import { ProjectId, ThreadId, type GitBranch } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import {
  resolveNewThreadInProjectOptions,
  resolveSourceThreadBranchForProject,
  resolveWorktreeBaseBranchForProject,
} from "./newThreadInProject";

const PROJECT_ID = ProjectId.makeUnsafe("project-1");
const THREAD_A = ThreadId.makeUnsafe("thread-a");
const THREAD_B = ThreadId.makeUnsafe("thread-b");

function branch(name: string, overrides: Partial<GitBranch> = {}): GitBranch {
  return {
    name,
    current: false,
    isDefault: false,
    isRemote: false,
    worktreePath: null,
    ...overrides,
  };
}

describe("resolveWorktreeBaseBranchForProject", () => {
  it("prefers the branch checked out at the project root", () => {
    expect(
      resolveWorktreeBaseBranchForProject({
        projectCwd: "/repo/project",
        sourceThreadBranch: "synara/deadbeef",
        branches: [
          branch("main", { current: true, worktreePath: "/repo/project" }),
          branch("synara/deadbeef", { worktreePath: "/repo/worktrees/synara-deadbeef" }),
        ],
      }),
    ).toBe("main");
  });

  it("falls back to a non-temporary source thread branch", () => {
    expect(
      resolveWorktreeBaseBranchForProject({
        projectCwd: "/repo/project",
        sourceThreadBranch: "feature/demo",
        branches: [branch("feature/demo", { current: true, worktreePath: "/repo/other" })],
      }),
    ).toBe("feature/demo");
  });

  it("ignores temporary synara worktree branches as a base", () => {
    expect(
      resolveWorktreeBaseBranchForProject({
        projectCwd: "/repo/project",
        sourceThreadBranch: "synara/deadbeef",
        branches: [branch("develop", { isDefault: true })],
      }),
    ).toBe("develop");
  });
});

describe("resolveSourceThreadBranchForProject", () => {
  it("prefers the active route thread in the same project", () => {
    expect(
      resolveSourceThreadBranchForProject({
        projectId: PROJECT_ID,
        routeThreadId: THREAD_A,
        threads: [{ id: THREAD_A, projectId: PROJECT_ID, branch: "feature/active" }],
        draftThreadsByThreadId: {},
      }),
    ).toBe("feature/active");
  });

  it("falls back to another thread in the project", () => {
    expect(
      resolveSourceThreadBranchForProject({
        projectId: PROJECT_ID,
        routeThreadId: null,
        threads: [{ id: THREAD_B, projectId: PROJECT_ID, branch: "main" }],
        draftThreadsByThreadId: {},
      }),
    ).toBe("main");
  });
});

describe("resolveNewThreadInProjectOptions", () => {
  it("creates a fresh worktree thread with a seeded base branch", () => {
    expect(
      resolveNewThreadInProjectOptions({
        defaultThreadEnvMode: "local",
        intent: "worktree",
        preferredBaseBranch: "main",
      }),
    ).toEqual({
      envMode: "worktree",
      branch: "main",
      fresh: true,
    });
  });

  it("uses the default thread env mode when intent is default", () => {
    expect(
      resolveNewThreadInProjectOptions({
        defaultThreadEnvMode: "worktree",
        preferredBaseBranch: "main",
      }),
    ).toEqual({
      envMode: "worktree",
      branch: "main",
      fresh: true,
    });
  });

  it("clears worktree metadata for explicit local threads", () => {
    expect(
      resolveNewThreadInProjectOptions({
        defaultThreadEnvMode: "worktree",
        intent: "local",
      }),
    ).toEqual({
      envMode: "local",
      worktreePath: null,
    });
  });
});
