import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createBridgeDeviceStore } from "./bridge-device-store.js";
import { createDatabase } from "./database.js";
import { migrateToLatest } from "./migrator.js";
import { hashDeviceCredential } from "./pairing-code-store.js";
import { createServerStore } from "./server-store.js";

const SESSION_SECRET = "test-session-secret-with-32-characters";
const DEVICE_CREDENTIAL = "B".repeat(43);
const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const NONCE = "N".repeat(43);
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const path of temporaryDirectories.splice(0))
    rmSync(path, { force: true, recursive: true });
});

describe("Bridge device authentication store", () => {
  it("authenticates a credential and rejects nonce replay", async () => {
    const directory = mkdtempSync(join(tmpdir(), "newemby-device-auth-"));
    temporaryDirectories.push(directory);
    const database = createDatabase(join(directory, "test.db"));

    try {
      await migrateToLatest(database);
      await createServerStore(database).select({
        baseUrl: "https://emby.example.com/",
        capabilityFlags: { ping: true, publicInfo: true },
        latencyMs: 20,
        name: "Home Emby",
        serverId: "server-1",
        supportsHttps: true,
        version: "4.8.11.0",
      });
      await database
        .insertInto("bridgeDevices")
        .values({
          bridgeVersion: "0.1.0",
          createdAt: "2026-07-17T12:00:00.000Z",
          credentialHash: hashDeviceCredential(
            DEVICE_CREDENTIAL,
            SESSION_SECRET,
          ),
          embyUserId: "user-1",
          id: DEVICE_ID,
          lastSeenAt: "2026-07-17T12:00:00.000Z",
          name: "Living Room PC",
          platform: "windows",
          revokedAt: null,
          serverId: "server-1",
        })
        .execute();

      let currentTime = new Date("2026-07-17T12:01:00.000Z");
      const store = createBridgeDeviceStore(
        database,
        { sessionSecret: SESSION_SECRET },
        () => currentTime,
      );
      const input = {
        deviceCredential: DEVICE_CREDENTIAL,
        deviceId: DEVICE_ID,
        nonce: NONCE,
      };

      await expect(store.authenticate(input)).resolves.toMatchObject({
        kind: "authenticated",
        device: { lastSeenAt: "2026-07-17T12:01:00.000Z" },
      });
      await expect(store.authenticate(input)).resolves.toEqual({
        kind: "replay",
      });
      const rawNonce = await database
        .selectFrom("bridgeRequestNonces")
        .selectAll()
        .executeTakeFirstOrThrow();
      expect(rawNonce.nonceHash).not.toBe(NONCE);
      expect(JSON.stringify(rawNonce)).not.toContain(NONCE);

      currentTime = new Date("2026-07-17T12:06:00.000Z");
      await expect(store.authenticate(input)).resolves.toMatchObject({
        kind: "authenticated",
      });
    } finally {
      await database.destroy();
    }
  });

  it("does not record a nonce for an invalid credential", async () => {
    const directory = mkdtempSync(join(tmpdir(), "newemby-device-invalid-"));
    temporaryDirectories.push(directory);
    const database = createDatabase(join(directory, "test.db"));

    try {
      await migrateToLatest(database);
      const store = createBridgeDeviceStore(database, {
        sessionSecret: SESSION_SECRET,
      });

      await expect(
        store.authenticate({
          deviceCredential: DEVICE_CREDENTIAL,
          deviceId: DEVICE_ID,
          nonce: NONCE,
        }),
      ).resolves.toEqual({ kind: "invalid-credential" });
      await expect(
        database.selectFrom("bridgeRequestNonces").selectAll().execute(),
      ).resolves.toEqual([]);
    } finally {
      await database.destroy();
    }
  });
});
