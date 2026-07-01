// FILE: threadTabBarStore.logic.ts
// Purpose: Pure transitions for thread tab bar UI state (group collapse, active project).
// Layer: UI state helpers

import type { ProjectId } from "@t3tools/contracts";

export interface ThreadTabBarPersistedState {
  collapsedProjectIds: ProjectId[];
  lastActiveProjectId: ProjectId | null;
}

export function createDefaultThreadTabBarState(): ThreadTabBarPersistedState {
  return {
    collapsedProjectIds: [],
    lastActiveProjectId: null,
  };
}

export function isProjectGroupCollapsed(
  collapsedProjectIds: readonly ProjectId[],
  projectId: ProjectId,
): boolean {
  return collapsedProjectIds.includes(projectId);
}

export function toggleProjectGroupCollapsed(
  state: ThreadTabBarPersistedState,
  projectId: ProjectId,
): ThreadTabBarPersistedState {
  const collapsed = isProjectGroupCollapsed(state.collapsedProjectIds, projectId);
  if (collapsed) {
    return {
      ...state,
      collapsedProjectIds: state.collapsedProjectIds.filter((id) => id !== projectId),
    };
  }
  return {
    ...state,
    collapsedProjectIds: [...state.collapsedProjectIds, projectId],
  };
}

export function expandProjectGroup(
  state: ThreadTabBarPersistedState,
  projectId: ProjectId,
): ThreadTabBarPersistedState {
  if (!isProjectGroupCollapsed(state.collapsedProjectIds, projectId)) {
    return state;
  }
  return {
    ...state,
    collapsedProjectIds: state.collapsedProjectIds.filter((id) => id !== projectId),
  };
}

export function setLastActiveProjectId(
  state: ThreadTabBarPersistedState,
  projectId: ProjectId | null,
): ThreadTabBarPersistedState {
  if (state.lastActiveProjectId === projectId) {
    return state;
  }
  return {
    ...state,
    lastActiveProjectId: projectId,
  };
}

export function normalizeCollapsedProjectIds(
  value: unknown,
  knownProjectIds: ReadonlySet<ProjectId>,
): ProjectId[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<ProjectId>();
  const normalized: ProjectId[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || entry.length === 0) {
      continue;
    }
    const projectId = entry as ProjectId;
    if (!knownProjectIds.has(projectId)) {
      continue;
    }
    if (seen.has(projectId)) {
      continue;
    }
    seen.add(projectId);
    normalized.push(projectId);
  }
  return normalized;
}
