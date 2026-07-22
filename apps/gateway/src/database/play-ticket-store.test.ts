import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createAuthSessionStore } from "./auth-session-store.js";
import { createDatabase } from "./database.js";
import { migrateToLatest } from "./migrator.js";
import { createPlayTicketStore } from "./play-ticket-store.js";
import { createServerStore } from "./server-store.js";

const SESSION_SECRET = "test-session-secret-with-32-characters";
const TOKEN_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const DEVICE_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_DEVICE_ID = "99999999-9999-4999-8999-999999999999";
const TICKET_ID = "33333333-3333-4333-8333-333333333333";
const PLAY_SESSION_ID = "44444444-4444-4444-8444-444444444444";
const TICKET_SECRET = "C".repeat(43);
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const path of temporaryDirectories.splice(0))
    rmSync(path, { force: true, recursive: true });
});

async function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), "newemby-play-ticket-store-"));
  temporaryDirectories.push(directory);
  const database = createDatabase(join(directory, "test.db"));
  await migrateToLatest(database);
  await createServerStore(database).select({
    baseUrl: "https://emby.example.com/",
    capabilityFlags: { ping: true, publicInfo: true },
    latencyMs: 20,
    name: "Home Emby",
    serverId: "server-1",
    supportsHttps: true,
    version: "4.8.11.0",
  });

  const authStore = createAuthSessionStore(database, {
    sessionSecret: SESSION_SECRET,
    tokenEncryptionKey: TOKEN_ENCRYPTION_KEY,
  });
  const cookie = await authStore.create({
    accessToken: "upstream-secret-token",
    user: {
      name: "Alex",
      permissions: {
        canDownload: true,
        canManageServer: false,
        isAdministrator: false,
      },
      serverId: "server-1",
      userId: "user-1",
    },
  });
  const session = await authStore.find(cookie);
  if (session === null) throw new Error("Test auth session was not created");

  for (const id of [DEVICE_ID, OTHER_DEVICE_ID]) {
    await database
      .insertInto("bridgeDevices")
      .values({
        bridgeVersion: "0.1.0",
        createdAt: "2026-07-22T12:00:00.000Z",
        credentialHash: id === DEVICE_ID ? "d".repeat(64) : "e".repeat(64),
        embyUserId: id === DEVICE_ID ? "user-1" : "user-2",
        id,
        lastSeenAt: "2026-07-22T12:00:00.000Z",
        name: id === DEVICE_ID ? "Living Room PC" : "Office PC",
        platform: "windows",
        revokedAt: null,
        serverId: "server-1",
      })
      .execute();
  }

  let currentTime = new Date("2026-07-22T12:00:00.000Z");
  const ids = [TICKET_ID, PLAY_SESSION_ID];
  const store = createPlayTicketStore(
    database,
    { sessionSecret: SESSION_SECRET },
    () => currentTime,
    {
      id: () => ids.shift() ?? crypto.randomUUID(),
      secret: () => TICKET_SECRET,
    },
  );

  return {
    authStore,
    database,
    issue: () =>
      store.issue({
        authSessionId: session.sessionId,
        bridgeDeviceId: DEVICE_ID,
        selection: {
          audioStreamIndex: 1,
          displayTitle: "示例电影",
          itemId: "item-1",
          mediaSourceId: "source-1",
          resumeTicks: 600_000_000,
          subtitleStreamIndex: null,
        },
        serverId: "server-1",
        userId: "user-1",
      }),
    session,
    setTime: (value: string) => {
      currentTime = new Date(value);
    },
    store,
  };
}

describe("PlayTicket store", () => {
  it("issues a 60-second ticket and persists only its secret hash", async () => {
    const fixture = await createFixture();
    try {
      const issued = await fixture.issue();
      expect(issued).toEqual({
        expiresAt: "2026-07-22T12:01:00.000Z",
        playSessionId: PLAY_SESSION_ID,
        playTicket: `pt1.${TICKET_ID}.${TICKET_SECRET}`,
      });

      const raw = await fixture.database
        .selectFrom("playTickets")
        .selectAll()
        .executeTakeFirstOrThrow();
      expect(raw.authSessionId).toBe(fixture.session.sessionId);
      expect(raw.bridgeDeviceId).toBe(DEVICE_ID);
      expect(raw.secretHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(raw)).not.toContain(TICKET_SECRET);
      expect(JSON.stringify(raw)).not.toContain("upstream-secret-token");
    } finally {
      await fixture.database.destroy();
    }
  });

  it("refuses to issue for a device outside the authenticated binding", async () => {
    const fixture = await createFixture();
    try {
      await expect(
        fixture.store.issue({
          authSessionId: fixture.session.sessionId,
          bridgeDeviceId: OTHER_DEVICE_ID,
          selection: {
            audioStreamIndex: null,
            displayTitle: "示例电影",
            itemId: "item-1",
            mediaSourceId: "source-1",
            resumeTicks: 0,
            subtitleStreamIndex: null,
          },
          serverId: "server-1",
          userId: "user-1",
        }),
      ).resolves.toBeNull();
    } finally {
      await fixture.database.destroy();
    }
  });

  it("redeems exactly once under concurrent attempts", async () => {
    const fixture = await createFixture();
    try {
      const issued = await fixture.issue();
      if (issued === null) throw new Error("Ticket was not issued");
      fixture.setTime("2026-07-22T12:00:30.000Z");

      const results = await Promise.all([
        fixture.store.redeem(issued.playTicket, DEVICE_ID),
        fixture.store.redeem(issued.playTicket, DEVICE_ID),
      ]);
      expect(results.filter((result) => result !== null)).toHaveLength(1);
      expect(results.filter((result) => result === null)).toHaveLength(1);
      expect(results.find((result) => result !== null)).toMatchObject({
        playSessionId: PLAY_SESSION_ID,
        selection: { itemId: "item-1", resumeTicks: 600_000_000 },
      });
    } finally {
      await fixture.database.destroy();
    }
  });

  it("does not consume a ticket on a wrong secret or another device", async () => {
    const fixture = await createFixture();
    try {
      const issued = await fixture.issue();
      if (issued === null) throw new Error("Ticket was not issued");
      const wrongSecret = `pt1.${TICKET_ID}.${"W".repeat(43)}`;

      await expect(
        fixture.store.redeem(issued.playTicket, OTHER_DEVICE_ID),
      ).resolves.toBeNull();
      await expect(
        fixture.store.redeem(wrongSecret, DEVICE_ID),
      ).resolves.toBeNull();
      await expect(
        fixture.store.redeem(issued.playTicket, DEVICE_ID),
      ).resolves.toMatchObject({ playSessionId: PLAY_SESSION_ID });
    } finally {
      await fixture.database.destroy();
    }
  });

  it("rejects expiration and revoked login sessions", async () => {
    const expired = await createFixture();
    try {
      const issued = await expired.issue();
      if (issued === null) throw new Error("Ticket was not issued");
      expired.setTime("2026-07-22T12:01:00.000Z");
      await expect(
        expired.store.redeem(issued.playTicket, DEVICE_ID),
      ).resolves.toBeNull();
    } finally {
      await expired.database.destroy();
    }

    const revoked = await createFixture();
    try {
      const issued = await revoked.issue();
      if (issued === null) throw new Error("Ticket was not issued");
      await revoked.database
        .updateTable("authSessions")
        .set({ revokedAt: "2026-07-22T12:00:10.000Z" })
        .where("id", "=", revoked.session.sessionId)
        .execute();
      revoked.setTime("2026-07-22T12:00:20.000Z");
      await expect(
        revoked.store.redeem(issued.playTicket, DEVICE_ID),
      ).resolves.toBeNull();
    } finally {
      await revoked.database.destroy();
    }
  });

  it("retains redemption state until the ticket expires, then prunes it", async () => {
    const fixture = await createFixture();
    try {
      const issued = await fixture.issue();
      if (issued === null) throw new Error("Ticket was not issued");
      await fixture.store.redeem(issued.playTicket, DEVICE_ID);
      await expect(fixture.store.pruneInactive()).resolves.toBe(0);
      fixture.setTime("2026-07-22T12:01:00.000Z");
      await expect(fixture.store.pruneInactive()).resolves.toBe(1);
    } finally {
      await fixture.database.destroy();
    }
  });

  it("claims, completes, deduplicates, and orders playback events", async () => {
    const fixture = await createFixture();
    try {
      const issued = await fixture.issue();
      if (issued === null) throw new Error("Ticket was not issued");
      await fixture.store.redeem(issued.playTicket, DEVICE_ID);
      const fingerprint = "a".repeat(64);
      const claim = {
        bridgeDeviceId: DEVICE_ID,
        eventType: "playing" as const,
        fingerprint,
        playSessionId: PLAY_SESSION_ID,
        sequence: 1,
      };

      await expect(fixture.store.claimPlaybackEvent!(claim)).resolves.toBe(
        "claimed",
      );
      await expect(fixture.store.claimPlaybackEvent!(claim)).resolves.toBe(
        "pending",
      );
      await fixture.store.completePlaybackEvent!({
        completedAt: "2026-07-22T12:00:31.000Z",
        eventType: "playing",
        fingerprint,
        playSessionId: PLAY_SESSION_ID,
        positionTicks: 600_000_000,
        sequence: 1,
      });

      await expect(fixture.store.claimPlaybackEvent!(claim)).resolves.toBe(
        "duplicate",
      );
      await expect(
        fixture.store.claimPlaybackEvent!({
          ...claim,
          fingerprint: "b".repeat(64),
        }),
      ).resolves.toBe("conflict");
      await expect(
        fixture.store.claimPlaybackEvent!({ ...claim, sequence: 3 }),
      ).resolves.toBe("out-of-order");

      const playback = await fixture.database
        .selectFrom("playbackSessions")
        .select(["lastPositionTicks", "lastSequence", "startedAt"])
        .where("id", "=", PLAY_SESSION_ID)
        .executeTakeFirstOrThrow();
      expect(playback).toEqual({
        lastPositionTicks: 600_000_000,
        lastSequence: 1,
        startedAt: "2026-07-22T12:00:31.000Z",
      });
    } finally {
      await fixture.database.destroy();
    }
  });

  it("releases a failed pending event for an identical retry", async () => {
    const fixture = await createFixture();
    try {
      const issued = await fixture.issue();
      if (issued === null) throw new Error("Ticket was not issued");
      await fixture.store.redeem(issued.playTicket, DEVICE_ID);
      const fingerprint = "c".repeat(64);
      const claim = {
        bridgeDeviceId: DEVICE_ID,
        eventType: "playing" as const,
        fingerprint,
        playSessionId: PLAY_SESSION_ID,
        sequence: 1,
      };
      await expect(fixture.store.claimPlaybackEvent!(claim)).resolves.toBe(
        "claimed",
      );

      await fixture.store.releasePlaybackEvent!(
        PLAY_SESSION_ID,
        1,
        fingerprint,
      );

      await expect(fixture.store.claimPlaybackEvent!(claim)).resolves.toBe(
        "claimed",
      );
    } finally {
      await fixture.database.destroy();
    }
  });
});
