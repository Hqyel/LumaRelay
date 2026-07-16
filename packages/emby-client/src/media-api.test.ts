import { describe, expect, it, vi } from "vitest";

import {
  getMediaHome,
  getMediaItems,
  getMediaLibraries,
  searchMedia,
} from "./media-api.js";

const input = {
  accessToken: "gateway-only-token",
  deviceId: "device-1",
  serverId: "server-1",
  userId: "user-1",
};

const movie = {
  BackdropImageTags: ["backdrop-tag"],
  Genres: ["Drama"],
  Id: "movie-1",
  ImageTags: { Primary: "poster-tag" },
  Name: "Example Movie",
  Overview: "A fixture overview.",
  Type: "Movie",
  UserData: {
    IsFavorite: true,
    Played: false,
    PlayedPercentage: 25,
    PlaybackPositionTicks: 600_000_000,
  },
};

describe("authenticated media client", () => {
  it("builds the home model without exposing the access token", async () => {
    const fetcher = vi.fn(async (request: string | URL | Request) => {
      const url = new URL(String(request));
      const body = url.pathname.endsWith("/Latest")
        ? [movie]
        : { Items: [movie], TotalRecordCount: 1 };
      return new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
      });
    });

    const home = await getMediaHome("https://emby.example.com", input, {
      fetch: fetcher as typeof fetch,
    });

    expect(home.hero?.title).toBe("Example Movie");
    expect(home.resumeItems[0]?.playbackPositionSeconds).toBe(60);
    expect(home.genreRows[0]?.genre).toBe("Drama");
    expect(JSON.stringify(home)).not.toContain(input.accessToken);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("maps only user-authorized views to libraries", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            Items: [
              {
                CollectionType: "movies",
                Id: "library-1",
                ImageTags: {},
                Name: "Movies",
                Type: "CollectionFolder",
              },
            ],
          }),
        ),
    );

    const libraries = await getMediaLibraries(
      "https://emby.example.com",
      input,
      { fetch: fetcher as typeof fetch },
    );

    expect(libraries).toEqual([
      expect.objectContaining({ libraryId: "library-1", serverId: "server-1" }),
    ]);
  });

  it("queries paged movies through the user-scoped endpoint", async () => {
    const fetcher = vi.fn(async (request: string | URL | Request) => {
      const url = new URL(String(request));
      expect(url.pathname).toBe("/Users/user-1/Items");
      expect(url.searchParams.get("IncludeItemTypes")).toBe("Movie");
      expect(url.searchParams.get("StartIndex")).toBe("40");
      expect(url.searchParams.get("SortBy")).toBe("DateCreated");
      return new Response(
        JSON.stringify({
          Items: [movie],
          StartIndex: 40,
          TotalRecordCount: 81,
        }),
      );
    });

    const result = await getMediaItems(
      "https://emby.example.com",
      input,
      {
        favorite: undefined,
        genre: undefined,
        kind: "movie",
        libraryId: undefined,
        limit: 40,
        minCommunityRating: undefined,
        officialRating: undefined,
        playState: "any",
        seriesStatus: "any",
        sortBy: "dateAdded",
        sortOrder: "descending",
        startIndex: 40,
        year: undefined,
      },
      { fetch: fetcher as typeof fetch },
    );

    expect(result.total).toBe(81);
    expect(result.items[0]?.kind).toBe("movie");
  });

  it("groups user-scoped search results and people", async () => {
    const fetcher = vi.fn(async (request: string | URL | Request) => {
      const url = new URL(String(request));
      if (url.pathname === "/Persons")
        return new Response(
          JSON.stringify({
            Items: [{ Id: "person-1", Name: "Alex Actor", Type: "Actor" }],
          }),
        );
      return new Response(
        JSON.stringify({
          Items: [
            movie,
            { Id: "series-1", Name: "Example Series", Type: "Series" },
            { Id: "episode-1", Name: "Episode One", Type: "Episode" },
          ],
        }),
      );
    });

    const result = await searchMedia(
      "https://emby.example.com",
      input,
      { limit: 8, q: "example" },
      { fetch: fetcher as typeof fetch },
    );

    expect(result.movies).toHaveLength(1);
    expect(result.series).toHaveLength(1);
    expect(result.episodes).toHaveLength(1);
    expect(result.people[0]?.name).toBe("Alex Actor");
  });
});
