import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./database/database.js";
import { migrateToLatest } from "./database/migrator.js";
import { createServerStore } from "./database/server-store.js";
import { createAuthSessionStore } from "./database/auth-session-store.js";
import { createPairingCodeStore } from "./database/pairing-code-store.js";

const config = loadConfig();
const database = createDatabase(config.databasePath);
await migrateToLatest(database);
const authSessionStore = createAuthSessionStore(database, config);
await authSessionStore.pruneInactive();
const pairingCodeStore = createPairingCodeStore(database, config);
await pairingCodeStore.pruneExpired();

const app = await buildApp({
  authSessionStore,
  config,
  pairingCodeStore,
  serverStore: createServerStore(database),
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
