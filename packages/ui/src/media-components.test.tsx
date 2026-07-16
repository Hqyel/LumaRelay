// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ContinueWatchingCard,
  ImageFallback,
  MediaRow,
  PosterCard,
} from "./index.js";

describe("media foundation components", () => {
  it("shows an accessible title fallback when an image fails", () => {
    render(<ImageFallback alt="星际归途" src="/missing.jpg" />);
    fireEvent.error(screen.getByAltText("星际归途"));

    expect(
      screen.getByRole("img", { name: "星际归途 图片不可用" }),
    ).toBeTruthy();
    expect(screen.getByText("星")).toBeTruthy();
  });

  it("renders poster progress, favorite and unwatched states", () => {
    render(
      <PosterCard
        favorite
        progress={42}
        subtitle="2025 · 科幻"
        title="星际归途"
        unwatchedCount={2}
      />,
    );

    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "42",
    );
    expect(screen.getByLabelText("已收藏")).toBeTruthy();
    expect(screen.getByText("2 集未看")).toBeTruthy();
  });

  it("provides a named continue action", () => {
    render(
      <ContinueWatchingCard
        progress={58}
        remaining="52 分钟"
        title="星际遗迹"
      />,
    );

    expect(
      screen.getByRole("button", { name: "继续播放 星际遗迹" }),
    ).toBeTruthy();
  });

  it("renders compact media row metadata", () => {
    render(
      <MediaRow metadata="第 2 集 · 45 分钟" progress={60} title="无人码头" />,
    );

    expect(screen.getByText("无人码头")).toBeTruthy();
    expect(screen.getByText("第 2 集 · 45 分钟")).toBeTruthy();
  });
});
