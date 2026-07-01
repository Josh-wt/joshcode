// FILE: threadTabBarStore.ts
// Purpose: Persists thread tab bar UI state (collapsed project groups, last active project).
// Layer: UI state store

import type { ProjectId } from "@t3tools/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  expandProjectGroup,
  createDefaultThreadTabBarState,
  normalizeCollapsedProjectIds,
  setLastActiveProjectId,
  toggleProjectGroupCollapsed,
  type ThreadTabBarPersistedState,
} from "./threadTabBarStore.logic";

interface ThreadTabBarStoreState extends ThreadTabBarPersistedState {
  toggleProjectCollapsed: (projectId: ProjectId) => void;
  expandProject: (projectId: ProjectId) => void;
  setLastActiveProjectId: (projectId: ProjectId | null) => void;
  hydrateCollapsedFromProjects: (input: {
    projectIds: readonly ProjectId[];
    expandedProjectIds: readonly ProjectId[];
  }) => void;
}

const THREAD_TAB_BAR_STORAGE_KEY = "synara:thread-tab-bar:v1";
let migrationApplied = false;

export const useThreadTabBarStore = create<ThreadTabBarStoreState>()(
  persist(
    (set, get) => ({
      ...createDefaultThreadTabBarState(),
      toggleProjectCollapsed: (projectId) => {
        set((state) => toggleProjectGroupCollapsed(state, projectId));
      },
      expandProject: (projectId) => {
        set((state) => expandProjectGroup(state, projectId));
      },
      setLastActiveProjectId: (projectId) => {
        set((state) => setLastActiveProjectId(state, projectId));
      },
      hydrateCollapsedFromProjects: ({ projectIds, expandedProjectIds }) => {
        if (migrationApplied || get().collapsedProjectIds.length > 0) {
          return;
        }
        migrationApplied = true;
        const expandedSet = new Set(expandedProjectIds);
        const collapsedProjectIds = projectIds.filter((projectId) => !expandedSet.has(projectId));
        if (collapsedProjectIds.length === 0) {
          return;
        }
        set({ collapsedProjectIds });
      },
    }),
    {
      name: THREAD_TAB_BAR_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        collapsedProjectIds: state.collapsedProjectIds,
        lastActiveProjectId: state.lastActiveProjectId,
      }),
      merge: (persistedState, currentState) => {
        const candidate = persistedState as Partial<ThreadTabBarPersistedState> | undefined;
        return {
          ...currentState,
          collapsedProjectIds: Array.isArray(candidate?.collapsedProjectIds)
            ? candidate.collapsedProjectIds.filter(
                (id): id is ProjectId => typeof id === "string" && id.length > 0,
              )
            : currentState.collapsedProjectIds,
          lastActiveProjectId:
            typeof candidate?.lastActiveProjectId === "string" &&
            candidate.lastActiveProjectId.length > 0
              ? candidate.lastActiveProjectId
              : currentState.lastActiveProjectId,
        };
      },
    },
  ),
);

export function pruneThreadTabBarCollapsedProjects(projectIds: readonly ProjectId[]): void {
  const known = new Set(projectIds);
  useThreadTabBarStore.setState((state) => {
    const collapsedProjectIds = normalizeCollapsedProjectIds(state.collapsedProjectIds, known);
    const lastActiveProjectId =
      state.lastActiveProjectId && known.has(state.lastActiveProjectId)
        ? state.lastActiveProjectId
        : null;
    if (
      collapsedProjectIds.length === state.collapsedProjectIds.length &&
      collapsedProjectIds.every((id, index) => id === state.collapsedProjectIds[index]) &&
      lastActiveProjectId === state.lastActiveProjectId
    ) {
      return state;
    }
    return {
      collapsedProjectIds,
      lastActiveProjectId,
    };
  });
}
