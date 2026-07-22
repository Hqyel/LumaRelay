import { sql, type Kysely, type Migration } from "kysely";

import type { DatabaseSchema } from "../types.js";

export const PlayTicketsMigration: Migration = {
  async up(database: Kysely<DatabaseSchema>): Promise<void> {
    await database.schema
      .createTable("play_tickets")
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("secret_hash", "text", (column) => column.notNull().unique())
      .addColumn("play_session_id", "text", (column) =>
        column.notNull().unique(),
      )
      .addColumn("auth_session_id", "text", (column) =>
        column.notNull().references("auth_sessions.id").onDelete("cascade"),
      )
      .addColumn("bridge_device_id", "text", (column) =>
        column.notNull().references("bridge_devices.id").onDelete("cascade"),
      )
      .addColumn("server_id", "text", (column) =>
        column.notNull().references("servers.id").onDelete("cascade"),
      )
      .addColumn("emby_user_id", "text", (column) => column.notNull())
      .addColumn("emby_item_id", "text", (column) => column.notNull())
      .addColumn("media_source_id", "text", (column) => column.notNull())
      .addColumn("resume_ticks", "integer", (column) => column.notNull())
      .addColumn("audio_stream_index", "integer")
      .addColumn("subtitle_stream_index", "integer")
      .addColumn("created_at", "text", (column) => column.notNull())
      .addColumn("expires_at", "text", (column) => column.notNull())
      .addColumn("redeemed_at", "text")
      .addCheckConstraint(
        "play_tickets_secret_hash",
        sql`length(secret_hash) = 64 and secret_hash not glob '*[^0-9a-f]*'`,
      )
      .addCheckConstraint(
        "play_tickets_media_ids",
        sql`length(trim(emby_item_id)) between 1 and 256 and length(trim(media_source_id)) between 1 and 256`,
      )
      .addCheckConstraint(
        "play_tickets_resume_ticks",
        sql`typeof(resume_ticks) = 'integer' and resume_ticks between 0 and 9007199254740991`,
      )
      .addCheckConstraint(
        "play_tickets_audio_stream_index",
        sql`audio_stream_index is null or (typeof(audio_stream_index) = 'integer' and audio_stream_index >= 0)`,
      )
      .addCheckConstraint(
        "play_tickets_subtitle_stream_index",
        sql`subtitle_stream_index is null or (typeof(subtitle_stream_index) = 'integer' and subtitle_stream_index >= 0)`,
      )
      .addCheckConstraint(
        "play_tickets_expiry_order",
        sql`unixepoch(created_at) is not null and unixepoch(expires_at) is not null and unixepoch(expires_at) > unixepoch(created_at) and unixepoch(expires_at) <= unixepoch(created_at) + 60`,
      )
      .addCheckConstraint(
        "play_tickets_redemption_order",
        sql`redeemed_at is null or (unixepoch(redeemed_at) is not null and unixepoch(redeemed_at) >= unixepoch(created_at) and unixepoch(redeemed_at) <= unixepoch(expires_at))`,
      )
      .execute();

    await database.schema
      .createIndex("play_tickets_expiry")
      .on("play_tickets")
      .column("expires_at")
      .execute();

    await database.schema
      .createIndex("play_tickets_binding")
      .on("play_tickets")
      .columns(["auth_session_id", "bridge_device_id"])
      .execute();
  },

  async down(database: Kysely<DatabaseSchema>): Promise<void> {
    await database.schema.dropTable("play_tickets").ifExists().execute();
  },
};
