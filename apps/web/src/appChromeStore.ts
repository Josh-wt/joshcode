// FILE: appChromeStore.ts
// Purpose: Shared app chrome UI state (search palette, add-project dialog, palette filters).
// Layer: UI state store

import type { ProjectId } from "@t3tools/contracts";
import { create } from "zustand";

export type AppSearchPaletteMode = "search" | "import";

interface AppChromeStoreState {
  searchPaletteOpen: boolean;
  searchPaletteMode: AppSearchPaletteMode;
  searchPaletteInitialQuery: string | null;
  searchPaletteProjectFilterId: ProjectId | null;
  addProjectDialogOpen: boolean;
  openSearchPalette: (input?: {
    mode?: AppSearchPaletteMode;
    initialQuery?: string | null;
    projectFilterId?: ProjectId | null;
  }) => void;
  toggleSearchPalette: (mode?: AppSearchPaletteMode) => void;
  setSearchPaletteOpen: (open: boolean) => void;
  setSearchPaletteMode: (mode: AppSearchPaletteMode) => void;
  setSearchPaletteInitialQuery: (query: string | null) => void;
  setSearchPaletteProjectFilterId: (projectId: ProjectId | null) => void;
  openAddProjectDialog: () => void;
  closeAddProjectDialog: () => void;
}

export const useAppChromeStore = create<AppChromeStoreState>()((set, get) => ({
  searchPaletteOpen: false,
  searchPaletteMode: "search",
  searchPaletteInitialQuery: null,
  searchPaletteProjectFilterId: null,
  addProjectDialogOpen: false,
  openSearchPalette: (input) => {
    set({
      searchPaletteOpen: true,
      searchPaletteMode: input?.mode ?? "search",
      searchPaletteInitialQuery: input?.initialQuery ?? null,
      searchPaletteProjectFilterId: input?.projectFilterId ?? null,
    });
  },
  toggleSearchPalette: (mode = "search") => {
    const state = get();
    if (state.searchPaletteOpen && state.searchPaletteMode === mode) {
      set({ searchPaletteOpen: false, searchPaletteProjectFilterId: null });
      return;
    }
    set({
      searchPaletteOpen: true,
      searchPaletteMode: mode,
      searchPaletteInitialQuery: null,
      searchPaletteProjectFilterId: null,
    });
  },
  setSearchPaletteOpen: (open) =>
    set({
      searchPaletteOpen: open,
      ...(open ? {} : { searchPaletteProjectFilterId: null }),
    }),
  setSearchPaletteMode: (mode) => set({ searchPaletteMode: mode }),
  setSearchPaletteInitialQuery: (query) => set({ searchPaletteInitialQuery: query }),
  setSearchPaletteProjectFilterId: (projectId) => set({ searchPaletteProjectFilterId: projectId }),
  openAddProjectDialog: () => set({ addProjectDialogOpen: true }),
  closeAddProjectDialog: () => set({ addProjectDialogOpen: false }),
}));
