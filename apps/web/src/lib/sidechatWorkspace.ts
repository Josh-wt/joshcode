// FILE: sidechatWorkspace.ts
// Purpose: Derive an isolated worktree workspace for new sidechats on git projects.
// Layer: Web orchestration helper

import { buildTemporaryWorktreeBranchName } from "@t3tools/shared/git";
import { deriveAssociatedWorktreeMetadata } from "@t3tools/shared/threadWorkspace";

import { readNativeApi } from "~/nativeApi";

export interface SidechatWorkspaceSeed {
  envMode: "local" | "worktree";
  branch: string | null;
  worktreePath: string | null;
  associatedWorktreePath: string | null;
  associatedWorktreeBranch: string | null;
  associatedWorktreeRef: string | null;
  workspaceContexts: [];
  activeWorkspaceContextId: null;
}

export function buildInheritedSidechatWorkspace(input: {
  envMode: "local" | "worktree" | null | undefined;
  branch: string | null | undefined;
  worktreePath: string | null | undefined;
  associatedWorktreePath?: string | null | undefined;
  associatedWorktreeBranch?: string | null | undefined;
  associatedWorktreeRef?: string | null | undefined;
}): SidechatWorkspaceSeed {
  const envMode = input.envMode ?? (input.worktreePath ? "worktree" : "local");
  return {
    envMode,
    branch: input.branch ?? null,
    worktreePath: input.worktreePath ?? null,
    associatedWorktreePath: input.associatedWorktreePath ?? null,
    associatedWorktreeBranch: input.associatedWorktreeBranch ?? null,
    associatedWorktreeRef: input.associatedWorktreeRef ?? null,
    workspaceContexts: [],
    activeWorkspaceContextId: null,
  };
}

export async function resolveSidechatWorkspaceSeed(input: {
  projectCwd: string;
  isGitRepo: boolean;
  baseBranch: string | null;
  parentWorkspace: SidechatWorkspaceSeed;
}): Promise<SidechatWorkspaceSeed> {
  if (!input.isGitRepo || !input.baseBranch?.trim()) {
    return input.parentWorkspace;
  }

  const api = readNativeApi();
  if (!api) {
    return input.parentWorkspace;
  }

  try {
    const result = await api.git.createWorktree({
      cwd: input.projectCwd,
      branch: input.baseBranch,
      newBranch: buildTemporaryWorktreeBranchName(),
      path: null,
    });
    const associatedWorktree = deriveAssociatedWorktreeMetadata({
      branch: result.worktree.branch,
      worktreePath: result.worktree.path,
    });
    return {
      envMode: "worktree",
      branch: result.worktree.branch,
      worktreePath: result.worktree.path,
      associatedWorktreePath: associatedWorktree.associatedWorktreePath,
      associatedWorktreeBranch: associatedWorktree.associatedWorktreeBranch,
      associatedWorktreeRef: associatedWorktree.associatedWorktreeRef,
      workspaceContexts: [],
      activeWorkspaceContextId: null,
    };
  } catch (error) {
    console.warn("Failed to provision isolated worktree for sidechat; inheriting parent workspace.", {
      projectCwd: input.projectCwd,
      baseBranch: input.baseBranch,
      error,
    });
    return input.parentWorkspace;
  }
}
