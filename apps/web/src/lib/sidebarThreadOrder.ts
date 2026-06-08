// FILE: sidebarThreadOrder.ts
// Purpose: Persist and apply manual sidebar thread ordering per project folder.

import type { ThreadId } from "@t3tools/contracts";
import { normalizeWorkspaceRootForComparison } from "@t3tools/shared/threadWorkspace";

const PERSISTED_STATE_KEY = "synara:app-ui-state:v1";

type PersistedSidebarUiState = {
  threadOrderIdsByProjectCwd?: Record<string, ThreadId[]>;
};

const persistedThreadOrderIdsByProjectCwd = new Map<string, ThreadId[]>();

function projectCwdKey(cwd: string): string {
  return normalizeWorkspaceRootForComparison(cwd);
}

export function hydrateSidebarThreadOrderFromStorage(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const raw = window.localStorage.getItem(PERSISTED_STATE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as PersistedSidebarUiState;
    persistedThreadOrderIdsByProjectCwd.clear();
    for (const [cwd, threadIds] of Object.entries(parsed.threadOrderIdsByProjectCwd ?? {})) {
      if (!Array.isArray(threadIds)) {
        continue;
      }
      const normalizedIds = threadIds.filter(
        (threadId): threadId is ThreadId => typeof threadId === "string" && threadId.length > 0,
      );
      if (normalizedIds.length > 0) {
        persistedThreadOrderIdsByProjectCwd.set(cwd, normalizedIds);
      }
    }
  } catch {
    // Ignore malformed persisted state.
  }
}

export function readPersistedThreadOrderIdsForProject(projectCwd: string): readonly ThreadId[] {
  return persistedThreadOrderIdsByProjectCwd.get(projectCwdKey(projectCwd)) ?? [];
}

export function rememberThreadOrderForProject(
  projectCwd: string,
  orderedThreadIds: readonly ThreadId[],
): void {
  const cwdKey = projectCwdKey(projectCwd);
  persistedThreadOrderIdsByProjectCwd.set(cwdKey, [...orderedThreadIds]);
  if (typeof window === "undefined") {
    return;
  }
  try {
    const raw = window.localStorage.getItem(PERSISTED_STATE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    window.localStorage.setItem(
      PERSISTED_STATE_KEY,
      JSON.stringify({
        ...parsed,
        threadOrderIdsByProjectCwd: Object.fromEntries(persistedThreadOrderIdsByProjectCwd),
      }),
    );
  } catch {
    // Ignore quota/storage errors.
  }
}

export function reorderThreadIdsInProject(input: {
  orderedThreadIds: readonly ThreadId[];
  draggedThreadId: ThreadId;
  targetThreadId: ThreadId;
}): ThreadId[] {
  const { draggedThreadId, targetThreadId } = input;
  if (draggedThreadId === targetThreadId) {
    return [...input.orderedThreadIds];
  }

  const next = input.orderedThreadIds.filter((threadId) => threadId !== draggedThreadId);
  const targetIndex = next.indexOf(targetThreadId);
  if (targetIndex < 0) {
    return [...input.orderedThreadIds, draggedThreadId];
  }
  next.splice(targetIndex, 0, draggedThreadId);
  return next;
}

export function insertThreadIdIntoProjectOrder(input: {
  orderedThreadIds: readonly ThreadId[];
  threadId: ThreadId;
  targetThreadId?: ThreadId | null;
  position?: "before" | "after";
}): ThreadId[] {
  const withoutDragged = input.orderedThreadIds.filter((threadId) => threadId !== input.threadId);
  if (!input.targetThreadId) {
    return [...withoutDragged, input.threadId];
  }

  const targetIndex = withoutDragged.indexOf(input.targetThreadId);
  if (targetIndex < 0) {
    return [...withoutDragged, input.threadId];
  }

  const insertIndex = input.position === "after" ? targetIndex + 1 : targetIndex;
  const next = [...withoutDragged];
  next.splice(insertIndex, 0, input.threadId);
  return next;
}

export function sortThreadIdsWithManualOrder<T extends { id: ThreadId }>(
  threads: readonly T[],
  manualOrderIds: readonly ThreadId[],
): T[] {
  if (manualOrderIds.length === 0) {
    return [...threads];
  }

  const byId = new Map(threads.map((thread) => [thread.id, thread] as const));
  const ordered: T[] = [];
  const seen = new Set<ThreadId>();

  for (const threadId of manualOrderIds) {
    const thread = byId.get(threadId);
    if (!thread || seen.has(threadId)) {
      continue;
    }
    seen.add(threadId);
    ordered.push(thread);
  }

  for (const thread of threads) {
    if (!seen.has(thread.id)) {
      ordered.push(thread);
    }
  }

  return ordered;
}
