import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createAuthSessionStore } from "./database/auth-session-store.js";
import { createBridgeDeviceStore } from "./database/bridge-device-store.js";
import { createDatabase } from "./database/database.js";
import { migrateToLatest } from "./database/migrator.js";
import { hashDeviceCredential } from "./database/pairing-code-store.js";
import { createPlayTicketStore } from "./database/play-ticket-store.js";
import { createServerStore } from "./database/server-store.js";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const DEVICE_CREDENTIAL = "B".repeat(43);
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const path of temporaryDirectories.splice(0))
    rmSync(path, { force: true, recursive: true });
});

describe("PlayTicket integrated flow", () => {
  it("issues, redeems once, and never exposes stored credentials", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lumarelay-play-flow-"));
    temporaryDirectories.push(directory);
    const database = createDatabase(join(directory, "test.db"));
    const config = loadConfig({ NODE_ENV: "test" });
    const serverStore = createServerStore(database);
    const loadPlaybackResource = vi.fn().mockImplementation(async () => ({
      embyPlaySessionId: "emby-play-session-1",
      response: new Response("media", {
        headers: { "content-type": "video/mp4" },
        status: 206,
      }),
    }));
    const reportStarted = vi.fn().mockResolvedValue(undefined);
    let app: Awaited<ReturnType<typeof buildApp>> | undefined;

    try {
      await migrateToLatest(database);
      await serverStore.select({
        baseUrl: "https://emby.example.com/",
        capabilityFlags: { ping: true, publicInfo: true },
        latencyMs: 20,
        name: "Home Emby",
        serverId: "server-1",
        supportsHttps: true,
        version: "4.8.11.0",
      });
      const authSessionStore = createAuthSessionStore(database, config);
      const sessionCookie = await authSessionStore.create({
        accessToken: "upstream-secret-token",
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
      });
      await database
        .insertInto("bridgeDevices")
        .values({
          bridgeVersion: "0.1.0",
          createdAt: new Date().toISOString(),
          credentialHash: hashDeviceCredential(
            DEVICE_CREDENTIAL,
            config.sessionSecret,
          ),
          embyUserId: "user-1",
          id: DEVICE_ID,
          lastSeenAt: new Date().toISOString(),
          name: "Living Room PC",
          platform: "windows",
          revokedAt: null,
          serverId: "server-1",
        })
        .execute();

      app = await buildApp({
        authSessionStore,
        bridgeDeviceStore: createBridgeDeviceStore(database, config),
        config,
        logger: false,
        playTicket: {
          getPlaybackOptions: async () => [
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
          ],
          loadPlaybackResource,
        },
        playTicketStore: createPlayTicketStore(database, config),
        playback: { reportStarted },
        serverStore,
      });
      const csrf = await app.inject({
        method: "GET",
        url: "/api/v1/security/csrf",
      });
      const setCookie = csrf.headers["set-cookie"];
      const csrfCookie = (
        Array.isArray(setCookie) ? setCookie[0] : setCookie
      )?.split(";")[0];
      const issued = await app.inject({
        body: {
          audioStreamIndex: 1,
          deviceId: DEVICE_ID,
          displayTitle: "示例电影",
          itemId: "item-1",
          mediaSourceId: "source-1",
          resumeTicks: 600_000_000,
          subtitleStreamIndex: null,
        },
        headers: {
          cookie: `${csrfCookie}; lumarelay_session=${sessionCookie}`,
          origin: "http://127.0.0.1:5173",
          "x-lumarelay-csrf": csrf.json().csrfToken as string,
        },
        method: "POST",
        url: "/api/v1/bridge/play-tickets",
      });
      expect(issued.statusCode).toBe(201);
      const playTicket = issued.json().playTicket as string;

      const redeem = (nonce: string) =>
        app!.inject({
          body: { playTicket },
          headers: {
            authorization: `LumaRelayDevice ${DEVICE_CREDENTIAL}`,
            "x-lumarelay-nonce": nonce,
          },
          method: "POST",
          url: `/api/v1/bridge/devices/${DEVICE_ID}/play-tickets/redeem`,
        });
      const redeemed = await redeem("N".repeat(43));
      const replayed = await redeem("R".repeat(43));

      expect(redeemed.statusCode).toBe(200);
      expect(redeemed.json()).toMatchObject({
        playSessionId: issued.json().playSessionId,
        selection: { itemId: "item-1", mediaSourceId: "source-1" },
      });
      expect(replayed.statusCode).toBe(401);
      expect(replayed.json().error.code).toBe("PLAY_TICKET_INVALID");

      const playSessionId = issued.json().playSessionId as string;
      const media = await app.inject({
        headers: {
          authorization: `LumaRelayDevice ${DEVICE_CREDENTIAL}`,
          "x-lumarelay-nonce": "M".repeat(43),
        },
        method: "GET",
        url: `/api/v1/bridge/devices/${DEVICE_ID}/playback/${playSessionId}/media`,
      });
      expect(media.statusCode).toBe(206);

      const secondMedia = await app.inject({
        headers: {
          authorization: `LumaRelayDevice ${DEVICE_CREDENTIAL}`,
          "x-lumarelay-nonce": "S".repeat(43),
        },
        method: "GET",
        url: `/api/v1/bridge/devices/${DEVICE_ID}/playback/${playSessionId}/media`,
      });
      expect(secondMedia.statusCode).toBe(206);
      expect(loadPlaybackResource).toHaveBeenLastCalledWith(
        "https://emby.example.com/",
        expect.any(Object),
        expect.any(Object),
        {
          embyPlaySessionId: "emby-play-session-1",
          localPlaySessionId: playSessionId,
        },
        "media",
        undefined,
      );

      const playing = await app.inject({
        body: {
          eventType: "playing",
          isPaused: false,
          playbackRate: 1,
          playSessionId,
          positionTicks: 10_000_000,
          sequence: 1,
        },
        headers: {
          authorization: `LumaRelayDevice ${DEVICE_CREDENTIAL}`,
          "x-lumarelay-nonce": "P".repeat(43),
        },
        method: "POST",
        url: `/api/v1/bridge/devices/${DEVICE_ID}/playback-events`,
      });
      expect(playing.statusCode).toBe(200);
      expect(reportStarted).toHaveBeenCalledWith(
        "https://emby.example.com/",
        expect.objectContaining({
          playSessionId: "emby-play-session-1",
        }),
      );
      const playbackSession = await database
        .selectFrom("playbackSessions")
        .select(["embyPlaySessionId", "id"])
        .where("id", "=", playSessionId)
        .executeTakeFirstOrThrow();
      expect(playbackSession.embyPlaySessionId).toBe("emby-play-session-1");

      const raw = await database
        .selectFrom("playTickets")
        .selectAll()
        .executeTakeFirstOrThrow();
      expect(raw.redeemedAt).not.toBeNull();
      expect(JSON.stringify(raw)).not.toContain(playTicket);
      expect(JSON.stringify(redeemed.json())).not.toContain(
        "upstream-secret-token",
      );
      expect(JSON.stringify(redeemed.json())).not.toContain(DEVICE_CREDENTIAL);
    } finally {
      if (app !== undefined) await app.close();
      await database.destroy();
    }
  });
});
