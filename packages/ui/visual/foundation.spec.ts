import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function openFoundationGallery(page: Page) {
  await page.goto(
    "/iframe.html?id=foundation-gallery--all-states&viewMode=story",
  );
  await page.waitForLoadState("networkidle");
}

test("foundation gallery passes accessibility checks", async ({ page }) => {
  await openFoundationGallery(page);

  const accessibility = await new AxeBuilder({ page })
    .include("#storybook-root")
    .analyze();

  expect(accessibility.violations).toEqual([]);

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Continue" })).toBeFocused();
});

test("foundation gallery matches the visual baseline", async ({ page }) => {
  await openFoundationGallery(page);

  await expect(page.locator("#storybook-root")).toHaveScreenshot(
    "foundation-gallery.png",
  );
});
