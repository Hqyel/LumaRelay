import { EmbyAuthError, EmbyProbeError } from "@newemby/emby-client";
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

async function stateChangeHeaders(
  app: Awaited<ReturnType<typeof buildApp>>,
  sessionCookie?: string,
) {
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/security/csrf",
  });
  const setCookie = response.headers["set-cookie"];
  const csrfCookie = (
    Array.isArray(setCookie) ? setCookie[0] : setCookie
  )?.split(";")[0];
  const cookie = [csrfCookie, sessionCookie].filter(Boolean).join("; ");

  return {
    cookie,
    origin: "http://127.0.0.1:5173",
    "x-newemby-csrf": response.json().csrfToken as string,
  };
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
    expect(document.paths?.["/api/v1/security/csrf"]).toBeDefined();
  });

  it("issues an HttpOnly signed CSRF cookie", async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/security/csrf",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().csrfToken).toHaveLength(43);
    expect(response.headers["set-cookie"]).toContain("newemby_csrf=");
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]).toContain("SameSite=Lax");
  });

  it("requires CSRF for state changes but not server probes", async () => {
    const probeServer = vi.fn().mockResolvedValue({
      baseUrl: "http://127.0.0.1:8096/",
      capabilityFlags: { ping: true, publicInfo: true },
      latencyMs: 15,
      name: "Home Emby",
      serverId: "server-id",
      supportsHttps: false,
      version: "4.8.11.0",
    });
    const app = await buildApp({
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      probeServer,
    });
    apps.push(app);

    const probe = await app.inject({
      method: "POST",
      payload: { baseUrl: "http://127.0.0.1:8096" },
      url: "/api/v1/servers/probe",
    });
    const selection = await app.inject({
      headers: { origin: "http://127.0.0.1:5173" },
      method: "POST",
      payload: { baseUrl: "http://127.0.0.1:8096" },
      url: "/api/v1/servers/select",
    });

    expect(probe.statusCode).toBe(200);
    expect(selection.statusCode).toBe(403);
    expect(selection.json().error.code).toBe("CSRF_INVALID");
  });

  it("rejects a CSRF header that does not match the signed cookie", async () => {
    const app = await createTestApp();
    const headers = await stateChangeHeaders(app);
    const response = await app.inject({
      headers: { ...headers, "x-newemby-csrf": "tampered-token" },
      method: "POST",
      url: "/api/v1/auth/logout",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("CSRF_INVALID");
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

  it("selects and returns the current Emby server", async () => {
    const probeServer = vi.fn().mockResolvedValue({
      baseUrl: "http://127.0.0.1:8096/",
      capabilityFlags: { ping: true, publicInfo: true },
      latencyMs: 15,
      name: "Home Emby",
      serverId: "server-id",
      supportsHttps: false,
      version: "4.8.11.0",
    });
    const app = await buildApp({
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      probeServer,
    });
    apps.push(app);

    const selection = await app.inject({
      headers: await stateChangeHeaders(app),
      method: "POST",
      payload: { baseUrl: "http://127.0.0.1:8096" },
      url: "/api/v1/servers/select",
    });
    const current = await app.inject({
      method: "GET",
      url: "/api/v1/servers/current",
    });

    expect(selection.statusCode).toBe(200);
    expect(current.statusCode).toBe(200);
    expect(current.json().server.serverId).toBe("server-id");
    expect(current.json().configuredBaseUrl).toBe("http://127.0.0.1:8096/");
  });

  it("revokes old server sessions only when the probed server ID changes", async () => {
    const oldServer = {
      baseUrl: "http://127.0.0.1:8096/",
      capabilityFlags: { ping: true, publicInfo: true },
      latencyMs: 15,
      name: "Old Emby",
      serverId: "server-old",
      supportsHttps: false,
      version: "4.8.11.0",
    };
    const newServer = {
      ...oldServer,
      name: "New Emby",
      serverId: "server-new",
    };
    const session = {
      accessToken: "old-emby-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
      sessionId: "session-id",
      user: {
        name: "Alex",
        permissions: {
          canDownload: true,
          canManageServer: false,
          isAdministrator: false,
        },
        serverId: "server-old",
        userId: "user-1",
      },
    };
    const authSessionStore = {
      create: vi.fn(),
      find: vi.fn(),
      getDeviceId: vi.fn().mockResolvedValue("gateway-device-id"),
      pruneInactive: vi.fn(),
      revoke: vi.fn(),
      revokeServerSessions: vi.fn().mockResolvedValue([session]),
      updateUser: vi.fn(),
    };
    const logoutSession = vi.fn();
    const bridgeDeviceStore = {
      authenticate: vi.fn(),
      listForUser: vi.fn(),
      revokeAuthenticated: vi.fn(),
      revokeForUser: vi.fn(),
      revokeServerDevices: vi.fn().mockResolvedValue(1),
    };
    const probeServer = vi
      .fn()
      .mockResolvedValueOnce(oldServer)
      .mockResolvedValueOnce(oldServer)
      .mockResolvedValueOnce(newServer);
    const app = await buildApp({
      authSessionStore,
      bridgeDeviceStore,
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      logoutSession,
      probeServer,
    });
    apps.push(app);

    for (let index = 0; index < 3; index++) {
      const response = await app.inject({
        headers: await stateChangeHeaders(app),
        method: "POST",
        payload: { baseUrl: "http://127.0.0.1:8096" },
        url: "/api/v1/servers/select",
      });
      expect(response.statusCode).toBe(200);
    }

    expect(authSessionStore.revokeServerSessions).toHaveBeenCalledOnce();
    expect(authSessionStore.revokeServerSessions).toHaveBeenCalledWith(
      "server-old",
    );
    expect(bridgeDeviceStore.revokeServerDevices).toHaveBeenCalledOnce();
    expect(bridgeDeviceStore.revokeServerDevices).toHaveBeenCalledWith(
      "server-old",
    );
    expect(logoutSession).toHaveBeenCalledWith(
      oldServer.baseUrl,
      expect.objectContaining({ accessToken: "old-emby-token" }),
    );
  });

  it("preserves the current session when a replacement probe fails", async () => {
    const server = {
      baseUrl: "http://127.0.0.1:8096/",
      capabilityFlags: { ping: true, publicInfo: true },
      latencyMs: 15,
      name: "Home Emby",
      serverId: "server-id",
      supportsHttps: false,
      version: "4.8.11.0",
    };
    const authSessionStore = {
      create: vi.fn(),
      find: vi.fn(),
      getDeviceId: vi.fn(),
      pruneInactive: vi.fn(),
      revoke: vi.fn(),
      revokeServerSessions: vi.fn(),
      updateUser: vi.fn(),
    };
    const probeServer = vi
      .fn()
      .mockResolvedValueOnce(server)
      .mockRejectedValueOnce(new EmbyProbeError("timeout", "Timed out"));
    const app = await buildApp({
      authSessionStore,
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      probeServer,
    });
    apps.push(app);

    await app.inject({
      headers: await stateChangeHeaders(app),
      method: "POST",
      payload: { baseUrl: "http://127.0.0.1:8096" },
      url: "/api/v1/servers/select",
    });
    const failed = await app.inject({
      headers: await stateChangeHeaders(app),
      method: "POST",
      payload: { baseUrl: "http://127.0.0.1:8096" },
      url: "/api/v1/servers/select",
    });
    const current = await app.inject({
      method: "GET",
      url: "/api/v1/servers/current",
    });

    expect(failed.statusCode).toBe(408);
    expect(current.json().server.serverId).toBe("server-id");
    expect(authSessionStore.revokeServerSessions).not.toHaveBeenCalled();
  });

  it("returns public users and proxies avatar bytes", async () => {
    const getPublicUsers = vi.fn().mockResolvedValue([
      {
        avatarUrl: "/api/v1/auth/public-users/user-1/avatar",
        hasPassword: true,
        name: "Alex",
        primaryImageTag: "image-tag",
        userId: "user-1",
      },
    ]);
    const getPublicUserAvatar = vi.fn().mockResolvedValue({
      body: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
      etag: "image-tag",
    });
    const app = await buildApp({
      config: loadConfig({ NODE_ENV: "test" }),
      getPublicUserAvatar,
      getPublicUsers,
      logger: false,
      probeServer: vi.fn().mockResolvedValue({
        baseUrl: "http://127.0.0.1:8096/",
        capabilityFlags: { ping: true, publicInfo: true },
        latencyMs: 15,
        name: "Home Emby",
        serverId: "server-id",
        supportsHttps: false,
        version: "4.8.11.0",
      }),
    });
    apps.push(app);
    await app.inject({
      headers: await stateChangeHeaders(app),
      method: "POST",
      payload: { baseUrl: "http://127.0.0.1:8096" },
      url: "/api/v1/servers/select",
    });

    const users = await app.inject({
      method: "GET",
      url: "/api/v1/auth/public-users",
    });
    const avatar = await app.inject({
      method: "GET",
      url: "/api/v1/auth/public-users/user-1/avatar",
    });

    expect(users.statusCode).toBe(200);
    expect(users.json().users[0].name).toBe("Alex");
    expect(avatar.statusCode).toBe(200);
    expect(avatar.headers["content-type"]).toBe("image/png");
    expect(avatar.rawPayload).toEqual(Buffer.from([1, 2, 3]));
  });

  it("creates an HttpOnly session without exposing the Emby token", async () => {
    const authenticateUser = vi.fn().mockResolvedValue({
      accessToken: "emby-secret-token",
      user: {
        name: "Alex",
        permissions: {
          canDownload: true,
          canManageServer: false,
          isAdministrator: false,
        },
        serverId: "server-id",
        userId: "user-1",
      },
    });
    const authSessionStore = {
      create: vi.fn().mockResolvedValue("browser-session-token"),
      find: vi.fn(),
      getDeviceId: vi.fn().mockResolvedValue("gateway-device-id"),
      pruneInactive: vi.fn(),
      revoke: vi.fn(),
      revokeServerSessions: vi.fn().mockResolvedValue([]),
      updateUser: vi.fn(),
    };
    const app = await buildApp({
      authSessionStore,
      authenticateUser,
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      probeServer: vi.fn().mockResolvedValue({
        baseUrl: "http://127.0.0.1:8096/",
        capabilityFlags: { ping: true, publicInfo: true },
        latencyMs: 15,
        name: "Home Emby",
        serverId: "server-id",
        supportsHttps: false,
        version: "4.8.11.0",
      }),
    });
    apps.push(app);
    await app.inject({
      headers: await stateChangeHeaders(app),
      method: "POST",
      payload: { baseUrl: "http://127.0.0.1:8096" },
      url: "/api/v1/servers/select",
    });

    const response = await app.inject({
      headers: await stateChangeHeaders(app),
      method: "POST",
      payload: { password: "correct-password", username: "Alex" },
      url: "/api/v1/auth/login",
    });
    const serialized = JSON.stringify(response.json());

    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"]).toContain(
      "newemby_session=browser-session-token",
    );
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]).toContain("SameSite=Lax");
    expect(serialized).not.toContain("emby-secret-token");
    expect(authSessionStore.create).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "emby-secret-token" }),
    );
  });

  it("logs out the upstream session when local persistence fails", async () => {
    const authentication = {
      accessToken: "emby-secret-token",
      user: {
        name: "Alex",
        permissions: {
          canDownload: true,
          canManageServer: false,
          isAdministrator: false,
        },
        serverId: "server-id",
        userId: "user-1",
      },
    };
    const authSessionStore = {
      create: vi.fn().mockRejectedValue(new Error("SQLite write failed")),
      find: vi.fn(),
      getDeviceId: vi.fn().mockResolvedValue("gateway-device-id"),
      pruneInactive: vi.fn(),
      revoke: vi.fn(),
      revokeServerSessions: vi.fn().mockResolvedValue([]),
      updateUser: vi.fn(),
    };
    const logoutSession = vi.fn();
    const app = await buildApp({
      authSessionStore,
      authenticateUser: vi.fn().mockResolvedValue(authentication),
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      logoutSession,
      probeServer: vi.fn().mockResolvedValue({
        baseUrl: "http://127.0.0.1:8096/",
        capabilityFlags: { ping: true, publicInfo: true },
        latencyMs: 15,
        name: "Home Emby",
        serverId: "server-id",
        supportsHttps: false,
        version: "4.8.11.0",
      }),
    });
    apps.push(app);
    await app.inject({
      headers: await stateChangeHeaders(app),
      method: "POST",
      payload: { baseUrl: "http://127.0.0.1:8096" },
      url: "/api/v1/servers/select",
    });

    const response = await app.inject({
      headers: await stateChangeHeaders(app),
      method: "POST",
      payload: { password: "correct-password", username: "Alex" },
      url: "/api/v1/auth/login",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(response.json())).not.toContain("emby-secret-token");
    expect(logoutSession).toHaveBeenCalledWith("http://127.0.0.1:8096/", {
      accessToken: "emby-secret-token",
      deviceId: "gateway-device-id",
    });
  });

  it("refreshes the current user without exposing session secrets", async () => {
    const refreshedUser = {
      name: "Alex",
      permissions: {
        canDownload: true,
        canManageServer: true,
        isAdministrator: true,
      },
      serverId: "server-id",
      userId: "user-1",
    };
    const authSessionStore = {
      create: vi.fn(),
      find: vi.fn().mockResolvedValue({
        accessToken: "emby-secret-token",
        expiresAt: "2099-01-01T00:00:00.000Z",
        sessionId: "session-id",
        user: refreshedUser,
      }),
      getDeviceId: vi.fn().mockResolvedValue("gateway-device-id"),
      pruneInactive: vi.fn(),
      revoke: vi.fn(),
      revokeServerSessions: vi.fn().mockResolvedValue([]),
      updateUser: vi.fn(),
    };
    const getAuthenticatedUser = vi.fn().mockResolvedValue(refreshedUser);
    const app = await buildApp({
      authSessionStore,
      config: loadConfig({ NODE_ENV: "test" }),
      getAuthenticatedUser,
      logger: false,
      probeServer: vi.fn().mockResolvedValue({
        baseUrl: "http://127.0.0.1:8096/",
        capabilityFlags: { ping: true, publicInfo: true },
        latencyMs: 15,
        name: "Home Emby",
        serverId: "server-id",
        supportsHttps: false,
        version: "4.8.11.0",
      }),
    });
    apps.push(app);
    await app.inject({
      headers: await stateChangeHeaders(app),
      method: "POST",
      payload: { baseUrl: "http://127.0.0.1:8096" },
      url: "/api/v1/servers/select",
    });

    const response = await app.inject({
      headers: { cookie: "newemby_session=browser-session-token" },
      method: "GET",
      url: "/api/v1/auth/me",
    });
    const serialized = JSON.stringify(response.json());

    expect(response.statusCode).toBe(200);
    expect(response.json().user.permissions.isAdministrator).toBe(true);
    expect(serialized).not.toContain("emby-secret-token");
    expect(getAuthenticatedUser).toHaveBeenCalledWith(
      "http://127.0.0.1:8096/",
      expect.objectContaining({ accessToken: "emby-secret-token" }),
    );
    expect(authSessionStore.updateUser).toHaveBeenCalledWith(
      "session-id",
      refreshedUser,
    );
  });

  it("revokes a cookie session that belongs to another server", async () => {
    const authSessionStore = {
      create: vi.fn(),
      find: vi.fn().mockResolvedValue({
        accessToken: "old-token",
        expiresAt: "2099-01-01T00:00:00.000Z",
        sessionId: "session-id",
        user: {
          name: "Alex",
          permissions: {
            canDownload: true,
            canManageServer: false,
            isAdministrator: false,
          },
          serverId: "server-old",
          userId: "user-1",
        },
      }),
      getDeviceId: vi.fn(),
      pruneInactive: vi.fn(),
      revoke: vi.fn(),
      revokeServerSessions: vi.fn().mockResolvedValue([]),
      updateUser: vi.fn(),
    };
    const app = await buildApp({
      authSessionStore,
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      probeServer: vi.fn().mockResolvedValue({
        baseUrl: "http://127.0.0.1:8096/",
        capabilityFlags: { ping: true, publicInfo: true },
        latencyMs: 15,
        name: "Home Emby",
        serverId: "server-current",
        supportsHttps: false,
        version: "4.8.11.0",
      }),
    });
    apps.push(app);
    await app.inject({
      headers: await stateChangeHeaders(app),
      method: "POST",
      payload: { baseUrl: "http://127.0.0.1:8096" },
      url: "/api/v1/servers/select",
    });

    const response = await app.inject({
      headers: { cookie: "newemby_session=browser-session-token" },
      method: "GET",
      url: "/api/v1/auth/me",
    });

    expect(response.statusCode).toBe(401);
    expect(authSessionStore.revoke).toHaveBeenCalledWith(
      "browser-session-token",
    );
  });

  it("rejects an absent NewEmby session", async () => {
    const app = await buildApp({
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      probeServer: vi.fn().mockResolvedValue({
        baseUrl: "http://127.0.0.1:8096/",
        capabilityFlags: { ping: true, publicInfo: true },
        latencyMs: 15,
        name: "Home Emby",
        serverId: "server-id",
        supportsHttps: false,
        version: "4.8.11.0",
      }),
    });
    apps.push(app);
    await app.inject({
      headers: await stateChangeHeaders(app),
      method: "POST",
      payload: { baseUrl: "http://127.0.0.1:8096" },
      url: "/api/v1/servers/select",
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHENTICATED");
  });

  it("requires a selected server before reading the current user", async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("SERVER_NOT_SELECTED");
  });

  it("revokes locally before attempting the upstream logout", async () => {
    const events: string[] = [];
    const user = {
      name: "Alex",
      permissions: {
        canDownload: true,
        canManageServer: false,
        isAdministrator: false,
      },
      serverId: "server-id",
      userId: "user-1",
    };
    const authSessionStore = {
      create: vi.fn(),
      find: vi.fn().mockResolvedValue({
        accessToken: "emby-secret-token",
        expiresAt: "2099-01-01T00:00:00.000Z",
        sessionId: "session-id",
        user,
      }),
      getDeviceId: vi.fn().mockResolvedValue("gateway-device-id"),
      pruneInactive: vi.fn(),
      revoke: vi.fn().mockImplementation(() => {
        events.push("local-revoke");
      }),
      revokeServerSessions: vi.fn().mockResolvedValue([]),
      updateUser: vi.fn(),
    };
    const logoutSession = vi.fn().mockImplementation(() => {
      events.push("upstream-logout");
    });
    const app = await buildApp({
      authSessionStore,
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      logoutSession,
      probeServer: vi.fn().mockResolvedValue({
        baseUrl: "http://127.0.0.1:8096/",
        capabilityFlags: { ping: true, publicInfo: true },
        latencyMs: 15,
        name: "Home Emby",
        serverId: "server-id",
        supportsHttps: false,
        version: "4.8.11.0",
      }),
    });
    apps.push(app);
    await app.inject({
      headers: await stateChangeHeaders(app),
      method: "POST",
      payload: { baseUrl: "http://127.0.0.1:8096" },
      url: "/api/v1/servers/select",
    });

    const response = await app.inject({
      headers: {
        ...(await stateChangeHeaders(
          app,
          "newemby_session=browser-session-token",
        )),
      },
      method: "POST",
      url: "/api/v1/auth/logout",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ success: true });
    const clearedCookies = String(response.headers["set-cookie"]);
    expect(clearedCookies).toContain("newemby_session=");
    expect(clearedCookies).toContain("newemby_csrf=");
    expect(clearedCookies).toContain("Max-Age=0");
    expect(events).toEqual(["local-revoke", "upstream-logout"]);
    expect(JSON.stringify(response.json())).not.toContain("emby-secret-token");
  });

  it("keeps the local logout successful when Emby is unavailable", async () => {
    const authSessionStore = {
      create: vi.fn(),
      find: vi.fn().mockResolvedValue({
        accessToken: "emby-secret-token",
        expiresAt: "2099-01-01T00:00:00.000Z",
        sessionId: "session-id",
        user: {
          name: "Alex",
          permissions: {
            canDownload: true,
            canManageServer: false,
            isAdministrator: false,
          },
          serverId: "server-id",
          userId: "user-1",
        },
      }),
      getDeviceId: vi.fn().mockResolvedValue("gateway-device-id"),
      pruneInactive: vi.fn(),
      revoke: vi.fn(),
      revokeServerSessions: vi.fn().mockResolvedValue([]),
      updateUser: vi.fn(),
    };
    const app = await buildApp({
      authSessionStore,
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      logoutSession: vi.fn().mockRejectedValue(new Error("Emby offline")),
      probeServer: vi.fn().mockResolvedValue({
        baseUrl: "http://127.0.0.1:8096/",
        capabilityFlags: { ping: true, publicInfo: true },
        latencyMs: 15,
        name: "Home Emby",
        serverId: "server-id",
        supportsHttps: false,
        version: "4.8.11.0",
      }),
    });
    apps.push(app);
    await app.inject({
      headers: await stateChangeHeaders(app),
      method: "POST",
      payload: { baseUrl: "http://127.0.0.1:8096" },
      url: "/api/v1/servers/select",
    });

    const response = await app.inject({
      headers: {
        ...(await stateChangeHeaders(
          app,
          "newemby_session=browser-session-token",
        )),
      },
      method: "POST",
      url: "/api/v1/auth/logout",
    });

    expect(response.statusCode).toBe(200);
    expect(authSessionStore.revoke).toHaveBeenCalled();
  });

  it("rejects logout requests from an untrusted origin", async () => {
    const app = await createTestApp();
    const response = await app.inject({
      headers: { origin: "https://evil.example.com" },
      method: "POST",
      url: "/api/v1/auth/logout",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("ORIGIN_NOT_ALLOWED");
  });

  it("revokes a local session after an upstream unauthorized response", async () => {
    const authSessionStore = {
      create: vi.fn(),
      find: vi.fn().mockResolvedValue({
        accessToken: "expired-token",
        expiresAt: "2099-01-01T00:00:00.000Z",
        sessionId: "session-id",
        user: {
          name: "Alex",
          permissions: {
            canDownload: true,
            canManageServer: false,
            isAdministrator: false,
          },
          serverId: "server-id",
          userId: "user-1",
        },
      }),
      getDeviceId: vi.fn().mockResolvedValue("gateway-device-id"),
      pruneInactive: vi.fn(),
      revoke: vi.fn(),
      revokeServerSessions: vi.fn().mockResolvedValue([]),
      updateUser: vi.fn(),
    };
    const app = await buildApp({
      authSessionStore,
      config: loadConfig({ NODE_ENV: "test" }),
      getAuthenticatedUser: vi
        .fn()
        .mockRejectedValue(new EmbyAuthError("unauthorized", "Expired token")),
      logger: false,
      probeServer: vi.fn().mockResolvedValue({
        baseUrl: "http://127.0.0.1:8096/",
        capabilityFlags: { ping: true, publicInfo: true },
        latencyMs: 15,
        name: "Home Emby",
        serverId: "server-id",
        supportsHttps: false,
        version: "4.8.11.0",
      }),
    });
    apps.push(app);
    await app.inject({
      headers: await stateChangeHeaders(app),
      method: "POST",
      payload: { baseUrl: "http://127.0.0.1:8096" },
      url: "/api/v1/servers/select",
    });

    const response = await app.inject({
      headers: { cookie: "newemby_session=browser-session-token" },
      method: "GET",
      url: "/api/v1/auth/me",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHENTICATED");
    expect(response.headers["set-cookie"]).toContain("Max-Age=0");
    expect(authSessionStore.revoke).toHaveBeenCalledWith(
      "browser-session-token",
    );
  });

  it("rejects login requests from an untrusted origin", async () => {
    const authenticateUser = vi.fn();
    const app = await buildApp({
      authenticateUser,
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
    });
    apps.push(app);

    const response = await app.inject({
      headers: { origin: "https://evil.example.com" },
      method: "POST",
      payload: { password: "password", username: "Alex" },
      url: "/api/v1/auth/login",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("ORIGIN_NOT_ALLOWED");
    expect(authenticateUser).not.toHaveBeenCalled();
  });

  it("classifies invalid credentials and limits repeated login attempts", async () => {
    const authenticateUser = vi
      .fn()
      .mockRejectedValue(
        new EmbyAuthError("unauthorized", "Invalid credentials"),
      );
    const app = await buildApp({
      authSessionStore: {
        create: vi.fn(),
        find: vi.fn(),
        getDeviceId: vi.fn().mockResolvedValue("gateway-device-id"),
        pruneInactive: vi.fn(),
        revoke: vi.fn(),
        revokeServerSessions: vi.fn().mockResolvedValue([]),
        updateUser: vi.fn(),
      },
      authenticateUser,
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      probeServer: vi.fn().mockResolvedValue({
        baseUrl: "http://127.0.0.1:8096/",
        capabilityFlags: { ping: true, publicInfo: true },
        latencyMs: 15,
        name: "Home Emby",
        serverId: "server-id",
        supportsHttps: false,
        version: "4.8.11.0",
      }),
    });
    apps.push(app);
    await app.inject({
      headers: await stateChangeHeaders(app),
      method: "POST",
      payload: { baseUrl: "http://127.0.0.1:8096" },
      url: "/api/v1/servers/select",
    });

    const loginHeaders = await stateChangeHeaders(app);
    for (let i = 0; i < 5; i++) {
      const response = await app.inject({
        headers: loginHeaders,
        method: "POST",
        payload: { password: "wrong", username: "Alex" },
        remoteAddress: "192.0.2.10",
        url: "/api/v1/auth/login",
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe("AUTH_INVALID_CREDENTIALS");
    }

    const limited = await app.inject({
      headers: loginHeaders,
      method: "POST",
      payload: { password: "wrong", username: "Alex" },
      remoteAddress: "192.0.2.10",
      url: "/api/v1/auth/login",
    });

    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe("RATE_LIMITED");
    expect(authenticateUser).toHaveBeenCalledTimes(5);
  });
});
