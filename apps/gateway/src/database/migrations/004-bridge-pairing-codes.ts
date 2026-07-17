import type { Kysely, Migration } from "kysely";

import type { DatabaseSchema } from "../types.js";

export const BridgePairingCodesMigration: Migration = {
  async up(database: Kysely<DatabaseSchema>): Promise<void> {
    await database.schema
      .createTable("bridge_pairing_codes")
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("code_hash", "text", (column) => column.notNull().unique())
      .addColumn("auth_session_id", "text", (column) =>
        column.notNull().references("auth_sessions.id").onDelete("cascade"),
      )
      .addColumn("created_at", "text", (column) => column.notNull())
      .addColumn("expires_at", "text", (column) => column.notNull())
      .execute();

    await database.schema
      .createIndex("bridge_pairing_codes_auth_session_id")
      .on("bridge_pairing_codes")
      .column("auth_session_id")
      .execute();
    await database.schema
      .createIndex("bridge_pairing_codes_expires_at")
      .on("bridge_pairing_codes")
      .column("expires_at")
      .execute();
  },

  async down(database: Kysely<DatabaseSchema>): Promise<void> {
    await database.schema
      .dropTable("bridge_pairing_codes")
      .ifExists()
      .execute();
  },
};
