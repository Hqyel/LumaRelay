import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { createDatabase } from "./database.js";
import { migrateDown, migrateToLatest } from "./migrator.js";
import { createServerStore } from "./server-store.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const path of temporaryDirectories.splice(0))
    rmSync(path, { force: true, recursive: true });
});

describe("SQLite migrations", () => {
  it("can migrate up, down and up again", async () => {
    const directory = mkdtempSync(join(tmpdir(), "newemby-migration-"));
    temporaryDirectories.push(directory);
    const database = createDatabase(join(directory, "test.db"));

    try {
      await migrateToLatest(database);
      await database
        .insertInto("servers")
        .values({
          id: "server-1",
          baseUrl: "https://emby.example.com/",
          name: "Home Emby",
          version: "4.8.11.0",
          isActive: 1,
        })
        .execute();

      const server = await database
        .selectFrom("servers")
        .selectAll()
        .executeTakeFirstOrThrow();
      expect(server.id).toBe("server-1");

      await migrateDown(database);
      const rolledBack = await database
        .selectFrom("servers")
        .select(["id", "name"])
        .executeTakeFirstOrThrow();
      expect(rolledBack.id).toBe("server-1");

      await migrateToLatest(database);
      const restored = await database
        .selectFrom("servers")
        .selectAll()
        .executeTakeFirstOrThrow();
      expect(restored.lastLatencyMs).toBe(0);
    } finally {
      await database.destroy();
    }
  });

  it("persists the selected server", async () => {
    const directory = mkdtempSync(join(tmpdir(), "newemby-server-store-"));
    temporaryDirectories.push(directory);
    const database = createDatabase(join(directory, "test.db"));

    try {
      await migrateToLatest(database);
      const store = createServerStore(database);
      await store.select({
        baseUrl: "https://emby.example.com/",
        capabilityFlags: {
          imageProcessing: true,
          ping: true,
          publicInfo: true,
          publicUsers: false,
          userAuthentication: true,
          userItems: true,
          userViews: true,
        },
        latencyMs: 23,
        name: "Home Emby",
        serverId: "server-1",
        supportsHttps: true,
        version: "4.8.11.0",
      });

      await expect(store.getCurrent()).resolves.toMatchObject({
        capabilityFlags: {
          imageProcessing: true,
          publicUsers: false,
          userItems: true,
        },
        latencyMs: 23,
        serverId: "server-1",
        supportsHttps: true,
        version: "4.8.11.0",
      });
    } finally {
      await database.destroy();
    }
  });
});
