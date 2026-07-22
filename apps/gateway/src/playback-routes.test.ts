import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import type { AuthSessionStore } from "./database/auth-session-store.js";
import type { BridgeDeviceStore } from "./database/bridge-device-store.js";
import type { PlayTicketStore } from "./database/play-ticket-store.js";
import type { ServerStore } from "./database/server-store.js";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const PLAY_SESSION_ID = "22222222-2222-4222-8222-222222222222";
const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

function createDependencies() {
  const authSessionStore: AuthSessionStore = {
    create: vi.fn(),
    find: vi.fn(),
    findById: vi.fn().mockResolvedValue({
      accessToken: "secret-upstream-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
      sessionId: "auth-session-1",
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
    getDeviceId: vi.fn().mockResolvedValue("gateway-device"),
    pruneInactive: vi.fn(),
    revoke: vi.fn(),
    revokeById: vi.fn(),
    revokeServerSessions: vi.fn(),
    updateUser: vi.fn(),
  };
  const bridgeDeviceStore: BridgeDeviceStore = {
    authenticate: vi.fn().mockResolvedValue({
      device: {
        bridgeVersion: "0.1.0",
        deviceId: DEVICE_ID,
        lastSeenAt: "2026-07-22T12:00:00.000Z",
        name: "Desktop",
        pairedAt: "2026-07-22T11:00:00.000Z",
        platform: "windows",
      },
      kind: "authenticated",
    }),
    listForUser: vi.fn(),
    revokeAuthenticated: vi.fn(),
    revokeForUser: vi.fn(),
    revokeServerDevices: vi.fn(),
  };
  const playTicketStore: PlayTicketStore = {
    findPlaybackSession: vi.fn().mockResolvedValue({
      authSessionId: "auth-session-1",
      bridgeDeviceId: DEVICE_ID,
      playSessionId: PLAY_SESSION_ID,
      selection: {
        audioStreamIndex: 1,
        itemId: "item-1",
        mediaSourceId: "source-1",
        resumeTicks: 0,
        subtitleStreamIndex: null,
      },
      serverId: "server-1",
      userId: "user-1",
    }),
    issue: vi.fn(),
    markStarted: vi.fn(),
    pruneInactive: vi.fn(),
    redeem: vi.fn(),
  };
  const serverStore: ServerStore = {
    getById: vi.fn().mockResolvedValue({
      baseUrl: "https://emby.example.com/",
      capabilityFlags: { ping: true, publicInfo: true },
      latencyMs: 20,
      name: "Home Emby",
      serverId: "server-1",
      supportsHttps: true,
      version: "4.8.11.0",
    }),
    getCurrent: vi.fn(),
    select: vi.fn(),
  };
  return {
    authSessionStore,
    bridgeDeviceStore,
    playTicketStore,
    serverStore,
  };
}

async function createTestApp() {
  const dependencies = createDependencies();
  const reportStarted = vi.fn().mockResolvedValue(undefined);
  const app = await buildApp({
    ...dependencies,
    config: loadConfig({ NODE_ENV: "test" }),
    logger: false,
    playback: { reportStarted },
  });
  apps.push(app);
  return { app, dependencies, reportStarted };
}

function requestOptions() {
  return {
    body: {
      eventType: "playing",
      isPaused: false,
      playbackRate: 1,
      playSessionId: PLAY_SESSION_ID,
      positionTicks: 10_000_000,
    },
    headers: {
      authorization: `NewEmbyDevice ${"A".repeat(43)}`,
      "x-newemby-nonce": "N".repeat(43),
    },
    method: "POST" as const,
    url: `/api/v1/bridge/devices/${DEVICE_ID}/playback-events`,
  };
}

describe("Bridge playback routes", () => {
  it("resolves the redeemed session and reports Playing without exposure", async () => {
    const { app, dependencies, reportStarted } = await createTestApp();
    const response = await app.inject(requestOptions());

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ success: true });
    expect(reportStarted).toHaveBeenCalledWith(
      "https://emby.example.com/",
      expect.objectContaining({
        accessToken: "secret-upstream-token",
        itemId: "item-1",
        playSessionId: PLAY_SESSION_ID,
        positionTicks: 10_000_000,
      }),
    );
    expect(dependencies.playTicketStore.markStarted).toHaveBeenCalledTimes(1);
    expect(response.body).not.toContain("secret-upstream-token");
  });

  it("does not accept a playback session outside the device binding", async () => {
    const { app, dependencies, reportStarted } = await createTestApp();
    vi.mocked(
      dependencies.playTicketStore.findPlaybackSession!,
    ).mockResolvedValue(null);
    const response = await app.inject(requestOptions());

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("PLAYBACK_SESSION_NOT_FOUND");
    expect(reportStarted).not.toHaveBeenCalled();
  });
});
