// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyTheme,
  initializeTheme,
  readThemeMode,
  resolveTheme,
  setThemeMode,
} from "./theme.js";

function installMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    addEventListener: vi.fn((_event: string, listener: () => void) => {
      listeners.add(listener);
    }),
    dispatch() {
      listeners.forEach((listener) => listener());
    },
    matches,
    media: "(prefers-color-scheme: light)",
    onchange: null,
    removeEventListener: vi.fn((_event: string, listener: () => void) => {
      listeners.delete(listener);
    }),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media),
  );
  return media;
}

describe("theme selection", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-mode");
    document.documentElement.classList.remove("light-mode");
    document.head.innerHTML = '<meta name="theme-color" content="#0f0f23">';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to the system theme and responds to system changes", () => {
    const media = installMatchMedia(true);
    expect(initializeTheme()).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.themeMode).toBe("system");

    media.matches = false;
    media.dispatch();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("persists an explicit theme and updates browser chrome", () => {
    installMatchMedia(false);
    setThemeMode("light");

    expect(readThemeMode()).toBe("light");
    expect(resolveTheme("light")).toBe("light");
    expect(document.documentElement.classList).toContain("light-mode");
    expect(
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute("content"),
    ).toBe("#f8fafc");

    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
