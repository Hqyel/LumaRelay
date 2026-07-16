import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./database/database.js";
import { migrateToLatest } from "./database/migrator.js";
import { createServerStore } from "./database/server-store.js";

const config = loadConfig();
const database = createDatabase(config.databasePath);
await migrateToLatest(database);

const app = await buildApp({
  config,
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
