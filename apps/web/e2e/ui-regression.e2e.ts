import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function chooseSelectOption(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { exact: true, name: option }).click();
}

async function openMovieAction(page: Page, action: string) {
  await page.getByRole("button", { name: "更多电影操作" }).click();
  return page.getByRole("menuitem", { exact: true, name: action });
}

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

const movieOverview =
  "穿越群星之后，一名旅人沿着失落的航线重新寻找属于自己的家园，也重新理解那些被时间留下的人。旅途中接连出现的旧坐标和静默信号，让每一次选择都指向一段被刻意隐藏的往事；只有重新面对离别、承诺与归途，他才能知道所谓家园究竟是一处地点，还是仍愿意等待自己的人。";
const episodeCardOverview =
  "一段来自失落航线的静默信号重新串联起所有线索，也迫使众人在未知星域中重新审视彼此的选择与尚未兑现的承诺。";

const movieDetail = {
  ...movieItems[0],
  backdropImageTag: "backdrop-movie-1",
  genres: ["科幻", "剧情", "冒险"],
  overview: movieOverview,
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

const episodeDetail = {
  backdropImageTag: "backdrop-series-1",
  episodeNumber: 2,
  genres: ["科幻", "悬疑"],
  isFavorite: false,
  isPlayed: false,
  itemId: "episode-2",
  kind: "episode" as const,
  overview: "一段静默信号让所有线索重新指向失落的航线。",
  playbackPositionSeconds: 1320,
  primaryImageTag: "episode-image-2",
  runtimeSeconds: 2880,
  seasonId: "season-1",
  seasonNumber: 1,
  seriesId: "series-1",
  serverId: "server-1",
  subtitle: "群星之间",
  title: "静默信号",
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
  name: [
    "离港",
    "静默信号",
    "重力井",
    "无名坐标与最后一段失落航线的回声以及归途尽头的秘密",
    "回声",
    "归途",
  ][index],
  overview: index === 1 ? episodeCardOverview : "新的线索将众人带向未知星域。",
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
  resumeItems: [episodeDetail],
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
    if (path === "/api/v1/bridge/pairing-codes") {
      expect(route.request().headers()["x-lumarelay-csrf"]).toBe(
        "e2e-csrf-token-with-at-least-32-characters",
      );
      await route.fulfill({
        json: {
          expiresAt: "2026-07-22T12:01:00.000Z",
          expiresInSeconds: 60,
          pairingCode: "A".repeat(43),
          requestId: "request-pairing-code",
        },
        status: 201,
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
    if (
      path.startsWith("/api/v1/media/items/") &&
      path.endsWith("/playback-options")
    ) {
      const playbackItemId = path.split("/").at(-2)!;
      await route.fulfill({
        json: {
          itemId: playbackItemId,
          requestId: "request-playback-options",
          sources: [
            {
              audioTracks: [
                {
                  codec: "aac",
                  codecTag: "mp4a",
                  displayTitle: "中文 AAC 5.1",
                  index: 1,
                  isDefault: true,
                  isExternal: false,
                  isText: false,
                  kind: "audio",
                  language: "chi",
                  profile: "LC",
                  sampleRate: 48_000,
                  bitrate: 640_000,
                  channelLayout: "5.1",
                  channels: 6,
                },
              ],
              bitrate: 8_000_000,
              container: "mkv",
              defaultAudioStreamIndex: 1,
              defaultSubtitleStreamIndex: 2,
              mediaSourceId: "source-1",
              name: "星海归途.2026.1080p.WEB-DL.H265.AAC.中文字幕收藏版.原始媒体版本",
              runtimeTicks: 72_000_000_000,
              sizeBytes: 4_294_967_296,
              subtitleTracks: [
                {
                  codec: "srt",
                  displayTitle: "简体中文",
                  index: 2,
                  isDefault: true,
                  isExternal: true,
                  isText: true,
                  kind: "subtitle",
                  language: "chi",
                },
              ],
              supportsDirectStream: true,
              video: {
                aspectRatio: "16:9",
                bitDepth: 10,
                bitrate: 8_000_000,
                codec: "hevc",
                codecTag: "hvc1",
                displayTitle: "1080p HEVC Main 10",
                frameRate: 23.976,
                height: 1080,
                isInterlaced: false,
                level: 150,
                pixelFormat: "yuv420p10le",
                profile: "Main 10",
                refFrames: 1,
                videoRange: "HDR10",
                width: 1920,
              },
            },
          ],
        },
      });
      return;
    }
    if (
      path === "/api/v1/bridge/play-tickets" &&
      route.request().method() === "POST"
    ) {
      expect(route.request().headers()["x-lumarelay-csrf"]).toBe(
        "e2e-csrf-token-with-at-least-32-characters",
      );
      await route.fulfill({
        json: {
          expiresAt: "2026-07-22T12:01:00.000Z",
          expiresInSeconds: 60,
          playSessionId: "22222222-2222-4222-8222-222222222222",
          playTicket: `pt1.33333333-3333-4333-8333-333333333333.${"C".repeat(43)}`,
          requestId: "request-play-ticket",
        },
        status: 201,
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
    if (path === "/api/v1/media/items/episode-2") {
      await route.fulfill({
        json: {
          item: episodeDetail,
          people,
          relatedItems: seriesItems.slice(1, 4),
          requestId: "request-episode-detail",
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

async function stabilizeLibraryScreenshotHeight(page: Page) {
  await page.addStyleTag({
    content: "html, body, #root { min-height: 1163px !important; }",
  });
}

test("Bridge setup separates local connection and capabilities", async ({
  page,
}) => {
  let connected = false;
  await page.route("http://127.0.0.1:58080/v1/status**", async (route) => {
    if (!connected) {
      await route.abort("connectionrefused");
      return;
    }
    await route.fulfill({
      headers: { "access-control-allow-origin": "http://127.0.0.1:4173" },
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
        deviceId: "11111111-1111-4111-8111-111111111111",
        isPaired: true,
        platform: "windows",
        players: [
          {
            adapterId: "potplayer",
            architecture: "x64",
            displayName: "PotPlayer",
            isAvailable: true,
            isRunning: false,
            version: "1.7.22398.0",
          },
        ],
        smtc: {
          capability: "ready",
          isMonitoring: true,
          potPlayerSessionCount: 0,
          potPlayerSessionState: "notObserved",
          sessionCount: 0,
        },
        status: "ready",
      },
    });
  });
  await mockPageApi(page, true);
  await page.goto("/home");

  await page
    .getByRole("button", { name: /Bridge 未连接，打开本地播放连接设置/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "本地播放连接" }),
  ).toBeVisible();
  await expect(page.getByText("连接便携版")).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("bridge-setup.png");

  await page.getByRole("button", { name: "生成配对请求" }).click();
  await expect(
    page.getByRole("link", { name: "打开 Bridge 完成配对" }),
  ).toHaveAttribute(
    "href",
    `lumarelay://pair?code=${"A".repeat(43)}&gateway=http%3A%2F%2F127.0.0.1%3A4173`,
  );

  connected = true;
  await page.getByRole("button", { name: "重新检测" }).click();
  await expect(
    page.getByText("本机已可以接收 LumaRelay 的播放请求。"),
  ).toBeVisible();
  await expect(page.getByText("已发现 1.7.22398.0")).toBeVisible();
  await expect(page.getByText("系统媒体会话监听正常")).toBeVisible();
});

test("connect page is accessible by keyboard and matches its baseline", async ({
  page,
}) => {
  await mockPageApi(page, false);
  await page.goto("/connect");
  await expect(
    page.getByRole("heading", { name: "连接媒体服务器" }),
  ).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /^主题：/ })).toBeFocused();
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
  await expect(page.getByRole("button", { name: /^主题：/ })).toBeFocused();
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
  await expect(page.getByText("第 1 季 · 第 2 集 · 静默信号")).toBeVisible();
  await expect(page.getByText("已观看 22:00 · 剩余 26:00")).toBeVisible();
  await expect(page.locator(".lumarelay-app-header")).toHaveCSS(
    "border-bottom-width",
    "0px",
  );
  await expect(page.locator(".lumarelay-app-header")).toHaveCSS(
    "box-shadow",
    "none",
  );
  await expect(page.locator(".lumarelay-app-header")).not.toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );

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

  await page
    .getByRole("link", { name: /静默信号/ })
    .first()
    .click();
  await expect(
    page.getByText("第 1 季 第 2 集", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "群星之间" })).toBeVisible();
  await expect(
    page.getByText("一段静默信号让所有线索重新指向失落的航线。"),
  ).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "相关演员" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "相关推荐" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "媒体信息" })).toBeVisible();
  await expect(page.getByText("1920×1080")).toBeVisible();
  await expect(page.getByText("yuv420p10le")).toBeVisible();
  await expect(page.getByText("48,000 Hz")).toBeVisible();
  await expect(
    page.locator(".episode-reference-lower > :last-child"),
  ).toContainText("媒体信息");
  await expect(
    page.getByRole("button", { name: "更多单集操作" }),
  ).toBeVisible();
  await expect(page.getByLabel("版本")).toContainText("星海归途.2026");
  await expect(page.getByRole("button", { name: "继续播放" })).toBeVisible();
  await waitForImages(page);
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("episode-detail.png", {
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
  await expect(
    page.getByRole("heading", { exact: true, name: "星海归途" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "返回上一页" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "更多电影操作" }),
  ).toBeVisible();
  await expect(page.getByText("2026-03-14")).toBeVisible();
  await expect(page.getByText("2小时0分钟0秒")).toBeVisible();
  await expect(page.getByText("1080P", { exact: true })).toBeVisible();
  await expect(page.getByText("24 FPS", { exact: true })).toBeVisible();
  await expect(page.getByLabel("版本")).toContainText("星海归途.2026");
  await expect(page.getByLabel("详情音轨")).toContainText("中文 AAC 5.1");
  await expect(page.getByLabel("详情字幕")).toContainText("简体中文");
  const versionValue = page
    .getByLabel("版本")
    .locator(".lumarelay-select-value-scroll");
  await expect(versionValue).toHaveCSS("white-space", "nowrap");
  await expect(versionValue).toHaveCSS("overflow-x", "hidden");
  expect(
    await versionValue.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
  await page.getByLabel("版本").hover();
  await expect
    .poll(() => versionValue.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  const firstVersionOffset = await versionValue.evaluate(
    (element) => element.scrollLeft,
  );
  await page.waitForTimeout(500);
  expect(
    await versionValue.evaluate((element) => element.scrollLeft),
  ).toBeGreaterThan(firstVersionOffset);
  await page.mouse.move(0, 0);
  await expect
    .poll(() => versionValue.evaluate((element) => element.scrollLeft))
    .toBe(0);
  await page.getByRole("button", { exact: true, name: "更多" }).click();
  await expect(page.getByRole("dialog", { name: "剧情简介" })).toBeVisible();
  await expect(page.getByText(movieOverview, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  const immersiveHeader = page.locator(".lumarelay-app-header");
  await expect(immersiveHeader).toHaveAttribute("data-immersive", "true");
  await expect(immersiveHeader).not.toHaveAttribute("data-scrolled", "true");
  await waitForImages(page);
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("movie-detail.png", { fullPage: true });
  await page.evaluate(() => window.scrollTo(0, 300));
  await expect(immersiveHeader).toHaveAttribute("data-scrolled", "true");
});

test("local playback preparation is accessible and starts the Bridge", async ({
  page,
}) => {
  let started = false;
  await page.route("http://127.0.0.1:58080/v1/status**", async (route) => {
    await route.fulfill({
      headers: { "access-control-allow-origin": "http://127.0.0.1:4173" },
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
        deviceId: "11111111-1111-4111-8111-111111111111",
        isPaired: true,
        platform: "windows",
        players: [
          {
            adapterId: "potplayer",
            architecture: "x64",
            displayName: "PotPlayer",
            isAvailable: true,
            isRunning: false,
            version: "1.7.22398.0",
          },
        ],
        smtc: {
          capability: "ready",
          isMonitoring: true,
          potPlayerSessionCount: 0,
          potPlayerSessionState: "notObserved",
          sessionCount: 0,
        },
        status: "ready",
      },
    });
  });
  await page.route(
    "http://127.0.0.1:58080/v1/playback/start",
    async (route) => {
      started = true;
      expect(route.request().headers()["x-lumarelay-nonce"]).toHaveLength(32);
      await route.fulfill({
        headers: { "access-control-allow-origin": "http://127.0.0.1:4173" },
        json: {
          playSessionId: "22222222-2222-4222-8222-222222222222",
          player: "potplayer",
          status: "launching",
        },
      });
    },
  );
  await mockPageApi(page, true);
  await page.goto("/item/movie-1");
  await page.getByRole("button", { exact: true, name: "播放" }).click();

  await expect(
    page.getByRole("heading", { name: "本地播放准备" }),
  ).toBeVisible();
  await expect(page.getByLabel("播放版本")).toContainText("1080p");
  await expect(page.getByLabel("音轨", { exact: true })).toContainText(
    "中文 AAC 5.1",
  );
  await expect(page.getByLabel("字幕", { exact: true })).toContainText(
    "简体中文",
  );
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("playback-preparation.png");

  await page.getByRole("button", { name: "使用 PotPlayer 播放" }).click();
  await expect(page.getByText("PotPlayer 正在启动…")).toBeVisible();
  expect(started).toBe(true);
});

test("current playback reflects live Bridge timeline states", async ({
  page,
}) => {
  let paused = false;
  await page.route("http://127.0.0.1:58080/v1/status**", async (route) => {
    await route.fulfill({
      headers: { "access-control-allow-origin": "http://127.0.0.1:4173" },
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
        deviceId: "11111111-1111-4111-8111-111111111111",
        isPaired: true,
        platform: "windows",
        players: [
          {
            adapterId: "potplayer",
            architecture: "x64",
            displayName: "PotPlayer",
            isAvailable: true,
            isRunning: true,
            version: "1.7.22398.0",
          },
        ],
        smtc: {
          capability: "ready",
          isMonitoring: true,
          potPlayerSessionCount: 1,
          potPlayerSessionState: "detected",
          sessionCount: 1,
        },
        status: "ready",
      },
    });
  });
  await page.route(
    "http://127.0.0.1:58080/v1/playback/status",
    async (route) => {
      await route.fulfill({
        headers: { "access-control-allow-origin": "http://127.0.0.1:4173" },
        json: {
          sessions: [
            {
              durationTicks: 72_000_000_000,
              itemId: "movie-1",
              playSessionId: "22222222-2222-4222-8222-222222222222",
              positionTicks: paused ? 9_300_000_000 : 9_000_000_000,
              state: paused ? "paused" : "playing",
              syncState: "synchronized",
              updatedAt: "2026-07-22T12:00:00.000Z",
              warning: null,
            },
          ],
        },
      });
    },
  );
  await mockPageApi(page, true);
  await page.goto("/home");

  const panel = page.getByRole("complementary", { name: "当前本地播放" });
  await expect(panel.getByText("正在播放")).toBeVisible();
  await expect(panel.getByRole("link", { name: "星海归途" })).toBeVisible();
  await expect(panel.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "13",
  );
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("current-playback.png");

  paused = true;
  await expect(panel.getByText("已暂停")).toBeVisible({ timeout: 3_000 });
});

test("series details show season and horizontal episodes", async ({ page }) => {
  await mockPageApi(page, true);
  await page.goto("/item/series-1");
  await expect(page.getByRole("heading", { name: "群星之间" })).toBeVisible();
  await expect(
    page.getByText("第 1 季 第 2 集", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "更多剧集操作" }),
  ).toBeVisible();
  await expect(page.getByLabel("版本")).toContainText("星海归途.2026");
  await expect(page.getByLabel("选择季")).toContainText("第 1 季");
  await expect(page.getByText("1. 离港")).toBeVisible();
  await expect(page.getByText("22:00 / 48:00")).toBeVisible();
  const episodeOverviewCard = page
    .locator(".detail-episode-card")
    .filter({ hasText: "2. 静默信号" });
  await episodeOverviewCard
    .getByRole("button", { exact: true, name: "更多" })
    .click();
  await expect(page.getByRole("dialog", { name: "2. 静默信号" })).toBeVisible();
  await expect(
    page.getByText(episodeCardOverview, { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  const longEpisodeTitle = page.getByRole("link", {
    name: "4. 无名坐标与最后一段失落航线的回声以及归途尽头的秘密",
  });
  const longEpisodeCard = page
    .locator(".detail-episode-card")
    .filter({ has: longEpisodeTitle });
  expect(
    await longEpisodeTitle.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
  await longEpisodeCard.hover();
  await expect(longEpisodeCard).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(longEpisodeCard.locator(".detail-episode-info")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(longEpisodeCard).toHaveCSS("box-shadow", "none");
  await expect
    .poll(() => longEpisodeTitle.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  const firstTitleOffset = await longEpisodeTitle.evaluate(
    (element) => element.scrollLeft,
  );
  await page.waitForTimeout(500);
  expect(
    await longEpisodeTitle.evaluate((element) => element.scrollLeft),
  ).toBeGreaterThan(firstTitleOffset);
  await page.mouse.move(0, 0);
  await expect
    .poll(() => longEpisodeTitle.evaluate((element) => element.scrollLeft))
    .toBe(0);
  await waitForImages(page);
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("series-detail.png", { fullPage: true });

  await page.getByRole("button", { exact: true, name: "继续播放" }).click();
  await expect(
    page.getByRole("heading", { name: "本地播放准备" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: /2\. 静默信号/ }).click();
  await expect(page.getByRole("heading", { name: "群星之间" })).toBeVisible();
  await expect(
    page.getByText("第 1 季 第 2 集", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("一段静默信号让所有线索重新指向失落的航线。"),
  ).toHaveCount(1);
});

test("movie library matches the reference card grid", async ({ page }) => {
  await mockPageApi(page, true);
  await page.goto("/movies?page=1");
  await expect(page.getByRole("heading", { name: "全部电影" })).toBeVisible();
  const firstCard = page.getByRole("link", { name: /星海归途/ }).first();
  const cardInfo = firstCard.locator(".home-card-info");
  const restingBackground = await cardInfo.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await firstCard.hover();
  await expect(firstCard.locator(".home-poster-wrapper")).not.toHaveCSS(
    "transform",
    "none",
  );
  await expect
    .poll(() =>
      cardInfo.evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .toBe(restingBackground);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  await waitForImages(page);
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await stabilizeLibraryScreenshotHeight(page);
  await expect(page).toHaveScreenshot("movie-library.png", { fullPage: true });
});

test("large media grids virtualize rows and prioritize only the first image", async ({
  page,
}) => {
  await mockPageApi(page, true);
  await page.route("**/api/v1/media/items**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path !== "/api/v1/media/items") {
      await route.fallback();
      return;
    }
    const items = Array.from({ length: 100 }, (_, index) => ({
      ...mediaItem,
      isFavorite: false,
      itemId: `virtual-movie-${index + 1}`,
      primaryImageTag: "virtual-poster",
      title: `Virtual Movie ${index + 1}`,
    }));
    await route.fulfill({
      json: {
        items,
        limit: 100,
        requestId: "request-virtual-items",
        startIndex: 0,
        total: items.length,
      },
    });
  });

  await page.goto("/movies?page=1");
  const grid = page.getByLabel("电影列表");
  await expect(grid.locator(".home-media-card").first()).toBeVisible();
  await expect
    .poll(async () => Number(await grid.getAttribute("data-virtual-row-count")))
    .toBeLessThan(100);
  expect(await grid.locator(".home-media-card").count()).toBeLessThan(100);
  expect(await grid.locator(".media-browser-grid-row").count()).toBeLessThan(8);

  const firstImage = grid.locator("img").first();
  await expect(firstImage).toHaveAttribute("loading", "eager");
  await expect(firstImage).toHaveAttribute("fetchpriority", "high");
  expect(await grid.locator('img[loading="lazy"]').count()).toBeGreaterThan(0);

  await page.mouse.wheel(0, 100_000);
  await expect(
    page.getByRole("link", { name: /Virtual Movie 100/ }),
  ).toBeVisible();
  expect(await grid.locator(".home-media-card").count()).toBeLessThan(100);
});

test("media filters use canonical shareable URL state", async ({ page }) => {
  await mockPageApi(page, true);
  await page.goto("/movies?page=2");
  await page.getByLabel("类型标签").fill("科幻, 剧情");
  await page
    .getByRole("textbox", { exact: true, name: "年份" })
    .fill("2026, 2024");
  await page.getByLabel("最低评分").fill("8");
  await chooseSelectOption(page, "观看状态", "未看");
  await chooseSelectOption(page, "收藏状态", "仅收藏");
  await chooseSelectOption(page, "排序", "社区评分");
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

test("theme menu persists light and follows the system preference", async ({
  page,
}) => {
  await mockPageApi(page, true);
  await page.goto("/home");

  const themeButton = page.getByRole("button", { name: /^主题：/ });
  await expect(themeButton).toHaveAccessibleName("主题：跟随系统");
  await themeButton.click();
  await page.getByRole("menuitemradio", { name: "亮色" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-mode",
    "light",
  );
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("application-shell-light.png", {
    fullPage: true,
  });

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(themeButton).toHaveAccessibleName("主题：亮色");
  await themeButton.click();
  await page.getByRole("menuitemradio", { name: "跟随系统" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-mode",
    "system",
  );
});

test("light theme covers authentication, library controls, and details", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("lumarelay.theme", "light");
  });
  await mockPageApi(page, true);

  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "登录媒体服务器" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("login-page-light.png", {
    fullPage: true,
  });

  await page.goto("/movies?page=1");
  await expect(page.getByRole("heading", { name: "全部电影" })).toBeVisible();
  await expect(page.getByLabel("观看状态")).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await stabilizeLibraryScreenshotHeight(page);
  await expect(page).toHaveScreenshot("movie-library-light.png", {
    fullPage: true,
  });

  await page.goto("/item/movie-1");
  await expect(
    page.getByRole("heading", { exact: true, name: "星海归途" }),
  ).toBeVisible();
  await waitForImages(page);
  await expectNoAccessibilityViolations(page);
  await settleVisualState(page);
  await expect(page).toHaveScreenshot("movie-detail-light.png", {
    fullPage: true,
  });
});

test("browser back restores media URL and scroll position", async ({
  page,
}) => {
  await mockPageApi(page, true);
  await page.goto(
    "/movies?genre=Drama&genre=Sci-Fi&page=2&sortBy=dateAdded&sortOrder=descending",
  );
  await expect(page.locator(".home-media-card").first()).toBeVisible();

  await page.mouse.wheel(0, 10_000);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(200);
  await page.waitForTimeout(150);
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
  await stabilizeLibraryScreenshotHeight(page);
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
  const libraryCard = page.getByRole("link", { name: /我的电影/ });
  await expect(libraryCard).toBeVisible();
  const restingBackground = await libraryCard.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await libraryCard.hover();
  await expect
    .poll(() =>
      libraryCard.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    )
    .toBe(restingBackground);
  await page.mouse.move(0, 0);
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
  await stabilizeLibraryScreenshotHeight(page);
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
  await (await openMovieAction(page, "取消收藏")).click();
  await expect(await openMovieAction(page, "收藏")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.reload();
  await expect(await openMovieAction(page, "收藏")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "我的收藏" })).toHaveCount(0);

  await page.goto("/item/movie-1");
  await (await openMovieAction(page, "收藏")).click();
  await expect(await openMovieAction(page, "取消收藏")).toBeVisible();
});

test("played state updates optimistically, survives refresh, and is restored", async ({
  page,
}) => {
  await mockPageApi(page, true);
  await page.goto("/item/movie-1");
  await (await openMovieAction(page, "标记已看")).click();
  await expect(await openMovieAction(page, "标记未看")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.reload();
  await expect(await openMovieAction(page, "标记未看")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/home");
  await expect(page.getByLabel("已看").first()).toBeVisible();

  await page.goto("/item/movie-1");
  await (await openMovieAction(page, "标记未看")).click();
  await expect(await openMovieAction(page, "标记已看")).toBeVisible();
});

test("failed played update rolls back and remains actionable", async ({
  page,
}) => {
  await mockPageApi(page, true, "normal", true);
  await page.goto("/item/movie-1");
  await (await openMovieAction(page, "标记已看")).click();

  await expect(page.getByRole("alert")).toContainText(
    "观看状态更新失败，已恢复原状态，请重试",
  );
  await expect(await openMovieAction(page, "标记已看")).toBeEnabled();
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
