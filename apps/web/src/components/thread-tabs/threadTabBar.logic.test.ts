import { ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import type { Project, SidebarThreadSummary } from "~/types";

import {
  buildThreadTabGroups,
  isThreadRoutePathname,
  resolveThreadTabGroupAccentColor,
  resolveThreadTabProjectLabel,
  resolveThreadTabProvider,
} from "./threadTabBar.logic";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: ProjectId.makeUnsafe("project-1"),
    name: "My App",
    folderName: "my-app",
    cwd: "/home/josh/my-app",
    kind: "project",
    expanded: true,
    scripts: [],
    localName: null,
    remoteName: "origin",
    defaultModelSelection: null,
    ...overrides,
  };
}

function makeThread(overrides: Partial<SidebarThreadSummary> = {}): SidebarThreadSummary {
  return {
    id: ThreadId.makeUnsafe("thread-1"),
    projectId: ProjectId.makeUnsafe("project-1"),
    title: "Fix auth",
    modelSelection: { provider: "codex", model: "gpt-5" },
    interactionMode: "default",
    branch: null,
    worktreePath: null,
    session: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    latestTurn: null,
    latestUserMessageAt: null,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    hasLiveTailWork: false,
    ...overrides,
  };
}

describe("threadTabBar.logic", () => {
  it("detects thread routes and excludes settings/kanban paths", () => {
    expect(isThreadRoutePathname("/thread-abc")).toBe(true);
    expect(isThreadRoutePathname("/settings")).toBe(false);
    expect(isThreadRoutePathname("/kanban/project-1")).toBe(false);
    expect(isThreadRoutePathname("/automations")).toBe(false);
    expect(isThreadRoutePathname("/plugins")).toBe(false);
    expect(isThreadRoutePathname("/")).toBe(false);
  });

  it("assigns stable accent colors per project id", () => {
    const projectId = ProjectId.makeUnsafe("project-stable");
    expect(resolveThreadTabGroupAccentColor(projectId)).toBe(
      resolveThreadTabGroupAccentColor(projectId),
    );
  });

  it("labels home chat container projects as Home", () => {
    const project = makeProject({
      kind: "chat",
      name: "",
      remoteName: "",
      cwd: "/home/josh/.synara/chat",
    });
    expect(
      resolveThreadTabProjectLabel(project, {
        homeDir: "/home/josh",
        chatWorkspaceRoot: "/home/josh/.synara/chat",
      }),
    ).toBe("Home");
  });

  it("resolves provider from session when available", () => {
    const thread = makeThread({
      modelSelection: { provider: "codex", model: "gpt-5" },
      session: {
        provider: "claudeAgent",
        status: "running",
        orchestrationStatus: "running",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(resolveThreadTabProvider(thread)).toBe("claudeAgent");
  });

  it("builds expanded and collapsed project tab groups", () => {
    const project = makeProject();
    const activeThreadId = ThreadId.makeUnsafe("thread-1");
    const groups = buildThreadTabGroups({
      projects: [project],
      sortedThreadsByProjectId: new Map([[project.id, [makeThread({ id: activeThreadId })]]]),
      collapsedProjectIds: new Set(),
      activeThreadId,
      activeProjectId: project.id,
      draftThreadIds: new Set(),
      pinnedProjectIds: [],
      homeDir: "/home/josh",
      chatWorkspaceRoot: "/home/josh/.synara/chat",
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.isExpanded).toBe(true);
    expect(groups[0]?.threads).toHaveLength(1);
    expect(groups[0]?.threads[0]?.isActive).toBe(true);

    const collapsedGroups = buildThreadTabGroups({
      projects: [project],
      sortedThreadsByProjectId: new Map([[project.id, [makeThread({ id: activeThreadId })]]]),
      collapsedProjectIds: new Set([project.id]),
      activeThreadId,
      activeProjectId: project.id,
      draftThreadIds: new Set(),
      pinnedProjectIds: [],
      homeDir: "/home/josh",
      chatWorkspaceRoot: "/home/josh/.synara/chat",
    });

    expect(collapsedGroups[0]?.threads).toHaveLength(0);
    expect(collapsedGroups[0]?.threadCount).toBe(1);
  });

  it("merges duplicate home chat containers into one Home tab group", () => {
    const homeDir = "/home/josh";
    const chatWorkspaceRoot = "/home/josh/Documents/Synara";
    const legacyHome = makeProject({
      id: ProjectId.makeUnsafe("home-legacy"),
      kind: "chat",
      name: "Home",
      remoteName: "Home",
      cwd: homeDir,
    });
    const managedChat = makeProject({
      id: ProjectId.makeUnsafe("home-managed"),
      kind: "chat",
      name: "Side question",
      remoteName: "Side question",
      cwd: `${chatWorkspaceRoot}/2026-06-11/side-question`,
    });
    const landing = makeProject({
      id: ProjectId.makeUnsafe("landing"),
      name: "Landing",
      cwd: "/home/josh/landing",
    });
    const legacyThread = makeThread({
      id: ThreadId.makeUnsafe("thread-legacy"),
      projectId: legacyHome.id,
      title: "Legacy chat",
    });
    const managedThread = makeThread({
      id: ThreadId.makeUnsafe("thread-managed"),
      projectId: managedChat.id,
      title: "Managed chat",
    });

    const groups = buildThreadTabGroups({
      projects: [legacyHome, managedChat, landing],
      sortedThreadsByProjectId: new Map([
        [legacyHome.id, [legacyThread]],
        [managedChat.id, [managedThread]],
        [landing.id, []],
      ]),
      collapsedProjectIds: new Set(),
      activeThreadId: managedThread.id,
      activeProjectId: managedChat.id,
      draftThreadIds: new Set(),
      pinnedProjectIds: [],
      homeDir,
      chatWorkspaceRoot,
    });

    const homeGroups = groups.filter((group) => group.label === "Home");
    expect(homeGroups).toHaveLength(1);
    expect(homeGroups[0]?.threads).toHaveLength(2);
    expect(homeGroups[0]?.isHomeChat).toBe(true);
    expect(groups.some((group) => group.label === "Landing")).toBe(true);
  });

  it("includes subagent threads in a project group", () => {
    const project = makeProject();
    const parentThread = makeThread({ id: ThreadId.makeUnsafe("parent") });
    const subagentThread = makeThread({
      id: ThreadId.makeUnsafe("child"),
      parentThreadId: ThreadId.makeUnsafe("parent"),
      title: "Subagent task",
    });
    const groups = buildThreadTabGroups({
      projects: [project],
      sortedThreadsByProjectId: new Map([[project.id, [parentThread, subagentThread]]]),
      collapsedProjectIds: new Set(),
      activeThreadId: subagentThread.id,
      activeProjectId: project.id,
      draftThreadIds: new Set(),
      pinnedProjectIds: [],
      homeDir: null,
      chatWorkspaceRoot: null,
    });

    expect(groups[0]?.threads).toHaveLength(2);
    expect(groups[0]?.threads[1]?.isSubagent).toBe(true);
  });
});
