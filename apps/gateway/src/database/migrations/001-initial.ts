import type { Kysely, Migration } from "kysely";

import type { DatabaseSchema } from "../types.js";

export const InitialMigration: Migration = {
  async up(database: Kysely<DatabaseSchema>): Promise<void> {
    await database.schema
      .createTable("servers")
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("base_url", "text", (column) => column.notNull().unique())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("version", "text", (column) => column.notNull())
      .addColumn("capability_flags_json", "text", (column) =>
        column.notNull().defaultTo("{}"),
      )
      .addColumn("is_active", "integer", (column) =>
        column.notNull().defaultTo(0),
      )
      .addColumn("created_at", "text", (column) =>
        column.notNull().defaultTo(new Date().toISOString()),
      )
      .addColumn("updated_at", "text", (column) =>
        column.notNull().defaultTo(new Date().toISOString()),
      )
      .execute();

    await database.schema
      .createIndex("servers_one_active")
      .on("servers")
      .column("is_active")
      .unique()
      .where("is_active", "=", 1)
      .execute();
  },

  async down(database: Kysely<DatabaseSchema>): Promise<void> {
    await database.schema.dropIndex("servers_one_active").ifExists().execute();
    await database.schema.dropTable("servers").ifExists().execute();
  },
};
