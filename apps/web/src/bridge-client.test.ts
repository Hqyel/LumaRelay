import type { LocalBridgeStatus } from "@lumarelay/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  bridgeCapabilityModel,
  bridgePairingUri,
  fetchLocalPlaybackStatus,
  startLocalPlayback,
} from "./bridge-client.js";

const status: LocalBridgeStatus = {
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
};

describe("local Bridge client", () => {
  it("keeps unavailable, player, and SMTC states separate", () => {
    expect(bridgeCapabilityModel(undefined).availability).toBe("not-detected");
    expect(bridgeCapabilityModel(status)).toMatchObject({
      availability: "connected",
      isPaired: true,
      playerAvailable: true,
      playerRunning: false,
      smtcReady: true,
    });
  });

  it("encodes the Gateway origin and pairing code in the protocol URI", () => {
    const uri = bridgePairingUri("http://127.0.0.1:5173", "A".repeat(43));
    expect(uri).toContain("lumarelay://pair?");
    expect(uri).toContain("gateway=http%3A%2F%2F127.0.0.1%3A5173");
    expect(uri).toContain(`code=${"A".repeat(43)}`);
  });

  it("parses truthful local playback status without credentials", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sessions: [
            {
              durationTicks: 7_200_000_000,
              itemId: "item-1",
              playSessionId: "22222222-2222-4222-8222-222222222222",
              positionTicks: 600_000_000,
              state: "playing",
              syncState: "synchronized",
              updatedAt: "2026-07-22T12:00:00.000Z",
              warning: null,
            },
          ],
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );

    await expect(fetchLocalPlaybackStatus()).resolves.toMatchObject({
      sessions: [{ itemId: "item-1", state: "playing" }],
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:58080/v1/playback/status",
    );
    fetchMock.mockRestore();
  });

  it("preserves the Bridge error code when playback cannot start", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "PLAY_TICKET_REDEEM_FAILED",
            message: "The Bridge could not prepare local playback.",
          },
        }),
        {
          headers: { "content-type": "application/json" },
          status: 502,
        },
      ),
    );

    await expect(startLocalPlayback("temporary-ticket")).rejects.toMatchObject({
      code: "PLAY_TICKET_REDEEM_FAILED",
      statusCode: 502,
    });
    fetchMock.mockRestore();
  });
});
