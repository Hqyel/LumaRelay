import {
  LocalBridgeStatusSchema,
  LocalPlaybackStatusResponseSchema,
  LocalPlaybackStartResponseSchema,
  type LocalBridgeStatus,
  type LocalPlaybackStartResponse,
  type LocalPlaybackStatusResponse,
} from "@newemby/contracts";

export const LOCAL_BRIDGE_API_VERSION = 1;
export const LOCAL_BRIDGE_BASE_URL = "http://127.0.0.1:58080";

export type BridgeAvailability = "connected" | "incompatible" | "not-detected";

export interface BridgeCapabilityModel {
  availability: BridgeAvailability;
  isPaired: boolean;
  playerAvailable: boolean;
  playerRunning: boolean;
  playerVersion?: string;
  smtcReady: boolean;
  status?: LocalBridgeStatus;
}

export async function fetchLocalBridgeStatus(
  signal?: AbortSignal,
): Promise<LocalBridgeStatus> {
  const url = new URL("/v1/status", LOCAL_BRIDGE_BASE_URL);
  url.searchParams.set("apiVersion", String(LOCAL_BRIDGE_API_VERSION));
  const response = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" },
    signal,
  });
  if (!response.ok)
    throw new Error(`Local Bridge returned HTTP ${response.status}`);
  return LocalBridgeStatusSchema.parse(await response.json());
}

export function bridgeCapabilityModel(
  status: LocalBridgeStatus | undefined,
): BridgeCapabilityModel {
  if (status === undefined)
    return {
      availability: "not-detected",
      isPaired: false,
      playerAvailable: false,
      playerRunning: false,
      smtcReady: false,
    };

  const player = status.players.find(
    (candidate) => candidate.adapterId === "potplayer",
  );
  return {
    availability: status.compatibility.isCompatible
      ? "connected"
      : "incompatible",
    isPaired: status.isPaired,
    playerAvailable: player?.isAvailable === true,
    playerRunning: player?.isRunning === true,
    playerVersion: player?.version,
    smtcReady: status.smtc.capability === "ready" && status.smtc.isMonitoring,
    status,
  };
}

export function bridgePairingUri(
  gatewayOrigin: string,
  pairingCode: string,
): string {
  const query = new URLSearchParams({
    code: pairingCode,
    gateway: gatewayOrigin,
  });
  return `newemby://pair?${query.toString()}`;
}

function localNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export async function startLocalPlayback(
  playTicket: string,
): Promise<LocalPlaybackStartResponse> {
  const response = await fetch(`${LOCAL_BRIDGE_BASE_URL}/v1/playback/start`, {
    body: JSON.stringify({ playTicket }),
    headers: {
      "content-type": "application/json",
      "x-newemby-nonce": localNonce(),
    },
    method: "POST",
  });
  if (!response.ok)
    throw new Error(
      `Local Bridge rejected playback with HTTP ${response.status}`,
    );
  return LocalPlaybackStartResponseSchema.parse(await response.json());
}

export async function fetchLocalPlaybackStatus(
  signal?: AbortSignal,
): Promise<LocalPlaybackStatusResponse> {
  const response = await fetch(`${LOCAL_BRIDGE_BASE_URL}/v1/playback/status`, {
    cache: "no-store",
    headers: { accept: "application/json" },
    signal,
  });
  if (!response.ok)
    throw new Error(`Local Bridge returned HTTP ${response.status}`);
  return LocalPlaybackStatusResponseSchema.parse(await response.json());
}
