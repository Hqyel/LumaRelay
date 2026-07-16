import type { Generated } from "kysely";

export interface ServersTable {
  baseUrl: string;
  capabilityFlagsJson: Generated<string>;
  createdAt: Generated<string>;
  id: string;
  isActive: Generated<number>;
  name: string;
  updatedAt: Generated<string>;
  version: string;
}

export interface DatabaseSchema {
  servers: ServersTable;
}
