import { describe, expect, it } from "vitest";

import { episodePlaybackTitle, mediaPlaybackTitle } from "./playback-title.js";

describe("playback title", () => {
  it("formats an episode with its position in the selected season", () => {
    expect(
      episodePlaybackTitle(
        {
          episodeNumber: 3,
          name: "新的开始",
          seriesName: "示例剧集",
        },
        12,
      ),
    ).toBe("示例剧集-新的开始-第3/12集");
  });

  it("uses only the movie name for movies", () => {
    expect(
      mediaPlaybackTitle({
        kind: "movie",
        title: "示例电影",
      }),
    ).toBe("示例电影");
  });

  it("removes control characters and limits the player title", () => {
    expect(
      mediaPlaybackTitle({
        kind: "movie",
        title: `示例\n${"片".repeat(300)}`,
      }),
    ).toHaveLength(256);
  });
});
