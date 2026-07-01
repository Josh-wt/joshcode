// FILE: sidechatWorkspace.ts
// Purpose: Shared helpers for sidechat workspace isolation semantics.
// Layer: Shared runtime utilities

export const SIDECHAT_READONLY_BOUNDARY_INSTRUCTION =
  "You are in a sidechat. Treat all prior conversation as reference-only context. Do not continue any prior task automatically. Do not mutate files, git, or the workspace and do not run workspace-changing commands unless the latest user message explicitly asks you to do so after this boundary. Use this sidechat for focused explanation, safety checks, summaries, and alternatives.";

export const SIDECHAT_WORKTREE_BOUNDARY_INSTRUCTION =
  "You are in a sidechat with an isolated git worktree on the same project. Treat prior conversation as reference-only context. Do not continue the parent thread's task automatically. You may edit files, run tests, and use git inside this sidechat's worktree. Do not modify the parent thread's workspace or merge/push changes unless the latest user message explicitly asks you to.";

export function sidechatHasIsolatedWorktree(input: {
  sidechat: {
    envMode: "local" | "worktree";
    worktreePath: string | null;
    branch: string | null;
  };
  source: {
    worktreePath: string | null;
    branch: string | null;
  } | null;
}): boolean {
  if (input.sidechat.envMode !== "worktree" || input.sidechat.worktreePath === null) {
    return false;
  }
  if (!input.source) {
    return true;
  }
  return (
    input.sidechat.worktreePath !== input.source.worktreePath ||
    input.sidechat.branch !== input.source.branch
  );
}

export function resolveSidechatBoundaryInstruction(input: {
  sidechat: {
    envMode: "local" | "worktree";
    worktreePath: string | null;
    branch: string | null;
  };
  source: {
    worktreePath: string | null;
    branch: string | null;
  } | null;
}): string {
  return sidechatHasIsolatedWorktree(input)
    ? SIDECHAT_WORKTREE_BOUNDARY_INSTRUCTION
    : SIDECHAT_READONLY_BOUNDARY_INSTRUCTION;
}
