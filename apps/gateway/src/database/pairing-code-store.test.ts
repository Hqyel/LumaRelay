import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createAuthSessionStore } from "./auth-session-store.js";
import { createDatabase } from "./database.js";
import { migrateToLatest } from "./migrator.js";
import { createPairingCodeStore } from "./pairing-code-store.js";
import { createServerStore } from "./server-store.js";

const LUMARELAY_SESSION_SECRET = "test-session-secret-with-32-characters";
const LUMARELAY_TOKEN_ENCRYPTION_KEY =
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const path of temporaryDirectories.splice(0))
    rmSync(path, { force: true, recursive: true });
});

describe("Bridge pairing code store", () => {
  it("stores only a hash bound to the current auth session", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lumarelay-pairing-code-"));
    temporaryDirectories.push(directory);
    const database = createDatabase(join(directory, "test.db"));

    try {
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
        sessionSecret: LUMARELAY_SESSION_SECRET,
        tokenEncryptionKey: LUMARELAY_TOKEN_ENCRYPTION_KEY,
      });
      const cookieToken = await authStore.create({
        accessToken: "emby-secret-token",
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
      const session = await authStore.find(cookieToken);
      expect(session).not.toBeNull();

      const currentTime = new Date("2026-07-17T12:00:00.000Z");
      const store = createPairingCodeStore(
        database,
        { sessionSecret: LUMARELAY_SESSION_SECRET },
        () => currentTime,
      );
      const issued = await store.issue(session!.sessionId);
      const raw = await database
        .selectFrom("bridgePairingCodes")
        .selectAll()
        .executeTakeFirstOrThrow();

      expect(issued.pairingCode).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(issued.expiresAt).toBe("2026-07-17T12:01:00.000Z");
      expect(raw.authSessionId).toBe(session!.sessionId);
      expect(raw.codeHash).not.toBe(issued.pairingCode);
      expect(JSON.stringify(raw)).not.toContain(issued.pairingCode);
    } finally {
      await database.destroy();
    }
  });

  it("replaces an earlier session code and prunes it after 60 seconds", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lumarelay-pairing-expiry-"));
    temporaryDirectories.push(directory);
    const database = createDatabase(join(directory, "test.db"));

    try {
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
        sessionSecret: LUMARELAY_SESSION_SECRET,
        tokenEncryptionKey: LUMARELAY_TOKEN_ENCRYPTION_KEY,
      });
      const cookieToken = await authStore.create({
        accessToken: "emby-secret-token",
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
      const session = await authStore.find(cookieToken);
      expect(session).not.toBeNull();

      let currentTime = new Date("2026-07-17T12:00:00.000Z");
      const store = createPairingCodeStore(
        database,
        { sessionSecret: LUMARELAY_SESSION_SECRET },
        () => currentTime,
      );
      const first = await store.issue(session!.sessionId);
      const second = await store.issue(session!.sessionId);

      expect(second.pairingCode).not.toBe(first.pairingCode);
      await expect(
        database.selectFrom("bridgePairingCodes").selectAll().execute(),
      ).resolves.toHaveLength(1);

      currentTime = new Date("2026-07-17T12:01:00.000Z");
      await expect(store.pruneExpired()).resolves.toBe(1);
      await expect(
        database.selectFrom("bridgePairingCodes").selectAll().execute(),
      ).resolves.toEqual([]);
    } finally {
      await database.destroy();
    }
  });

  it("atomically exchanges a live code for a hashed device credential", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lumarelay-pairing-redeem-"));
    temporaryDirectories.push(directory);
    const database = createDatabase(join(directory, "test.db"));

    try {
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
        sessionSecret: LUMARELAY_SESSION_SECRET,
        tokenEncryptionKey: LUMARELAY_TOKEN_ENCRYPTION_KEY,
      });
      const cookieToken = await authStore.create({
        accessToken: "emby-secret-token",
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
      const session = await authStore.find(cookieToken);
      expect(session).not.toBeNull();

      let currentTime = new Date("2026-07-17T12:00:00.000Z");
      const store = createPairingCodeStore(
        database,
        { sessionSecret: LUMARELAY_SESSION_SECRET },
        () => currentTime,
      );
      const issued = await store.issue(session!.sessionId);
      const request = {
        bridgeVersion: "0.1.0",
        deviceName: "Living Room PC",
        pairingCode: issued.pairingCode,
        platform: "windows" as const,
      };
      const redeemed = await store.redeem(request);

      expect(redeemed).toMatchObject({
        device: {
          bridgeVersion: "0.1.0",
          name: "Living Room PC",
          platform: "windows",
        },
      });
      expect(redeemed?.deviceCredential).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const raw = await database
        .selectFrom("bridgeDevices")
        .selectAll()
        .executeTakeFirstOrThrow();
      expect(raw.serverId).toBe("server-1");
      expect(raw.embyUserId).toBe("user-1");
      expect(raw.credentialHash).not.toBe(redeemed?.deviceCredential);
      expect(JSON.stringify(raw)).not.toContain(redeemed?.deviceCredential);
      await expect(store.redeem(request)).resolves.toBeNull();

      const expiring = await store.issue(session!.sessionId);
      currentTime = new Date("2026-07-17T12:01:00.000Z");
      await expect(
        store.redeem({ ...request, pairingCode: expiring.pairingCode }),
      ).resolves.toBeNull();
    } finally {
      await database.destroy();
    }
  });
});
