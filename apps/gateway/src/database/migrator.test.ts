import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { sql } from "kysely";
import { afterEach, describe, expect, it } from "vitest";

import { createDatabase } from "./database.js";
import { migrateDown, migrateToLatest } from "./migrator.js";

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
      const removed = await sql<{ name: string }>`
        select name from sqlite_master where name = 'servers'
      `.execute(database);
      expect(removed.rows).toHaveLength(0);

      await migrateToLatest(database);
      const restored = await database
        .selectFrom("servers")
        .selectAll()
        .execute();
      expect(restored).toHaveLength(0);
    } finally {
      await database.destroy();
    }
  });
});
