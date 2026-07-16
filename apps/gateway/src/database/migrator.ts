import {
  Migrator,
  type Kysely,
  type Migration,
  type MigrationResultSet,
} from "kysely";

import { InitialMigration } from "./migrations/001-initial.js";
import { ServerSelectionMigration } from "./migrations/002-server-selection.js";
import { AuthSessionsMigration } from "./migrations/003-auth-sessions.js";
import type { DatabaseSchema } from "./types.js";

const migrations: Record<string, Migration> = {
  "001-initial": InitialMigration,
  "002-server-selection": ServerSelectionMigration,
  "003-auth-sessions": AuthSessionsMigration,
};

function createMigrator(database: Kysely<DatabaseSchema>): Migrator {
  return new Migrator({
    db: database,
    provider: {
      async getMigrations(): Promise<Record<string, Migration>> {
        return migrations;
      },
    },
  });
}

function assertMigrationResult(result: MigrationResultSet): void {
  if (result.error !== undefined) throw result.error;
}

export async function migrateToLatest(
  database: Kysely<DatabaseSchema>,
): Promise<void> {
  const result = await createMigrator(database).migrateToLatest();
  assertMigrationResult(result);
}

export async function migrateDown(
  database: Kysely<DatabaseSchema>,
): Promise<void> {
  const result = await createMigrator(database).migrateDown();
  assertMigrationResult(result);
}
