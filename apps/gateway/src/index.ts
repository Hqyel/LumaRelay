import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./database/database.js";
import { migrateToLatest } from "./database/migrator.js";
import { createServerStore } from "./database/server-store.js";
import { createAuthSessionStore } from "./database/auth-session-store.js";
import { createBridgeDeviceStore } from "./database/bridge-device-store.js";
import { createPairingCodeStore } from "./database/pairing-code-store.js";
import { createPlayTicketStore } from "./database/play-ticket-store.js";

const config = loadConfig();
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
const database = createDatabase(config.databasePath);
await migrateToLatest(database);
const authSessionStore = createAuthSessionStore(database, config);
await authSessionStore.pruneInactive();
const pairingCodeStore = createPairingCodeStore(database, config);
await pairingCodeStore.pruneExpired();
const bridgeDeviceStore = createBridgeDeviceStore(database, config);
const playTicketStore = createPlayTicketStore(database, config);
await playTicketStore.pruneInactive();

const app = await buildApp({
  authSessionStore,
  bridgeDeviceStore,
  config,
  pairingCodeStore,
  playTicketStore,
  serverStore: createServerStore(database),
  version: process.env.LUMARELAY_VERSION ?? "0.0.0",
  webRoot,
});
app.addHook("onClose", async () => database.destroy());

try {
  await app.listen({
    host: config.host,
    port: config.port,
  });
} catch (error) {
  app.log.fatal({ err: error }, "Gateway failed to start");
  process.exitCode = 1;
}
