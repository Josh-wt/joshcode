// FILE: useThreadTabStrip.ts
// Purpose: Data and actions for the project-grouped thread tab strip.
// Layer: Hook

import { ThreadId, type ProjectId } from "@t3tools/contracts";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { useAppSettings } from "~/appSettings";
import { useAppChrome } from "~/appChromeContext";
import { useAppChromeStore } from "~/appChromeStore";
import {
  groupSidebarThreadsByProjectId,
  sortProjectsForSidebar,
  sortThreadsForSidebar,
} from "~/components/Sidebar.logic";
import { useComposerDraftStore } from "~/composerDraftStore";
import { useHandleNewThread } from "~/hooks/useHandleNewThread";
import { readPersistedThreadOrderIdsForProject } from "~/lib/sidebarThreadOrder";
import { usePinnedProjectsStore } from "~/pinnedProjectsStore";
import { createSidebarThreadSummariesSelector } from "~/storeSelectors";
import { useStore } from "~/store";
import { useWorkspaceStore } from "~/workspaceStore";
import { useThreadTabBarStore, pruneThreadTabBarCollapsedProjects } from "~/threadTabBarStore";
import { readNativeApi } from "~/nativeApi";
import { prewarmHomeChatProject } from "~/lib/chatProjects";

import { buildThreadTabGroups } from "./threadTabBar.logic";
import { useThreadTabBarActions } from "./useThreadTabBarActions";

export function useThreadTabStrip() {
  const navigate = useNavigate();
  const routeThreadId = useParams({
    strict: false,
    select: (params) => (params.threadId ? ThreadId.makeUnsafe(params.threadId) : null),
  });
  const projects = useStore((state) => state.projects);
  const sidebarThreadSummaryById = useStore((state) => state.sidebarThreadSummaryById);
  const homeDir = useWorkspaceStore((state) => state.homeDir);
  const chatWorkspaceRoot = useWorkspaceStore((state) => state.chatWorkspaceRoot);
  const draftThreadsByThreadId = useComposerDraftStore((state) => state.draftThreadsByThreadId);
  const pinnedProjectIds = usePinnedProjectsStore((state) => state.pinnedProjectIds);
  const collapsedProjectIds = useThreadTabBarStore((state) => state.collapsedProjectIds);
  const toggleProjectCollapsed = useThreadTabBarStore((state) => state.toggleProjectCollapsed);
  const expandProject = useThreadTabBarStore((state) => state.expandProject);
  const setLastActiveProjectId = useThreadTabBarStore((state) => state.setLastActiveProjectId);
  const hydrateCollapsedFromProjects = useThreadTabBarStore(
    (state) => state.hydrateCollapsedFromProjects,
  );
  const openSearchPalette = useAppChromeStore((state) => state.openSearchPalette);
  const { settings: appSettings } = useAppSettings();
  const { activeProjectId, handleNewThread } = useHandleNewThread();
  const {
    showNativeProjectContextMenu,
    setProjectContextMenuState,
    setRenameDialogThreadId,
    showThreadContextMenu,
    confirmAndArchiveThread,
    confirmAndRemoveProject,
  } = useAppChrome();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const selectSidebarThreads = useMemo(() => createSidebarThreadSummariesSelector(), []);
  const sidebarThreads = useStore(selectSidebarThreads);
  const sidebarDisplayThreads = useMemo(
    () => sidebarThreads.filter((thread) => thread.archivedAt == null),
    [sidebarThreads],
  );

  const sidebarThreadsByProjectId = useMemo(
    () => groupSidebarThreadsByProjectId(sidebarDisplayThreads),
    [sidebarDisplayThreads],
  );

  const sortedSidebarThreadsByProjectId = useMemo(() => {
    const byProjectId = new Map<ProjectId, (typeof sidebarDisplayThreads)[number][]>();
    for (const [projectId, projectThreads] of sidebarThreadsByProjectId) {
      const projectCwd = projects.find((project) => project.id === projectId)?.cwd ?? "";
      byProjectId.set(
        projectId,
        sortThreadsForSidebar(
          projectThreads,
          appSettings.sidebarThreadSortOrder,
          readPersistedThreadOrderIdsForProject(projectCwd),
        ),
      );
    }
    return byProjectId;
  }, [appSettings.sidebarThreadSortOrder, projects, sidebarThreadsByProjectId]);

  const sortedProjects = useMemo(
    () => sortProjectsForSidebar(projects, sidebarThreads, appSettings.sidebarProjectSortOrder),
    [appSettings.sidebarProjectSortOrder, projects, sidebarThreads],
  );

  const projectCwdById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.cwd] as const)),
    [projects],
  );

  const draftThreadIds = useMemo(
    () => new Set(Object.keys(draftThreadsByThreadId) as ThreadId[]),
    [draftThreadsByThreadId],
  );

  const collapsedProjectIdSet = useMemo(
    () => new Set(collapsedProjectIds),
    [collapsedProjectIds],
  );

  const tabGroups = useMemo(
    () =>
      buildThreadTabGroups({
        projects: sortedProjects,
        sortedThreadsByProjectId: sortedSidebarThreadsByProjectId,
        collapsedProjectIds: collapsedProjectIdSet,
        activeThreadId: routeThreadId,
        activeProjectId,
        draftThreadIds,
        pinnedProjectIds,
        homeDir,
        chatWorkspaceRoot,
      }),
    [
      activeProjectId,
      chatWorkspaceRoot,
      collapsedProjectIdSet,
      draftThreadIds,
      homeDir,
      pinnedProjectIds,
      routeThreadId,
      sortedProjects,
      sortedSidebarThreadsByProjectId,
    ],
  );

  const {
    createThreadInProject,
    createWorktreeThreadInProject,
    navigateToThread,
  } = useThreadTabBarActions({
    sidebarThreads,
    sidebarThreadSummaryById,
    routeThreadId,
    projectCwdById,
    onRequestRename: setRenameDialogThreadId,
  });

  const openProjectContextMenu = useCallback(
    (projectId: ProjectId, position: { x: number; y: number }) => {
      const api = readNativeApi();
      if (api?.contextMenu?.show) {
        void showNativeProjectContextMenu(projectId, position);
        return;
      }
      setProjectContextMenuState({ projectId, position });
    },
    [setProjectContextMenuState, showNativeProjectContextMenu],
  );

  const openProjectSearchPalette = useCallback(
    (projectId: ProjectId, label: string) => {
      openSearchPalette({
        mode: "search",
        initialQuery: `project:${label}`,
        projectFilterId: projectId,
      });
    },
    [openSearchPalette],
  );

  useEffect(() => {
    prewarmHomeChatProject({ homeDir, chatWorkspaceRoot });
  }, [chatWorkspaceRoot, homeDir]);

  useEffect(() => {
    pruneThreadTabBarCollapsedProjects(projects.map((project) => project.id));
  }, [projects]);

  useEffect(() => {
    hydrateCollapsedFromProjects({
      projectIds: projects.map((project) => project.id),
      expandedProjectIds: projects.filter((project) => project.expanded).map((project) => project.id),
    });
  }, [hydrateCollapsedFromProjects, projects]);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }
    setLastActiveProjectId(activeProjectId);
    expandProject(activeProjectId);
  }, [activeProjectId, expandProject, setLastActiveProjectId]);

  useEffect(() => {
    if (!routeThreadId) {
      return;
    }
    const threadProjectId = sidebarThreadSummaryById[routeThreadId]?.projectId;
    if (!threadProjectId) {
      return;
    }
    expandProject(threadProjectId);
  }, [expandProject, routeThreadId, sidebarThreadSummaryById]);

  useEffect(() => {
    if (!routeThreadId || !scrollContainerRef.current) {
      return;
    }
    const activeTab = scrollContainerRef.current.querySelector(
      `[data-thread-tab-id="${routeThreadId}"]`,
    );
    if (activeTab instanceof HTMLElement) {
      activeTab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [routeThreadId, tabGroups]);

  const handleGlobalNewThread = useCallback(() => {
    const targetProjectId = activeProjectId ?? sortedProjects[0]?.id;
    if (!targetProjectId) {
      void navigate({ to: "/" });
      return;
    }
    createThreadInProject(targetProjectId);
  }, [activeProjectId, createThreadInProject, navigate, sortedProjects]);

  return {
    tabGroups,
    scrollContainerRef,
    toggleProjectCollapsed,
    createThreadInProject,
    createWorktreeThreadInProject,
    navigateToThread,
    confirmAndArchiveThread,
    showThreadContextMenu,
    confirmAndRemoveProject,
    openProjectContextMenu,
    openProjectSearchPalette,
    handleGlobalNewThread,
  };
}
