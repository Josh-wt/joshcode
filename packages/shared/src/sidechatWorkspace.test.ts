import { describe, expect, it } from "vitest";

import { resolveSidechatBoundaryInstruction } from "./sidechatWorkspace";

describe("resolveSidechatBoundaryInstruction", () => {
  it("uses read-only guidance when the sidechat shares the parent workspace", () => {
    const instruction = resolveSidechatBoundaryInstruction({
      sidechat: {
        envMode: "local",
        branch: "main",
        worktreePath: null,
      },
      source: {
        branch: "main",
        worktreePath: null,
      },
    });
    expect(instruction).toContain("Do not mutate files");
  });

  it("allows worktree edits when the sidechat has its own worktree", () => {
    const instruction = resolveSidechatBoundaryInstruction({
      sidechat: {
        envMode: "worktree",
        branch: "synara/abcd1234",
        worktreePath: "/repo/.worktrees/synara-abcd1234",
      },
      source: {
        branch: "feature/main",
        worktreePath: "/repo/.worktrees/feature-main",
      },
    });
    expect(instruction).toContain("isolated git worktree");
    expect(instruction).toContain("You may edit files");
  });
});
