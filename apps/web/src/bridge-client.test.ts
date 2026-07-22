import type { LocalBridgeStatus } from "@newemby/contracts";
import { describe, expect, it } from "vitest";

import { bridgeCapabilityModel, bridgePairingUri } from "./bridge-client.js";

const status: LocalBridgeStatus = {
  apiVersion: 1,
  applicationId: "NewEmby.PlayerBridge",
  architecture: "x64",
  bridgeVersion: "0.1.0",
  compatibility: {
    isCompatible: true,
    maximumClientApiVersion: 1,
    minimumClientApiVersion: 1,
    requestedApiVersion: 1,
  },
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
    expect(uri).toContain("newemby://pair?");
    expect(uri).toContain("gateway=http%3A%2F%2F127.0.0.1%3A5173");
    expect(uri).toContain(`code=${"A".repeat(43)}`);
  });
});
