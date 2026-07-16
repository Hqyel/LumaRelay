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

test("connects, signs in, restores the session, and signs out", async ({
  page,
}) => {
  let authenticated = false;
  let selected = false;
  let sessionReads = 0;

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

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
      authenticated = false;
      await route.fulfill({
        json: { requestId: "request-logout", success: true },
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
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "首页" })).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("button", { name: "打开 Alex 的用户菜单" }),
  ).toBeVisible();
  expect(sessionReads).toBeGreaterThanOrEqual(2);

  await page.getByRole("button", { name: "打开 Alex 的用户菜单" }).click();
  await page.getByRole("menuitem", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "登录媒体服务器" }),
  ).toBeVisible();
});
