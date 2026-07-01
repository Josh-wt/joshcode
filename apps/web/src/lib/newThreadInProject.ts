// FILE: newThreadInProject.ts
// Purpose: Resolve options for creating a new chat thread inside an existing project.
// Layer: Web bootstrap helper

import type { GitBranch, ProjectId, ThreadId } from "@t3tools/contracts";
import { isTemporaryWorktreeBranch } from "@t3tools/shared/git";

import {
  resolveSidebarNewThreadEnvMode,
  type SidebarNewThreadEnvMode,
} from "../components/Sidebar.logic";
import { resolveComposerSlashRootBranch } from "../composerSlashCommands";
import type { NewThreadOptions } from "./threadBootstrap";

export type NewThreadInProjectIntent = "default" | "local" | "worktree";

export function resolveWorktreeBaseBranchForProject(input: {
  projectCwd: string | null | undefined;
  sourceThreadBranch?: string | null;
  branches?: ReadonlyArray<GitBranch> | null;
}): string | null {
  const currentAtProjectRoot = resolveComposerSlashRootBranch({
    branches: input.branches,
    activeProjectCwd: input.projectCwd,
    activeThreadBranch: null,
  });
  if (currentAtProjectRoot) {
    return currentAtProjectRoot;
  }

  const sourceBranch = input.sourceThreadBranch?.trim();
  if (sourceBranch && !isTemporaryWorktreeBranch(sourceBranch)) {
    return sourceBranch;
  }

  const defaultBranch = input.branches?.find((branch) => branch.isDefault)?.name;
  if (defaultBranch) {
    return defaultBranch;
  }

  return input.branches?.find((branch) => branch.current)?.name ?? null;
}

export function resolveSourceThreadBranchForProject(input: {
  projectId: ProjectId;
  routeThreadId: ThreadId | null;
  threads: ReadonlyArray<{
    id: ThreadId;
    projectId: ProjectId;
    branch?: string | null;
  }>;
  draftThreadsByThreadId: Readonly<
    Record<string, { projectId: ProjectId; branch?: string | null } | undefined>
  >;
}): string | null {
  if (input.routeThreadId) {
    const routeDraft = input.draftThreadsByThreadId[input.routeThreadId];
    if (routeDraft?.projectId === input.projectId && routeDraft.branch) {
      return routeDraft.branch;
    }
    const routeThread = input.threads.find((thread) => thread.id === input.routeThreadId);
    if (routeThread?.projectId === input.projectId && routeThread.branch) {
      return routeThread.branch;
    }
  }

  for (const thread of input.threads) {
    if (thread.projectId === input.projectId && thread.branch) {
      return thread.branch;
    }
  }

  return null;
}

export function resolveNewThreadInProjectOptions(input: {
  defaultThreadEnvMode: SidebarNewThreadEnvMode;
  intent?: NewThreadInProjectIntent;
  explicitOptions?: NewThreadOptions;
  preferredBaseBranch?: string | null;
}): NewThreadOptions {
  const intent = input.intent ?? "default";
  const envMode =
    intent === "worktree"
      ? "worktree"
      : intent === "local"
        ? "local"
        : resolveSidebarNewThreadEnvMode({
            defaultEnvMode: input.defaultThreadEnvMode,
            ...(input.explicitOptions?.envMode !== undefined
              ? { requestedEnvMode: input.explicitOptions.envMode }
              : {}),
          });

  const shouldClearWorktree = envMode === "local" && input.explicitOptions?.worktreePath === undefined;
  const preferredBaseBranch = input.preferredBaseBranch ?? null;
  const branch =
    input.explicitOptions?.branch !== undefined
      ? input.explicitOptions.branch
      : envMode === "worktree"
        ? preferredBaseBranch
        : null;

  return {
    ...input.explicitOptions,
    envMode,
    ...(shouldClearWorktree ? { worktreePath: null } : {}),
    ...(branch !== null ? { branch } : {}),
    ...(envMode === "worktree" ? { fresh: true } : {}),
  };
}
