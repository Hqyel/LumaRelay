import { describe, expect, it } from "vitest";

import {
  BRIDGE_PAIRING_CODE_LIFETIME_SECONDS,
  BridgePairingCodeResponseSchema,
  CurrentServerResponseSchema,
  ErrorEnvelopeSchema,
  HealthResponseSchema,
  MediaHomeResponseSchema,
  ProbeServerRequestSchema,
  ProbeServerResponseSchema,
} from "./index.js";

describe("shared API contracts", () => {
  it("accepts the health response wire shape", () => {
    const result = HealthResponseSchema.safeParse({
      status: "ok",
      service: "gateway",
      version: "0.0.0",
      requestId: "request-1",
    });

    expect(result.success).toBe(true);
  });

  it("rejects non-URL server probe inputs", () => {
    const result = ProbeServerRequestSchema.safeParse({
      baseUrl: "not-a-url",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a server summary carrying serverId", () => {
    const result = ProbeServerResponseSchema.safeParse({
      requestId: "request-2",
      server: {
        serverId: "emby-server-id",
        name: "Home Emby",
        version: "4.8.11.0",
        baseUrl: "https://emby.example.com",
        latencyMs: 42,
        supportsHttps: true,
        capabilityFlags: {
          publicInfo: true,
          ping: true,
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it("requires request IDs in error envelopes", () => {
    const result = ErrorEnvelopeSchema.safeParse({
      error: {
        code: "SERVER_TIMEOUT",
        message: "Timed out",
      },
    });

    expect(result.success).toBe(false);
  });

  it("accepts an empty current-server response", () => {
    const result = CurrentServerResponseSchema.safeParse({
      configuredBaseUrl: "http://127.0.0.1:8096/",
      requestId: "request-3",
      server: null,
    });

    expect(result.success).toBe(true);
  });

  it("accepts an empty authenticated media home", () => {
    expect(
      MediaHomeResponseSchema.safeParse({
        favoriteItems: [],
        genreRows: [],
        hero: null,
        latestMovies: [],
        latestSeries: [],
        requestId: "request-media-home",
        resumeItems: [],
      }).success,
    ).toBe(true);
  });

  it("accepts a 60-second opaque Bridge pairing code", () => {
    const result = BridgePairingCodeResponseSchema.safeParse({
      expiresAt: "2026-07-17T12:01:00.000Z",
      expiresInSeconds: BRIDGE_PAIRING_CODE_LIFETIME_SECONDS,
      pairingCode: "A".repeat(43),
      requestId: "request-pairing-code",
    });

    expect(result.success).toBe(true);
    expect(
      BridgePairingCodeResponseSchema.safeParse({
        expiresAt: "2026-07-17T12:01:00.000Z",
        expiresInSeconds: 120,
        pairingCode: "short-code",
        requestId: "request-pairing-code",
      }).success,
    ).toBe(false);
  });
});
