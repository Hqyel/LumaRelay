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

async function mockPageApi(page: Page, selected: boolean) {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;

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

    await route.abort();
  });
}

async function expectNoAccessibilityViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
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
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "首页" })).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "跳到主要内容" })).toBeFocused();
  await expect(
    page.getByRole("button", { name: "全局搜索（尚未开放）" }),
  ).toBeDisabled();
  await page
    .getByRole("link", { name: "跳到主要内容" })
    .evaluate((element: HTMLElement) => element.blur());
  await page.waitForTimeout(250);
  await expectNoAccessibilityViolations(page);
  await expect(page).toHaveScreenshot("application-shell.png", {
    fullPage: true,
  });
});
