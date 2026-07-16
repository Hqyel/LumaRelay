import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCurrentServer,
  getCurrentUser,
  getPublicUsers,
  login,
  selectServer,
} from "./api.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Web Gateway client", () => {
  it("reads the current server with credentials", async () => {
    const fetcher = vi.fn().mockResolvedValue(
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
    const fetcher = vi.fn().mockResolvedValue(
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
    const fetcher = vi.fn().mockResolvedValue(
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
    const fetcher = vi.fn().mockResolvedValue(
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
});
