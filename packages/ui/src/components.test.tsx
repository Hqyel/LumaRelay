// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  Button,
  ConfirmDangerDialog,
  EmptyState,
  ErrorState,
  Input,
  Select,
  SelectTrigger,
  Skeleton,
} from "./index.js";

describe("base UI components", () => {
  it("labels inputs and exposes associated validation messages", () => {
    render(
      <Input error="服务器地址无效" hint="请输入完整地址" label="服务器地址" />,
    );

    const input = screen.getByLabelText("服务器地址");
    expect(input.id).not.toBe("");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toHaveLength(2);
    expect(screen.getByText("请输入完整地址")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("服务器地址无效");
  });

  it("renders empty and error states with distinct semantics", () => {
    const { container, rerender } = render(
      <EmptyState description="没有媒体" title="媒体库为空" />,
    );
    expect(screen.getByText("媒体库为空")).toBeTruthy();

    rerender(<ErrorState description="请重试" title="连接失败" />);
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
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

  it("keeps long select values on one horizontally scrollable line", () => {
    render(
      <Select defaultValue="long">
        <SelectTrigger aria-label="版本">
          <span>很长的媒体版本名称</span>
        </SelectTrigger>
      </Select>,
    );

    expect(screen.getByLabelText("版本").className).toContain(
      "lumarelay-select-trigger",
    );
    expect(
      screen
        .getByLabelText("版本")
        .querySelector(".lumarelay-select-value-scroll"),
    ).not.toBeNull();
  });
});
