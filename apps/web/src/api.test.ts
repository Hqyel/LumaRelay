import { afterEach, describe, expect, it, vi } from "vitest";

import { getCurrentServer, selectServer } from "./api.js";

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
});
