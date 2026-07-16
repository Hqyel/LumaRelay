// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  Button,
  ConfirmDangerDialog,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
} from "./index.js";

describe("base UI components", () => {
  it("labels inputs and exposes validation errors", () => {
    render(<Input error="服务器地址无效" label="服务器地址" name="server" />);

    expect(
      screen.getByLabelText("服务器地址").getAttribute("aria-invalid"),
    ).toBe("true");
    expect(screen.getByText("服务器地址无效")).toBeTruthy();
  });

  it("renders empty and error states with distinct semantics", () => {
    const { rerender } = render(
      <EmptyState description="没有媒体" title="媒体库为空" />,
    );
    expect(screen.getByText("媒体库为空")).toBeTruthy();

    rerender(<ErrorState description="请重试" title="连接失败" />);
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("keeps skeletons out of the accessibility tree", () => {
    const { container } = render(<Skeleton className="h-10" />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("renders an accessible danger confirmation dialog", () => {
    render(
      <ConfirmDangerDialog
        description="将删除媒体库"
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open
        title="删除媒体库？"
      />,
    );

    expect(screen.getByRole("dialog", { name: "删除媒体库？" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "确认" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭弹层" })).toBeTruthy();
  });

  it("uses a native button with a safe default type", () => {
    render(<Button>保存</Button>);
    expect(
      screen.getByRole("button", { name: "保存" }).getAttribute("type"),
    ).toBe("button");
  });
});
