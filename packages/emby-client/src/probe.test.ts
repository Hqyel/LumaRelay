import { describe, expect, it, vi } from "vitest";

import type { EmbyProbeError } from "./index.js";
import { probeEmbyServer } from "./index.js";

describe("probeEmbyServer", () => {
  it("maps public server information to ServerSummary", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("Emby Server", { status: 200 }))
      .mockResolvedValueOnce(
        Response.json({
          Id: "server-id",
          ServerName: "Home Emby",
          Version: "4.8.11.0",
        }),
      )
      .mockResolvedValueOnce(Response.json([]));

    const result = await probeEmbyServer("https://emby.example.com/emby", {
      fetch: fetcher,
    });

    expect(result).toMatchObject({
      serverId: "server-id",
      name: "Home Emby",
      version: "4.8.11.0",
      baseUrl: "https://emby.example.com/emby/",
      supportsHttps: true,
      capabilityFlags: {
        imageProcessing: true,
        ping: true,
        publicInfo: true,
        publicUsers: true,
        userAuthentication: true,
        userItems: true,
        userViews: true,
      },
    });
    expect(fetcher.mock.calls[0]?.[0].toString()).toBe(
      "https://emby.example.com/emby/System/Ping",
    );
    expect(fetcher.mock.calls[2]?.[0].toString()).toBe(
      "https://emby.example.com/emby/Users/Public",
    );
  });

  it("records an unavailable optional public-users capability", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("Emby Server", { status: 200 }))
      .mockResolvedValueOnce(
        Response.json({
          Id: "server-id",
          ServerName: "Home Emby",
          Version: "4.8.11.0",
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 403 }));

    const result = await probeEmbyServer("https://emby.example.com", {
      fetch: fetcher,
    });

    expect(result.capabilityFlags.publicUsers).toBe(false);
    expect(result.version).toBe("4.8.11.0");
  });

  it("measures only the Ping request as server latency", async () => {
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(124.6);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("Emby Server", { status: 200 }))
      .mockResolvedValueOnce(
        Response.json({
          Id: "server-id",
          ServerName: "Home Emby",
          Version: "4.8.11.0",
        }),
      )
      .mockResolvedValueOnce(Response.json([]));

    const result = await probeEmbyServer("https://emby.example.com", {
      fetch: fetcher,
      now,
    });

    expect(result.latencyMs).toBe(25);
    expect(now).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("classifies timeout errors", async () => {
    const timeout = new DOMException("Timed out", "TimeoutError");
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(timeout);

    await expect(
      probeEmbyServer("https://emby.example.com", { fetch: fetcher }),
    ).rejects.toMatchObject({
      kind: "timeout",
    } satisfies Partial<EmbyProbeError>);
  });

  it("classifies TLS certificate errors", async () => {
    const cause = Object.assign(new Error("certificate"), {
      code: "CERT_HAS_EXPIRED",
    });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("fetch failed", { cause }));

    await expect(
      probeEmbyServer("https://emby.example.com", { fetch: fetcher }),
    ).rejects.toMatchObject({ kind: "tls" } satisfies Partial<EmbyProbeError>);
  });

  it("rejects unsupported Emby versions", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("Emby Server", { status: 200 }))
      .mockResolvedValueOnce(
        Response.json({
          Id: "server-id",
          ServerName: "Old Emby",
          Version: "3.6.0.0",
        }),
      );

    await expect(
      probeEmbyServer("https://emby.example.com", { fetch: fetcher }),
    ).rejects.toMatchObject({
      kind: "unsupported-version",
    } satisfies Partial<EmbyProbeError>);
  });
});
