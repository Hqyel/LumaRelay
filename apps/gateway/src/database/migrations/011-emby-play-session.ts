import type { Migration } from "kysely";

export const EmbyPlaySessionMigration: Migration = {
  async down(database) {
    await database.schema
      .alterTable("playback_sessions")
      .dropColumn("emby_play_session_id")
      .execute();
  },
  async up(database) {
    await database.schema
      .alterTable("playback_sessions")
      .addColumn("emby_play_session_id", "text")
      .execute();
  },
};
