import type { Kysely, Migration } from "kysely";

import type { DatabaseSchema } from "../types.js";

export const AuthSessionsMigration: Migration = {
  async up(database: Kysely<DatabaseSchema>): Promise<void> {
    await database.schema
      .createTable("app_settings")
      .addColumn("key", "text", (column) => column.primaryKey())
      .addColumn("value", "text", (column) => column.notNull())
      .addColumn("updated_at", "text", (column) =>
        column.notNull().defaultTo(new Date().toISOString()),
      )
      .execute();

    await database.schema
      .createTable("auth_sessions")
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("secret_hash", "text", (column) => column.notNull().unique())
      .addColumn("server_id", "text", (column) =>
        column.notNull().references("servers.id").onDelete("cascade"),
      )
      .addColumn("emby_user_id", "text", (column) => column.notNull())
      .addColumn("user_name", "text", (column) => column.notNull())
      .addColumn("primary_image_tag", "text")
      .addColumn("permissions_json", "text", (column) => column.notNull())
      .addColumn("access_token_ciphertext", "text", (column) =>
        column.notNull(),
      )
      .addColumn("access_token_iv", "text", (column) => column.notNull())
      .addColumn("access_token_tag", "text", (column) => column.notNull())
      .addColumn("created_at", "text", (column) => column.notNull())
      .addColumn("last_seen_at", "text", (column) => column.notNull())
      .addColumn("expires_at", "text", (column) => column.notNull())
      .addColumn("revoked_at", "text")
      .execute();

    await database.schema
      .createIndex("auth_sessions_expires_at")
      .on("auth_sessions")
      .column("expires_at")
      .execute();
  },

  async down(database: Kysely<DatabaseSchema>): Promise<void> {
    await database.schema.dropTable("auth_sessions").ifExists().execute();
    await database.schema.dropTable("app_settings").ifExists().execute();
  },
};
