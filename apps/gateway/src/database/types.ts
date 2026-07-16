import type { Generated } from "kysely";

export interface ServersTable {
  baseUrl: string;
  capabilityFlagsJson: Generated<string>;
  createdAt: Generated<string>;
  id: string;
  isActive: Generated<number>;
  lastLatencyMs: Generated<number>;
  lastProbedAt: Generated<string>;
  name: string;
  supportsHttps: Generated<number>;
  updatedAt: Generated<string>;
  version: string;
}

export interface DatabaseSchema {
  servers: ServersTable;
}
