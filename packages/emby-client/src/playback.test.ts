import { describe, expect, it, vi } from "vitest";

import { reportPlaybackStarted } from "./playback.js";

describe("playback check-ins", () => {
  it("reports Playing with the authenticated DirectPlay context", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));

    await reportPlaybackStarted(
      "https://emby.example.com/",
      {
        accessToken: "secret-token",
        audioStreamIndex: 1,
        deviceId: "gateway-device",
        isPaused: false,
        itemId: "item-1",
        mediaSourceId: "source-1",
        playbackRate: 1,
        playSessionId: "11111111-1111-4111-8111-111111111111",
        positionTicks: 12_000_000,
        subtitleStreamIndex: null,
      },
      { fetch: fetcher },
    );

    const [url, request] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("https://emby.example.com/Sessions/Playing");
    expect(request.headers).toMatchObject({
      "x-emby-token": "secret-token",
    });
    expect(JSON.parse(request.body as string)).toMatchObject({
      CanSeek: true,
      ItemId: "item-1",
      MediaSourceId: "source-1",
      PlayMethod: "DirectPlay",
      PositionTicks: 12_000_000,
    });
    expect(url.toString()).not.toContain("secret-token");
  });
});
