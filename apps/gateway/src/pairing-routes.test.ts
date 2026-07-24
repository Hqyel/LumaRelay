import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import type { AuthSessionStore } from "./database/auth-session-store.js";
import type { PairingCodeStore } from "./database/pairing-code-store.js";
import type { ServerStore } from "./database/server-store.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

function createAuthSessionStore(serverId = "server-1"): AuthSessionStore & {
  find: ReturnType<typeof vi.fn>;
  revoke: ReturnType<typeof vi.fn>;
} {
  return {
    create: vi.fn(),
    find: vi.fn().mockResolvedValue({
      accessToken: "upstream-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
      sessionId: "session-1",
      user: {
        name: "Alex",
        permissions: {
          canDownload: true,
          canManageServer: false,
          isAdministrator: false,
        },
        serverId,
        userId: "user-1",
      },
    }),
    getDeviceId: vi.fn(),
    pruneInactive: vi.fn(),
    revoke: vi.fn(),
    revokeServerSessions: vi.fn(),
    updateUser: vi.fn(),
  };
}

function createServerStore(): ServerStore {
  return {
    getCurrent: vi.fn().mockResolvedValue({
      baseUrl: "https://emby.example.com/",
      capabilityFlags: { ping: true, publicInfo: true },
      latencyMs: 20,
      name: "Home Emby",
      serverId: "server-1",
      supportsHttps: true,
      version: "4.8.11.0",
    }),
    select: vi.fn(),
  };
}

function createPairingCodeStore(): PairingCodeStore & {
  issue: ReturnType<typeof vi.fn>;
  redeem: ReturnType<typeof vi.fn>;
} {
  return {
    issue: vi.fn().mockResolvedValue({
      expiresAt: "2026-07-17T12:01:00.000Z",
      pairingCode: "A".repeat(43),
    }),
    pruneExpired: vi.fn(),
    redeem: vi.fn().mockResolvedValue({
      device: {
        bridgeVersion: "0.1.0",
        deviceId: "11111111-1111-4111-8111-111111111111",
        lastSeenAt: "2026-07-17T12:00:00.000Z",
        name: "Living Room PC",
        pairedAt: "2026-07-17T12:00:00.000Z",
        platform: "windows",
      },
      deviceCredential: "B".repeat(43),
    }),
  };
}

async function stateChangeHeaders(
  app: Awaited<ReturnType<typeof buildApp>>,
  includeSession = true,
) {
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/security/csrf",
  });
  const setCookie = response.headers["set-cookie"];
  const csrfCookie = (
    Array.isArray(setCookie) ? setCookie[0] : setCookie
  )?.split(";")[0];

  return {
    cookie: [
      csrfCookie,
      includeSession ? "lumarelay_session=session-cookie" : undefined,
    ]
      .filter(Boolean)
      .join("; "),
    origin: "http://127.0.0.1:5173",
    "x-lumarelay-csrf": response.json().csrfToken as string,
  };
}

async function createTestApp(options?: {
  authSessionStore?: AuthSessionStore;
  pairingCodeStore?: PairingCodeStore;
  serverStore?: ServerStore;
}) {
  const app = await buildApp({
    authSessionStore: options?.authSessionStore ?? createAuthSessionStore(),
    config: loadConfig({ NODE_ENV: "test" }),
    logger: false,
    pairingCodeStore: options?.pairingCodeStore ?? createPairingCodeStore(),
    serverStore: options?.serverStore ?? createServerStore(),
  });
  apps.push(app);
  return app;
}

describe("Bridge pairing routes", () => {
  it("issues a 60-second code for the authenticated session", async () => {
    const pairingCodeStore = createPairingCodeStore();
    const app = await createTestApp({ pairingCodeStore });
    const response = await app.inject({
      headers: await stateChangeHeaders(app),
      method: "POST",
      url: "/api/v1/bridge/pairing-codes",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      expiresAt: "2026-07-17T12:01:00.000Z",
      expiresInSeconds: 60,
      pairingCode: "A".repeat(43),
      requestId: response.headers["x-request-id"],
    });
    expect(pairingCodeStore.issue).toHaveBeenCalledWith("session-1");
  });

  it("requires exact Origin, CSRF and an authenticated session", async () => {
    const pairingCodeStore = createPairingCodeStore();
    const app = await createTestApp({ pairingCodeStore });
    const missingCsrf = await app.inject({
      headers: { origin: "http://127.0.0.1:5173" },
      method: "POST",
      url: "/api/v1/bridge/pairing-codes",
    });
    const missingSession = await app.inject({
      headers: await stateChangeHeaders(app, false),
      method: "POST",
      url: "/api/v1/bridge/pairing-codes",
    });

    expect(missingCsrf.statusCode).toBe(403);
    expect(missingCsrf.json().error.code).toBe("CSRF_INVALID");
    expect(missingSession.statusCode).toBe(401);
    expect(missingSession.json().error.code).toBe("UNAUTHENTICATED");
    expect(pairingCodeStore.issue).not.toHaveBeenCalled();
  });

  it("revokes a session that belongs to another server", async () => {
    const authSessionStore = createAuthSessionStore("server-2");
    const pairingCodeStore = createPairingCodeStore();
    const app = await createTestApp({ authSessionStore, pairingCodeStore });
    const response = await app.inject({
      headers: await stateChangeHeaders(app),
      method: "POST",
      url: "/api/v1/bridge/pairing-codes",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHENTICATED");
    expect(response.headers["set-cookie"]).toContain("lumarelay_session=;");
    expect(response.headers["set-cookie"]).toContain("Path=/");
    expect(authSessionStore.revoke).toHaveBeenCalledWith("session-cookie");
    expect(pairingCodeStore.issue).not.toHaveBeenCalled();
  });

  it("publishes the pairing endpoint in OpenAPI", async () => {
    const app = await createTestApp();
    await app.ready();

    expect(app.swagger().paths?.["/api/v1/bridge/pairing-codes"]).toBeDefined();
    expect(
      app.swagger().paths?.["/api/v1/bridge/pairings/redeem"],
    ).toBeDefined();
  });

  it("redeems a code without requiring a browser cookie or CSRF", async () => {
    const pairingCodeStore = createPairingCodeStore();
    const app = await createTestApp({ pairingCodeStore });
    const response = await app.inject({
      method: "POST",
      payload: {
        bridgeVersion: "0.1.0",
        deviceName: "Living Room PC",
        pairingCode: "A".repeat(43),
        platform: "windows",
      },
      url: "/api/v1/bridge/pairings/redeem",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      allowedOrigins: ["http://127.0.0.1:5173"],
      device: { name: "Living Room PC" },
      deviceCredential: "B".repeat(43),
    });
    expect(pairingCodeStore.redeem).toHaveBeenCalledWith({
      bridgeVersion: "0.1.0",
      deviceName: "Living Room PC",
      pairingCode: "A".repeat(43),
      platform: "windows",
    });
  });

  it("does not distinguish expired, replayed, and unknown codes", async () => {
    const pairingCodeStore = createPairingCodeStore();
    pairingCodeStore.redeem.mockResolvedValue(null);
    const app = await createTestApp({ pairingCodeStore });
    const response = await app.inject({
      method: "POST",
      payload: {
        bridgeVersion: "0.1.0",
        deviceName: "Living Room PC",
        pairingCode: "A".repeat(43),
        platform: "windows",
      },
      url: "/api/v1/bridge/pairings/redeem",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("PAIRING_CODE_INVALID");
  });
});
