import { describe, expect, it } from "vitest";

import { buildInheritedSidechatWorkspace } from "./sidechatWorkspace";

describe("buildInheritedSidechatWorkspace", () => {
  it("defaults env mode from worktree path", () => {
    expect(
      buildInheritedSidechatWorkspace({
        envMode: "worktree",
        branch: "main",
        worktreePath: "/repo/.worktrees/feature",
      }),
    ).toEqual({
      envMode: "worktree",
      branch: "main",
      worktreePath: "/repo/.worktrees/feature",
      associatedWorktreePath: null,
      associatedWorktreeBranch: null,
      associatedWorktreeRef: null,
      workspaceContexts: [],
      activeWorkspaceContextId: null,
    });
  });

  it("clears workspace contexts for sidechat threads", () => {
    expect(
      buildInheritedSidechatWorkspace({
        envMode: "local",
        branch: null,
        worktreePath: null,
      }).workspaceContexts,
    ).toEqual([]);
  });
});
