import type {
  PlaybackMediaSource,
  PlaybackTrack,
  PlayTicketSelection,
} from "@newemby/contracts";
import { z } from "zod";

import {
  EmbyMediaError,
  fetchEmby,
  type AuthenticatedMediaRequest,
  type MediaClientOptions,
} from "./media-api.js";
import { embyApiUrl } from "./url.js";

const EmbyMediaStreamSchema = z.object({
  Codec: z.string().optional(),
  DisplayTitle: z.string().optional(),
  Index: z.number().int().nonnegative(),
  IsDefault: z.boolean().optional(),
  IsExternal: z.boolean().optional(),
  IsTextSubtitleStream: z.boolean().optional(),
  Language: z.string().optional(),
  Title: z.string().optional(),
  Type: z.enum(["Audio", "Subtitle", "Video"]).catch("Video"),
});

const EmbyMediaSourceSchema = z.object({
  Bitrate: z.number().int().positive().optional(),
  Container: z.string().optional(),
  DefaultAudioStreamIndex: z.number().int().nonnegative().nullable().optional(),
  DefaultSubtitleStreamIndex: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .optional(),
  Id: z.string().trim().min(1),
  MediaStreams: z.array(EmbyMediaStreamSchema).optional(),
  Name: z.string().optional(),
  RunTimeTicks: z.number().int().nonnegative().optional(),
  SupportsDirectPlay: z.boolean().optional(),
  SupportsDirectStream: z.boolean().optional(),
});

const EmbyPlaybackInfoSchema = z.object({
  MediaSources: z.array(EmbyMediaSourceSchema).optional(),
});

function clean(value: string | undefined): string | undefined {
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
  const parsed = EmbyPlaybackInfoSchema.safeParse(
    await (await fetchEmby(url, input, options)).json(),
  );
  if (!parsed.success)
    throw new EmbyMediaError(
      "invalid-response",
      "Emby returned an invalid playback information response",
      { cause: parsed.error },
    );

  return (parsed.data.MediaSources ?? [])
    .filter(
      (source) =>
        source.SupportsDirectStream === true ||
        source.SupportsDirectPlay === true,
    )
    .map((source) => {
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
        bitrate: source.Bitrate,
        container,
        defaultAudioStreamIndex:
          source.DefaultAudioStreamIndex ??
          audioTracks.find((candidate) => candidate.isDefault)?.index ??
          audioTracks[0]?.index ??
          null,
        defaultSubtitleStreamIndex:
          source.DefaultSubtitleStreamIndex ??
          subtitleTracks.find((candidate) => candidate.isDefault)?.index ??
          null,
        mediaSourceId: source.Id,
        name:
          clean(source.Name) ??
          (container === undefined ? "默认版本" : container.toUpperCase()),
        runtimeTicks: source.RunTimeTicks ?? 0,
        subtitleTracks,
        supportsDirectStream: true,
      } satisfies PlaybackMediaSource;
    });
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
  const url =
    resource === "media"
      ? embyApiUrl(
          baseUrl,
          `/Videos/${encodeURIComponent(selection.itemId)}/stream`,
        )
      : embyApiUrl(
          baseUrl,
          `/Videos/${encodeURIComponent(selection.itemId)}/${encodeURIComponent(selection.mediaSourceId)}/Subtitles/${selection.subtitleStreamIndex ?? -1}/Stream.srt`,
        );
  if (resource === "media") {
    url.searchParams.set("DeviceId", input.deviceId);
    url.searchParams.set("MediaSourceId", selection.mediaSourceId);
    url.searchParams.set("PlaySessionId", playSessionId);
    url.searchParams.set("Static", "true");
    if (selection.audioStreamIndex !== null)
      url.searchParams.set(
        "AudioStreamIndex",
        String(selection.audioStreamIndex),
      );
  }
  return fetchEmby(
    url,
    input,
    options,
    resource === "media" ? "*/*" : "application/x-subrip,text/plain;q=0.9",
    range === undefined ? {} : { range },
  );
}
