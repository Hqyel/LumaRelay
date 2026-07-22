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
    const fetcher = vi.fn().mockResolvedValue(
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

    const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).not.toContain("upstream-secret-token");
    expect(url.searchParams.get("Static")).toBe("true");
    expect(init.headers).toMatchObject({
      range: "bytes=100-",
      "x-emby-token": "upstream-secret-token",
    });
  });
});
