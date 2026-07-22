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

export interface BridgeDevicesTable {
  bridgeVersion: string;
  createdAt: string;
  credentialHash: string;
  embyUserId: string;
  id: string;
  lastSeenAt: string;
  name: string;
  platform: string;
  revokedAt: string | null;
  serverId: string;
}

export interface BridgeRequestNoncesTable {
  deviceId: string;
  expiresAt: string;
  nonceHash: string;
}

export interface PlayTicketsTable {
  audioStreamIndex: number | null;
  authSessionId: string;
  bridgeDeviceId: string;
  createdAt: string;
  embyItemId: string;
  embyUserId: string;
  expiresAt: string;
  id: string;
  mediaSourceId: string;
  playSessionId: string;
  redeemedAt: string | null;
  resumeTicks: number;
  secretHash: string;
  serverId: string;
  subtitleStreamIndex: number | null;
}

export interface PlaybackSessionsTable {
  audioStreamIndex: number | null;
  authSessionId: string;
  bridgeDeviceId: string;
  createdAt: string;
  embyItemId: string;
  embyUserId: string;
  id: string;
  lastEventAt: string | null;
  lastPositionTicks: number;
  lastSequence: number;
  mediaSourceId: string;
  resumeTicks: number;
  serverId: string;
  startedAt: string | null;
  stoppedAt: string | null;
  subtitleStreamIndex: number | null;
}

export interface DatabaseSchema {
  appSettings: AppSettingsTable;
  authSessions: AuthSessionsTable;
  bridgeDevices: BridgeDevicesTable;
  bridgePairingCodes: BridgePairingCodesTable;
  bridgeRequestNonces: BridgeRequestNoncesTable;
  playTickets: PlayTicketsTable;
  playbackSessions: PlaybackSessionsTable;
  servers: ServersTable;
}
