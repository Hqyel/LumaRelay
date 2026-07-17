import type { MediaCard } from "@newemby/contracts";
import { describe, expect, it } from "vitest";

import { updateFavoriteCache } from "./favorite-cache.js";

const item: MediaCard = {
  isFavorite: false,
  isPlayed: false,
  itemId: "movie-1",
  kind: "movie",
  playbackPositionSeconds: 0,
  serverId: "server-1",
  title: "Movie",
};

describe("favorite cache updates", () => {
  it("updates nested cards and the home favorite row", () => {
    const value = {
      favoriteItems: [] as MediaCard[],
      latestMovies: [item],
      nested: { item },
    };
    const favorite = updateFavoriteCache(value, item, true);
    const restored = updateFavoriteCache(favorite, item, false);

    expect(favorite.latestMovies[0]?.isFavorite).toBe(true);
    expect(favorite.nested.item.isFavorite).toBe(true);
    expect(favorite.favoriteItems).toHaveLength(1);
    expect(restored.favoriteItems).toHaveLength(0);
    expect(restored.latestMovies[0]?.isFavorite).toBe(false);
  });

  it("preserves unrelated cache data by reference", () => {
    const unrelated = { items: [{ itemId: "movie-2", isFavorite: false }] };
    expect(updateFavoriteCache(unrelated, item, true)).toBe(unrelated);
  });
});
