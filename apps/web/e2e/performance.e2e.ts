import { expect, test } from "@playwright/test";

const production = process.env.LUMARELAY_E2E_PRODUCTION === "true";

test.skip(!production, "Run through the explicit production performance gate");

test("production home becomes meaningfully interactive within budget", async ({
  context,
  page,
}) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    connectionType: "wifi",
    downloadThroughput: (10 * 1024 * 1024) / 8,
    latency: 40,
    offline: false,
    uploadThroughput: (5 * 1024 * 1024) / 8,
  });

  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/servers/current") {
      await route.fulfill({
        json: {
          configuredBaseUrl: "https://emby.example.com/",
          requestId: "performance-current",
          server: {
            baseUrl: "https://emby.example.com/",
            capabilityFlags: { ping: true, publicInfo: true },
            latencyMs: 20,
            name: "Performance Emby",
            serverId: "server-1",
            supportsHttps: true,
            version: "4.8.11.0",
          },
        },
      });
      return;
    }
    if (path === "/api/v1/auth/me") {
      await route.fulfill({
        json: {
          requestId: "performance-me",
          server: {
            baseUrl: "https://emby.example.com/",
            capabilityFlags: { ping: true, publicInfo: true },
            latencyMs: 20,
            name: "Performance Emby",
            serverId: "server-1",
            supportsHttps: true,
            version: "4.8.11.0",
          },
          user: {
            name: "Performance User",
            permissions: {
              canDownload: false,
              canManageServer: false,
              isAdministrator: false,
            },
            serverId: "server-1",
            userId: "user-1",
          },
        },
      });
      return;
    }
    if (path === "/api/v1/media/libraries") {
      await route.fulfill({
        json: { libraries: [], requestId: "performance-libraries" },
      });
      return;
    }
    if (path === "/api/v1/media/home") {
      const item = {
        isFavorite: false,
        isPlayed: false,
        itemId: "performance-movie",
        kind: "movie",
        playbackPositionSeconds: 0,
        serverId: "server-1",
        title: "Performance Movie",
      };
      await route.fulfill({
        json: {
          favoriteItems: [],
          genreRows: [],
          hero: { ...item, genres: [] },
          latestMovies: [item],
          latestSeries: [],
          requestId: "performance-home",
          resumeItems: [],
        },
      });
      return;
    }
    await route.abort();
  });

  const startedAt = performance.now();
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  const firstAction = page.getByRole("link", { name: /Performance Movie/ });
  await firstAction.focus();
  await expect(firstAction).toBeFocused();
  const interactiveMs = Math.round(performance.now() - startedAt);

  console.log(`Production home meaningful interaction: ${interactiveMs}ms`);
  expect(interactiveMs).toBeLessThan(2500);
});
