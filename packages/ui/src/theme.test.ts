import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const theme = readFileSync(new URL("./theme.css", import.meta.url), "utf8");
const mark = readFileSync(
  new URL("./assets/newemby-mark.svg", import.meta.url),
  "utf8",
);

describe("NewEmby design foundation", () => {
  it.each([
    "--color-bg: #0f0f23",
    "--color-accent: #7c5cff",
    "--color-on-accent: #ffffff",
    "--radius-panel: 1rem",
    "--breakpoint-sm: 40rem",
    "--breakpoint-lg: 64rem",
    "--breakpoint-2xl: 100rem",
    "prefers-reduced-motion",
  ])("contains the required token: %s", (token) => {
    expect(theme).toContain(token);
  });

  it("uses a repository-owned vector mark", () => {
    expect(mark).toContain("<svg");
    expect(mark).not.toMatch(/<image\b|data:image|(?:href|src)="https?:\/\//);
  });
});
