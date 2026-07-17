import type { Kysely, Migration } from "kysely";

import type { DatabaseSchema } from "../types.js";

export const BridgeRequestNoncesMigration: Migration = {
  async up(database: Kysely<DatabaseSchema>): Promise<void> {
    await database.schema
      .createTable("bridge_request_nonces")
      .addColumn("device_id", "text", (column) =>
        column.notNull().references("bridge_devices.id").onDelete("cascade"),
      )
      .addColumn("nonce_hash", "text", (column) => column.notNull())
      .addColumn("expires_at", "text", (column) => column.notNull())
      .addPrimaryKeyConstraint("bridge_request_nonces_primary", [
        "device_id",
        "nonce_hash",
      ])
      .execute();

    await database.schema
      .createIndex("bridge_request_nonces_expires_at")
      .on("bridge_request_nonces")
      .column("expires_at")
      .execute();
  },

  async down(database: Kysely<DatabaseSchema>): Promise<void> {
    await database.schema
      .dropTable("bridge_request_nonces")
      .ifExists()
      .execute();
  },
};
