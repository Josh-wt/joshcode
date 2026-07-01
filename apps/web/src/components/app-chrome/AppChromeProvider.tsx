// FILE: AppChromeProvider.tsx
// Purpose: Mounts app chrome hooks once and exposes them through AppChromeContext.
// Layer: UI provider

import { ThreadId } from "@t3tools/contracts";
import { useParams } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";

import {
  AppChromeContext,
  type AppChromeContextValue,
  type AppChromeRenameProject,
} from "~/appChromeContext";
import { useAddProjectFlow } from "~/hooks/useAddProjectFlow";
import { useAppChromeSearchHost } from "~/hooks/useAppChromeSearchHost";
import { useDiffRouteSearch } from "~/hooks/useDiffRouteSearch";
import { useProjectContextMenuActions } from "~/hooks/useProjectContextMenuActions";
import { useThreadContextMenuActions } from "~/hooks/useThreadContextMenuActions";
import { createSidebarThreadSummariesSelector } from "~/storeSelectors";
import { useStore } from "~/store";

function toRenameProject(
  project: {
    id: AppChromeRenameProject["id"];
    name: string;
    localName: string | null;
    folderName: string;
  } | null,
): AppChromeRenameProject | null {
  if (!project) return null;
  return {
    id: project.id,
    name: project.name,
    localName: project.localName,
    folderName: project.folderName,
  };
}

export function AppChromeProvider({ children }: { children: ReactNode }) {
  const selectSidebarThreads = useMemo(() => createSidebarThreadSummariesSelector(), []);
  const sidebarThreads = useStore(selectSidebarThreads);
  const sidebarThreadSummaryById = useStore((state) => state.sidebarThreadSummaryById);
  const projects = useStore((state) => state.projects);
  const routeThreadId = useParams({
    strict: false,
    select: (params) => (params.threadId ? ThreadId.makeUnsafe(params.threadId) : null),
  });
  const routeSearch = useDiffRouteSearch();
  const routeSplitViewId = routeSearch.splitViewId ?? null;

  const addProjectFlow = useAddProjectFlow();
  const searchHost = useAppChromeSearchHost({ sidebarThreads, sidebarThreadSummaryById });
  const projectActions = useProjectContextMenuActions({
    sidebarThreads,
    routeThreadId,
    routeSplitViewId,
  });
  const threadActions = useThreadContextMenuActions({
    sidebarThreads,
    sidebarThreadSummaryById,
    routeThreadId,
    routeSplitViewId,
  });

  const value = useMemo<AppChromeContextValue>(() => {
    const menuProject = projectActions.projectContextMenuProject;
    const renameProject = projectActions.renameProjectDialogId
      ? (projects.find((project) => project.id === projectActions.renameProjectDialogId) ?? null)
      : null;

    return {
      addProjectFromPath: addProjectFlow.addProjectFromPath,
      searchPaletteProjects: searchHost.searchPaletteProjects,
      searchPaletteProjectById: searchHost.searchPaletteProjectById,
      homeDir: searchHost.homeDir,
      keybindings: searchHost.keybindings,
      onCreateChat: searchHost.onCreateChat,
      onCreateThread: searchHost.onCreateThread,
      onOpenSettings: searchHost.onOpenSettings,
      onOpenUsageSettings: searchHost.onOpenUsageSettings,
      onOpenProject: searchHost.onOpenProject,
      onOpenThread: searchHost.onOpenThread,
      onImportThread: searchHost.onImportThread,
      onNavigateAutomations: searchHost.onNavigateAutomations,
      onNavigatePlugins: searchHost.onNavigatePlugins,
      onNavigateArchivedThreads: searchHost.onNavigateArchivedThreads,
      onNavigateWorktrees: searchHost.onNavigateWorktrees,
      projectContextMenuState: projectActions.projectContextMenuState,
      setProjectContextMenuState: projectActions.setProjectContextMenuState,
      projectContextMenuProject: toRenameProject(menuProject),
      projectContextMenuIsPinned: projectActions.projectContextMenuIsPinned,
      projectContextMenuIsRunning: projectActions.projectContextMenuIsRunning,
      projectContextMenuHasOpenServer: projectActions.projectContextMenuHasOpenServer,
      projectContextMenuHasAnyThreads: projectActions.projectContextMenuHasAnyThreads,
      projectContextMenuHasArchivableThreads: projectActions.projectContextMenuHasArchivableThreads,
      onProjectContextMenuAction: (projectId, action) => {
        void projectActions.handleProjectContextMenuAction(projectId, action);
      },
      showNativeProjectContextMenu: projectActions.showNativeProjectContextMenu,
      projectRunDialogProjectId: projectActions.projectRunDialogProjectId,
      setProjectRunDialogProjectId: projectActions.setProjectRunDialogProjectId,
      projectRunDialogProject: projectActions.projectRunDialogProject
        ? { id: projectActions.projectRunDialogProject.id, name: projectActions.projectRunDialogProject.name }
        : null,
      projectRunDialogCommandDraft: projectActions.projectRunDialogCommandDraft,
      setProjectRunDialogCommandDraft: projectActions.setProjectRunDialogCommandDraft,
      projectRunDialogCommandIsValid: projectActions.projectRunDialogCommandIsValid,
      projectRunDialogExistingRun: projectActions.projectRunDialogExistingRun,
      closeProjectRunDialog: projectActions.closeProjectRunDialog,
      confirmProjectRun: () => {
        void projectActions.handleConfirmProjectRun();
      },
      renameDialogThreadId: threadActions.renameDialogThreadId,
      setRenameDialogThreadId: threadActions.setRenameDialogThreadId,
      renameDialogThreadTitle:
        threadActions.renameDialogThreadId !== null
          ? (sidebarThreadSummaryById[threadActions.renameDialogThreadId]?.title ?? "")
          : "",
      onRenameThreadSave: (newTitle) => {
        if (threadActions.renameDialogThreadId === null) return;
        const target = sidebarThreadSummaryById[threadActions.renameDialogThreadId];
        if (!target) return;
        searchHost.onRenameThreadSave(target.id, newTitle, target.title);
        threadActions.setRenameDialogThreadId(null);
      },
      renameProjectDialogId: projectActions.renameProjectDialogId,
      setRenameProjectDialogId: projectActions.setRenameProjectDialogId,
      renameProjectDialogProject: toRenameProject(renameProject),
      onRenameProjectSave: (nextName) => {
        if (!renameProject) return;
        projectActions.handleRenameProjectSave(renameProject.id, nextName, renameProject.localName);
      },
      showThreadContextMenu: threadActions.showThreadContextMenu,
      confirmAndArchiveThread: threadActions.confirmAndArchiveThread,
      confirmAndRemoveProject: projectActions.confirmAndRemoveProject,
      openAddProjectDialog: addProjectFlow.openAddProjectDialog,
    };
  }, [
    addProjectFlow.addProjectFromPath,
    addProjectFlow.openAddProjectDialog,
    projectActions,
    projects,
    searchHost,
    sidebarThreadSummaryById,
    threadActions,
  ]);

  return <AppChromeContext.Provider value={value}>{children}</AppChromeContext.Provider>;
}
