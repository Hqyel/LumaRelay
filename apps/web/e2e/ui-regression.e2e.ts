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

const movieDetail = {
  ...movieItems[0],
  backdropImageTag: "backdrop-movie-1",
  genres: ["科幻", "剧情", "冒险"],
  overview:
    "穿越群星之后，一名旅人沿着失落的航线重新寻找属于自己的家园，也重新理解那些被时间留下的人。",
  premiereDate: "2026-03-14T00:00:00.000Z",
  tagline: "每一次远行，都是为了回家。",
};

const seriesDetail = {
  ...seriesItems[0],
  backdropImageTag: "backdrop-series-1",
  genres: ["科幻", "悬疑"],
  overview:
    "一群来自不同星球的旅人被卷入同一场失踪事件，他们必须在群星之间找到真相。",
  premiereDate: "2026-01-12T00:00:00.000Z",
};

const people = ["林岚", "周屿", "苏野", "程墨"].map((name, index) => ({
  kind: index === 3 ? "director" : "actor",
  name,
  personId: `person-${index + 1}`,
  primaryImageTag: `person-image-${index + 1}`,
  role: index === 3 ? "导演" : ["旅人", "领航员", "工程师"][index],
  serverId: "server-1",
}));

const episodes = Array.from({ length: 6 }, (_, index) => ({
  episodeId: `episode-${index + 1}`,
  episodeNumber: index + 1,
  isPlayed: index === 0,
  name: ["离港", "静默信号", "重力井", "无名坐标", "回声", "归途"][index],
  overview: "新的线索将众人带向未知星域。",
  playbackPositionSeconds: index === 1 ? 1320 : 0,
  premiereDate: `2026-0${index + 1}-12T08:00:00.000Z`,
  primaryImageTag: `episode-image-${index + 1}`,
  runtimeSeconds: 2880,
  seasonId: "season-1",
  seasonNumber: 1,
  seriesId: "series-1",
  seriesName: "群星之间",
  serverId: "server-1",
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

async function mockPageApi(
  page: Page,
  selected: boolean,
  itemState:
    "normal" | "empty" | "error" | "forbidden" | "unauthenticated" = "normal",
  playedWriteFails = false,
) {
  let favoriteState = true;
  let playedState = false;

  await page.route("**/api/v1/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.pathname;

    if (path.includes("/images/")) {
      const isSeries = path.includes("series-");
      const isBackdrop = path.endsWith("/backdrop");
      await route.fulfill({
        body: isBackdrop
          ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${isSeries ? "#082f49" : "#312e81"}"/><stop offset=".55" stop-color="${isSeries ? "#155e75" : "#7e22ce"}"/><stop offset="1" stop-color="#0f0f23"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><circle cx="940" cy="180" r="220" fill="#fff" opacity=".08"/><path d="M0 620L310 280l180 210 150-170 250 300 180-220 300 320H0z" fill="#fff" opacity=".09"/><g fill="#fff" opacity=".65"><circle cx="720" cy="100" r="3"/><circle cx="1060" cy="380" r="2"/><circle cx="550" cy="210" r="2"/><circle cx="1180" cy="90" r="4"/></g></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${isSeries ? "#0e7490" : "#7c3aed"}"/><stop offset="1" stop-color="${isSeries ? "#312e81" : "#be185d"}"/></linearGradient></defs><rect width="240" height="360" fill="url(#g)"/><circle cx="190" cy="70" r="88" fill="#fff" opacity=".08"/><path d="M-20 300L90 170l65 78 40-48 70 100v80H-20z" fill="#fff" opacity=".12"/><path d="M30 40h80v8H30zm0 18h52v5H30z" fill="#fff" opacity=".55"/></svg>`,
        contentType: "image/svg+xml",
      });
      return;
    }

    if (path === "/api/v1/security/csrf") {
      await route.fulfill({
        json: {
          csrfToken: "e2e-csrf-token-with-at-least-32-characters",
          requestId: "request-csrf",
        },
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
      await route.fulfill({
        json: {
          ...mediaHome,
          favoriteItems: favoriteState
            ? [
                {
                  ...mediaItem,
                  isFavorite: true,
                  isPlayed: playedState,
                  playedPercentage: playedState ? 100 : undefined,
                },
              ]
            : [],
          hero:
            mediaHome.hero === null
              ? null
              : {
                  ...mediaHome.hero,
                  isFavorite: favoriteState,
                  isPlayed: playedState,
                  playedPercentage: playedState ? 100 : undefined,
                },
          latestMovies: mediaHome.latestMovies.map((item) => ({
            ...item,
            isFavorite:
              item.itemId === "movie-1" ? favoriteState : item.isFavorite,
            isPlayed: item.itemId === "movie-1" ? playedState : item.isPlayed,
            playedPercentage:
              item.itemId === "movie-1" && playedState
                ? 100
                : item.playedPercentage,
          })),
          resumeItems: playedState ? [] : mediaHome.resumeItems,
        },
      });
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
      if (itemState === "forbidden" || itemState === "unauthenticated") {
        const unauthenticated = itemState === "unauthenticated";
        await route.fulfill({
          json: {
            error: {
              code: unauthenticated ? "UNAUTHENTICATED" : "ACCESS_DENIED",
              message: unauthenticated ? "Sign in again" : "Forbidden",
              requestId: unauthenticated
                ? "request-items-auth"
                : "request-items-denied",
            },
          },
          status: unauthenticated ? 401 : 403,
        });
        return;
      }
      if (itemState === "error") {
        await route.fulfill({
          body: "Upstream gateway unavailable",
          contentType: "text/plain",
          headers: { "x-request-id": "request-items-error" },
          status: 503,
        });
        return;
      }
      const requestedKinds = requestUrl.searchParams.getAll("kind");
      const items = (
        itemState === "empty"
          ? []
          : requestedKinds.length > 1
            ? [...movieItems.slice(0, 4), ...seriesItems.slice(0, 4)]
            : requestedKinds.includes("series")
              ? seriesItems
              : movieItems
      ).map((item) => ({
        ...item,
        isFavorite: item.itemId === "movie-1" ? favoriteState : item.isFavorite,
        isPlayed: item.itemId === "movie-1" ? playedState : item.isPlayed,
        playedPercentage:
          item.itemId === "movie-1" && playedState
            ? 100
            : item.playedPercentage,
      }));
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
    if (path === "/api/v1/media/search") {
      await route.fulfill({
        json: {
          episodes: [],
          movies: movieItems.slice(0, 3).map((item) => ({
            ...item,
            isFavorite:
              item.itemId === "movie-1" ? favoriteState : item.isFavorite,
            isPlayed: item.itemId === "movie-1" ? playedState : item.isPlayed,
            playedPercentage:
              item.itemId === "movie-1" && playedState
                ? 100
                : item.playedPercentage,
          })),
          people: [],
          requestId: "request-search",
          series: seriesItems.slice(0, 3),
        },
      });
      return;
    }
    if (path === "/api/v1/media/items/movie-1") {
      await route.fulfill({
        json: {
          item: {
            ...movieDetail,
            isFavorite: favoriteState,
            isPlayed: playedState,
            playedPercentage: playedState ? 100 : undefined,
          },
          people,
          relatedItems: movieItems.slice(1, 7),
          requestId: "request-movie-detail",
        },
      });
      return;
    }
    if (
      path === "/api/v1/media/items/movie-1/favorite" &&
      route.request().method() === "PUT"
    ) {
      const body = route.request().postDataJSON() as { favorite: boolean };
      favoriteState = body.favorite;
      await route.fulfill({
        json: {
          requestId: "request-favorite",
          state: {
            isFavorite: favoriteState,
            isPlayed: playedState,
            itemId: "movie-1",
            playbackPositionSeconds: 0,
            playedPercentage: playedState ? 100 : undefined,
            serverId: "server-1",
          },
        },
      });
      return;
    }
    if (
      path === "/api/v1/media/items/movie-1/played" &&
      route.request().method() === "PUT"
    ) {
      if (playedWriteFails) {
        await route.fulfill({
          json: {
            error: {
              code: "EMBY_WRITE_FAILED",
              message: "The Emby write failed",
              requestId: "request-played-failed",
            },
          },
          status: 502,
        });
        return;
      }
      const body = route.request().postDataJSON() as { played: boolean };
      playedState = body.played;
      await route.fulfill({
        json: {
          requestId: "request-played",
          state: {
            isFavorite: favoriteState,
            isPlayed: playedState,
            itemId: "movie-1",
            playbackPositionSeconds: 0,
            playedPercentage: playedState ? 100 : undefined,
            serverId: "server-1",
          },
        },
      });
      return;
    }
    if (path === "/api/v1/media/items/series-1") {
      await route.fulfill({
        json: {
          item: seriesDetail,
          people,
          relatedItems: seriesItems.slice(1, 7),
          requestId: "request-series-detail",
        },
      });
      return;
    }
    if (path === "/api/v1/media/series/series-1/seasons") {
      await route.fulfill({
        json: {
          requestId: "request-seasons",
          seasons: [
            {
              indexNumber: 1,
              isPlayed: false,
              name: "第 1 季",
              seasonId: "season-1",
              seriesId: "series-1",
              serverId: "server-1",
              unplayedEpisodeCount: 5,
            },
            {
              indexNumber: 2,
              isPlayed: false,
              name: "第 2 季",
              seasonId: "season-2",
              seriesId: "series-1",
              serverId: "server-1",
              unplayedEpisodeCount: 8,
            },
          ],
        },
      });
      return;
    }
    if (path === "/api/v1/media/series/series-1/episodes") {
      await route.fulfill({
        json: { episodes, requestId: "request-episodes" },
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

async function waitForImages(page: Page) {
  await page.locator("img").evaluateAll(async (images) => {
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
  await expect(
    page.getByRole("button", { name: "打开全局搜索" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "跳到主要内容" })
    .evaluate((element: HTMLElement) => element.blur());
  await page.waitForTimeout(250);
  await expectNoAccessibilityViolations(page);
  await expect(page).toHaveScreenshot("application-shell.png", {
    fullPage: true,
  });
});

test("header search expands and shows reference dropdown results", async ({
  page,
}) => {
  await mockPageApi(page, true);
  await page.goto("/home");
  await page.getByRole("button", { name: "打开全局搜索" }).click();
  const searchInput = page.getByRole("combobox", {
    name: "搜索电影或剧集",
  });
  await expect(searchInput).toBeFocused();
  await searchInput.fill("星海");
  const dropdown = page.locator("#header-search-results");
  await expect(dropdown.getByRole("link", { name: /星海归途/ })).toBeVisible();
  await expect(dropdown.getByRole("link", { name: /群星之间/ })).toBeVisible();
  await waitForImages(page);
  await expectNoAccessibilityViolations(page);
  await expect(page).toHaveScreenshot("header-search-dropdown.png", {
    fullPage: true,
  });
  await searchInput.press("Escape");
  await expect(searchInput).toBeHidden();
});

test("legacy search route returns to home", async ({ page }) => {
  await mockPageApi(page, true);
  await page.goto("/search?q=星海");
  await expect(page).toHaveURL(/\/home$/);
});

test("movie details match the reference immersive layout", async ({ page }) => {
  await mockPageApi(page, true);
  await page.goto("/item/movie-1");
  await expect(page.getByRole("heading", { name: "星海归途" })).toBeVisible();
  await expect(page.getByText("每一次远行，都是为了回家。")).toBeVisible();
  await waitForImages(page);
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("movie-detail.png", { fullPage: true });
});

test("series details show season and horizontal episodes", async ({ page }) => {
  await mockPageApi(page, true);
  await page.goto("/item/series-1");
  await expect(page.getByRole("heading", { name: "群星之间" })).toBeVisible();
  await expect(page.getByLabel("选择季")).toHaveValue("season-1");
  await expect(page.getByText("1. 离港")).toBeVisible();
  await waitForImages(page);
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("series-detail.png", { fullPage: true });
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
  await waitForImages(page);
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("movie-library.png", { fullPage: true });
});

test("media filters use canonical shareable URL state", async ({ page }) => {
  await mockPageApi(page, true);
  await page.goto("/movies?page=2");
  await page.getByLabel("类型标签").fill("科幻, 剧情");
  await page
    .getByRole("textbox", { exact: true, name: "年份" })
    .fill("2026, 2024");
  await page.getByLabel("最低评分").fill("8");
  await page.getByLabel("观看状态").selectOption("unplayed");
  await page.getByLabel("收藏状态").selectOption("true");
  await page.locator('select[name="sortBy"]').selectOption("communityRating");
  const filteredRequest = page.waitForRequest((request) =>
    request.url().includes("/api/v1/media/items?"),
  );
  await page.getByRole("button", { name: "应用筛选" }).click();

  const request = await filteredRequest;
  const apiParams = new URL(request.url()).searchParams;
  expect(apiParams.getAll("genre")).toEqual(["剧情", "科幻"]);
  expect(apiParams.getAll("year")).toEqual(["2024", "2026"]);
  expect(apiParams.get("favorite")).toBe("true");
  expect(apiParams.get("playState")).toBe("unplayed");
  expect(apiParams.get("sortBy")).toBe("communityRating");

  await expect(page).toHaveURL(/page=1/);
  const browserParams = new URL(page.url()).searchParams;
  expect(browserParams.getAll("genre")).toEqual(["剧情", "科幻"]);
  expect(browserParams.getAll("year")).toEqual(["2024", "2026"]);
});

test("browser back restores media URL and scroll position", async ({
  page,
}) => {
  await mockPageApi(page, true);
  await page.goto(
    "/movies?genre=Drama&genre=Sci-Fi&page=2&sortBy=dateAdded&sortOrder=descending",
  );
  await expect(page.locator(".home-media-card").first()).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(100);
  const previousScrollY = await page.evaluate(() => window.scrollY);
  expect(previousScrollY).toBeGreaterThan(200);

  await page
    .locator(".home-media-card")
    .first()
    .evaluate((element) => (element as HTMLElement).click());
  await expect(page).toHaveURL(/\/item\/movie-1/);
  await page.goBack();

  const restoredUrl = new URL(page.url());
  expect(restoredUrl.pathname).toBe("/movies");
  expect(restoredUrl.searchParams.get("page")).toBe("2");
  expect(restoredUrl.searchParams.getAll("genre")).toEqual(["Drama", "Sci-Fi"]);
  await expect
    .poll(async () => {
      const restoredScrollY = await page.evaluate(() => window.scrollY);
      return Math.abs(restoredScrollY - previousScrollY);
    })
    .toBeLessThanOrEqual(120);
});

test("series library matches the reference card grid", async ({ page }) => {
  await mockPageApi(page, true);
  await page.goto("/series?page=1");
  await expect(page.getByRole("heading", { name: "全部剧集" })).toBeVisible();
  await waitForImages(page);
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
  await waitForImages(page);
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("generic-library.png", {
    fullPage: true,
  });
});

test("empty media state matches the shared glass treatment", async ({
  page,
}) => {
  await mockPageApi(page, true, "empty");
  await page.goto("/movies?page=1");
  await expect(
    page.getByRole("heading", { name: "没有找到电影" }),
  ).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("media-empty-state.png", {
    fullPage: true,
  });
});

test("offline media state keeps a visible retry action", async ({ page }) => {
  await mockPageApi(page, true, "error");
  await page.goto("/movies?page=1");
  await expect(
    page.getByRole("heading", { name: "电影库暂时不可用" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "重新加载" })).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("media-error-state.png", {
    fullPage: true,
  });
});

test("forbidden media uses a dedicated non-retryable state", async ({
  page,
}) => {
  await mockPageApi(page, true, "forbidden");
  await page.goto("/movies?page=1");
  await expect(
    page.getByRole("heading", { name: "无权访问电影库" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "重新加载" })).toHaveCount(0);
  await expect(page.getByText(/request-items-denied/)).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("media-access-denied.png", {
    fullPage: true,
  });
});

test("media 401 continues to use the global login recovery", async ({
  page,
}) => {
  await mockPageApi(page, true, "unauthenticated");
  await page.goto("/movies?page=1");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "登录媒体服务器" }),
  ).toBeVisible();
});

test("favorite updates optimistically, survives refresh, and is restored", async ({
  page,
}) => {
  await mockPageApi(page, true);
  await page.goto("/item/movie-1");
  const favoriteButton = page.getByRole("button", { name: "已收藏" });
  await expect(favoriteButton).toHaveAttribute("aria-pressed", "true");
  await favoriteButton.click();
  await expect(page.getByRole("button", { name: "收藏" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await page.reload();
  await expect(page.getByRole("button", { name: "收藏" })).toBeVisible();
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "我的收藏" })).toHaveCount(0);

  await page.goto("/item/movie-1");
  await page.getByRole("button", { name: "收藏" }).click();
  await expect(page.getByRole("button", { name: "已收藏" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("played state updates optimistically, survives refresh, and is restored", async ({
  page,
}) => {
  await mockPageApi(page, true);
  await page.goto("/item/movie-1");
  const playedButton = page.getByRole("button", { name: "标记已看" });
  await expect(playedButton).toHaveAttribute("aria-pressed", "false");
  await playedButton.click();
  await expect(page.getByRole("button", { name: "标记未看" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.reload();
  await expect(page.getByRole("button", { name: "标记未看" })).toBeVisible();
  await page.goto("/home");
  await expect(page.getByLabel("已看").first()).toBeVisible();

  await page.goto("/item/movie-1");
  await page.getByRole("button", { name: "标记未看" }).click();
  await expect(page.getByRole("button", { name: "标记已看" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("failed played update rolls back and remains actionable", async ({
  page,
}) => {
  await mockPageApi(page, true, "normal", true);
  await page.goto("/item/movie-1");
  const playedButton = page.getByRole("button", { name: "标记已看" });
  await playedButton.click();

  await expect(page.getByRole("alert")).toContainText(
    "观看状态更新失败，已恢复原状态，请重试",
  );
  await expect(playedButton).toHaveAttribute("aria-pressed", "false");
  await expect(playedButton).toBeEnabled();
});

test("administrator entry matches the compact glass management shell", async ({
  page,
}) => {
  await mockPageApi(page, true);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { exact: true, name: "概览" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "服务器概览" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "跳到管理内容" })).toBeFocused();
  await page
    .getByRole("link", { name: "跳到管理内容" })
    .evaluate((element: HTMLElement) => element.blur());
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("admin-foundation.png", {
    fullPage: true,
  });
});
