// FILE: AppChromeSearchPaletteHost.tsx
// Purpose: Wires SidebarSearchPalette to app chrome store, search actions, and thread data.
// Layer: UI component

import { ProjectId, ThreadId, type ResolvedKeybindingsConfig } from "@t3tools/contracts";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import { useAppSettings } from "~/appSettings";
import { useAppChromeStore } from "~/appChromeStore";
import { useAppChrome } from "~/appChromeContext";
import {
  SidebarSearchPalette,
  type ImportProviderKind,
  type SidebarSearchPaletteMode,
} from "~/components/SidebarSearchPalette";
import type { SidebarSearchThread } from "~/components/SidebarSearchPalette.logic";
import { isHomeChatContainerProject } from "~/lib/chatProjects";
import { buildAppChromeSearchActions } from "~/lib/appChromeSearchActions";
import {
  providerComposerCapabilitiesQueryOptions,
  supportsThreadImport,
} from "~/lib/providerDiscoveryReactQuery";
import { usePinnedProjectsStore } from "~/pinnedProjectsStore";
import { usePinnedThreadsStore } from "~/pinnedThreadsStore";
import { useStore } from "~/store";
import {
  createAllThreadsSelector,
  createSidebarDisplayThreadsSelector,
} from "~/storeSelectors";
import { useWorkspaceStore } from "~/workspaceStore";

export function AppChromeSearchPaletteHost() {
  const searchPaletteOpen = useAppChromeStore((state) => state.searchPaletteOpen);
  const searchPaletteMode = useAppChromeStore((state) => state.searchPaletteMode);
  const searchPaletteInitialQuery = useAppChromeStore((state) => state.searchPaletteInitialQuery);
  const searchPaletteProjectFilterId = useAppChromeStore(
    (state) => state.searchPaletteProjectFilterId,
  );
  const setSearchPaletteOpen = useAppChromeStore((state) => state.setSearchPaletteOpen);
  const setSearchPaletteMode = useAppChromeStore((state) => state.setSearchPaletteMode);
  const setSearchPaletteInitialQuery = useAppChromeStore((state) => state.setSearchPaletteInitialQuery);
  const setSearchPaletteProjectFilterId = useAppChromeStore(
    (state) => state.setSearchPaletteProjectFilterId,
  );
  const pinnedThreadIds = usePinnedThreadsStore((state) => state.pinnedThreadIds);
  const pinnedProjectIds = usePinnedProjectsStore((state) => state.pinnedProjectIds);
  const { settings: appSettings } = useAppSettings();
  const projects = useStore((state) => state.projects);
  const homeDir = useWorkspaceStore((state) => state.homeDir);
  const chatWorkspaceRoot = useWorkspaceStore((state) => state.chatWorkspaceRoot);
  const {
    searchPaletteProjects,
    searchPaletteProjectById,
    onCreateChat,
    onCreateThread,
    onOpenSettings,
    onOpenUsageSettings,
    onOpenProject,
    onOpenThread,
    onImportThread,
    addProjectFromPath,
    onNavigateAutomations,
    onNavigatePlugins,
    onNavigateArchivedThreads,
    onNavigateWorktrees,
    keybindings,
  } = useAppChrome();

  const selectAllThreads = useMemo(() => createAllThreadsSelector(), []);
  const selectSidebarDisplayThreads = useMemo(() => createSidebarDisplayThreadsSelector(), []);
  const importProviderCapabilityQueries = useQueries({
    queries: (["codex", "claudeAgent", "cursor", "kilo", "opencode"] as const).map((provider) =>
      providerComposerCapabilitiesQueryOptions(provider),
    ),
  });
  const threads = useStore(selectAllThreads);
  const sidebarDisplayThreads = useStore(selectSidebarDisplayThreads);
  const importProviders: ReadonlyArray<ImportProviderKind> = (
    ["codex", "claudeAgent", "cursor", "kilo", "opencode"] as const
  ).filter((provider, index) => supportsThreadImport(importProviderCapabilityQueries[index]?.data));
  const searchPaletteThreads = useMemo<SidebarSearchThread[]>(() => {
    const threadById = new Map(threads.map((thread) => [thread.id, thread] as const));
    return sidebarDisplayThreads.flatMap((threadSummary) => {
      const thread = threadById.get(threadSummary.id);
      if (!thread) {
        return [];
      }

      return [
        {
          id: thread.id,
          title: thread.title,
          projectId: thread.projectId,
          projectName: searchPaletteProjectById.get(thread.projectId)?.name ?? "Unknown project",
          projectRemoteName:
            searchPaletteProjectById.get(thread.projectId)?.remoteName ?? "Unknown project",
          provider: thread.modelSelection.provider,
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
          messages: thread.messages.map((message) => ({
            text: message.text,
          })),
        },
      ];
    });
  }, [searchPaletteProjectById, sidebarDisplayThreads, threads]);

  const paletteThreads = useMemo(() => {
    if (!searchPaletteProjectFilterId) {
      return searchPaletteThreads;
    }
    return searchPaletteThreads.filter(
      (thread) => thread.projectId === searchPaletteProjectFilterId,
    );
  }, [searchPaletteProjectFilterId, searchPaletteThreads]);

  const browsePinnedThreads = useMemo(() => {
    const pinnedIdSet = new Set<ThreadId>(pinnedThreadIds);
    return paletteThreads.filter((thread) => pinnedIdSet.has(ThreadId.makeUnsafe(thread.id)));
  }, [paletteThreads, pinnedThreadIds]);

  const browsePinnedProjects = useMemo(() => {
    const pinnedIdSet = new Set<ProjectId>(pinnedProjectIds);
    return searchPaletteProjects.filter((project) =>
      pinnedIdSet.has(ProjectId.makeUnsafe(project.id)),
    );
  }, [pinnedProjectIds, searchPaletteProjects]);

  const homeChatProjectId = useMemo(() => {
    const workspacePaths = { homeDir, chatWorkspaceRoot };
    return (
      projects.find((project) => isHomeChatContainerProject(project, workspacePaths))?.id ?? null
    );
  }, [chatWorkspaceRoot, homeDir, projects]);

  const browseHomeChatThreads = useMemo(() => {
    if (!appSettings.showChatsSection || !homeChatProjectId) {
      return [];
    }
    return paletteThreads.filter((thread) => thread.projectId === homeChatProjectId);
  }, [appSettings.showChatsSection, homeChatProjectId, paletteThreads]);

  const actions = useMemo(
    () => buildAppChromeSearchActions({ keybindings: keybindings as ResolvedKeybindingsConfig }),
    [keybindings],
  );

  if (!searchPaletteOpen) {
    return null;
  }

  return (
    <SidebarSearchPalette
      open={searchPaletteOpen}
      mode={searchPaletteMode as SidebarSearchPaletteMode}
      onModeChange={setSearchPaletteMode}
      onOpenChange={(open) => {
        setSearchPaletteOpen(open);
        if (!open) {
          setSearchPaletteMode("search");
          setSearchPaletteInitialQuery(null);
          setSearchPaletteProjectFilterId(null);
        }
      }}
      actions={actions}
      projects={searchPaletteProjects}
      threads={paletteThreads}
      browsePinnedThreads={browsePinnedThreads}
      browsePinnedProjects={browsePinnedProjects}
      browseHomeChatThreads={browseHomeChatThreads}
      onCreateChat={onCreateChat}
      onCreateThread={onCreateThread}
      onAddProjectPath={addProjectFromPath}
      homeDir={homeDir}
      initialBrowseQuery={searchPaletteInitialQuery}
      onOpenSettings={onOpenSettings}
      onOpenUsageSettings={onOpenUsageSettings}
      onOpenProject={onOpenProject}
      importProviders={importProviders}
      onImportThread={onImportThread}
      onOpenThread={(threadId) => {
        onOpenThread(threadId);
      }}
      onNavigateAutomations={onNavigateAutomations}
      onNavigatePlugins={onNavigatePlugins}
      onNavigateArchivedThreads={onNavigateArchivedThreads}
      onNavigateWorktrees={onNavigateWorktrees}
    />
  );
}
