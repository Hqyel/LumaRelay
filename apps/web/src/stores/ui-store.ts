import { create } from "zustand";

import {
  initializeTheme,
  setThemeMode as persistThemeMode,
  type ThemeMode,
} from "../theme.js";

interface UiState {
  navigationExpanded: boolean;
  themeMode: ThemeMode;
  setNavigationExpanded: (expanded: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
}

export const useUiStore = create<UiState>((set) => ({
  navigationExpanded: false,
  themeMode: initializeTheme(),
  setNavigationExpanded: (navigationExpanded) => set({ navigationExpanded }),
  setThemeMode: (themeMode) => {
    persistThemeMode(themeMode);
    set({ themeMode });
  },
}));
