import { describe, expect, it, vi } from "vitest";

import { getMediaHome, getMediaLibraries } from "./media-api.js";

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
});
