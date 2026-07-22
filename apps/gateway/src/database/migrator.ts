import {
  Migrator,
  type Kysely,
  type Migration,
  type MigrationResultSet,
} from "kysely";

import { InitialMigration } from "./migrations/001-initial.js";
import { ServerSelectionMigration } from "./migrations/002-server-selection.js";
import { AuthSessionsMigration } from "./migrations/003-auth-sessions.js";
import { BridgePairingCodesMigration } from "./migrations/004-bridge-pairing-codes.js";
import { BridgeDevicesMigration } from "./migrations/005-bridge-devices.js";
import { BridgeRequestNoncesMigration } from "./migrations/006-bridge-request-nonces.js";
import { PlayTicketsMigration } from "./migrations/007-play-tickets.js";
import { backupDatabase } from "./database.js";
import type { DatabaseSchema } from "./types.js";

const migrations: Record<string, Migration> = {
  "001-initial": InitialMigration,
  "002-server-selection": ServerSelectionMigration,
  "003-auth-sessions": AuthSessionsMigration,
  "004-bridge-pairing-codes": BridgePairingCodesMigration,
  "005-bridge-devices": BridgeDevicesMigration,
  "006-bridge-request-nonces": BridgeRequestNoncesMigration,
  "007-play-tickets": PlayTicketsMigration,
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

async function hasMigration(
  migrator: Migrator,
  state: "executed" | "pending",
): Promise<boolean> {
  const migrationInfo = await migrator.getMigrations();
  return migrationInfo.some((migration) =>
    state === "executed"
      ? migration.executedAt !== undefined
      : migration.executedAt === undefined,
  );
}

export async function migrateToLatest(
  database: Kysely<DatabaseSchema>,
): Promise<void> {
  const migrator = createMigrator(database);
  if (!(await hasMigration(migrator, "pending"))) return;

  await backupDatabase(database);
  const result = await migrator.migrateToLatest();
  assertMigrationResult(result);
}

export async function migrateDown(
  database: Kysely<DatabaseSchema>,
): Promise<void> {
  const migrator = createMigrator(database);
  if (!(await hasMigration(migrator, "executed"))) return;

  await backupDatabase(database);
  const result = await migrator.migrateDown();
  assertMigrationResult(result);
}
