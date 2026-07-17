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

export interface AppSettingsTable {
  key: string;
  updatedAt: Generated<string>;
  value: string;
}

export interface AuthSessionsTable {
  accessTokenCiphertext: string;
  accessTokenIv: string;
  accessTokenTag: string;
  createdAt: string;
  embyUserId: string;
  expiresAt: string;
  id: string;
  lastSeenAt: string;
  permissionsJson: string;
  primaryImageTag: string | null;
  revokedAt: string | null;
  secretHash: string;
  serverId: string;
  userName: string;
}

export interface BridgePairingCodesTable {
  authSessionId: string;
  codeHash: string;
  createdAt: string;
  expiresAt: string;
  id: string;
}

export interface DatabaseSchema {
  appSettings: AppSettingsTable;
  authSessions: AuthSessionsTable;
  bridgePairingCodes: BridgePairingCodesTable;
  servers: ServersTable;
}
