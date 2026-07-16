import { describe, expect, it } from "vitest";

import {
  ErrorEnvelopeSchema,
  HealthResponseSchema,
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
});
