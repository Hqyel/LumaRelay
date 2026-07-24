export const themeModes = ["dark", "light", "system"] as const;

export type ThemeMode = (typeof themeModes)[number];

const storageKey = "lumarelay.theme";
const systemThemeQuery = "(prefers-color-scheme: light)";
let removeSystemListener: (() => void) | undefined;

function isThemeMode(value: string | null): value is ThemeMode {
  return themeModes.some((mode) => mode === value);
}

export function readThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system";

  try {
    const stored = window.localStorage.getItem(storageKey);
    return isThemeMode(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function systemUsesLightTheme() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(systemThemeQuery).matches
  );
}

export function resolveTheme(mode: ThemeMode): Exclude<ThemeMode, "system"> {
  if (mode !== "system") return mode;
  return systemUsesLightTheme() ? "light" : "dark";
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;

  const resolved = resolveTheme(mode);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themeMode = mode;
  root.classList.toggle("light-mode", resolved === "light");

  const themeColor = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  themeColor?.setAttribute(
    "content",
    resolved === "light" ? "#f8fafc" : "#0f0f23",
  );
}

function watchSystemTheme(mode: ThemeMode) {
  removeSystemListener?.();
  removeSystemListener = undefined;
  if (
    mode !== "system" ||
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  )
    return;

  const query = window.matchMedia(systemThemeQuery);
  const handleChange = () => applyTheme("system");
  query.addEventListener("change", handleChange);
  removeSystemListener = () =>
    query.removeEventListener("change", handleChange);
}

export function setThemeMode(mode: ThemeMode) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(storageKey, mode);
    } catch {
      // Theme selection remains active when storage is unavailable.
    }
  }

  applyTheme(mode);
  watchSystemTheme(mode);
}

export function initializeTheme() {
  const mode = readThemeMode();
  applyTheme(mode);
  watchSystemTheme(mode);
  return mode;
}
