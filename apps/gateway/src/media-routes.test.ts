import type { MediaHomeResponse } from "@newemby/contracts";
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
});
