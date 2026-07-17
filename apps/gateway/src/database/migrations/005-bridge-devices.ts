import type { Kysely, Migration } from "kysely";

import type { DatabaseSchema } from "../types.js";

export const BridgeDevicesMigration: Migration = {
  async up(database: Kysely<DatabaseSchema>): Promise<void> {
    await database.schema
      .createTable("bridge_devices")
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("credential_hash", "text", (column) =>
        column.notNull().unique(),
      )
      .addColumn("server_id", "text", (column) =>
        column.notNull().references("servers.id").onDelete("cascade"),
      )
      .addColumn("emby_user_id", "text", (column) => column.notNull())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("platform", "text", (column) => column.notNull())
      .addColumn("bridge_version", "text", (column) => column.notNull())
      .addColumn("created_at", "text", (column) => column.notNull())
      .addColumn("last_seen_at", "text", (column) => column.notNull())
      .addColumn("revoked_at", "text")
      .execute();

    await database.schema
      .createIndex("bridge_devices_owner")
      .on("bridge_devices")
      .columns(["server_id", "emby_user_id"])
      .execute();
  },

  async down(database: Kysely<DatabaseSchema>): Promise<void> {
    await database.schema.dropTable("bridge_devices").ifExists().execute();
  },
};
