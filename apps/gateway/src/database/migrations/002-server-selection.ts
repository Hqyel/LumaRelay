import type { Kysely, Migration } from "kysely";

import type { DatabaseSchema } from "../types.js";

export const ServerSelectionMigration: Migration = {
  async up(database: Kysely<DatabaseSchema>): Promise<void> {
    await database.schema
      .alterTable("servers")
      .addColumn("last_latency_ms", "integer", (column) =>
        column.notNull().defaultTo(0),
      )
      .execute();
    await database.schema
      .alterTable("servers")
      .addColumn("supports_https", "integer", (column) =>
        column.notNull().defaultTo(0),
      )
      .execute();
    await database.schema
      .alterTable("servers")
      .addColumn("last_probed_at", "text", (column) =>
        column.notNull().defaultTo(new Date().toISOString()),
      )
      .execute();
  },

  async down(database: Kysely<DatabaseSchema>): Promise<void> {
    await database.schema
      .alterTable("servers")
      .dropColumn("last_probed_at")
      .execute();
    await database.schema
      .alterTable("servers")
      .dropColumn("supports_https")
      .execute();
    await database.schema
      .alterTable("servers")
      .dropColumn("last_latency_ms")
      .execute();
  },
};
