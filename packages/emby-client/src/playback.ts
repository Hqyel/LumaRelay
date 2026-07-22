import { EmbyMediaError } from "./media-api.js";
import { embyApiUrl } from "./url.js";

export interface PlaybackSessionInput {
  accessToken: string;
  audioStreamIndex: number | null;
  deviceId: string;
  isPaused: boolean;
  itemId: string;
  mediaSourceId: string;
  playbackRate: number;
  playSessionId: string;
  positionTicks: number;
  subtitleStreamIndex: number | null;
}

export interface PlaybackClientOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

function authorizationHeader(deviceId: string): string {
  const safeDeviceId = deviceId.replace(/["\\]/g, "");
  return (
    'Emby Client="NewEmby", Device="Gateway", ' +
    `DeviceId="${safeDeviceId}", Version="0.0.0"`
  );
}

async function postPlayback(
  baseUrl: string,
  path: string,
  input: PlaybackSessionInput,
  body: Record<string, unknown>,
  options: PlaybackClientOptions,
): Promise<void> {
  const fetcher = options.fetch ?? globalThis.fetch;

  try {
    const response = await fetcher(embyApiUrl(baseUrl, path), {
      body: JSON.stringify(body),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-emby-authorization": authorizationHeader(input.deviceId),
        "x-emby-token": input.accessToken,
      },
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(options.timeoutMs ?? 8000),
    });

    if (response.status === 401)
      throw new EmbyMediaError("unauthorized", "The Emby session has expired");
    if (response.status === 403)
      throw new EmbyMediaError("forbidden", "Playback access was denied");
    if (!response.ok)
      throw new EmbyMediaError(
        "write-failed",
        "The Emby playback check-in failed",
      );
  } catch (error) {
    if (error instanceof EmbyMediaError) throw error;
    if (error instanceof DOMException && error.name === "TimeoutError")
      throw new EmbyMediaError("timeout", "The Emby request timed out", {
        cause: error,
      });
    throw new EmbyMediaError(
      "write-failed",
      "The Emby playback check-in failed",
      { cause: error },
    );
  }
}

function playbackBody(input: PlaybackSessionInput): Record<string, unknown> {
  return {
    AudioStreamIndex: input.audioStreamIndex,
    CanSeek: true,
    IsMuted: false,
    IsPaused: input.isPaused,
    ItemId: input.itemId,
    MediaSourceId: input.mediaSourceId,
    PlaybackRate: input.playbackRate,
    PlayMethod: "DirectPlay",
    PlaySessionId: input.playSessionId,
    PositionTicks: input.positionTicks,
    QueueableMediaTypes: ["Video"],
    SubtitleStreamIndex: input.subtitleStreamIndex,
  };
}

export async function reportPlaybackStarted(
  baseUrl: string,
  input: PlaybackSessionInput,
  options: PlaybackClientOptions = {},
): Promise<void> {
  await postPlayback(
    baseUrl,
    "/Sessions/Playing",
    input,
    playbackBody(input),
    options,
  );
}
