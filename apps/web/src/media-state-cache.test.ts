import type { MediaCard } from "@lumarelay/contracts";
import { describe, expect, it } from "vitest";

import { updateMediaStateCache } from "./media-state-cache.js";

const item: MediaCard = {
  isFavorite: false,
  isPlayed: false,
  itemId: "movie-1",
  kind: "movie",
  playbackPositionSeconds: 0,
  serverId: "server-1",
  title: "Movie",
};

describe("media state cache updates", () => {
  it("updates nested cards and the home favorite row", () => {
    const value = {
      favoriteItems: [] as MediaCard[],
      latestMovies: [item],
      nested: { item },
    };
    const favorite = updateMediaStateCache(value, item, { isFavorite: true });
    const restored = updateMediaStateCache(favorite, item, {
      isFavorite: false,
    });

    expect(favorite.latestMovies[0]?.isFavorite).toBe(true);
    expect(favorite.nested.item.isFavorite).toBe(true);
    expect(favorite.favoriteItems).toHaveLength(1);
    expect(restored.favoriteItems).toHaveLength(0);
    expect(restored.latestMovies[0]?.isFavorite).toBe(false);
  });

  it("preserves unrelated cache data by reference", () => {
    const unrelated = { items: [{ itemId: "movie-2", isFavorite: false }] };
    expect(updateMediaStateCache(unrelated, item, { isFavorite: true })).toBe(
      unrelated,
    );
  });

  it("updates played state everywhere and removes completed resume items", () => {
    const value = {
      hero: item,
      latestMovies: [item],
      resumeItems: [item],
    };
    const played = updateMediaStateCache(value, item, {
      isPlayed: true,
      playbackPositionSeconds: 0,
      playedPercentage: 100,
    });

    expect(played.hero).toMatchObject({
      isPlayed: true,
      playedPercentage: 100,
    });
    expect(played.latestMovies[0]?.isPlayed).toBe(true);
    expect(played.resumeItems).toEqual([]);
  });
});
