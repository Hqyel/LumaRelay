import {
  ServerCapabilityFlagsSchema,
  type ServerSummary,
} from "@lumarelay/contracts";
import type { Kysely, Selectable } from "kysely";

import type { DatabaseSchema, ServersTable } from "./types.js";

export interface ServerStore {
  getCurrent(): Promise<ServerSummary | null>;
  getById?(serverId: string): Promise<ServerSummary | null>;
  select(server: ServerSummary): Promise<void>;
}

function toServerSummary(server: Selectable<ServersTable>): ServerSummary {
  return {
    baseUrl: server.baseUrl,
    capabilityFlags: ServerCapabilityFlagsSchema.parse(
      JSON.parse(server.capabilityFlagsJson),
    ),
    latencyMs: server.lastLatencyMs,
    name: server.name,
    serverId: server.id,
    supportsHttps: server.supportsHttps === 1,
    version: server.version,
  };
}

export function createServerStore(
  database: Kysely<DatabaseSchema>,
): ServerStore {
  return {
    async getById(serverId: string): Promise<ServerSummary | null> {
      const server = await database
        .selectFrom("servers")
        .selectAll()
        .where("id", "=", serverId)
        .executeTakeFirst();
      return server === undefined ? null : toServerSummary(server);
    },
    async getCurrent(): Promise<ServerSummary | null> {
      const server = await database
        .selectFrom("servers")
        .selectAll()
        .where("isActive", "=", 1)
        .executeTakeFirst();

      return server === undefined ? null : toServerSummary(server);
    },

    async select(server: ServerSummary): Promise<void> {
      await database.transaction().execute(async (transaction) => {
        const now = new Date().toISOString();

        await transaction.updateTable("servers").set({ isActive: 0 }).execute();
        await transaction
          .deleteFrom("servers")
          .where("baseUrl", "=", server.baseUrl)
          .where("id", "!=", server.serverId)
          .execute();
        await transaction
          .insertInto("servers")
          .values({
            baseUrl: server.baseUrl,
            capabilityFlagsJson: JSON.stringify(server.capabilityFlags),
            id: server.serverId,
            isActive: 1,
            lastLatencyMs: server.latencyMs,
            lastProbedAt: now,
            name: server.name,
            supportsHttps: server.supportsHttps ? 1 : 0,
            updatedAt: now,
            version: server.version,
          })
          .onConflict((conflict) =>
            conflict.column("id").doUpdateSet({
              baseUrl: server.baseUrl,
              capabilityFlagsJson: JSON.stringify(server.capabilityFlags),
              isActive: 1,
              lastLatencyMs: server.latencyMs,
              lastProbedAt: now,
              name: server.name,
              supportsHttps: server.supportsHttps ? 1 : 0,
              updatedAt: now,
              version: server.version,
            }),
          )
          .execute();
      });
    },
  };
}
