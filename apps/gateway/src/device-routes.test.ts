import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import type { AuthSessionStore } from "./database/auth-session-store.js";
import type { BridgeDeviceStore } from "./database/bridge-device-store.js";
import type { ServerStore } from "./database/server-store.js";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const DEVICE_CREDENTIAL = "B".repeat(43);
const NONCE = "N".repeat(43);
const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

function createDeviceStore(): BridgeDeviceStore & {
  authenticate: ReturnType<typeof vi.fn>;
  listForUser: ReturnType<typeof vi.fn>;
  revokeAuthenticated: ReturnType<typeof vi.fn>;
  revokeForUser: ReturnType<typeof vi.fn>;
  revokeServerDevices: ReturnType<typeof vi.fn>;
} {
  return {
    authenticate: vi.fn().mockResolvedValue({
      device: {
        bridgeVersion: "0.1.0",
        deviceId: DEVICE_ID,
        lastSeenAt: "2026-07-17T12:00:00.000Z",
        name: "Living Room PC",
        pairedAt: "2026-07-17T12:00:00.000Z",
        platform: "windows",
      },
      kind: "authenticated",
    }),
    listForUser: vi.fn().mockResolvedValue([]),
    revokeAuthenticated: vi.fn().mockResolvedValue(true),
    revokeForUser: vi.fn().mockResolvedValue(true),
    revokeServerDevices: vi.fn().mockResolvedValue(0),
  };
}

async function createTestApp(bridgeDeviceStore = createDeviceStore()) {
  const app = await buildApp({
    bridgeDeviceStore,
    config: loadConfig({ NODE_ENV: "test" }),
    logger: false,
  });
  apps.push(app);
  return { app, bridgeDeviceStore };
}

function createAuthSessionStore(): AuthSessionStore {
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
        serverId: "server-1",
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

async function stateChangeHeaders(app: Awaited<ReturnType<typeof buildApp>>) {
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/security/csrf",
  });
  const setCookie = response.headers["set-cookie"];
  const csrfCookie = (
    Array.isArray(setCookie) ? setCookie[0] : setCookie
  )?.split(";")[0];

  return {
    cookie: `${csrfCookie}; lumarelay_session=session-cookie`,
    origin: "http://127.0.0.1:5173",
    "x-lumarelay-csrf": response.json().csrfToken as string,
  };
}

describe("Bridge device routes", () => {
  it("accepts a credential with a fresh nonce", async () => {
    const { app, bridgeDeviceStore } = await createTestApp();
    const response = await app.inject({
      headers: {
        authorization: `LumaRelayDevice ${DEVICE_CREDENTIAL}`,
        "x-lumarelay-nonce": NONCE,
      },
      method: "POST",
      url: `/api/v1/bridge/devices/${DEVICE_ID}/heartbeat`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
    expect(bridgeDeviceStore.authenticate).toHaveBeenCalledWith({
      deviceCredential: DEVICE_CREDENTIAL,
      deviceId: DEVICE_ID,
      nonce: NONCE,
    });
  });

  it("rejects missing credentials and malformed nonces", async () => {
    const { app, bridgeDeviceStore } = await createTestApp();
    const missingCredential = await app.inject({
      headers: { "x-lumarelay-nonce": NONCE },
      method: "POST",
      url: `/api/v1/bridge/devices/${DEVICE_ID}/heartbeat`,
    });
    const malformedNonce = await app.inject({
      headers: {
        authorization: `LumaRelayDevice ${DEVICE_CREDENTIAL}`,
        "x-lumarelay-nonce": "short",
      },
      method: "POST",
      url: `/api/v1/bridge/devices/${DEVICE_ID}/heartbeat`,
    });

    expect(missingCredential.statusCode).toBe(401);
    expect(missingCredential.json().error.code).toBe(
      "BRIDGE_CREDENTIAL_INVALID",
    );
    expect(malformedNonce.statusCode).toBe(400);
    expect(malformedNonce.json().error.code).toBe("NONCE_INVALID");
    expect(bridgeDeviceStore.authenticate).not.toHaveBeenCalled();
  });

  it("returns a stable replay error", async () => {
    const bridgeDeviceStore = createDeviceStore();
    bridgeDeviceStore.authenticate.mockResolvedValue({ kind: "replay" });
    const { app } = await createTestApp(bridgeDeviceStore);
    const response = await app.inject({
      headers: {
        authorization: `LumaRelayDevice ${DEVICE_CREDENTIAL}`,
        "x-lumarelay-nonce": NONCE,
      },
      method: "POST",
      url: `/api/v1/bridge/devices/${DEVICE_ID}/heartbeat`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("REPLAY_DETECTED");
  });

  it("lists only devices owned by the current user and server", async () => {
    const bridgeDeviceStore = createDeviceStore();
    bridgeDeviceStore.listForUser.mockResolvedValue([
      {
        bridgeVersion: "0.1.0",
        deviceId: DEVICE_ID,
        lastSeenAt: "2026-07-17T12:00:00.000Z",
        name: "Living Room PC",
        pairedAt: "2026-07-17T11:00:00.000Z",
        platform: "windows",
      },
    ]);
    const app = await buildApp({
      authSessionStore: createAuthSessionStore(),
      bridgeDeviceStore,
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      serverStore: createServerStore(),
    });
    apps.push(app);
    const response = await app.inject({
      headers: { cookie: "lumarelay_session=session-cookie" },
      method: "GET",
      url: "/api/v1/bridge/devices",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().devices).toHaveLength(1);
    expect(bridgeDeviceStore.listForUser).toHaveBeenCalledWith(
      "server-1",
      "user-1",
    );
  });

  it("revokes only an owned device behind Origin and CSRF", async () => {
    const bridgeDeviceStore = createDeviceStore();
    const app = await buildApp({
      authSessionStore: createAuthSessionStore(),
      bridgeDeviceStore,
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false,
      serverStore: createServerStore(),
    });
    apps.push(app);
    const response = await app.inject({
      headers: await stateChangeHeaders(app),
      method: "DELETE",
      url: `/api/v1/bridge/devices/${DEVICE_ID}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      deviceId: DEVICE_ID,
      success: true,
    });
    expect(bridgeDeviceStore.revokeForUser).toHaveBeenCalledWith(
      "server-1",
      "user-1",
      DEVICE_ID,
    );
  });

  it("lets an authenticated device revoke its own credential", async () => {
    const bridgeDeviceStore = createDeviceStore();
    const { app } = await createTestApp(bridgeDeviceStore);
    const response = await app.inject({
      headers: {
        authorization: `LumaRelayDevice ${DEVICE_CREDENTIAL}`,
        "x-lumarelay-nonce": NONCE,
      },
      method: "DELETE",
      url: `/api/v1/bridge/devices/${DEVICE_ID}/credential`,
    });

    expect(response.statusCode).toBe(200);
    expect(bridgeDeviceStore.revokeAuthenticated).toHaveBeenCalledWith(
      DEVICE_ID,
    );
  });
});
