import {
  LocalBridgeStatusSchema,
  LocalPlaybackStatusResponseSchema,
  LocalPlaybackStartResponseSchema,
  type LocalBridgeStatus,
  type LocalPlaybackStartResponse,
  type LocalPlaybackStatusResponse,
} from "@lumarelay/contracts";

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

export class LocalBridgeError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "LocalBridgeError";
  }
}

async function localBridgeError(response: Response): Promise<LocalBridgeError> {
  try {
    const body = (await response.json()) as {
      error?: { code?: unknown; message?: unknown };
    };
    if (
      typeof body.error?.code === "string" &&
      typeof body.error.message === "string"
    ) {
      return new LocalBridgeError(
        body.error.code,
        body.error.message,
        response.status,
      );
    }
  } catch {
    // The loopback service may be interrupted before writing JSON.
  }
  return new LocalBridgeError(
    "LOCAL_BRIDGE_REQUEST_FAILED",
    `Local Bridge returned HTTP ${response.status}`,
    response.status,
  );
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
  return `lumarelay://pair?${query.toString()}`;
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
      "x-lumarelay-nonce": localNonce(),
    },
    method: "POST",
  });
  if (!response.ok) throw await localBridgeError(response);
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
