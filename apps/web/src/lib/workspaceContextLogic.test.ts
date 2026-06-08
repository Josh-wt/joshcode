import { describe, expect, it } from "vitest";

import {
  appendWorkspaceContext,
  buildProjectWorkspaceContext,
  hasWorkspaceContextSignature,
  patchThreadWorkspaceContext,
  resolveWorkspaceContextsBase,
  updateThreadWorkspaceContext,
  workspaceContextSignature,
} from "./workspaceContextLogic";

describe("workspaceContextLogic", () => {
  const baseContext = {
    id: "project:repo-b",
    projectId: "repo-b" as const,
    label: "Other Repo",
    role: "context" as const,
    accessMode: "read-write" as const,
    cwd: "/repos/other",
    envMode: "local" as const,
    branch: "main",
    worktreePath: null,
  };

  it("updates branch and cwd for local context", () => {
    const next = patchThreadWorkspaceContext(baseContext, "/repos/other", {
      branch: "feature/x",
    });
    expect(next.branch).toBe("feature/x");
    expect(next.cwd).toBe("/repos/other");
    expect(next.envMode).toBe("local");
  });

  it("updates worktree path and env mode together", () => {
    const next = patchThreadWorkspaceContext(baseContext, "/repos/other", {
      envMode: "worktree",
      branch: "synara/abc",
      worktreePath: "/repos/other/.worktrees/abc",
    });
    expect(next.envMode).toBe("worktree");
    expect(next.cwd).toBe("/repos/other/.worktrees/abc");
  });

  it("patches only the targeted context in an array", () => {
    const primary = { ...baseContext, id: "primary", role: "primary" as const };
    const next = updateThreadWorkspaceContext([primary, baseContext], baseContext.id, "/repos/other", {
      branch: "develop",
    });
    expect(next[0]?.branch).toBe("main");
    expect(next[1]?.branch).toBe("develop");
  });

  it("builds distinct ids for two branches in the same repo", () => {
    const project = {
      id: "repo-a" as const,
      name: "Repo A",
      folderName: "repo-a",
      cwd: "/repos/a",
    };
    const main = buildProjectWorkspaceContext({ project, branch: "main" });
    const feature = buildProjectWorkspaceContext({ project, branch: "feature/x" });
    expect(main.id).not.toBe(feature.id);
    expect(workspaceContextSignature(main)).not.toBe(workspaceContextSignature(feature));
  });

  it("seeds the thread primary workspace before the first additional context is persisted", () => {
    const primary = {
      id: "primary",
      projectId: "repo-a" as const,
      label: "Repo A",
      role: "primary" as const,
      accessMode: "read-write" as const,
      cwd: "/repos/a",
      envMode: "local" as const,
      branch: "main",
      worktreePath: null,
    };
    const projectB = {
      id: "repo-b" as const,
      name: "Repo B",
      folderName: "repo-b",
      cwd: "/repos/b",
    };
    const added = buildProjectWorkspaceContext({ project: projectB });
    const next = appendWorkspaceContext([], primary, added);

    expect(resolveWorkspaceContextsBase([], primary)).toEqual([primary]);
    expect(next).toHaveLength(2);
    expect(next[0]).toMatchObject({ id: "primary", projectId: "repo-a", role: "primary" });
    expect(next[1]).toMatchObject({ projectId: "repo-b", role: "context" });
  });

  it("detects duplicate branch signatures within a context set", () => {
    const project = {
      id: "repo-a" as const,
      name: "Repo A",
      folderName: "repo-a",
      cwd: "/repos/a",
    };
    const contexts = [
      buildProjectWorkspaceContext({ project, branch: "main" }),
      buildProjectWorkspaceContext({ project, branch: "feature/x" }),
    ];
    expect(
      hasWorkspaceContextSignature(contexts, {
        projectId: project.id,
        envMode: "local",
        branch: "main",
        worktreePath: null,
      }),
    ).toBe(true);
    expect(
      hasWorkspaceContextSignature(contexts, {
        projectId: project.id,
        envMode: "local",
        branch: "develop",
        worktreePath: null,
      }),
    ).toBe(false);
  });
});
