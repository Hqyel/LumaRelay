import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createDatabase } from "./database.js";
import { migrateToLatest } from "./migrator.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const path of temporaryDirectories.splice(0))
    rmSync(path, { force: true, recursive: true });
});

async function createTicketDatabase() {
  const directory = mkdtempSync(join(tmpdir(), "newemby-play-ticket-"));
  temporaryDirectories.push(directory);
  const database = createDatabase(join(directory, "test.db"));
  await migrateToLatest(database);

  await database
    .insertInto("servers")
    .values({
      baseUrl: "https://emby.example.com/",
      id: "server-1",
      isActive: 1,
      name: "Home Emby",
      version: "4.8.11.0",
    })
    .execute();
  await database
    .insertInto("authSessions")
    .values({
      accessTokenCiphertext: "ciphertext",
      accessTokenIv: "iv",
      accessTokenTag: "tag",
      createdAt: "2026-07-22T08:00:00.000Z",
      embyUserId: "user-1",
      expiresAt: "2026-07-29T08:00:00.000Z",
      id: "11111111-1111-4111-8111-111111111111",
      lastSeenAt: "2026-07-22T08:00:00.000Z",
      permissionsJson: "{}",
      primaryImageTag: null,
      revokedAt: null,
      secretHash: "a".repeat(64),
      serverId: "server-1",
      userName: "Test User",
    })
    .execute();
  await database
    .insertInto("bridgeDevices")
    .values({
      bridgeVersion: "0.1.0",
      createdAt: "2026-07-22T08:00:00.000Z",
      credentialHash: "b".repeat(64),
      embyUserId: "user-1",
      id: "22222222-2222-4222-8222-222222222222",
      lastSeenAt: "2026-07-22T08:00:00.000Z",
      name: "Living Room PC",
      platform: "windows",
      revokedAt: null,
      serverId: "server-1",
    })
    .execute();

  return database;
}

function ticketValues() {
  return {
    audioStreamIndex: 1,
    authSessionId: "11111111-1111-4111-8111-111111111111",
    bridgeDeviceId: "22222222-2222-4222-8222-222222222222",
    createdAt: "2026-07-22T08:00:00.000Z",
    embyItemId: "item-1",
    embyUserId: "user-1",
    expiresAt: "2026-07-22T08:01:00.000Z",
    id: "33333333-3333-4333-8333-333333333333",
    mediaSourceId: "source-1",
    playSessionId: "44444444-4444-4444-8444-444444444444",
    redeemedAt: null,
    resumeTicks: 600_000_000,
    secretHash: "c".repeat(64),
    serverId: "server-1",
    subtitleStreamIndex: null,
  };
}

describe("PlayTicket data model", () => {
  it("persists only the ticket secret hash and all playback bindings", async () => {
    const database = await createTicketDatabase();
    try {
      await database.insertInto("playTickets").values(ticketValues()).execute();

      const ticket = await database
        .selectFrom("playTickets")
        .selectAll()
        .executeTakeFirstOrThrow();
      expect(ticket).toMatchObject({
        authSessionId: "11111111-1111-4111-8111-111111111111",
        bridgeDeviceId: "22222222-2222-4222-8222-222222222222",
        embyItemId: "item-1",
        mediaSourceId: "source-1",
        playSessionId: "44444444-4444-4444-8444-444444444444",
        redeemedAt: null,
        resumeTicks: 600_000_000,
        secretHash: "c".repeat(64),
        serverId: "server-1",
      });
      expect(ticket).not.toHaveProperty("secret");
      expect(ticket).not.toHaveProperty("accessToken");
    } finally {
      await database.destroy();
    }
  });

  it.each([
    ["negative resume Ticks", { resumeTicks: -1 }],
    ["fractional resume Ticks", { resumeTicks: 1.5 }],
    [
      "resume Ticks outside the JavaScript safe range",
      { resumeTicks: Number.MAX_SAFE_INTEGER + 1 },
    ],
    ["negative audio stream", { audioStreamIndex: -1 }],
    ["fractional subtitle stream", { subtitleStreamIndex: 1.5 }],
    ["empty media source", { mediaSourceId: " " }],
    ["lifetime beyond 60 seconds", { expiresAt: "2026-07-22T08:01:01.000Z" }],
    ["invalid expiry timestamp", { expiresAt: "not-a-date" }],
    ["invalid redemption timestamp", { redeemedAt: "not-a-date" }],
    ["invalid hash", { secretHash: "plaintext-ticket" }],
  ])("rejects %s", async (_name, override) => {
    const database = await createTicketDatabase();
    try {
      await expect(
        database
          .insertInto("playTickets")
          .values({ ...ticketValues(), ...override })
          .execute(),
      ).rejects.toThrow();
    } finally {
      await database.destroy();
    }
  });

  it("enforces unique ticket secrets and play session IDs", async () => {
    const database = await createTicketDatabase();
    try {
      await database.insertInto("playTickets").values(ticketValues()).execute();
      await expect(
        database
          .insertInto("playTickets")
          .values({
            ...ticketValues(),
            id: "55555555-5555-4555-8555-555555555555",
          })
          .execute(),
      ).rejects.toThrow();
    } finally {
      await database.destroy();
    }
  });
});
