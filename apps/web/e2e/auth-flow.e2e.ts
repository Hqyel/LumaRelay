import { expect, test } from "@playwright/test";

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

const movie = {
  genres: ["Drama"],
  isFavorite: false,
  isPlayed: false,
  itemId: "movie-1",
  kind: "movie",
  overview: "A complete E2E journey fixture.",
  playbackPositionSeconds: 0,
  serverId: "server-1",
  title: "Example Movie",
};

test("completes login, browse, filter, favorite restore, and logout", async ({
  page,
}) => {
  let authenticated = false;
  let favorite = false;
  let filterObserved = false;
  let selected = false;
  let sessionReads = 0;

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (path === "/api/v1/security/csrf" && method === "GET") {
      await route.fulfill({
        json: {
          csrfToken: "test-csrf-token-with-at-least-32-characters",
          requestId: "request-csrf",
        },
      });
      return;
    }
    if (path === "/api/v1/servers/current" && method === "GET") {
      await route.fulfill({
        json: {
          configuredBaseUrl: "https://emby.example.com/",
          requestId: "request-current",
          server: selected ? server : null,
        },
      });
      return;
    }
    if (path === "/api/v1/servers/select" && method === "POST") {
      expect(request.headers()["x-lumarelay-csrf"]).toBe(
        "test-csrf-token-with-at-least-32-characters",
      );
      selected = true;
      await route.fulfill({
        json: { requestId: "request-select", server },
      });
      return;
    }
    if (path === "/api/v1/auth/public-users" && method === "GET") {
      await route.fulfill({
        json: {
          requestId: "request-users",
          users: [{ hasPassword: true, name: "Alex", userId: "user-1" }],
        },
      });
      return;
    }
    if (path === "/api/v1/auth/login" && method === "POST") {
      expect(request.headers()["x-lumarelay-csrf"]).toBe(
        "test-csrf-token-with-at-least-32-characters",
      );
      authenticated = true;
      await route.fulfill({
        json: { requestId: "request-login", server, user },
      });
      return;
    }
    if (path === "/api/v1/auth/me" && method === "GET") {
      sessionReads++;
      if (authenticated) {
        await route.fulfill({
          json: { requestId: "request-me", server, user },
        });
      } else {
        await route.fulfill({
          json: {
            error: {
              code: "UNAUTHENTICATED",
              message: "Sign in to continue",
              requestId: "request-me",
            },
          },
          status: 401,
        });
      }
      return;
    }
    if (path === "/api/v1/auth/logout" && method === "POST") {
      expect(request.headers()["x-lumarelay-csrf"]).toBe(
        "test-csrf-token-with-at-least-32-characters",
      );
      authenticated = false;
      await route.fulfill({
        json: { requestId: "request-logout", success: true },
      });
      return;
    }
    if (path === "/api/v1/media/home" && method === "GET") {
      const currentMovie = { ...movie, isFavorite: favorite };
      await route.fulfill({
        json: {
          favoriteItems: favorite ? [currentMovie] : [],
          genreRows: [],
          hero: currentMovie,
          latestMovies: [currentMovie],
          latestSeries: [],
          requestId: "request-home",
          resumeItems: [],
        },
      });
      return;
    }
    if (path === "/api/v1/media/libraries" && method === "GET") {
      await route.fulfill({
        json: {
          libraries: [
            {
              itemCount: 1,
              kind: "movies",
              libraryId: "library-1",
              name: "Movies",
              serverId: "server-1",
            },
          ],
          requestId: "request-libraries",
        },
      });
      return;
    }
    if (path === "/api/v1/media/items" && method === "GET") {
      filterObserved = new URL(request.url()).searchParams
        .getAll("genre")
        .includes("Drama");
      await route.fulfill({
        json: {
          items: [{ ...movie, isFavorite: favorite }],
          limit: 40,
          requestId: "request-items",
          startIndex: 0,
          total: 1,
        },
      });
      return;
    }
    if (path === "/api/v1/media/items/movie-1" && method === "GET") {
      await route.fulfill({
        json: {
          item: { ...movie, isFavorite: favorite },
          people: [],
          relatedItems: [],
          requestId: "request-item",
        },
      });
      return;
    }
    if (path === "/api/v1/media/items/movie-1/favorite" && method === "PUT") {
      expect(request.headers()["x-lumarelay-csrf"]).toBe(
        "test-csrf-token-with-at-least-32-characters",
      );
      favorite = (request.postDataJSON() as { favorite: boolean }).favorite;
      await route.fulfill({
        json: {
          requestId: "request-favorite",
          state: {
            isFavorite: favorite,
            isPlayed: false,
            itemId: "movie-1",
            playbackPositionSeconds: 0,
            serverId: "server-1",
          },
        },
      });
      return;
    }

    await route.abort();
  });

  await page.goto("/connect");
  await page.getByLabel("Emby 服务器地址").fill(server.baseUrl);
  await page.getByRole("button", { name: "连接服务器" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole("button", { name: "Alex" }).click();
  await page.getByLabel("密码").fill("correct-password");
  await page.getByRole("button", { exact: true, name: "登录" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "首页" })).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("button", { name: "打开 Alex 的用户菜单" }),
  ).toBeVisible();
  expect(sessionReads).toBeGreaterThanOrEqual(2);

  await page.getByRole("link", { exact: true, name: "电影" }).click();
  await expect(page).toHaveURL(/\/movies/);
  await page.getByLabel("类型标签").fill("Drama");
  await page.getByRole("button", { name: "应用筛选" }).click();
  await expect(page).toHaveURL(/genre=Drama/);
  await expect.poll(() => filterObserved).toBe(true);

  await page
    .getByRole("link", { name: /Example Movie/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/item\/movie-1/);
  await page.getByRole("button", { name: "更多电影操作" }).click();
  await page.getByRole("menuitem", { name: "收藏", exact: true }).click();
  await page.getByRole("button", { name: "更多电影操作" }).click();
  await expect(
    page.getByRole("menuitem", { name: "取消收藏", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: "更多电影操作" }).click();
  await page.getByRole("menuitem", { name: "取消收藏", exact: true }).click();
  await page.getByRole("button", { name: "更多电影操作" }).click();
  await expect(
    page.getByRole("menuitem", { name: "收藏", exact: true }),
  ).toBeVisible();
  expect(favorite).toBe(false);

  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "我的收藏" })).toHaveCount(0);

  const menuTrigger = page.getByRole("button", {
    name: "打开 Alex 的用户菜单",
  });
  await menuTrigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "退出登录" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem", { name: "退出登录" })).toBeHidden();
  await expect(menuTrigger).toBeFocused();

  await menuTrigger.click();
  await page.mouse.click(400, 400);
  await expect(page.getByRole("menuitem", { name: "退出登录" })).toBeHidden();

  await menuTrigger.click();
  await page.getByRole("menuitem", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "登录媒体服务器" }),
  ).toBeVisible();
});

test("redirects a non-administrator away from the admin shell", async ({
  page,
}) => {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/auth/me") {
      await route.fulfill({
        json: {
          requestId: "request-me",
          server,
          user: {
            ...user,
            permissions: {
              ...user.permissions,
              canManageServer: false,
              isAdministrator: false,
            },
          },
        },
      });
      return;
    }

    await route.abort();
  });

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/home$/);
  await expect(
    page.getByRole("heading", { exact: true, name: "首页" }),
  ).toBeVisible();
});
