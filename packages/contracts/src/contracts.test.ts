import { describe, expect, it } from "vitest";

import {
  BRIDGE_PAIRING_CODE_LIFETIME_SECONDS,
  BridgePairingCodeResponseSchema,
  BridgeHeartbeatResponseSchema,
  BridgeDevicesResponseSchema,
  CreatePlayTicketResponseSchema,
  RedeemBridgePairingCodeResponseSchema,
  CurrentServerResponseSchema,
  ErrorEnvelopeSchema,
  HealthResponseSchema,
  LocalBridgeStatusSchema,
  LocalPlaybackStatusResponseSchema,
  MediaHomeResponseSchema,
  PLAY_TICKET_LIFETIME_SECONDS,
  PlaybackOptionsResponseSchema,
  PlayTicketSchema,
  PlayTicketSelectionSchema,
  RedeemPlayTicketResponseSchema,
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

  it("accepts a device credential without exposing an Emby token", () => {
    expect(
      RedeemBridgePairingCodeResponseSchema.safeParse({
        allowedOrigins: ["https://lumarelay.example.com"],
        device: {
          bridgeVersion: "0.1.0",
          deviceId: "11111111-1111-4111-8111-111111111111",
          lastSeenAt: "2026-07-17T12:00:00.000Z",
          name: "Living Room PC",
          pairedAt: "2026-07-17T12:00:00.000Z",
          platform: "windows",
        },
        deviceCredential: "B".repeat(43),
        requestId: "request-redeem-pairing",
      }).success,
    ).toBe(true);
  });

  it("accepts a Bridge heartbeat response", () => {
    expect(
      BridgeHeartbeatResponseSchema.safeParse({
        requestId: "request-heartbeat",
        serverTime: "2026-07-17T12:00:00.000Z",
        status: "ok",
      }).success,
    ).toBe(true);
  });

  it("accepts an owner-scoped Bridge device list", () => {
    expect(
      BridgeDevicesResponseSchema.safeParse({
        devices: [
          {
            bridgeVersion: "0.1.0",
            deviceId: "11111111-1111-4111-8111-111111111111",
            lastSeenAt: "2026-07-17T12:00:00.000Z",
            name: "Living Room PC",
            pairedAt: "2026-07-17T11:00:00.000Z",
            platform: "windows",
          },
        ],
        requestId: "request-devices",
      }).success,
    ).toBe(true);
  });

  it("defines a versioned opaque PlayTicket and bounded playback selection", () => {
    const ticket = `pt1.11111111-1111-4111-8111-111111111111.${"C".repeat(43)}`;
    expect(PlayTicketSchema.safeParse(ticket).success).toBe(true);
    expect(PLAY_TICKET_LIFETIME_SECONDS).toBe(60);
    expect(
      PlayTicketSelectionSchema.safeParse({
        audioStreamIndex: 1,
        displayTitle: "示例电影",
        itemId: "item-1",
        mediaSourceId: "source-1",
        resumeTicks: 600_000_000,
        subtitleStreamIndex: null,
      }).success,
    ).toBe(true);
  });

  it("validates safe video format details without a media path", () => {
    const result = PlaybackOptionsResponseSchema.safeParse({
      itemId: "episode-1",
      requestId: "request-playback-options",
      sources: [
        {
          audioTracks: [
            {
              bitrate: 256_000,
              channelLayout: "stereo",
              channels: 2,
              codec: "aac",
              codecTag: "mp4a",
              displayTitle: "Chinese AAC stereo",
              index: 1,
              isDefault: true,
              isExternal: false,
              isText: false,
              kind: "audio",
              language: "chi",
              profile: "LC",
              sampleRate: 48_000,
            },
          ],
          bitrate: 8_000_000,
          container: "mkv",
          defaultAudioStreamIndex: null,
          defaultSubtitleStreamIndex: null,
          mediaSourceId: "source-1",
          name: "1080p",
          runtimeTicks: 72_000_000_000,
          sizeBytes: 4_294_967_296,
          subtitleTracks: [],
          supportsDirectStream: true,
          video: {
            aspectRatio: "16:9",
            bitDepth: 10,
            codec: "hevc",
            codecTag: "hvc1",
            height: 1080,
            isInterlaced: false,
            level: 150,
            pixelFormat: "yuv420p10le",
            refFrames: 1,
            videoRange: "HDR10",
            width: 1920,
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(JSON.stringify(result)).not.toContain("Path");
  });

  it("validates the local Bridge capability response", () => {
    expect(
      LocalBridgeStatusSchema.parse({
        apiVersion: 1,
        applicationId: "LumaRelay.PlayerBridge",
        architecture: "x64",
        bridgeVersion: "0.1.0",
        compatibility: {
          isCompatible: true,
          maximumClientApiVersion: 1,
          minimumClientApiVersion: 1,
          requestedApiVersion: 1,
        },
        deviceId: "11111111-1111-4111-8111-111111111111",
        isPaired: true,
        platform: "windows",
        players: [
          {
            adapterId: "potplayer",
            architecture: "x64",
            displayName: "PotPlayer",
            isAvailable: true,
            isRunning: false,
            version: "1.7.22398.0",
          },
        ],
        smtc: {
          capability: "ready",
          isMonitoring: true,
          potPlayerSessionCount: 0,
          potPlayerSessionState: "notObserved",
          sessionCount: 0,
        },
        status: "ready",
      }).isPaired,
    ).toBe(true);
  });

  it("validates truthful local playback synchronization states", () => {
    expect(
      LocalPlaybackStatusResponseSchema.parse({
        sessions: [
          {
            durationTicks: 7_200_000_000,
            itemId: "item-1",
            playSessionId: "22222222-2222-4222-8222-222222222222",
            positionTicks: 600_000_000,
            state: "paused",
            syncState: "stale",
            updatedAt: "2026-07-22T12:00:00.000Z",
            warning: "SMTC_STALE",
          },
        ],
      }).sessions[0]?.warning,
    ).toBe("SMTC_STALE");
  });

  it("rejects malformed PlayTickets and unsafe playback values", () => {
    expect(PlayTicketSchema.safeParse("pt1.visible-secret").success).toBe(
      false,
    );
    expect(
      PlayTicketSelectionSchema.safeParse({
        audioStreamIndex: -1,
        displayTitle: "示例电影",
        itemId: "item-1",
        mediaSourceId: "source-1",
        resumeTicks: Number.MAX_SAFE_INTEGER + 1,
        subtitleStreamIndex: 0,
      }).success,
    ).toBe(false);
    expect(
      PlayTicketSelectionSchema.safeParse({
        audioStreamIndex: null,
        displayTitle: "unsafe\nplayer title",
        itemId: "item-1",
        mediaSourceId: "source-1",
        resumeTicks: 0,
        subtitleStreamIndex: null,
      }).success,
    ).toBe(false);
  });

  it("accepts PlayTicket issue and redemption responses without credentials", () => {
    const playTicket = `pt1.11111111-1111-4111-8111-111111111111.${"C".repeat(43)}`;
    expect(
      CreatePlayTicketResponseSchema.safeParse({
        expiresAt: "2026-07-22T12:01:00.000Z",
        expiresInSeconds: 60,
        playSessionId: "22222222-2222-4222-8222-222222222222",
        playTicket,
        requestId: "request-ticket",
      }).success,
    ).toBe(true);
    const redeemed = {
      playSessionId: "22222222-2222-4222-8222-222222222222",
      requestId: "request-redeem",
      selection: {
        audioStreamIndex: null,
        displayTitle: "示例电影",
        itemId: "item-1",
        mediaSourceId: "source-1",
        resumeTicks: 0,
        subtitleStreamIndex: null,
      },
    };
    expect(RedeemPlayTicketResponseSchema.safeParse(redeemed).success).toBe(
      true,
    );
    expect(redeemed).not.toHaveProperty("accessToken");
    expect(redeemed).not.toHaveProperty("deviceCredential");
  });
});
