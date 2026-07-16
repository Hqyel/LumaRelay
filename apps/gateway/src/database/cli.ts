import { loadConfig } from "../config.js";
import { createDatabase } from "./database.js";
import { migrateDown, migrateToLatest } from "./migrator.js";

const direction = process.argv[2];
const database = createDatabase(loadConfig().databasePath);

try {
  if (direction === "up") await migrateToLatest(database);
  else if (direction === "down") await migrateDown(database);
  else throw new Error("Expected migration direction: up or down");
} finally {
  await database.destroy();
}
