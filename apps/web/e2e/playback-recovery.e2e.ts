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
    canManageServer: false,
    isAdministrator: false,
  },
  serverId: "server-1",
  userId: "user-1",
};

const item = {
  genres: [],
  isFavorite: false,
  isPlayed: false,
  itemId: "movie-1",
  kind: "movie",
  playbackPositionSeconds: 0,
  productionYear: 2026,
  runtimeSeconds: 600,
  serverId: "server-1",
  title: "星海归途",
};

type PlaybackScenario =
  | "playing"
  | "paused"
  | "seeked"
  | "ended"
  | "stale"
  | "ambiguous"
  | "timedOut";

interface RecoveryState {
  bridgeOnline: boolean;
  scenario: PlaybackScenario;
  smtcReady: boolean;
}

function localBridgeStatus(smtcReady: boolean) {
  return {
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
      capability: smtcReady ? "ready" : "unavailable",
      isMonitoring: smtcReady,
      potPlayerSessionCount: smtcReady ? 1 : 0,
      potPlayerSessionState: smtcReady ? "detected" : "notObserved",
      sessionCount: smtcReady ? 1 : 0,
    },
    status: "ready",
  };
}

function playbackSession(scenario: PlaybackScenario) {
  const unavailable = scenario === "ambiguous" || scenario === "timedOut";
  return {
    durationTicks: 6_000_000_000,
    itemId: "movie-1",
    playSessionId: "22222222-2222-4222-8222-222222222222",
    positionTicks:
      scenario === "seeked"
        ? 3_000_000_000
        : scenario === "ended"
          ? 5_900_000_000
          : 900_000_000,
    state: unavailable
      ? "unavailable"
      : scenario === "paused"
        ? "paused"
        : scenario === "ended"
          ? "ended"
          : "playing",
    syncState: unavailable
      ? "unavailable"
      : scenario === "stale"
        ? "stale"
        : "synchronized",
    updatedAt: "2026-07-22T12:00:00.000Z",
    warning:
      scenario === "stale"
        ? "SMTC_STALE"
        : scenario === "ambiguous"
          ? "SMTC_AMBIGUOUS"
          : scenario === "timedOut"
            ? "SMTC_MATCH_TIMEOUT"
            : null,
  };
}

async function mockRecoveryEnvironment(page: Page, state: RecoveryState) {
  const cors = { "access-control-allow-origin": "http://127.0.0.1:4173" };
  await page.route("http://127.0.0.1:58080/v1/status**", async (route) => {
    if (!state.bridgeOnline) {
      await route.abort("connectionrefused");
      return;
    }
    await route.fulfill({
      headers: cors,
      json: localBridgeStatus(state.smtcReady),
    });
  });
  await page.route(
    "http://127.0.0.1:58080/v1/playback/status",
    async (route) => {
      if (!state.bridgeOnline) {
        await route.abort("connectionrefused");
        return;
      }
      await route.fulfill({
        headers: cors,
        json: {
          sessions: state.smtcReady ? [playbackSession(state.scenario)] : [],
        },
      });
    },
  );
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/servers/current") {
      await route.fulfill({
        json: {
          configuredBaseUrl: server.baseUrl,
          requestId: "request-current",
          server,
        },
      });
      return;
    }
    if (path === "/api/v1/auth/me") {
      await route.fulfill({ json: { requestId: "request-me", server, user } });
      return;
    }
    if (path === "/api/v1/media/home") {
      await route.fulfill({
        json: {
          favoriteItems: [],
          genreRows: [],
          hero: null,
          latestMovies: [],
          latestSeries: [],
          requestId: "request-home",
          resumeItems: [],
        },
      });
      return;
    }
    if (path === "/api/v1/media/items/movie-1/playback-options") {
      await route.fulfill({
        json: {
          itemId: "movie-1",
          requestId: "request-options",
          sources: [
            {
              audioTracks: [],
              defaultAudioStreamIndex: null,
              defaultSubtitleStreamIndex: null,
              mediaSourceId: "source-1",
              name: "默认版本",
              runtimeTicks: 6_000_000_000,
              subtitleTracks: [],
              supportsDirectStream: true,
            },
          ],
        },
      });
      return;
    }
    if (path === "/api/v1/media/items/movie-1") {
      await route.fulfill({
        json: {
          item,
          people: [],
          relatedItems: [],
          requestId: "request-item",
        },
      });
      return;
    }
    await route.abort();
  });
}

test("playback panel recovers across lifecycle and failure states", async ({
  page,
}) => {
  const state: RecoveryState = {
    bridgeOnline: true,
    scenario: "playing",
    smtcReady: true,
  };
  await mockRecoveryEnvironment(page, state);
  await page.goto("/home");
  const panel = page.getByRole("complementary", { name: "当前本地播放" });

  await expect(panel.getByText("正在播放")).toBeVisible();
  state.scenario = "paused";
  await expect(panel.getByText("已暂停")).toBeVisible({ timeout: 3_000 });
  state.scenario = "seeked";
  await expect(panel.getByText("5:00 / 10:00")).toBeVisible({ timeout: 3_000 });
  state.scenario = "ended";
  await expect(panel.getByText("播放完成")).toBeVisible({ timeout: 3_000 });
  state.scenario = "stale";
  await expect(panel.getByText("播放器时间线已停止更新")).toBeVisible({
    timeout: 3_000,
  });
  state.scenario = "ambiguous";
  await expect(panel.getByText("检测到多个匹配会话，未猜测绑定")).toBeVisible({
    timeout: 3_000,
  });
  state.scenario = "timedOut";
  await expect(panel.getByText("未能匹配 PotPlayer 媒体会话")).toBeVisible({
    timeout: 3_000,
  });
  state.bridgeOnline = false;
  await expect(panel.getByText("Bridge 连接已中断")).toBeVisible({
    timeout: 3_000,
  });
  await expect(
    panel.getByText("无法读取本机播放状态，请确认 Bridge 仍在运行"),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("SMTC unavailable requires explicit degraded playback", async ({
  page,
}) => {
  const state: RecoveryState = {
    bridgeOnline: true,
    scenario: "playing",
    smtcReady: false,
  };
  await mockRecoveryEnvironment(page, state);
  await page.goto("/item/movie-1");
  await page.getByRole("button", { exact: true, name: "播放" }).click();

  await expect(page.getByText("SMTC 同步不可用")).toBeVisible();
  const start = page.getByRole("button", { name: "使用 PotPlayer 播放" });
  await expect(start).toBeDisabled();
  await page.getByRole("checkbox", { name: /仅启动，不同步进度/ }).check();
  await expect(start).toBeEnabled();
});
