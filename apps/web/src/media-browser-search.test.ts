import { describe, expect, it } from "vitest";

import {
  mediaItemsFromSearch,
  parseMediaBrowserSearch,
} from "./media-browser-search.js";

describe("media browser search state", () => {
  it("normalizes repeated and comma-separated filters", () => {
    const search = parseMediaBrowserSearch(
      {
        favorite: "true",
        genre: ["科幻", "剧情,科幻"],
        kind: ["series", "movie", "invalid"],
        minCommunityRating: "8",
        officialRating: ["PG-13", "R"],
        page: "3",
        playState: "unplayed",
        seriesStatus: "continuing",
        sortBy: "productionYear",
        sortOrder: "descending",
        year: ["2026", "2024,2026"],
      },
      { sortBy: "dateAdded", sortOrder: "descending" },
    );

    expect(search).toMatchObject({
      favorite: true,
      genre: ["剧情", "科幻"],
      kind: ["movie", "series"],
      officialRating: ["PG-13", "R"],
      page: 3,
      year: [2024, 2026],
    });
    expect(mediaItemsFromSearch(search)).toMatchObject({
      limit: 40,
      startIndex: 80,
    });
  });

  it("falls back to canonical defaults and drops invalid values", () => {
    expect(
      parseMediaBrowserSearch(
        { minCommunityRating: "11", page: "0", year: "12" },
        { sortBy: "name", sortOrder: "ascending" },
      ),
    ).toEqual({
      favorite: undefined,
      genre: [],
      kind: [],
      libraryId: undefined,
      minCommunityRating: undefined,
      officialRating: [],
      page: 1,
      playState: "any",
      seriesStatus: "any",
      sortBy: "name",
      sortOrder: "ascending",
      year: [],
    });
  });
});
