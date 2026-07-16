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
  });
});
