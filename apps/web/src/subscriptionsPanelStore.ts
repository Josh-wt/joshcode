// FILE: subscriptionsPanelStore.ts
// Purpose: Persists floating subscriptions panel open state and drag position.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  type FloatingPanelPosition,
  resolveDefaultSubscriptionsPanelPosition,
} from "./lib/draggableFloatingPanel";

const SUBSCRIPTIONS_PANEL_STORAGE_KEY = "synara:subscriptions-panel:v1";

interface SubscriptionsPanelStore {
  open: boolean;
  position: FloatingPanelPosition | null;
  sidebarExpanded: boolean;
  openPanel: () => void;
  dockPanel: () => void;
  closePanel: () => void;
  setPosition: (position: FloatingPanelPosition) => void;
  setSidebarExpanded: (expanded: boolean) => void;
}

export const useSubscriptionsPanelStore = create<SubscriptionsPanelStore>()(
  persist(
    (set, get) => ({
      open: false,
      position: null,
      sidebarExpanded: false,
      openPanel: () =>
        set({
          open: true,
          sidebarExpanded: false,
          position: get().position ?? resolveDefaultSubscriptionsPanelPosition(),
        }),
      dockPanel: () =>
        set({
          open: false,
          sidebarExpanded: true,
        }),
      closePanel: () => set({ open: false }),
      setPosition: (position) => set({ position }),
      setSidebarExpanded: (sidebarExpanded) => set({ sidebarExpanded }),
    }),
    {
      name: SUBSCRIPTIONS_PANEL_STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        open: state.open,
        position: state.position,
        sidebarExpanded: state.sidebarExpanded,
      }),
      migrate: (persistedState) => {
        const state = persistedState as Partial<SubscriptionsPanelStore> | undefined;
        return {
          open: state?.open ?? false,
          position: state?.position ?? null,
          sidebarExpanded: state?.sidebarExpanded ?? false,
        };
      },
    },
  ),
);
