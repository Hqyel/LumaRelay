import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import BetterSqlite3 from "better-sqlite3";
import { CamelCasePlugin, Kysely, SqliteDialect } from "kysely";

import type { DatabaseSchema } from "./types.js";

const BACKUP_LIMIT = 5;
const databaseHandles = new WeakMap<
  Kysely<DatabaseSchema>,
  { path: string; sqlite: BetterSqlite3.Database }
>();

export function createDatabase(path: string): Kysely<DatabaseSchema> {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

  const sqlite = new BetterSqlite3(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const database = new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({ database: sqlite }),
    plugins: [new CamelCasePlugin()],
  });

  databaseHandles.set(database, { path, sqlite });
  return database;
}

function backupDirectory(path: string): string {
  return `${path}.backups`;
}

function pruneBackups(path: string): void {
  const directory = backupDirectory(path);
  const backups = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sqlite"))
    .map((entry) => ({
      name: entry.name,
      modifiedAt: statSync(join(directory, entry.name)).mtimeMs,
    }))
    .sort((left, right) => right.modifiedAt - left.modifiedAt);

  for (const backup of backups.slice(BACKUP_LIMIT))
    unlinkSync(join(directory, backup.name));
}

export async function backupDatabase(
  database: Kysely<DatabaseSchema>,
): Promise<string | undefined> {
  const handle = databaseHandles.get(database);
  if (!handle || handle.path === ":memory:") return undefined;

  const directory = backupDirectory(handle.path);
  mkdirSync(directory, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const destination = join(
    directory,
    `${basename(handle.path)}.${timestamp}.${randomUUID()}.sqlite`,
  );

  await handle.sqlite.backup(destination);
  pruneBackups(handle.path);
  return destination;
}
