// FILE: useAppChromeSearchHost.ts
// Purpose: Search palette navigation callbacks (threads, projects, import, settings routes).
// Layer: Hook

import {
  ProjectId,
  ThreadId,
  type ResolvedKeybindingsConfig,
} from "@t3tools/contracts";
import { getDefaultModel } from "@t3tools/shared/model";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

import { useAppSettings } from "~/appSettings";
import {
  resolveSidebarNewThreadEnvMode,
  sortThreadsForSidebar,
} from "~/components/Sidebar.logic";
import type { ImportProviderKind } from "~/components/SidebarSearchPalette";
import type { SidebarSearchProject } from "~/components/SidebarSearchPalette.logic";
import { useFocusedChatContext } from "~/focusedChatContext";
import { useHandleNewChat } from "~/hooks/useHandleNewChat";
import { useHandleNewThread } from "~/hooks/useHandleNewThread";
import {
  resolveCurrentProjectTargetId,
} from "~/lib/projectShortcutTargets";
import { serverConfigQueryOptions } from "~/lib/serverReactQuery";
import { dispatchThreadRename } from "~/lib/threadRename";
import { newCommandId, newThreadId } from "~/lib/utils";
import { readNativeApi } from "~/nativeApi";
import { useStore } from "~/store";
import { useWorkspaceStore } from "~/workspaceStore";
import type { SidebarThreadSummary } from "~/types";

const EMPTY_KEYBINDINGS: ResolvedKeybindingsConfig = [];

export function useAppChromeSearchHost(input: {
  sidebarThreads: readonly SidebarThreadSummary[];
  sidebarThreadSummaryById: Readonly<Record<string, SidebarThreadSummary | undefined>>;
}) {
  const navigate = useNavigate();
  const { settings: appSettings } = useAppSettings();
  const { handleNewChat } = useHandleNewChat();
  const { handleNewThread } = useHandleNewThread();
  const projects = useStore((state) => state.projects);
  const homeDir = useWorkspaceStore((state) => state.homeDir);
  const { activeProjectId: focusedProjectId } = useFocusedChatContext();
  const { data: keybindings = EMPTY_KEYBINDINGS } = useQuery({
    ...serverConfigQueryOptions(),
    select: (config) => config.keybindings,
  });

  const searchPaletteProjects = useMemo<readonly SidebarSearchProject[]>(
    () =>
      projects.map((project) => ({
        id: project.id,
        name: project.name,
        remoteName: project.remoteName,
        folderName: project.folderName,
        localName: project.localName,
        cwd: project.cwd,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })),
    [projects],
  );

  const searchPaletteProjectById = useMemo(
    () =>
      new Map(
        projects.map(
          (project) => [project.id, { name: project.name, remoteName: project.remoteName }] as const,
        ),
      ),
    [projects],
  );

  const currentProjectShortcutTargetId = useMemo(
    () => resolveCurrentProjectTargetId(projects, focusedProjectId),
    [focusedProjectId, projects],
  );

  const focusMostRecentThreadForProject = useCallback(
    (projectId: ProjectId) => {
      const latestThread = sortThreadsForSidebar(
        input.sidebarThreads.filter((thread) => thread.projectId === projectId),
        appSettings.sidebarThreadSortOrder,
      )[0];
      if (!latestThread) return;
      void navigate({ to: "/$threadId", params: { threadId: latestThread.id } });
    },
    [appSettings.sidebarThreadSortOrder, input.sidebarThreads, navigate],
  );

  const onCreateChat = useCallback(() => {
    void handleNewChat({ fresh: true });
  }, [handleNewChat]);

  const onCreateThread = useCallback(() => {
    const projectId = currentProjectShortcutTargetId ?? projects[0]?.id;
    if (!projectId) return;
    void handleNewThread(projectId, {
      envMode: resolveSidebarNewThreadEnvMode({
        defaultEnvMode: appSettings.defaultThreadEnvMode,
      }),
    });
  }, [
    appSettings.defaultThreadEnvMode,
    currentProjectShortcutTargetId,
    handleNewThread,
    projects,
  ]);

  const onOpenSettings = useCallback(() => {
    void navigate({ to: "/settings" });
  }, [navigate]);

  const onOpenUsageSettings = useCallback(() => {
    void navigate({ to: "/settings", search: { section: "usage" } });
  }, [navigate]);

  const onOpenProject = useCallback(
    (projectId: string) => {
      const typedProjectId = ProjectId.makeUnsafe(projectId);
      const hasProjectThread = input.sidebarThreads.some(
        (thread) => thread.projectId === typedProjectId,
      );
      if (hasProjectThread) {
        focusMostRecentThreadForProject(typedProjectId);
        return;
      }
      void handleNewThread(typedProjectId, {
        envMode: resolveSidebarNewThreadEnvMode({
          defaultEnvMode: appSettings.defaultThreadEnvMode,
        }),
      });
    },
    [
      appSettings.defaultThreadEnvMode,
      focusMostRecentThreadForProject,
      handleNewThread,
      input.sidebarThreads,
    ],
  );

  const onOpenThread = useCallback(
    (threadId: string) => {
      void navigate({ to: "/$threadId", params: { threadId: ThreadId.makeUnsafe(threadId) } });
    },
    [navigate],
  );

  const onImportThread = useCallback(
    async (provider: ImportProviderKind, externalId: string) => {
      const api = readNativeApi();
      if (!api) {
        throw new Error("The app server is unavailable.");
      }
      if (!currentProjectShortcutTargetId) {
        throw new Error("Add a project before importing a thread.");
      }
      const activeProject = projects.find((project) => project.id === currentProjectShortcutTargetId);
      if (!activeProject) {
        throw new Error("The target project could not be resolved.");
      }
      const providerDefaultModel = getDefaultModel(provider);
      const modelSelection =
        activeProject.defaultModelSelection?.provider === provider
          ? activeProject.defaultModelSelection
          : providerDefaultModel
            ? { provider, model: providerDefaultModel }
            : null;
      if (!modelSelection) {
        throw new Error("Select a model before importing a thread.");
      }
      const threadId = newThreadId();
      const trimmedExternalId = externalId.trim();
      const suffix = trimmedExternalId.slice(-8);
      await api.orchestration.dispatchCommand({
        type: "thread.create",
        commandId: newCommandId(),
        threadId,
        projectId: activeProject.id,
        title: `Imported ${provider} session${suffix ? ` ${suffix}` : ""}`,
        modelSelection,
        runtimeMode: "full-access",
        interactionMode: "default",
        envMode: resolveSidebarNewThreadEnvMode({
          defaultEnvMode: appSettings.defaultThreadEnvMode,
        }),
        branch: null,
        worktreePath: null,
        workspaceContexts: [],
        activeWorkspaceContextId: null,
        createdAt: new Date().toISOString(),
      });
      await api.orchestration.importThread({ threadId, externalId: trimmedExternalId });
      await navigate({ to: "/$threadId", params: { threadId } });
    },
    [
      appSettings.defaultThreadEnvMode,
      currentProjectShortcutTargetId,
      navigate,
      projects,
    ],
  );

  const onNavigateAutomations = useCallback(() => {
    void navigate({ to: "/automations" });
  }, [navigate]);

  const onNavigatePlugins = useCallback(() => {
    void navigate({ to: "/plugins" });
  }, [navigate]);

  const onNavigateArchivedThreads = useCallback(() => {
    void navigate({ to: "/settings", search: { section: "archived" } });
  }, [navigate]);

  const onNavigateWorktrees = useCallback(() => {
    void navigate({ to: "/settings", search: { section: "worktrees" } });
  }, [navigate]);

  const onRenameThreadSave = useCallback(
    (threadId: ThreadId, newTitle: string, currentTitle: string) => {
      void dispatchThreadRename({
        threadId,
        newTitle,
        unchangedTitles: [currentTitle],
      });
    },
    [],
  );

  return {
    searchPaletteProjects,
    searchPaletteProjectById,
    homeDir,
    keybindings,
    onCreateChat,
    onCreateThread,
    onOpenSettings,
    onOpenUsageSettings,
    onOpenProject,
    onOpenThread,
    onImportThread,
    onNavigateAutomations,
    onNavigatePlugins,
    onNavigateArchivedThreads,
    onNavigateWorktrees,
    onRenameThreadSave,
  };
}
