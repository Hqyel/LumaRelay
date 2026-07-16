import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdminShell } from "./admin-shell.js";

describe("AdminShell", () => {
  it("renders dense admin landmarks and breadcrumbs", () => {
    const html = renderToStaticMarkup(
      <AdminShell
        breadcrumbs={["管理后台", "概览"]}
        navigation={[
          {
            active: true,
            href: "/admin",
            icon: <span>A</span>,
            label: "概览",
          },
        ]}
        title="概览"
      >
        <p>服务器状态</p>
      </AdminShell>,
    );

    expect(html).toContain('aria-label="管理导航"');
    expect(html).toContain("管理后台 / 概览");
    expect(html).toContain('id="admin-main-content"');
    expect(html).toContain("max-w-[90rem]");
  });
});
