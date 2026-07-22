import type { Migration } from "kysely";

export const PlaybackDisplayTitleMigration: Migration = {
  async down(database) {
    await database.schema
      .alterTable("playback_sessions")
      .dropColumn("display_title")
      .execute();
    await database.schema
      .alterTable("play_tickets")
      .dropColumn("display_title")
      .execute();
  },
  async up(database) {
    await database.schema
      .alterTable("play_tickets")
      .addColumn("display_title", "text", (column) =>
        column.notNull().defaultTo("NewEmby"),
      )
      .execute();
    await database.schema
      .alterTable("playback_sessions")
      .addColumn("display_title", "text", (column) =>
        column.notNull().defaultTo("NewEmby"),
      )
      .execute();
  },
};
