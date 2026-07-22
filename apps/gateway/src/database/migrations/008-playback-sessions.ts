import { sql, type Kysely, type Migration } from "kysely";

import type { DatabaseSchema } from "../types.js";

export const PlaybackSessionsMigration: Migration = {
  async up(database: Kysely<DatabaseSchema>): Promise<void> {
    await database.schema
      .createTable("playback_sessions")
      .addColumn("id", "text", (column) => column.primaryKey())
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
      .addColumn("started_at", "text")
      .addColumn("stopped_at", "text")
      .addColumn("last_sequence", "integer", (column) =>
        column.notNull().defaultTo(0),
      )
      .addColumn("last_position_ticks", "integer", (column) =>
        column.notNull().defaultTo(0),
      )
      .addColumn("last_event_at", "text")
      .addCheckConstraint(
        "playback_sessions_ticks",
        sql`typeof(resume_ticks) = 'integer' and resume_ticks between 0 and 9007199254740991 and typeof(last_position_ticks) = 'integer' and last_position_ticks between 0 and 9007199254740991`,
      )
      .addCheckConstraint(
        "playback_sessions_sequence",
        sql`typeof(last_sequence) = 'integer' and last_sequence >= 0`,
      )
      .execute();

    await database.schema
      .createIndex("playback_sessions_device")
      .on("playback_sessions")
      .columns(["bridge_device_id", "created_at"])
      .execute();
  },

  async down(database: Kysely<DatabaseSchema>): Promise<void> {
    await database.schema.dropTable("playback_sessions").ifExists().execute();
  },
};
