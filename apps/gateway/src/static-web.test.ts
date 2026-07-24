import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
  directories
    .splice(0)
    .forEach((directory) =>
      rmSync(directory, { force: true, recursive: true }),
    );
});

async function createStaticApp() {
  const webRoot = mkdtempSync(join(tmpdir(), "lumarelay-web-"));
  writeFileSync(join(webRoot, "index.html"), "<main>LumaRelay shell</main>");
  writeFileSync(join(webRoot, "app.js"), "globalThis.lumarelay = true;");
  directories.push(webRoot);

  const app = await buildApp({
    config: loadConfig({ NODE_ENV: "test" }),
    logger: false,
    webRoot,
  });
  apps.push(app);
  return app;
}

describe("static Web application", () => {
  it.each(["/", "/movies", "/item/movie-1"])(
    "serves the SPA shell for %s",
    async (url) => {
      const app = await createStaticApp();
      const response = await app.inject({
        headers: { accept: "text/html" },
        method: "GET",
        url,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/html");
      expect(response.body).toContain("LumaRelay shell");
    },
  );

  it("serves static assets without applying the SPA fallback", async () => {
    const app = await createStaticApp();
    const asset = await app.inject({ method: "GET", url: "/app.js" });
    const missing = await app.inject({
      headers: { accept: "text/html" },
      method: "GET",
      url: "/missing.js",
    });

    expect(asset.statusCode).toBe(200);
    expect(asset.body).toContain("globalThis.lumarelay");
    expect(missing.statusCode).toBe(404);
    expect(missing.headers["content-type"]).toContain("application/json");
  });

  it("keeps unknown API routes as JSON errors", async () => {
    const app = await createStaticApp();
    const response = await app.inject({
      headers: { accept: "text/html" },
      method: "GET",
      url: "/api/v1/missing",
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.json().error.code).toBe("NOT_FOUND");
  });
});
