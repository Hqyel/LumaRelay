import { create } from "zustand";

interface UiState {
  navigationExpanded: boolean;
  setNavigationExpanded: (expanded: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  navigationExpanded: false,
  setNavigationExpanded: (navigationExpanded) => set({ navigationExpanded }),
}));
