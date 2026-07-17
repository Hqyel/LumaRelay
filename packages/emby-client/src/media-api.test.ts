import { describe, expect, it, vi } from "vitest";

import {
  getMediaHome,
  getMediaItem,
  getMediaItems,
  getMediaLibraries,
  getSeriesEpisodes,
  getSeriesSeasons,
  searchMedia,
  setFavoriteState,
  setPlayedState,
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

  it("maps an authorized movie detail, cast, and related items", async () => {
    const fetcher = vi.fn(async (request: string | URL | Request) => {
      const url = new URL(String(request));
      if (url.pathname.endsWith("/Similar"))
        return new Response(
          JSON.stringify({ Items: [{ ...movie, Id: "movie-2" }] }),
        );
      expect(url.pathname).toBe("/Users/user-1/Items/movie-1");
      return new Response(
        JSON.stringify({
          ...movie,
          CommunityRating: 8.4,
          People: [
            {
              Id: "person-1",
              Name: "Alex Actor",
              PrimaryImageTag: "person-tag",
              Role: "Lead",
              Type: "Actor",
            },
          ],
          ProductionYear: 2025,
          Taglines: ["A fixture tagline."],
        }),
      );
    });

    const result = await getMediaItem(
      "https://emby.example.com",
      input,
      "movie-1",
      { fetch: fetcher as typeof fetch },
    );

    expect(result.item).toEqual(
      expect.objectContaining({
        communityRating: 8.4,
        itemId: "movie-1",
        tagline: "A fixture tagline.",
      }),
    );
    expect(result.people[0]).toEqual(
      expect.objectContaining({ personId: "person-1", role: "Lead" }),
    );
    expect(result.relatedItems[0]?.itemId).toBe("movie-2");
    expect(JSON.stringify(result)).not.toContain(input.accessToken);
  });

  it("maps user-scoped seasons and episodes", async () => {
    const fetcher = vi.fn(async (request: string | URL | Request) => {
      const url = new URL(String(request));
      expect(url.searchParams.get("UserId")).toBe("user-1");
      if (url.pathname.endsWith("/Seasons"))
        return new Response(
          JSON.stringify({
            Items: [
              {
                Id: "season-1",
                IndexNumber: 1,
                Name: "Season 1",
                SeriesId: "series-1",
                Type: "Season",
                UserData: { UnplayedItemCount: 2 },
              },
            ],
          }),
        );
      expect(url.pathname).toBe("/Shows/series-1/Episodes");
      expect(url.searchParams.get("SeasonId")).toBe("season-1");
      return new Response(
        JSON.stringify({
          Items: [
            {
              Id: "episode-1",
              IndexNumber: 1,
              Name: "Pilot",
              ParentIndexNumber: 1,
              RunTimeTicks: 1_800_000_000,
              SeasonId: "season-1",
              SeriesId: "series-1",
              Type: "Episode",
              UserData: { PlaybackPositionTicks: 300_000_000 },
            },
          ],
        }),
      );
    });

    const seasons = await getSeriesSeasons(
      "https://emby.example.com",
      input,
      "series-1",
      { fetch: fetcher as typeof fetch },
    );
    const episodes = await getSeriesEpisodes(
      "https://emby.example.com",
      input,
      "series-1",
      "season-1",
      { fetch: fetcher as typeof fetch },
    );

    expect(seasons.seasons[0]).toEqual(
      expect.objectContaining({
        seasonId: "season-1",
        unplayedEpisodeCount: 2,
      }),
    );
    expect(episodes.episodes[0]).toEqual(
      expect.objectContaining({
        episodeId: "episode-1",
        playbackPositionSeconds: 30,
        runtimeSeconds: 180,
      }),
    );
  });

  it("sets favorite state idempotently and returns refreshed user data", async () => {
    let favorite = false;
    const methods: string[] = [];
    const fetcher = vi.fn(async (request: string | URL | Request, init) => {
      const url = new URL(String(request));
      const method = init?.method ?? "GET";
      methods.push(method);

      if (url.pathname.includes("/FavoriteItems/")) {
        favorite = method === "POST";
        return new Response(undefined, { status: 204 });
      }

      expect(url.pathname).toBe("/Users/user-1/Items/movie-1");
      return new Response(
        JSON.stringify({
          Id: "movie-1",
          Name: "Movie",
          Type: "Movie",
          UserData: { IsFavorite: favorite, Played: false },
        }),
      );
    });

    const first = await setFavoriteState(
      "https://emby.example.com",
      input,
      "movie-1",
      true,
      { fetch: fetcher as typeof fetch },
    );
    const repeated = await setFavoriteState(
      "https://emby.example.com",
      input,
      "movie-1",
      true,
      { fetch: fetcher as typeof fetch },
    );

    expect(first.isFavorite).toBe(true);
    expect(repeated.isFavorite).toBe(true);
    expect(methods.filter((method) => method === "POST")).toHaveLength(1);
    expect(JSON.stringify(first)).not.toContain(input.accessToken);
  });

  it("sets played state idempotently and returns refreshed user data", async () => {
    let played = false;
    const methods: string[] = [];
    const fetcher = vi.fn(async (request: string | URL | Request, init) => {
      const url = new URL(String(request));
      const method = init?.method ?? "GET";
      methods.push(method);

      if (url.pathname.includes("/PlayedItems/")) {
        played = method === "POST";
        return new Response(undefined, { status: 204 });
      }

      expect(url.pathname).toBe("/Users/user-1/Items/movie-1");
      return new Response(
        JSON.stringify({
          Id: "movie-1",
          Name: "Movie",
          Type: "Movie",
          UserData: {
            IsFavorite: false,
            Played: played,
            PlayedPercentage: played ? 100 : undefined,
          },
        }),
      );
    });

    const first = await setPlayedState(
      "https://emby.example.com",
      input,
      "movie-1",
      true,
      { fetch: fetcher as typeof fetch },
    );
    const repeated = await setPlayedState(
      "https://emby.example.com",
      input,
      "movie-1",
      true,
      { fetch: fetcher as typeof fetch },
    );

    expect(first).toMatchObject({ isPlayed: true, playedPercentage: 100 });
    expect(repeated.isPlayed).toBe(true);
    expect(methods.filter((method) => method === "POST")).toHaveLength(1);
    expect(JSON.stringify(first)).not.toContain(input.accessToken);
  });
});
