// FILE: threadTabBar.logic.ts
// Purpose: Pure derivations for Chrome-style project tab groups and thread tabs.
// Layer: UI logic

import type { CSSProperties } from "react";
import type { ProjectId, ProviderKind, ThreadId } from "@t3tools/contracts";

import {
  isHomeChatContainerProject,
  resolveHomeChatContainerGrouping,
} from "~/lib/chatProjects";
import { cn } from "~/lib/utils";
import type { Project, SidebarThreadSummary } from "~/types";

export const THREAD_TAB_BAR_PREVIEW_LIMIT = 10;

/** Tab bar row height including bottom breathing room below tabs. */
export const THREAD_TAB_BAR_BOTTOM_INSET_PX = 12;
export const THREAD_TAB_BAR_CONTENT_HEIGHT_PX = 62;
export const THREAD_TAB_BAR_HEIGHT_PX =
  THREAD_TAB_BAR_CONTENT_HEIGHT_PX + THREAD_TAB_BAR_BOTTOM_INSET_PX;
export const THREAD_TAB_BAR_MAIN_ROW_CLASS = "min-h-[74px] h-[74px]";

/** Shared chip height for project pills and thread tabs in the top bar. */
export const THREAD_TAB_BAR_CHIP_HEIGHT_CLASS = "!h-8 min-h-8";

/** Thread tab: thin 2px rounded hairline under the chip. */
export const THREAD_TAB_ACTIVE_UNDERLINE_CLASS =
  "relative after:pointer-events-none after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--thread-tab-accent)] after:content-['']";

/** Thread tab chip sizing in the top bar. */
export const THREAD_TAB_CHIP_CLASS_NAME = cn(
  THREAD_TAB_BAR_CHIP_HEIGHT_CLASS,
  "rounded-md px-3 text-[length:var(--app-font-size-ui,13px)] leading-none",
);

/** Project group pill — taller than thread chips, bottom-aligned above tab bar inset. */
export const THREAD_TAB_GROUP_PILL_CLASS_NAME = cn(
  "!h-10 min-h-10 shrink-0 self-end rounded-lg px-4 text-[length:var(--app-font-size-ui,13px)] leading-none",
);

/** Project group pill: thick accent bar below the pill bottom edge. */
export const THREAD_TAB_GROUP_ACTIVE_UNDERLINE_CLASS =
  "relative after:pointer-events-none after:absolute after:inset-x-1 after:-bottom-2 after:h-2 after:rounded-full after:bg-[var(--thread-group-accent)] after:content-['']";

export function resolveThreadTabAccentCssVars(accentColor: string): CSSProperties {
  return { "--thread-tab-accent": accentColor } as CSSProperties;
}
/** Gap from the chat content top edge (below tab bar) to floating corner islands. */
export const APP_TOP_BAR_ISLAND_TOP_OFFSET_PX = 20;
/** Approximate vertical footprint of corner controls when positioning overlays (e.g. environment). */
export const APP_TOP_BAR_ISLAND_OVERHANG_PX = 32;
/** @deprecated Use THREAD_TAB_BAR_MAIN_ROW_CLASS */
export const THREAD_TAB_BAR_HEIGHT_CLASS = THREAD_TAB_BAR_MAIN_ROW_CLASS;

export const THREAD_TAB_GROUP_ACCENT_COLORS = [
  "#8b5cf6",
  "#3b82f6",
  "#14b8a6",
  "#f59e0b",
  "#ec4899",
  "#6366f1",
  "#10b981",
  "#f97316",
  "#06b6d4",
  "#a855f7",
  "#84cc16",
  "#ef4444",
] as const;

export interface ThreadTabModel {
  threadId: ThreadId;
  title: string;
  provider: ProviderKind;
  isActive: boolean;
  isSubagent: boolean;
  isDraft: boolean;
  hasLiveTailWork: boolean;
  hasPendingAction: boolean;
}

export interface ThreadTabGroupModel {
  projectId: ProjectId;
  label: string;
  isHomeChat: boolean;
  isExpanded: boolean;
  isActiveGroup: boolean;
  accentColor: string;
  threads: ThreadTabModel[];
  hiddenThreadCount: number;
  threadCount: number;
}

function hashProjectId(projectId: ProjectId): number {
  let hash = 0;
  for (let index = 0; index < projectId.length; index += 1) {
    hash = (hash * 31 + projectId.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function resolveThreadTabGroupAccentColor(projectId: ProjectId): string {
  const index = hashProjectId(projectId) % THREAD_TAB_GROUP_ACCENT_COLORS.length;
  return THREAD_TAB_GROUP_ACCENT_COLORS[index] ?? THREAD_TAB_GROUP_ACCENT_COLORS[0];
}

export function resolveThreadTabProjectLabel(
  project: Pick<Project, "id" | "name" | "folderName" | "cwd" | "kind" | "remoteName">,
  input: { homeDir: string | null; chatWorkspaceRoot: string | null },
): string {
  const paths = { homeDir: input.homeDir, chatWorkspaceRoot: input.chatWorkspaceRoot };
  const { canonicalProjectId } = resolveHomeChatContainerGrouping([project], paths);
  if (canonicalProjectId === project.id && isHomeChatContainerProject(project, paths)) {
    return "Home";
  }
  const trimmedName = project.name?.trim();
  if (trimmedName) {
    return trimmedName;
  }
  const folderName = project.folderName?.trim();
  if (folderName) {
    return folderName;
  }
  const cwdBasename = project.cwd.split(/[/\\]/).filter(Boolean).at(-1);
  return cwdBasename ?? "Project";
}

export function resolveThreadTabProvider(thread: SidebarThreadSummary): ProviderKind {
  return thread.session?.provider ?? thread.modelSelection.provider;
}

export function buildThreadTabModel(input: {
  thread: SidebarThreadSummary;
  activeThreadId: ThreadId | null | undefined;
  isDraft: boolean;
}): ThreadTabModel {
  const { thread, activeThreadId, isDraft } = input;
  return {
    threadId: thread.id,
    title: thread.title,
    provider: resolveThreadTabProvider(thread),
    isActive: thread.id === activeThreadId,
    isSubagent: Boolean(thread.parentThreadId),
    isDraft,
    hasLiveTailWork: thread.hasLiveTailWork,
    hasPendingAction: thread.hasPendingApprovals || thread.hasPendingUserInput,
  };
}

export function buildThreadTabGroups(input: {
  projects: readonly Project[];
  sortedThreadsByProjectId: ReadonlyMap<ProjectId, readonly SidebarThreadSummary[]>;
  collapsedProjectIds: ReadonlySet<ProjectId>;
  activeThreadId: ThreadId | null | undefined;
  activeProjectId: ProjectId | null | undefined;
  draftThreadIds: ReadonlySet<ThreadId>;
  pinnedProjectIds: readonly ProjectId[];
  homeDir: string | null;
  chatWorkspaceRoot: string | null;
  previewLimit?: number;
}): ThreadTabGroupModel[] {
  const workspacePaths = {
    homeDir: input.homeDir,
    chatWorkspaceRoot: input.chatWorkspaceRoot,
  };
  const { canonicalProjectId, projectIdAliases } = resolveHomeChatContainerGrouping(
    input.projects,
    workspacePaths,
  );

  const mergedThreadsByProjectId = new Map(input.sortedThreadsByProjectId);
  for (const [aliasProjectId, canonicalId] of projectIdAliases) {
    const aliasThreads = mergedThreadsByProjectId.get(aliasProjectId) ?? [];
    if (aliasThreads.length === 0) {
      mergedThreadsByProjectId.delete(aliasProjectId);
      continue;
    }
    const canonicalThreads = mergedThreadsByProjectId.get(canonicalId) ?? [];
    mergedThreadsByProjectId.set(canonicalId, [...canonicalThreads, ...aliasThreads]);
    mergedThreadsByProjectId.delete(aliasProjectId);
  }

  const visibleProjects = input.projects.filter((project) => !projectIdAliases.has(project.id));
  const projectById = new Map(visibleProjects.map((project) => [project.id, project] as const));
  const pinnedRank = new Map(input.pinnedProjectIds.map((projectId, index) => [projectId, index]));

  const orderedProjectIds = [...visibleProjects]
    .filter(
      (project) => project.kind !== "chat" || mergedThreadsByProjectId.has(project.id),
    )
    .toSorted((left, right) => {
      const leftPinned = pinnedRank.get(left.id);
      const rightPinned = pinnedRank.get(right.id);
      if (leftPinned !== undefined || rightPinned !== undefined) {
        if (leftPinned === undefined) return 1;
        if (rightPinned === undefined) return -1;
        return leftPinned - rightPinned;
      }
      return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
    })
    .map((project) => project.id);

  const groups: ThreadTabGroupModel[] = [];

  for (const projectId of orderedProjectIds) {
    const project = projectById.get(projectId);
    if (!project) {
      continue;
    }

    const projectThreads = mergedThreadsByProjectId.get(projectId) ?? [];
    const isExpanded = !input.collapsedProjectIds.has(projectId);
    const visibleThreads = isExpanded ? projectThreads : [];
    const hiddenThreadCount = isExpanded ? 0 : projectThreads.length;
    const accentColor = resolveThreadTabGroupAccentColor(projectId);
    const threads = visibleThreads.map((thread) =>
      buildThreadTabModel({
        thread,
        activeThreadId: input.activeThreadId,
        isDraft: input.draftThreadIds.has(thread.id),
      }),
    );
    const isActiveGroup =
      input.activeProjectId === projectId ||
      threads.some((thread) => thread.isActive) ||
      (input.activeThreadId !== null &&
        input.activeThreadId !== undefined &&
        projectThreads.some((thread) => thread.id === input.activeThreadId));

    groups.push({
      projectId,
      label: resolveThreadTabProjectLabel(project, workspacePaths),
      isHomeChat: canonicalProjectId !== null && projectId === canonicalProjectId,
      isExpanded,
      isActiveGroup,
      accentColor,
      threads: isExpanded ? threads : [],
      hiddenThreadCount: isExpanded ? hiddenThreadCount : projectThreads.length,
      threadCount: projectThreads.length,
    });
  }

  return groups;
}

export function isThreadRoutePathname(pathname: string): boolean {
  if (pathname === "/") {
    return false;
  }
  if (
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname.startsWith("/plugins") ||
    pathname.startsWith("/kanban") ||
    pathname.startsWith("/workspace") ||
    pathname.startsWith("/worldcup")
  ) {
    return false;
  }
  return /^\/[^/]+$/.test(pathname);
}
