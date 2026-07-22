import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import type { AuthSessionStore } from "./database/auth-session-store.js";
import type { BridgeDeviceStore } from "./database/bridge-device-store.js";
import type { PlayTicketStore } from "./database/play-ticket-store.js";
import type { ServerStore } from "./database/server-store.js";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const DEVICE_CREDENTIAL = "B".repeat(43);
const NONCE = "N".repeat(43);
const PLAY_SESSION_ID = "22222222-2222-4222-8222-222222222222";
const PLAY_TICKET = `pt1.33333333-3333-4333-8333-333333333333.${"C".repeat(43)}`;
const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

function createAuthSessionStore(): AuthSessionStore {
  const session = {
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
  };
  return {
    create: vi.fn(),
    find: vi.fn().mockResolvedValue(session),
    findById: vi.fn().mockResolvedValue(session),
    getDeviceId: vi.fn().mockResolvedValue("gateway-device"),
    pruneInactive: vi.fn(),
    revoke: vi.fn(),
    revokeServerSessions: vi.fn(),
    updateUser: vi.fn(),
  };
}

function createServerStore(): ServerStore {
  const server = {
    baseUrl: "https://emby.example.com/",
    capabilityFlags: { ping: true, publicInfo: true },
    latencyMs: 20,
    name: "Home Emby",
    serverId: "server-1",
    supportsHttps: true,
    version: "4.8.11.0",
  };
  return {
    getById: vi.fn().mockResolvedValue(server),
    getCurrent: vi.fn().mockResolvedValue(server),
    select: vi.fn(),
  };
}

function createBridgeDeviceStore(): BridgeDeviceStore {
  return {
    authenticate: vi.fn().mockResolvedValue({
      device: {
        bridgeVersion: "0.1.0",
        deviceId: DEVICE_ID,
        lastSeenAt: "2026-07-22T12:00:00.000Z",
        name: "Living Room PC",
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
}

function createPlayTicketStore(): PlayTicketStore & {
  bindEmbyPlaySessionId: ReturnType<typeof vi.fn>;
  findPlaybackSession: ReturnType<typeof vi.fn>;
  issue: ReturnType<typeof vi.fn>;
  redeem: ReturnType<typeof vi.fn>;
} {
  return {
    bindEmbyPlaySessionId: vi.fn().mockResolvedValue(true),
    findPlaybackSession: vi.fn().mockResolvedValue({
      authSessionId: "session-1",
      bridgeDeviceId: DEVICE_ID,
      embyPlaySessionId: null,
      playSessionId: PLAY_SESSION_ID,
      selection: {
        audioStreamIndex: 1,
        displayTitle: "示例电影",
        itemId: "item-1",
        mediaSourceId: "source-1",
        resumeTicks: 600_000_000,
        subtitleStreamIndex: null,
      },
      serverId: "server-1",
      startedAt: null,
      stoppedAt: null,
      userId: "user-1",
    }),
    issue: vi.fn().mockResolvedValue({
      expiresAt: "2026-07-22T12:01:00.000Z",
      playSessionId: PLAY_SESSION_ID,
      playTicket: PLAY_TICKET,
    }),
    pruneInactive: vi.fn(),
    redeem: vi.fn().mockResolvedValue({
      playSessionId: PLAY_SESSION_ID,
      selection: {
        audioStreamIndex: 1,
        displayTitle: "示例电影",
        itemId: "item-1",
        mediaSourceId: "source-1",
        resumeTicks: 600_000_000,
        subtitleStreamIndex: null,
      },
    }),
  };
}

async function createTestApp(playTicketStore = createPlayTicketStore()) {
  const bridgeDeviceStore = createBridgeDeviceStore();
  const app = await buildApp({
    authSessionStore: createAuthSessionStore(),
    bridgeDeviceStore,
    config: loadConfig({ NODE_ENV: "test" }),
    logger: false,
    playTicket: {
      getPlaybackOptions: vi.fn().mockResolvedValue([
        {
          audioTracks: [
            {
              displayTitle: "AAC stereo",
              index: 1,
              isDefault: true,
              isExternal: false,
              isText: false,
              kind: "audio",
            },
          ],
          defaultAudioStreamIndex: 1,
          defaultSubtitleStreamIndex: null,
          mediaSourceId: "source-1",
          name: "Default",
          runtimeTicks: 600_000_000,
          subtitleTracks: [],
          supportsDirectStream: true,
        },
      ]),
      loadPlaybackResource: vi.fn().mockResolvedValue({
        embyPlaySessionId: "emby-play-session-1",
        response: new Response("media-chunk", {
          headers: {
            "accept-ranges": "bytes",
            "content-type": "video/x-matroska",
          },
          status: 206,
        }),
      }),
    },
    playTicketStore,
    serverStore: createServerStore(),
  });
  apps.push(app);
  return { app, bridgeDeviceStore, playTicketStore };
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
    cookie: `${csrfCookie}; newemby_session=session-cookie`,
    origin: "http://127.0.0.1:5173",
    "x-newemby-csrf": response.json().csrfToken as string,
  };
}

function createRequestBody() {
  return {
    audioStreamIndex: 1,
    deviceId: DEVICE_ID,
    displayTitle: "示例电影",
    itemId: "item-1",
    mediaSourceId: "source-1",
    resumeTicks: 600_000_000,
    subtitleStreamIndex: null,
  };
}

describe("PlayTicket routes", () => {
  it("issues for the current login and owned Bridge behind CSRF", async () => {
    const { app, playTicketStore } = await createTestApp();
    const response = await app.inject({
      body: createRequestBody(),
      headers: await stateChangeHeaders(app),
      method: "POST",
      url: "/api/v1/bridge/play-tickets",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      expiresInSeconds: 60,
      playSessionId: PLAY_SESSION_ID,
      playTicket: PLAY_TICKET,
    });
    expect(playTicketStore.issue).toHaveBeenCalledWith({
      authSessionId: "session-1",
      bridgeDeviceId: DEVICE_ID,
      selection: {
        audioStreamIndex: 1,
        displayTitle: "示例电影",
        itemId: "item-1",
        mediaSourceId: "source-1",
        resumeTicks: 600_000_000,
        subtitleStreamIndex: null,
      },
      serverId: "server-1",
      userId: "user-1",
    });
  });

  it("proxies ranged media only for the authenticated bound device", async () => {
    const { app, bridgeDeviceStore, playTicketStore } = await createTestApp();
    const response = await app.inject({
      headers: {
        authorization: `NewEmbyDevice ${DEVICE_CREDENTIAL}`,
        range: "bytes=100-",
        "x-newemby-nonce": NONCE,
      },
      method: "GET",
      url: `/api/v1/bridge/devices/${DEVICE_ID}/playback/${PLAY_SESSION_ID}/media`,
    });

    expect(response.statusCode).toBe(206);
    expect(response.body).toBe("media-chunk");
    expect(response.headers["content-type"]).toContain("video/x-matroska");
    expect(bridgeDeviceStore.authenticate).toHaveBeenCalled();
    expect(playTicketStore.bindEmbyPlaySessionId).toHaveBeenCalledWith(
      PLAY_SESSION_ID,
      DEVICE_ID,
      "emby-play-session-1",
    );
  });

  it("requires exact Origin and CSRF before issuing", async () => {
    const { app, playTicketStore } = await createTestApp();
    const missingCsrf = await app.inject({
      body: createRequestBody(),
      headers: {
        cookie: "newemby_session=session-cookie",
        origin: "http://127.0.0.1:5173",
      },
      method: "POST",
      url: "/api/v1/bridge/play-tickets",
    });
    const foreignOrigin = await app.inject({
      body: createRequestBody(),
      headers: {
        ...(await stateChangeHeaders(app)),
        origin: "https://malicious.example.com",
      },
      method: "POST",
      url: "/api/v1/bridge/play-tickets",
    });

    expect(missingCsrf.statusCode).toBe(403);
    expect(missingCsrf.json().error.code).toBe("CSRF_INVALID");
    expect(foreignOrigin.statusCode).toBe(403);
    expect(foreignOrigin.json().error.code).toBe("ORIGIN_NOT_ALLOWED");
    expect(playTicketStore.issue).not.toHaveBeenCalled();
  });

  it("does not reveal whether a foreign Bridge device exists", async () => {
    const playTicketStore = createPlayTicketStore();
    playTicketStore.issue.mockResolvedValue(null);
    const { app } = await createTestApp(playTicketStore);
    const response = await app.inject({
      body: createRequestBody(),
      headers: await stateChangeHeaders(app),
      method: "POST",
      url: "/api/v1/bridge/play-tickets",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("BRIDGE_DEVICE_NOT_FOUND");
  });

  it("redeems through device credential and nonce authentication", async () => {
    const { app, bridgeDeviceStore, playTicketStore } = await createTestApp();
    const response = await app.inject({
      body: { playTicket: PLAY_TICKET },
      headers: {
        authorization: `NewEmbyDevice ${DEVICE_CREDENTIAL}`,
        "x-newemby-nonce": NONCE,
      },
      method: "POST",
      url: `/api/v1/bridge/devices/${DEVICE_ID}/play-tickets/redeem`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      playSessionId: PLAY_SESSION_ID,
      selection: { itemId: "item-1", mediaSourceId: "source-1" },
    });
    expect(bridgeDeviceStore.authenticate).toHaveBeenCalledWith({
      deviceCredential: DEVICE_CREDENTIAL,
      deviceId: DEVICE_ID,
      nonce: NONCE,
    });
    expect(playTicketStore.redeem).toHaveBeenCalledWith(PLAY_TICKET, DEVICE_ID);
  });

  it("uses one stable error for expired, replayed, or cross-device tickets", async () => {
    const playTicketStore = createPlayTicketStore();
    playTicketStore.redeem.mockResolvedValue(null);
    const { app } = await createTestApp(playTicketStore);
    const response = await app.inject({
      body: { playTicket: "not-a-ticket" },
      headers: {
        authorization: `NewEmbyDevice ${DEVICE_CREDENTIAL}`,
        "x-newemby-nonce": NONCE,
      },
      method: "POST",
      url: `/api/v1/bridge/devices/${DEVICE_ID}/play-tickets/redeem`,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toMatchObject({
      code: "PLAY_TICKET_INVALID",
      message: "The PlayTicket is invalid, expired, or already used",
    });
    expect(JSON.stringify(response.json())).not.toContain("not-a-ticket");
  });
});
