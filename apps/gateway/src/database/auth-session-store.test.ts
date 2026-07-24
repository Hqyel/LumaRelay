import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { createAuthSessionStore } from "./auth-session-store.js";
import { createDatabase } from "./database.js";
import { migrateToLatest } from "./migrator.js";
import { createServerStore } from "./server-store.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const path of temporaryDirectories.splice(0))
    rmSync(path, { force: true, recursive: true });
});

describe("Auth session store", () => {
  it("stores only a session hash and encrypted Emby token", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lumarelay-auth-session-"));
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
      const store = createAuthSessionStore(database, {
        sessionSecret: "test-session-secret-with-32-characters",
        tokenEncryptionKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      });
      const cookieToken = await store.create({
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

      const raw = await database
        .selectFrom("authSessions")
        .selectAll()
        .executeTakeFirstOrThrow();

      expect(raw.secretHash).not.toBe(cookieToken);
      expect(raw.accessTokenCiphertext).not.toContain("emby-secret-token");
      await expect(store.find(cookieToken)).resolves.toMatchObject({
        accessToken: "emby-secret-token",
        user: { userId: "user-1" },
      });
    } finally {
      await database.destroy();
    }
  });

  it("revokes damaged encrypted sessions instead of repeatedly throwing", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lumarelay-damaged-session-"));
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
      const store = createAuthSessionStore(database, {
        sessionSecret: "test-session-secret-with-32-characters",
        tokenEncryptionKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      });
      const cookieToken = await store.create({
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
      await database
        .updateTable("authSessions")
        .set({ accessTokenTag: "damaged" })
        .execute();

      await expect(store.find(cookieToken)).resolves.toBeNull();
      const stored = await database
        .selectFrom("authSessions")
        .select("revokedAt")
        .executeTakeFirstOrThrow();
      expect(stored.revokedAt).not.toBeNull();
    } finally {
      await database.destroy();
    }
  });

  it("revokes all server sessions and prunes inactive rows", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lumarelay-prune-session-"));
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
      const store = createAuthSessionStore(database, {
        sessionSecret: "test-session-secret-with-32-characters",
        tokenEncryptionKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      });
      const user = {
        name: "Alex",
        permissions: {
          canDownload: true,
          canManageServer: false,
          isAdministrator: false,
        },
        serverId: "server-1",
        userId: "user-1",
      };
      await store.create({ accessToken: "token-1", user });
      await store.create({ accessToken: "token-2", user });

      const revoked = await store.revokeServerSessions("server-1");
      expect(revoked.map((session) => session.accessToken)).toEqual([
        "token-1",
        "token-2",
      ]);
      await store.create({ accessToken: "expired-token", user });
      await database
        .updateTable("authSessions")
        .set({ expiresAt: "2000-01-01T00:00:00.000Z" })
        .where("revokedAt", "is", null)
        .execute();

      await expect(store.pruneInactive()).resolves.toBe(3);
      await expect(
        database.selectFrom("authSessions").selectAll().execute(),
      ).resolves.toEqual([]);
    } finally {
      await database.destroy();
    }
  });
});
