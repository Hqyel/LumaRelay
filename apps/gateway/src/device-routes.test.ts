import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import type { BridgeDeviceStore } from "./database/bridge-device-store.js";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const DEVICE_CREDENTIAL = "B".repeat(43);
const NONCE = "N".repeat(43);
const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

function createDeviceStore(): BridgeDeviceStore & {
  authenticate: ReturnType<typeof vi.fn>;
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

describe("Bridge device routes", () => {
  it("accepts a credential with a fresh nonce", async () => {
    const { app, bridgeDeviceStore } = await createTestApp();
    const response = await app.inject({
      headers: {
        authorization: `NewEmbyDevice ${DEVICE_CREDENTIAL}`,
        "x-newemby-nonce": NONCE,
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
      headers: { "x-newemby-nonce": NONCE },
      method: "POST",
      url: `/api/v1/bridge/devices/${DEVICE_ID}/heartbeat`,
    });
    const malformedNonce = await app.inject({
      headers: {
        authorization: `NewEmbyDevice ${DEVICE_CREDENTIAL}`,
        "x-newemby-nonce": "short",
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
        authorization: `NewEmbyDevice ${DEVICE_CREDENTIAL}`,
        "x-newemby-nonce": NONCE,
      },
      method: "POST",
      url: `/api/v1/bridge/devices/${DEVICE_ID}/heartbeat`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("REPLAY_DETECTED");
  });
});
