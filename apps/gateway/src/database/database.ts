import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import BetterSqlite3 from "better-sqlite3";
import { CamelCasePlugin, Kysely, SqliteDialect } from "kysely";

import type { DatabaseSchema } from "./types.js";

export function createDatabase(path: string): Kysely<DatabaseSchema> {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

  const sqlite = new BetterSqlite3(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({ database: sqlite }),
    plugins: [new CamelCasePlugin()],
  });
}
