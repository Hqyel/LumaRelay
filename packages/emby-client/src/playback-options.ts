import type {
  PlaybackMediaSource,
  PlaybackTrack,
  PlayTicketSelection,
} from "@newemby/contracts";
import { z } from "zod";

import {
  authenticatedHeaders,
  EmbyMediaError,
  fetchEmby,
  type AuthenticatedMediaRequest,
  type MediaClientOptions,
} from "./media-api.js";
import { embyApiUrl } from "./url.js";

const EmbyMediaStreamSchema = z.object({
  Codec: z.string().nullish(),
  DisplayTitle: z.string().nullish(),
  Index: z.number().int().nonnegative(),
  IsDefault: z.boolean().nullish(),
  IsExternal: z.boolean().nullish(),
  IsTextSubtitleStream: z.boolean().nullish(),
  Language: z.string().nullish(),
  Title: z.string().nullish(),
  Type: z.enum(["Audio", "Subtitle", "Video"]).catch("Video"),
});

const EmbyMediaSourceSchema = z.object({
  AddApiKeyToDirectStreamUrl: z.boolean().nullish(),
  Bitrate: z.number().int().positive().nullish(),
  Container: z.string().nullish(),
  DefaultAudioStreamIndex: z.number().int().nonnegative().nullish(),
  DefaultSubtitleStreamIndex: z.number().int().nonnegative().nullish(),
  DirectStreamUrl: z.string().nullish(),
  Id: z.string().trim().min(1),
  IsRemote: z.boolean().nullish(),
  MediaStreams: z.array(EmbyMediaStreamSchema).nullish(),
  Name: z.string().nullish(),
  Path: z.string().nullish(),
  Protocol: z.string().nullish(),
  RequiredHttpHeaders: z.record(z.string(), z.string()).nullish(),
  RunTimeTicks: z.number().int().nonnegative().nullish(),
  SupportsDirectPlay: z.boolean().nullish(),
  SupportsDirectStream: z.boolean().nullish(),
});

const EmbyPlaybackInfoSchema = z.object({
  ErrorCode: z.string().nullish(),
  MediaSources: z.array(EmbyMediaSourceSchema).nullish(),
  PlaySessionId: z.string().nullish(),
});

type EmbyMediaSource = z.infer<typeof EmbyMediaSourceSchema>;

const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const blockedRequiredHeaders = new Set([
  "connection",
  "content-length",
  "cookie",
  "host",
  "transfer-encoding",
  "x-emby-authorization",
  "x-emby-token",
]);

function clean(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === "" ? undefined : normalized;
}

function track(
  input: z.infer<typeof EmbyMediaStreamSchema>,
  kind: "audio" | "subtitle",
): PlaybackTrack {
  const language = clean(input.Language);
  const codec = clean(input.Codec);
  return {
    codec,
    displayTitle:
      clean(input.DisplayTitle) ??
      clean(input.Title) ??
      language ??
      `${kind === "audio" ? "音轨" : "字幕"} ${input.Index}`,
    index: input.Index,
    isDefault: input.IsDefault ?? false,
    isExternal: input.IsExternal ?? false,
    isText: kind === "subtitle" && (input.IsTextSubtitleStream ?? false),
    kind,
    language,
  };
}

function defaultTrackIndex(
  configured: number | null | undefined,
  tracks: PlaybackTrack[],
  textOnly = false,
): number | null {
  const candidates = textOnly
    ? tracks.filter((candidate) => candidate.isText)
    : tracks;
  return (
    candidates.find((candidate) => candidate.index === configured)?.index ??
    candidates.find((candidate) => candidate.isDefault)?.index ??
    candidates[0]?.index ??
    null
  );
}

function hasDirectLocation(source: EmbyMediaSource): boolean {
  if (clean(source.DirectStreamUrl) !== undefined) return true;
  return (
    source.Protocol?.toLowerCase() === "http" &&
    clean(source.Path) !== undefined
  );
}

function mapSource(source: EmbyMediaSource): PlaybackMediaSource {
  const streams = source.MediaStreams ?? [];
  const audioTracks = streams
    .filter((stream) => stream.Type === "Audio")
    .map((stream) => track(stream, "audio"));
  const subtitleTracks = streams
    .filter((stream) => stream.Type === "Subtitle")
    .map((stream) => track(stream, "subtitle"));
  const container = clean(source.Container);

  return {
    audioTracks,
    bitrate: source.Bitrate ?? undefined,
    container,
    defaultAudioStreamIndex: defaultTrackIndex(
      source.DefaultAudioStreamIndex,
      audioTracks,
    ),
    defaultSubtitleStreamIndex: defaultTrackIndex(
      source.DefaultSubtitleStreamIndex,
      subtitleTracks,
      true,
    ),
    mediaSourceId: source.Id,
    name:
      clean(source.Name) ??
      (container === undefined ? "默认版本" : container.toUpperCase()),
    runtimeTicks: source.RunTimeTicks ?? 0,
    subtitleTracks,
    supportsDirectStream:
      source.SupportsDirectStream === true ||
      source.SupportsDirectPlay === true ||
      hasDirectLocation(source),
  };
}

async function parsePlaybackInfo(response: Response) {
  const parsed = EmbyPlaybackInfoSchema.safeParse(await response.json());
  if (!parsed.success)
    throw new EmbyMediaError(
      "invalid-response",
      "Emby returned an invalid playback information response",
      { cause: parsed.error },
    );
  if (clean(parsed.data.ErrorCode) !== undefined)
    throw new EmbyMediaError(
      "invalid-response",
      `Emby could not prepare playback (${parsed.data.ErrorCode})`,
    );
  return parsed.data;
}

async function preparePlayback(
  baseUrl: string,
  input: AuthenticatedMediaRequest,
  selection: PlayTicketSelection,
  playSessionId: string,
  options: MediaClientOptions,
) {
  const url = embyApiUrl(
    baseUrl,
    `/Items/${encodeURIComponent(selection.itemId)}/PlaybackInfo`,
  );
  const response = await fetchEmby(
    url,
    input,
    options,
    "application/json",
    { "content-type": "application/json" },
    {
      body: JSON.stringify({
        CurrentPlaySessionId: playSessionId,
        EnableDirectPlay: true,
        EnableDirectStream: true,
        EnableTranscoding: false,
        IsPlayback: true,
        MediaSourceId: selection.mediaSourceId,
        UserId: input.userId,
      }),
      method: "POST",
    },
  );
  return parsePlaybackInfo(response);
}

function sanitizeEmbyToken(url: URL, accessToken: string): URL {
  const sanitized = new URL(url);
  for (const [name, value] of [...sanitized.searchParams.entries()]) {
    const normalized = name.toLowerCase();
    if (
      (normalized === "api_key" || normalized === "x-emby-token") &&
      value === accessToken
    )
      sanitized.searchParams.delete(name);
  }
  return sanitized;
}

function httpUrl(value: string, base?: URL): URL {
  const url = base === undefined ? new URL(value) : new URL(value, base);
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new EmbyMediaError(
      "invalid-response",
      "Emby returned an unsafe media stream URL",
    );
  return url;
}

function requiredHeaders(
  source: EmbyMediaSource | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(
    source?.RequiredHttpHeaders ?? {},
  )) {
    const normalized = name.toLowerCase();
    if (!blockedRequiredHeaders.has(normalized)) headers[normalized] = value;
  }
  return headers;
}

function mapResponseError(
  response: Response,
  requestUrl: URL,
  embyOrigin: string,
): never {
  const fromEmby = requestUrl.origin === embyOrigin;
  if (fromEmby && response.status === 401)
    throw new EmbyMediaError("unauthorized", "The Emby session has expired");
  if (response.status === 403)
    throw new EmbyMediaError("forbidden", "This media is not available");
  if (response.status === 404)
    throw new EmbyMediaError("not-found", "The media item was not found");
  throw new EmbyMediaError("unreachable", "The media stream request failed");
}

async function fetchPlaybackStream(
  baseUrl: string,
  input: AuthenticatedMediaRequest,
  source: EmbyMediaSource | undefined,
  initialUrl: URL,
  accept: string,
  range: string | undefined,
  options: MediaClientOptions,
): Promise<Response> {
  const fetcher = options.fetch ?? globalThis.fetch;
  const embyOrigin = new URL(baseUrl).origin;
  const requiredHeaderOrigin = initialUrl.origin;
  let allowEmbyAuthentication = initialUrl.origin === embyOrigin;
  let url = sanitizeEmbyToken(initialUrl, input.accessToken);

  try {
    for (let redirect = 0; redirect <= 5; redirect++) {
      const headers: Record<string, string> = {
        ...(allowEmbyAuthentication ? authenticatedHeaders(input) : {}),
        ...(url.origin === requiredHeaderOrigin ? requiredHeaders(source) : {}),
        accept,
      };
      if (range !== undefined) headers.range = range;

      const response = await fetcher(url, {
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(options.timeoutMs ?? 8000),
      });
      if (redirectStatuses.has(response.status)) {
        const location = response.headers.get("location");
        if (location === null || redirect === 5)
          throw new EmbyMediaError(
            "unreachable",
            "The media stream redirect was invalid",
          );
        const nextUrl = sanitizeEmbyToken(
          httpUrl(location, url),
          input.accessToken,
        );
        if (nextUrl.origin !== embyOrigin) allowEmbyAuthentication = false;
        url = nextUrl;
        continue;
      }
      if (!response.ok) mapResponseError(response, url, embyOrigin);
      return response;
    }
  } catch (error) {
    if (error instanceof EmbyMediaError) throw error;
    if (error instanceof DOMException && error.name === "TimeoutError")
      throw new EmbyMediaError("timeout", "The media stream timed out", {
        cause: error,
      });
    throw new EmbyMediaError("unreachable", "The media stream is unreachable", {
      cause: error,
    });
  }

  throw new EmbyMediaError("unreachable", "The media stream is unreachable");
}

function mediaStreamUrl(
  baseUrl: string,
  input: AuthenticatedMediaRequest,
  selection: PlayTicketSelection,
  playSessionId: string,
  source: EmbyMediaSource,
): URL {
  const directStreamUrl = clean(source.DirectStreamUrl);
  if (directStreamUrl !== undefined)
    return httpUrl(directStreamUrl, new URL(baseUrl));

  const path = clean(source.Path);
  if (source.Protocol?.toLowerCase() === "http" && path !== undefined)
    return httpUrl(path);

  const extension = clean(source.Container)?.replace(/[^a-z0-9]/gi, "");
  const streamPath = `/Videos/${encodeURIComponent(selection.itemId)}/stream${
    extension === undefined ? "" : `.${extension}`
  }`;
  const url = embyApiUrl(baseUrl, streamPath);
  url.searchParams.set("DeviceId", input.deviceId);
  url.searchParams.set("MediaSourceId", selection.mediaSourceId);
  url.searchParams.set("PlaySessionId", playSessionId);
  url.searchParams.set("Static", "true");
  if (selection.audioStreamIndex !== null)
    url.searchParams.set(
      "AudioStreamIndex",
      String(selection.audioStreamIndex),
    );
  return url;
}

export async function getPlaybackOptions(
  baseUrl: string,
  input: AuthenticatedMediaRequest,
  itemId: string,
  options: MediaClientOptions = {},
): Promise<PlaybackMediaSource[]> {
  const url = embyApiUrl(
    baseUrl,
    `/Items/${encodeURIComponent(itemId)}/PlaybackInfo`,
  );
  url.searchParams.set("UserId", input.userId);
  const data = await parsePlaybackInfo(await fetchEmby(url, input, options));
  return (data.MediaSources ?? []).map(mapSource);
}

export async function loadPlaybackResource(
  baseUrl: string,
  input: AuthenticatedMediaRequest,
  selection: PlayTicketSelection,
  playSessionId: string,
  resource: "media" | "subtitle",
  range: string | undefined,
  options: MediaClientOptions = {},
): Promise<Response> {
  if (resource === "subtitle") {
    const url = embyApiUrl(
      baseUrl,
      `/Videos/${encodeURIComponent(selection.itemId)}/${encodeURIComponent(
        selection.mediaSourceId,
      )}/Subtitles/${selection.subtitleStreamIndex ?? -1}/Stream.srt`,
    );
    return fetchPlaybackStream(
      baseUrl,
      input,
      undefined,
      url,
      "application/x-subrip,text/plain;q=0.9",
      range,
      options,
    );
  }

  const playback = await preparePlayback(
    baseUrl,
    input,
    selection,
    playSessionId,
    options,
  );
  const source = (playback.MediaSources ?? []).find(
    (candidate) => candidate.Id === selection.mediaSourceId,
  );
  if (source === undefined)
    throw new EmbyMediaError(
      "invalid-response",
      "The selected media source is no longer available",
    );
  const embyPlaySessionId = clean(playback.PlaySessionId) ?? playSessionId;
  return fetchPlaybackStream(
    baseUrl,
    input,
    source,
    mediaStreamUrl(baseUrl, input, selection, embyPlaySessionId, source),
    "*/*",
    range,
    options,
  );
}
