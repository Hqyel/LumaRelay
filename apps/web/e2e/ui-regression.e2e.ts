import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const server = {
  baseUrl: "https://emby.example.com/",
  capabilityFlags: { ping: true, publicInfo: true },
  latencyMs: 12,
  name: "Home Emby",
  serverId: "server-1",
  supportsHttps: true,
  version: "4.8.11.0",
};

const user = {
  name: "Alex",
  permissions: {
    canDownload: true,
    canManageServer: true,
    isAdministrator: true,
  },
  serverId: "server-1",
  userId: "user-1",
};

const mediaItem = {
  backdropImageTag: undefined,
  communityRating: 8.4,
  isFavorite: true,
  isPlayed: false,
  itemId: "movie-1",
  kind: "movie",
  officialRating: "PG-13",
  playbackPositionSeconds: 0,
  primaryImageTag: undefined,
  productionYear: 2026,
  runtimeSeconds: 7200,
  serverId: "server-1",
  title: "星海归途",
};

const movieItems = Array.from({ length: 8 }, (_, index) => ({
  ...mediaItem,
  communityRating: 8.7 - index * 0.3,
  isFavorite: index === 0,
  itemId: `movie-${index + 1}`,
  playedPercentage: index === 2 ? 46 : undefined,
  primaryImageTag: `image-movie-${index + 1}`,
  productionYear: 2026 - index,
  title: [
    "星海归途",
    "暮色航线",
    "无声灯塔",
    "昨日回声",
    "深空漫游",
    "雾中来信",
    "时间旅店",
    "远岸微光",
  ][index],
}));

const seriesItems = Array.from({ length: 8 }, (_, index) => ({
  ...mediaItem,
  communityRating: 9.1 - index * 0.25,
  itemId: `series-${index + 1}`,
  kind: "series",
  latestEpisodeDate: `2026-0${(index % 8) + 1}-12T08:00:00.000Z`,
  primaryImageTag: `image-series-${index + 1}`,
  seriesStatus: index % 3 === 0 ? "ended" : "continuing",
  title: [
    "群星之间",
    "夜航档案",
    "边境来客",
    "镜面城市",
    "风暴眼",
    "第七码头",
    "夏日信号",
    "时间之外",
  ][index],
  unplayedItemCount: index + 1,
}));

const mediaHome = {
  favoriteItems: [mediaItem],
  genreRows: [],
  hero: {
    ...mediaItem,
    genres: ["科幻"],
    overview: "穿越群星之后，一名旅人重新寻找属于自己的家园。",
  },
  latestMovies: [mediaItem],
  latestSeries: [],
  requestId: "request-home",
  resumeItems: [],
};

async function mockPageApi(page: Page, selected: boolean) {
  await page.route("**/api/v1/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.pathname;

    if (path.includes("/images/")) {
      const isSeries = path.includes("series-");
      await route.fulfill({
        body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${isSeries ? "#0e7490" : "#7c3aed"}"/><stop offset="1" stop-color="${isSeries ? "#312e81" : "#be185d"}"/></linearGradient></defs><rect width="240" height="360" fill="url(#g)"/><circle cx="190" cy="70" r="88" fill="#fff" opacity=".08"/><path d="M-20 300L90 170l65 78 40-48 70 100v80H-20z" fill="#fff" opacity=".12"/><path d="M30 40h80v8H30zm0 18h52v5H30z" fill="#fff" opacity=".55"/></svg>`,
        contentType: "image/svg+xml",
      });
      return;
    }

    if (path === "/api/v1/servers/current") {
      await route.fulfill({
        json: {
          configuredBaseUrl: "https://emby.example.com/",
          requestId: "request-current",
          server: selected ? server : null,
        },
      });
      return;
    }
    if (path === "/api/v1/auth/public-users") {
      await route.fulfill({
        json: {
          requestId: "request-users",
          users: [{ hasPassword: true, name: "Alex", userId: "user-1" }],
        },
      });
      return;
    }
    if (path === "/api/v1/auth/me") {
      await route.fulfill({
        json: { requestId: "request-me", server, user },
      });
      return;
    }
    if (path === "/api/v1/media/home") {
      await route.fulfill({ json: mediaHome });
      return;
    }
    if (path === "/api/v1/media/libraries") {
      await route.fulfill({
        json: {
          libraries: [
            {
              itemCount: 24,
              kind: "movies",
              libraryId: "library-1",
              name: "我的电影",
              serverId: "server-1",
            },
          ],
          requestId: "request-libraries",
        },
      });
      return;
    }
    if (path === "/api/v1/media/items") {
      const requestedKinds = requestUrl.searchParams.getAll("kind");
      const items =
        requestedKinds.length > 1
          ? [...movieItems.slice(0, 4), ...seriesItems.slice(0, 4)]
          : requestedKinds.includes("series")
            ? seriesItems
            : movieItems;
      await route.fulfill({
        json: {
          items,
          limit: 40,
          requestId: "request-items",
          startIndex: 0,
          total: items.length,
        },
      });
      return;
    }

    await route.abort();
  });
}

async function expectNoAccessibilityViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
}

async function waitForMediaImages(page: Page) {
  await page.locator(".home-poster-image").evaluateAll(async (images) => {
    await Promise.all(
      images.map((image) =>
        image instanceof HTMLImageElement ? image.decode() : Promise.resolve(),
      ),
    );
  });
}

async function settleVisualState(page: Page) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.mouse.move(1279, 719);
  await page.waitForTimeout(300);
}

test("connect page is accessible by keyboard and matches its baseline", async ({
  page,
}) => {
  await mockPageApi(page, false);
  await page.goto("/connect");
  await expect(
    page.getByRole("heading", { name: "连接媒体服务器" }),
  ).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Emby 服务器地址")).toBeFocused();
  await page
    .getByLabel("Emby 服务器地址")
    .evaluate((element: HTMLElement) => element.blur());
  await page.waitForTimeout(250);
  await expectNoAccessibilityViolations(page);
  await expect(page).toHaveScreenshot("connect-page.png", { fullPage: true });
});

test("login page is accessible by keyboard and matches its baseline", async ({
  page,
}) => {
  await mockPageApi(page, true);
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "登录媒体服务器" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Alex" })).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /Home Emby/ })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Alex" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("用户名")).toBeFocused();
  await page
    .getByLabel("用户名")
    .evaluate((element: HTMLElement) => element.blur());
  await page.waitForTimeout(250);
  await expectNoAccessibilityViolations(page);
  await expect(page).toHaveScreenshot("login-page.png", { fullPage: true });
});

test("application shell is accessible and matches its baseline", async ({
  page,
}) => {
  await mockPageApi(page, true);
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "首页" })).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "跳到主要内容" })).toBeFocused();
  await expect(page.getByRole("link", { name: "全局搜索" })).toBeVisible();
  await page
    .getByRole("link", { name: "跳到主要内容" })
    .evaluate((element: HTMLElement) => element.blur());
  await page.waitForTimeout(250);
  await expectNoAccessibilityViolations(page);
  await expect(page).toHaveScreenshot("application-shell.png", {
    fullPage: true,
  });
});

test("movie library matches the reference card grid", async ({ page }) => {
  await mockPageApi(page, true);
  await page.goto("/movies?page=1");
  await expect(page.getByRole("heading", { name: "全部电影" })).toBeVisible();
  const firstCard = page.getByRole("link", { name: /星海归途/ }).first();
  await firstCard.hover();
  await expect(firstCard.locator(".home-poster-wrapper")).not.toHaveCSS(
    "transform",
    "none",
  );
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  await waitForMediaImages(page);
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("movie-library.png", { fullPage: true });
});

test("series library matches the reference card grid", async ({ page }) => {
  await mockPageApi(page, true);
  await page.goto("/series?page=1");
  await expect(page.getByRole("heading", { name: "全部剧集" })).toBeVisible();
  await waitForMediaImages(page);
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("series-library.png", { fullPage: true });
});

test("authorized libraries match the reference glass list", async ({
  page,
}) => {
  await mockPageApi(page, true);
  await page.goto("/libraries");
  await expect(
    page.getByRole("heading", { level: 2, name: "媒体库" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /我的电影/ })).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("media-libraries.png", {
    fullPage: true,
  });
});

test("generic media library matches the reference card grid", async ({
  page,
}) => {
  await mockPageApi(page, true);
  await page.goto("/library/library-1?page=1");
  await expect(page.getByRole("heading", { name: "我的电影" })).toBeVisible();
  await waitForMediaImages(page);
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("generic-library.png", {
    fullPage: true,
  });
});
