import { expect, test } from "@playwright/test";

const server = {
  baseUrl: "https://emby.example.com/",
  capabilityFlags: { ping: true, publicInfo: true },
  latencyMs: 18,
  name: "Compatibility Emby",
  serverId: "server-1",
  supportsHttps: true,
  version: "4.8.11.0",
};

const user = {
  name: "Compatibility User",
  permissions: {
    canDownload: false,
    canManageServer: false,
    isAdministrator: false,
  },
  serverId: "server-1",
  userId: "user-1",
};

const movie = {
  isFavorite: false,
  isPlayed: false,
  itemId: "compatibility-movie",
  kind: "movie",
  playbackPositionSeconds: 0,
  productionYear: 2026,
  serverId: "server-1",
  title: "Compatibility Movie",
};

test("desktop browser supports navigation, keyboard search, and layout", async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.route("http://127.0.0.1:58080/v1/status**", async (route) => {
    await route.fulfill({
      headers: {
        "access-control-allow-origin": "http://127.0.0.1:4173",
      },
      json: {
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
        isPaired: false,
        platform: "windows",
        players: [],
        smtc: {
          capability: "unavailable",
          isMonitoring: false,
          potPlayerSessionCount: 0,
          potPlayerSessionState: "notObserved",
          sessionCount: 0,
        },
        status: "ready",
      },
    });
  });

  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/servers/current") {
      await route.fulfill({
        json: {
          configuredBaseUrl: server.baseUrl,
          requestId: "compatibility-current",
          server,
        },
      });
      return;
    }
    if (path === "/api/v1/auth/me") {
      await route.fulfill({
        json: { requestId: "compatibility-me", server, user },
      });
      return;
    }
    if (path === "/api/v1/media/home") {
      await route.fulfill({
        json: {
          favoriteItems: [],
          genreRows: [],
          hero: { ...movie, genres: [] },
          latestMovies: [movie],
          latestSeries: [],
          requestId: "compatibility-home",
          resumeItems: [],
        },
      });
      return;
    }
    if (path === "/api/v1/media/libraries") {
      await route.fulfill({
        json: {
          libraries: [
            {
              itemCount: 1,
              kind: "movies",
              libraryId: "library-1",
              name: "Compatibility Library",
              serverId: "server-1",
            },
          ],
          requestId: "compatibility-libraries",
        },
      });
      return;
    }
    if (path === "/api/v1/media/items") {
      await route.fulfill({
        json: {
          items: [movie],
          limit: 40,
          requestId: "compatibility-items",
          startIndex: 0,
          total: 1,
        },
      });
      return;
    }
    if (path === "/api/v1/media/search") {
      await route.fulfill({
        json: {
          episodes: [],
          movies: [movie],
          people: [],
          requestId: "compatibility-search",
          series: [],
        },
      });
      return;
    }
    await route.abort();
  });

  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "首页" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "跳到主要内容" })).toBeFocused();

  await page.getByRole("link", { exact: true, name: "电影" }).click();
  await expect(page.getByRole("heading", { name: "全部电影" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Compatibility Movie/ }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByRole("link", { exact: true, name: "首页" }).click();
  await page.getByRole("button", { name: "打开全局搜索" }).click();
  const search = page.getByRole("combobox", { name: "搜索电影或剧集" });
  await search.fill("Compatibility");
  await expect(
    page.getByRole("link", { name: /Compatibility Movie/ }).last(),
  ).toBeVisible();
  await search.press("Escape");
  await expect(
    page.getByRole("button", { name: "打开全局搜索" }),
  ).toBeFocused();

  expect(runtimeErrors).toEqual([]);
});
