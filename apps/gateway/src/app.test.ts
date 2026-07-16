import { EmbyProbeError } from "@newemby/emby-client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

async function createTestApp() {
  const app = await buildApp({
    config: loadConfig({ NODE_ENV: "test" }),
    logger: false,
    version: "test-version",
  });
  apps.push(app);
  return app;
}

describe("Gateway application", () => {
  it("returns a typed health response and request ID", async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).toBeTypeOf("string");
    expect(response.json()).toEqual({
      status: "ok",
      service: "gateway",
      version: "test-version",
      requestId: response.headers["x-request-id"],
    });
  });

  it("reuses a valid caller request ID", async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
      headers: {
        "x-request-id": "browser-request-1",
      },
    });

    expect(response.headers["x-request-id"]).toBe("browser-request-1");
  });

  it("returns the unified not-found envelope", async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/missing",
    });
    const body = response.json();

    expect(response.statusCode).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.requestId).toBe(response.headers["x-request-id"]);
  });

  it("generates OpenAPI from the health contract", async () => {
    const app = await createTestApp();
    await app.ready();
    const document = app.swagger();

    expect("openapi" in document ? document.openapi : undefined).toBe("3.1.0");
    expect(document.paths?.["/api/v1/health"]).toBeDefined();
  });

  it("probes an allowed Emby origin", async () => {
    const probeServer = vi.fn().mockResolvedValue({
      serverId: "server-id",
      name: "Home Emby",
      version: "4.8.11.0",
      baseUrl: "http://127.0.0.1:8096/",
      latencyMs: 20,
      supportsHttps: false,
      capabilityFlags: {
        publicInfo: true,
        ping: true,
      },
    });
    const app = await buildApp({
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      probeServer,
    });
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/servers/probe",
      payload: { baseUrl: "http://127.0.0.1:8096" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().server.serverId).toBe("server-id");
    expect(probeServer).toHaveBeenCalledWith("http://127.0.0.1:8096");
  });

  it("rejects an Emby origin outside the deployment allowlist", async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/servers/probe",
      payload: { baseUrl: "https://blocked.example.com" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("SERVER_NOT_ALLOWED");
  });

  it("maps Emby timeout errors to the public contract", async () => {
    const app = await buildApp({
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      probeServer: vi
        .fn()
        .mockRejectedValue(new EmbyProbeError("timeout", "Timed out")),
    });
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/servers/probe",
      payload: { baseUrl: "http://127.0.0.1:8096" },
    });

    expect(response.statusCode).toBe(408);
    expect(response.json().error.code).toBe("SERVER_TIMEOUT");
  });
});
