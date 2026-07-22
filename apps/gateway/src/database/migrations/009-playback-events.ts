import { sql, type Kysely, type Migration } from "kysely";

import type { DatabaseSchema } from "../types.js";

export const PlaybackEventsMigration: Migration = {
  async up(database: Kysely<DatabaseSchema>): Promise<void> {
    await database.schema
      .createTable("playback_events")
      .addColumn("play_session_id", "text", (column) =>
        column.notNull().references("playback_sessions.id").onDelete("cascade"),
      )
      .addColumn("sequence", "integer", (column) => column.notNull())
      .addColumn("fingerprint", "text", (column) => column.notNull())
      .addColumn("status", "text", (column) => column.notNull())
      .addColumn("created_at", "text", (column) => column.notNull())
      .addColumn("completed_at", "text")
      .addPrimaryKeyConstraint("playback_events_primary", [
        "play_session_id",
        "sequence",
      ])
      .addCheckConstraint(
        "playback_events_sequence",
        sql`typeof(sequence) = 'integer' and sequence > 0`,
      )
      .addCheckConstraint(
        "playback_events_fingerprint",
        sql`length(fingerprint) = 64 and fingerprint not glob '*[^0-9a-f]*'`,
      )
      .addCheckConstraint(
        "playback_events_status",
        sql`status in ('pending', 'complete')`,
      )
      .execute();
  },

  async down(database: Kysely<DatabaseSchema>): Promise<void> {
    await database.schema.dropTable("playback_events").ifExists().execute();
  },
};
