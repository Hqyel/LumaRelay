import {
  Migrator,
  type Kysely,
  type Migration,
  type MigrationResultSet,
} from "kysely";

import { InitialMigration } from "./migrations/001-initial.js";
import type { DatabaseSchema } from "./types.js";

const migrations: Record<string, Migration> = {
  "001-initial": InitialMigration,
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
