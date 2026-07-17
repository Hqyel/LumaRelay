import type { MediaHomeResponse, MediaItemResponse } from "@newemby/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import type { AuthSessionStore } from "./database/auth-session-store.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

function authStore(): AuthSessionStore {
  return {
    create: vi.fn(),
    find: vi.fn().mockResolvedValue({
      accessToken: "encrypted-at-rest-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
      sessionId: "session-1",
      user: {
        name: "Alex",
        permissions: {
          canDownload: true,
          canManageServer: false,
          isAdministrator: false,
        },
        serverId: "server-1",
        userId: "user-1",
      },
    }),
    getDeviceId: vi.fn().mockResolvedValue("device-1"),
    pruneInactive: vi.fn(),
    revoke: vi.fn(),
    revokeServerSessions: vi.fn(),
    updateUser: vi.fn(),
  };
}

describe("authenticated media routes", () => {
  it("returns the home domain model without an Emby token", async () => {
    const home: Omit<MediaHomeResponse, "requestId"> = {
      favoriteItems: [],
      genreRows: [],
      hero: null,
      latestMovies: [],
      latestSeries: [],
      resumeItems: [],
    };
    const getHome = vi.fn().mockResolvedValue(home);
    const app = await buildApp({
      authSessionStore: authStore(),
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      media: { getHome },
      serverStore: {
        getCurrent: vi.fn().mockResolvedValue({
          baseUrl: "http://127.0.0.1:8096/",
          capabilityFlags: { ping: true, publicInfo: true },
          latencyMs: 1,
          name: "Emby",
          serverId: "server-1",
          supportsHttps: false,
          version: "4.8.11.0",
        }),
        select: vi.fn(),
      },
    });
    apps.push(app);

    const response = await app.inject({
      headers: { cookie: "newemby_session=session-cookie" },
      method: "GET",
      url: "/api/v1/media/home",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ...home, requestId: expect.any(String) });
    expect(response.body).not.toContain("encrypted-at-rest-token");
    expect(getHome).toHaveBeenCalledWith(
      "http://127.0.0.1:8096/",
      expect.objectContaining({ userId: "user-1" }),
    );
  });

  it("requires a NewEmby session before proxying media", async () => {
    const app = await buildApp({
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      serverStore: {
        getCurrent: vi.fn().mockResolvedValue({
          baseUrl: "http://127.0.0.1:8096/",
          capabilityFlags: { ping: true, publicInfo: true },
          latencyMs: 1,
          name: "Emby",
          serverId: "server-1",
          supportsHttps: false,
          version: "4.8.11.0",
        }),
        select: vi.fn(),
      },
    });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/media/home",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHENTICATED");
  });

  it("passes validated pagination to the authenticated media client", async () => {
    const getItems = vi.fn().mockResolvedValue({
      items: [],
      limit: 40,
      startIndex: 40,
      total: 80,
    });
    const app = await buildApp({
      authSessionStore: authStore(),
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      media: { getItems },
      serverStore: {
        getCurrent: vi.fn().mockResolvedValue({
          baseUrl: "http://127.0.0.1:8096/",
          capabilityFlags: { ping: true, publicInfo: true },
          latencyMs: 1,
          name: "Emby",
          serverId: "server-1",
          supportsHttps: false,
          version: "4.8.11.0",
        }),
        select: vi.fn(),
      },
    });
    apps.push(app);

    const response = await app.inject({
      headers: { cookie: "newemby_session=session-cookie" },
      method: "GET",
      url: "/api/v1/media/items?kind=movie&startIndex=40&limit=40&sortBy=dateAdded&sortOrder=descending",
    });

    expect(response.statusCode).toBe(200);
    expect(getItems).toHaveBeenCalledWith(
      "http://127.0.0.1:8096/",
      expect.any(Object),
      expect.objectContaining({ kind: "movie", startIndex: 40 }),
    );
  });

  it("returns an authenticated movie detail without exposing credentials", async () => {
    const detail: Omit<MediaItemResponse, "requestId"> = {
      item: {
        genres: ["Drama"],
        isFavorite: false,
        isPlayed: false,
        itemId: "movie-1",
        kind: "movie",
        playbackPositionSeconds: 0,
        serverId: "server-1",
        title: "Example Movie",
      },
      people: [],
      relatedItems: [],
    };
    const getItem = vi.fn().mockResolvedValue(detail);
    const app = await buildApp({
      authSessionStore: authStore(),
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      media: { getItem },
      serverStore: {
        getCurrent: vi.fn().mockResolvedValue({
          baseUrl: "http://127.0.0.1:8096/",
          capabilityFlags: { ping: true, publicInfo: true },
          latencyMs: 1,
          name: "Emby",
          serverId: "server-1",
          supportsHttps: false,
          version: "4.8.11.0",
        }),
        select: vi.fn(),
      },
    });
    apps.push(app);

    const response = await app.inject({
      headers: { cookie: "newemby_session=session-cookie" },
      method: "GET",
      url: "/api/v1/media/items/movie-1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ...detail,
      requestId: expect.any(String),
    });
    expect(response.body).not.toContain("encrypted-at-rest-token");
    expect(getItem).toHaveBeenCalledWith(
      "http://127.0.0.1:8096/",
      expect.objectContaining({ userId: "user-1" }),
      "movie-1",
    );
  });

  it("returns seasons and episodes for the authenticated user", async () => {
    const getSeasons = vi.fn().mockResolvedValue({
      seasons: [
        {
          isPlayed: false,
          name: "Season 1",
          seasonId: "season-1",
          serverId: "server-1",
          unplayedEpisodeCount: 1,
        },
      ],
    });
    const getEpisodes = vi.fn().mockResolvedValue({
      episodes: [
        {
          episodeId: "episode-1",
          isPlayed: false,
          name: "Pilot",
          playbackPositionSeconds: 0,
          seasonId: "season-1",
          seriesId: "series-1",
          serverId: "server-1",
        },
      ],
    });
    const app = await buildApp({
      authSessionStore: authStore(),
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      media: { getEpisodes, getSeasons },
      serverStore: {
        getCurrent: vi.fn().mockResolvedValue({
          baseUrl: "http://127.0.0.1:8096/",
          capabilityFlags: { ping: true, publicInfo: true },
          latencyMs: 1,
          name: "Emby",
          serverId: "server-1",
          supportsHttps: false,
          version: "4.8.11.0",
        }),
        select: vi.fn(),
      },
    });
    apps.push(app);

    const headers = { cookie: "newemby_session=session-cookie" };
    const seasons = await app.inject({
      headers,
      method: "GET",
      url: "/api/v1/media/series/series-1/seasons",
    });
    const episodes = await app.inject({
      headers,
      method: "GET",
      url: "/api/v1/media/series/series-1/episodes?seasonId=season-1",
    });

    expect(seasons.statusCode).toBe(200);
    expect(episodes.statusCode).toBe(200);
    expect(getSeasons).toHaveBeenCalledWith(
      "http://127.0.0.1:8096/",
      expect.objectContaining({ userId: "user-1" }),
      "series-1",
    );
    expect(getEpisodes).toHaveBeenCalledWith(
      "http://127.0.0.1:8096/",
      expect.objectContaining({ userId: "user-1" }),
      "series-1",
      "season-1",
    );
  });

  it("rejects a library ID outside the current user's views", async () => {
    const getItems = vi.fn();
    const app = await buildApp({
      authSessionStore: authStore(),
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      media: {
        getItems,
        getLibraries: vi.fn().mockResolvedValue([]),
      },
      serverStore: {
        getCurrent: vi.fn().mockResolvedValue({
          baseUrl: "http://127.0.0.1:8096/",
          capabilityFlags: { ping: true, publicInfo: true },
          latencyMs: 1,
          name: "Emby",
          serverId: "server-1",
          supportsHttps: false,
          version: "4.8.11.0",
        }),
        select: vi.fn(),
      },
    });
    apps.push(app);

    const response = await app.inject({
      headers: { cookie: "newemby_session=session-cookie" },
      method: "GET",
      url: "/api/v1/media/items?libraryId=hidden-library",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("ACCESS_DENIED");
    expect(getItems).not.toHaveBeenCalled();
  });
});
