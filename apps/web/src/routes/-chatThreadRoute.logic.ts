// FILE: chatThreadRoute.logic.ts
// Purpose: Keep route-level chat panel state transitions and fallbacks deterministic.
// Layer: Route UI logic helpers.
// Exports: thread title fallback, deep-link bootstrap replay handling, and panel toggle helpers.

import { type ProjectId, type ThreadId, type TurnId } from "@t3tools/contracts";
import { workspaceRootsEqual } from "@t3tools/shared/threadWorkspace";

import { findWorkspaceRootMatch } from "../components/Sidebar.logic";
import { findHomeChatContainerProject } from "../lib/chatProjects";
import type { ChatRightPanel, DiffRouteSearch } from "../diffRouteSearch";

export interface ChatPanelStateSnapshot {
  panel: ChatRightPanel | null;
  diffTurnId: TurnId | null;
  diffFilePath: string | null;
}

export interface ChatPanelStatePatch {
  panel?: ChatRightPanel | null;
  diffTurnId?: TurnId | null;
  diffFilePath?: string | null;
}

export interface RoutePanelBootstrapResult {
  nextAppliedSearchKey: string | null;
  panelPatch: ChatPanelStatePatch | null;
}

export interface SplitPaneMaximizeDecision {
  splitViewIdToRemove: string;
  threadId: ThreadId;
  panelState: ChatPanelStateSnapshot | null;
}

export type SplitPaneCloseDecision =
  | {
      kind: "single-thread";
      threadId: ThreadId;
      splitViewIdToRemove: string;
    }
  | {
      kind: "split-thread";
      threadId: ThreadId;
      splitViewId: string;
    }
  | {
      kind: "new-chat";
    };

export function resolveThreadPickerTitle(title: string | null): string {
  return title || "New chat";
}

export interface SplitPaneWorkspaceDraftPlan {
  projectId: ProjectId;
  envMode: "local" | "worktree";
  worktreePath: string | null;
}

export function resolveSplitPaneWorkspaceDraftPlan(input: {
  workspaceRoot: string;
  homeDir: string | null;
  projects: ReadonlyArray<{ id: ProjectId; cwd: string; kind: string }>;
  threads: ReadonlyArray<{ projectId: ProjectId; worktreePath?: string | null }>;
}): SplitPaneWorkspaceDraftPlan | null {
  const matchedProject = findWorkspaceRootMatch(
    input.projects,
    input.workspaceRoot,
    (project) => project.cwd,
  );
  const homeProject =
    input.homeDir !== null ? findHomeChatContainerProject(input.projects, input.homeDir) : null;
  const threadWithWorktree = input.threads.find(
    (thread) =>
      thread.worktreePath && workspaceRootsEqual(thread.worktreePath, input.workspaceRoot),
  );
  const projectId =
    matchedProject?.id ?? homeProject?.id ?? threadWithWorktree?.projectId ?? null;

  if (!projectId) {
    return null;
  }

  const projectCwd =
    matchedProject?.cwd ??
    input.projects.find((project) => project.id === projectId)?.cwd ??
    input.homeDir;

  if (projectCwd && workspaceRootsEqual(projectCwd, input.workspaceRoot)) {
    return {
      projectId,
      envMode: "local",
      worktreePath: null,
    };
  }

  return {
    projectId,
    envMode: "worktree",
    worktreePath: input.workspaceRoot,
  };
}

function createRoutePanelSearchKey(input: {
  scopeId: string;
  search: DiffRouteSearch;
}): string | null {
  const { scopeId, search } = input;
  if (
    search.panel === undefined &&
    search.diff === undefined &&
    search.diffTurnId === undefined &&
    search.diffFilePath === undefined
  ) {
    return null;
  }

  return JSON.stringify({
    scopeId,
    panel: search.panel ?? (search.diff ? "diff" : null),
    diffTurnId: search.diffTurnId ?? null,
    diffFilePath: search.diffFilePath ?? null,
  });
}

export function resolveRoutePanelBootstrap(input: {
  scopeId: string;
  search: DiffRouteSearch;
  lastAppliedSearchKey: string | null;
}): RoutePanelBootstrapResult {
  const nextAppliedSearchKey = createRoutePanelSearchKey({
    scopeId: input.scopeId,
    search: input.search,
  });

  if (nextAppliedSearchKey === null) {
    return {
      nextAppliedSearchKey: null,
      panelPatch: null,
    };
  }

  if (input.lastAppliedSearchKey === nextAppliedSearchKey) {
    return {
      nextAppliedSearchKey,
      panelPatch: null,
    };
  }

  return {
    nextAppliedSearchKey,
    panelPatch: {
      panel: input.search.panel ?? (input.search.diff ? "diff" : null),
      diffTurnId: input.search.diffTurnId ?? null,
      diffFilePath: input.search.diffFilePath ?? null,
    },
  };
}

export function resolveToggledChatPanelPatch(
  previousState: ChatPanelStateSnapshot,
  panel: ChatRightPanel,
): ChatPanelStatePatch {
  return {
    panel: previousState.panel === panel ? null : panel,
    diffTurnId: previousState.diffTurnId,
    diffFilePath: previousState.diffFilePath,
  };
}

// Expanding a split pane exits split mode entirely; the selected chat becomes the single surface.
export function resolveSplitPaneMaximizeDecision(input: {
  splitViewId: string;
  focusedThreadId: ThreadId | null | undefined;
  focusedPanelState: ChatPanelStateSnapshot | null | undefined;
}): SplitPaneMaximizeDecision | null {
  if (!input.focusedThreadId) {
    return null;
  }

  return {
    splitViewIdToRemove: input.splitViewId,
    threadId: input.focusedThreadId,
    panelState: input.focusedPanelState ?? null,
  };
}

// Closing a sidechat is a return-to-source action; generic pane closes can still fall back normally.
export function resolveSplitPaneCloseDecision(input: {
  splitViewId: string;
  sourceThreadId: ThreadId;
  closingThreadId: ThreadId | null | undefined;
  closingSidechatSourceThreadId: ThreadId | null | undefined;
  nextFocusedThreadId: ThreadId | null | undefined;
  nextLeafCount: number;
}): SplitPaneCloseDecision {
  if (input.closingSidechatSourceThreadId) {
    return {
      kind: "single-thread",
      threadId: input.closingSidechatSourceThreadId,
      splitViewIdToRemove: input.splitViewId,
    };
  }

  if (input.closingThreadId && input.closingThreadId !== input.sourceThreadId) {
    return {
      kind: "single-thread",
      threadId: input.sourceThreadId,
      splitViewIdToRemove: input.splitViewId,
    };
  }

  if (input.nextFocusedThreadId) {
    if (input.nextLeafCount <= 1) {
      return {
        kind: "single-thread",
        threadId: input.nextFocusedThreadId,
        splitViewIdToRemove: input.splitViewId,
      };
    }
    return {
      kind: "split-thread",
      threadId: input.nextFocusedThreadId,
      splitViewId: input.splitViewId,
    };
  }

  return { kind: "new-chat" };
}
