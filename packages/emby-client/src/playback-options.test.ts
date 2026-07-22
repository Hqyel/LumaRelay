import { describe, expect, it, vi } from "vitest";

import {
  getPlaybackOptions,
  loadPlaybackResource,
} from "./playback-options.js";

const input = {
  accessToken: "upstream-secret-token",
  deviceId: "gateway-device",
  serverId: "server-1",
  userId: "user-1",
};

describe("playback options", () => {
  it("maps direct-stream sources and default tracks without exposing paths", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          MediaSources: [
            {
              Container: "mkv",
              DefaultAudioStreamIndex: 1,
              DefaultSubtitleStreamIndex: 2,
              Id: "source-1",
              MediaStreams: [
                {
                  Codec: "aac",
                  DisplayTitle: "Chinese AAC stereo",
                  Index: 1,
                  IsDefault: true,
                  Type: "Audio",
                },
                {
                  Codec: "srt",
                  DisplayTitle: "Chinese SRT",
                  Index: 2,
                  IsTextSubtitleStream: true,
                  Type: "Subtitle",
                },
              ],
              Name: "1080p",
              Path: "/private/movie.mkv",
              RunTimeTicks: 600_000_000,
              SupportsDirectStream: true,
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const sources = await getPlaybackOptions(
      "https://emby.example.com/",
      input,
      "item-1",
      { fetch: fetcher },
    );

    expect(sources).toEqual([
      expect.objectContaining({
        defaultAudioStreamIndex: 1,
        defaultSubtitleStreamIndex: 2,
        mediaSourceId: "source-1",
        name: "1080p",
      }),
    ]);
    expect(JSON.stringify(sources)).not.toContain("/private/movie.mkv");
    const requestUrl = new URL(fetcher.mock.calls[0]![0] as URL);
    expect(requestUrl.pathname).toBe("/Items/item-1/PlaybackInfo");
    expect(requestUrl.searchParams.get("UserId")).toBe("user-1");
  });

  it("keeps the token in headers while proxying a ranged static stream", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            MediaSources: [
              {
                Container: "mkv",
                Id: "source-1",
                SupportsDirectStream: true,
              },
            ],
            PlaySessionId: "emby-session",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response("media", {
          headers: { "content-type": "video/x-matroska" },
          status: 206,
        }),
      );
    await loadPlaybackResource(
      "https://emby.example.com/",
      input,
      {
        audioStreamIndex: 1,
        itemId: "item-1",
        mediaSourceId: "source-1",
        resumeTicks: 0,
        subtitleStreamIndex: null,
      },
      "22222222-2222-4222-8222-222222222222",
      "media",
      "bytes=100-",
      { fetch: fetcher },
    );

    const [prepareUrl, prepareInit] = fetcher.mock.calls[0] as [
      URL,
      RequestInit,
    ];
    expect(prepareUrl.pathname).toBe("/Items/item-1/PlaybackInfo");
    expect(prepareInit.method).toBe("POST");
    expect(JSON.parse(String(prepareInit.body))).toMatchObject({
      CurrentPlaySessionId: "22222222-2222-4222-8222-222222222222",
      IsPlayback: true,
      MediaSourceId: "source-1",
    });

    const [url, init] = fetcher.mock.calls[1] as [URL, RequestInit];
    expect(url.toString()).not.toContain("upstream-secret-token");
    expect(url.pathname).toBe("/Videos/item-1/stream.mkv");
    expect(url.searchParams.get("Static")).toBe("true");
    expect(url.searchParams.get("PlaySessionId")).toBe("emby-session");
    expect(init.headers).toMatchObject({
      accept: "*/*",
      range: "bytes=100-",
      "x-emby-token": "upstream-secret-token",
    });
  });

  it("uses STRM HTTP paths without sending the Emby token off-origin", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            MediaSources: [
              {
                Id: "source-1",
                Path: "https://cloud.example/media.mp4?signature=keep-me",
                Protocol: "Http",
                RequiredHttpHeaders: {
                  Referer: "https://cloud.example/",
                  "X-Emby-Token": "must-not-forward",
                },
              },
            ],
            PlaySessionId: "emby-session",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response("media", { status: 206 }));

    await loadPlaybackResource(
      "https://emby.example.com/",
      input,
      {
        audioStreamIndex: null,
        itemId: "strm-item",
        mediaSourceId: "source-1",
        resumeTicks: 0,
        subtitleStreamIndex: null,
      },
      "22222222-2222-4222-8222-222222222222",
      "media",
      "bytes=0-",
      { fetch: fetcher },
    );

    const [url, init] = fetcher.mock.calls[1] as [URL, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(url.toString()).toBe(
      "https://cloud.example/media.mp4?signature=keep-me",
    );
    expect(headers.referer).toBe("https://cloud.example/");
    expect(headers.range).toBe("bytes=0-");
    expect(headers["x-emby-token"]).toBeUndefined();
    expect(headers["x-emby-authorization"]).toBeUndefined();
  });

  it("removes Emby credentials after a same-origin stream redirect", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            MediaSources: [
              {
                DirectStreamUrl: "/Videos/item-1/stream",
                Id: "source-1",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          headers: {
            location: "https://cloud.example/direct.mp4?token=provider-token",
          },
          status: 302,
        }),
      )
      .mockResolvedValueOnce(new Response("media", { status: 206 }));

    await loadPlaybackResource(
      "https://emby.example.com/",
      input,
      {
        audioStreamIndex: null,
        itemId: "item-1",
        mediaSourceId: "source-1",
        resumeTicks: 0,
        subtitleStreamIndex: null,
      },
      "22222222-2222-4222-8222-222222222222",
      "media",
      undefined,
      { fetch: fetcher },
    );

    const sameOriginHeaders = fetcher.mock.calls[1]![1]?.headers as Record<
      string,
      string
    >;
    const externalHeaders = fetcher.mock.calls[2]![1]?.headers as Record<
      string,
      string
    >;
    expect(sameOriginHeaders["x-emby-token"]).toBe("upstream-secret-token");
    expect(externalHeaders["x-emby-token"]).toBeUndefined();
    expect(externalHeaders["x-emby-authorization"]).toBeUndefined();
  });

  it("does not select a non-text subtitle as the default", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          MediaSources: [
            {
              DefaultSubtitleStreamIndex: 3,
              Id: "source-1",
              MediaStreams: [
                {
                  Index: 2,
                  IsTextSubtitleStream: true,
                  Type: "Subtitle",
                },
                {
                  Index: 3,
                  IsDefault: true,
                  IsTextSubtitleStream: false,
                  Type: "Subtitle",
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const sources = await getPlaybackOptions(
      "https://emby.example.com/",
      input,
      "item-1",
      { fetch: fetcher },
    );

    expect(sources[0]?.defaultSubtitleStreamIndex).toBe(2);
  });
});
