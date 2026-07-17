import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  getCurrentServer,
  getCurrentUser,
  getPublicUsers,
  login,
  logout,
  selectServer,
  setFavorite,
  subscribeToUnauthorized,
} from "./api.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Web Gateway client", () => {
  function csrfAwareFetcher(response: Response) {
    return vi.fn().mockImplementation((input: string) =>
      Promise.resolve(
        input === "/api/v1/security/csrf"
          ? new Response(
              JSON.stringify({
                csrfToken: "test-csrf-token-with-at-least-32-characters",
                requestId: "csrf-request",
              }),
              { status: 200 },
            )
          : response.clone(),
      ),
    );
  }

  it("reads the current server with credentials", async () => {
    const fetcher = csrfAwareFetcher(
      new Response(
        JSON.stringify({
          configuredBaseUrl: "http://127.0.0.1:8096/",
          requestId: "request-1",
          server: null,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(getCurrentServer()).resolves.toMatchObject({ server: null });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/servers/current",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("reads the authenticated user only through the Gateway", async () => {
    const fetcher = csrfAwareFetcher(
      new Response(
        JSON.stringify({
          requestId: "request-2",
          server: {
            baseUrl: "https://emby.example.com/",
            capabilityFlags: { ping: true, publicInfo: true },
            latencyMs: 10,
            name: "Home Emby",
            serverId: "server-1",
            supportsHttps: true,
            version: "4.8.11.0",
          },
          user: {
            name: "Alex",
            permissions: {
              canDownload: true,
              canManageServer: true,
              isAdministrator: true,
            },
            serverId: "server-1",
            userId: "user-1",
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(getCurrentUser()).resolves.toMatchObject({
      user: { userId: "user-1" },
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/auth/me",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("posts a server selection as JSON", async () => {
    const fetcher = csrfAwareFetcher(
      new Response(
        JSON.stringify({
          requestId: "request-2",
          server: {
            baseUrl: "http://127.0.0.1:8096/",
            capabilityFlags: { ping: true, publicInfo: true },
            latencyMs: 10,
            name: "Home Emby",
            serverId: "server-id",
            supportsHttps: false,
            version: "4.8.11.0",
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetcher);

    await selectServer("http://127.0.0.1:8096");

    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/servers/select",
      expect.objectContaining({
        body: JSON.stringify({ baseUrl: "http://127.0.0.1:8096" }),
        method: "POST",
      }),
    );
    const selectionCall = fetcher.mock.calls.find(
      ([input]) => input === "/api/v1/servers/select",
    );
    expect(new Headers(selectionCall?.[1]?.headers).get("x-newemby-csrf")).toBe(
      "test-csrf-token-with-at-least-32-characters",
    );
  });

  it("reads public users through the Gateway", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          requestId: "request-3",
          users: [
            {
              hasPassword: true,
              name: "Alex",
              userId: "user-1",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(getPublicUsers()).resolves.toMatchObject({
      users: [{ userId: "user-1" }],
    });
  });

  it("posts credentials only to the Gateway login endpoint", async () => {
    const fetcher = csrfAwareFetcher(
      new Response(
        JSON.stringify({
          requestId: "request-4",
          server: {
            baseUrl: "https://emby.example.com/",
            capabilityFlags: { ping: true, publicInfo: true },
            latencyMs: 10,
            name: "Home Emby",
            serverId: "server-1",
            supportsHttps: true,
            version: "4.8.11.0",
          },
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
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetcher);

    await login({ password: "password", username: "Alex" });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/auth/login",
      expect.objectContaining({ credentials: "include", method: "POST" }),
    );
  });

  it("posts logout only to the Gateway", async () => {
    const fetcher = csrfAwareFetcher(
      new Response(JSON.stringify({ requestId: "request-5", success: true }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(logout()).resolves.toMatchObject({ success: true });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/auth/logout",
      expect.objectContaining({ credentials: "include", method: "POST" }),
    );
  });

  it("puts favorite state through the CSRF-protected Gateway", async () => {
    const fetcher = csrfAwareFetcher(
      new Response(
        JSON.stringify({
          requestId: "request-favorite",
          state: {
            isFavorite: true,
            isPlayed: false,
            itemId: "movie-1",
            playbackPositionSeconds: 0,
            serverId: "server-1",
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(setFavorite("movie-1", true)).resolves.toMatchObject({
      state: { isFavorite: true },
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/media/items/movie-1/favorite",
      expect.objectContaining({
        body: JSON.stringify({ favorite: true }),
        credentials: "include",
        method: "PUT",
      }),
    );
  });

  it("refreshes the CSRF token once when the Gateway rejects it", async () => {
    let csrfReads = 0;
    let selectionWrites = 0;
    const fetcher = vi.fn().mockImplementation((input: string) => {
      if (input === "/api/v1/security/csrf") {
        csrfReads++;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              csrfToken: `refreshed-csrf-token-${csrfReads}-with-padding`,
              requestId: `csrf-${csrfReads}`,
            }),
            { status: 200 },
          ),
        );
      }

      selectionWrites++;
      if (selectionWrites === 1)
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "CSRF_INVALID",
                message: "Refresh CSRF",
                requestId: "selection-1",
              },
            }),
            { status: 403 },
          ),
        );

      return Promise.resolve(
        new Response(
          JSON.stringify({
            requestId: "selection-2",
            server: {
              baseUrl: "http://127.0.0.1:8096/",
              capabilityFlags: { ping: true, publicInfo: true },
              latencyMs: 10,
              name: "Home Emby",
              serverId: "server-id",
              supportsHttps: false,
              version: "4.8.11.0",
            },
          }),
          { status: 200 },
        ),
      );
    });
    vi.stubGlobal("fetch", fetcher);

    await expect(selectServer("http://127.0.0.1:8096")).resolves.toMatchObject({
      server: { serverId: "server-id" },
    });
    expect(csrfReads).toBeGreaterThanOrEqual(1);
    expect(selectionWrites).toBe(2);
  });

  it("notifies recovery only for an unauthenticated session", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToUnauthorized(listener);

    try {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              error: {
                code: "UNAUTHENTICATED",
                message: "Session expired",
                requestId: "request-6",
              },
            }),
            { status: 401 },
          ),
        ),
      );
      await expect(getCurrentUser()).rejects.toMatchObject({
        code: "UNAUTHENTICATED",
      });
      expect(listener).toHaveBeenCalledTimes(1);

      vi.stubGlobal(
        "fetch",
        csrfAwareFetcher(
          new Response(
            JSON.stringify({
              error: {
                code: "AUTH_INVALID_CREDENTIALS",
                message: "Invalid credentials",
                requestId: "request-7",
              },
            }),
            { status: 401 },
          ),
        ),
      );
      await expect(
        login({ password: "wrong", username: "Alex" }),
      ).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS" });
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it("preserves status and request ID for a non-JSON proxy error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Bad gateway", {
          headers: {
            "content-type": "text/plain",
            "x-request-id": "proxy-request-1",
          },
          status: 502,
        }),
      ),
    );

    const error = await getCurrentServer().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: "HTTP_ERROR",
      requestId: "proxy-request-1",
      statusCode: 502,
    });
  });
});
