import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppShell } from "./app-shell.js";

describe("AppShell", () => {
  it("exposes navigation, context header and skip link landmarks", () => {
    const html = renderToStaticMarkup(
      <AppShell
        title="首页"
        navigation={[
          {
            active: true,
            href: "/",
            icon: <span>H</span>,
            label: "首页",
          },
          {
            disabled: true,
            href: "/search",
            icon: <span>S</span>,
            label: "搜索",
          },
        ]}
      >
        <p>内容</p>
      </AppShell>,
    );

    expect(html).toContain('aria-label="主导航"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('href="#main-content"');
    expect(html).toContain('id="main-content"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('href="/search"');
    expect(html).not.toContain("0_0_20px");
    expect(html).not.toContain("0_2px_8px");
  });

  it("lets immersive detail pages render artwork beneath the header", () => {
    const html = renderToStaticMarkup(
      <AppShell
        immersiveHeader
        immersiveHeaderScrolled
        navigation={[]}
        title="详情"
      >
        <p>沉浸详情</p>
      </AppShell>,
    );

    expect(html).toContain('data-immersive="true"');
    expect(html).toContain('data-scrolled="true"');
    expect(html).toContain('class="min-h-screen"');
    expect(html).not.toContain('class="min-h-screen pt-12"');
  });
});
