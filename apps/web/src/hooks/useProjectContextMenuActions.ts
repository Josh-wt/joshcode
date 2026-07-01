// FILE: useProjectContextMenuActions.ts
// Purpose: Project row context menu actions (native + React menu handlers, dev server run).
// Layer: Hook

import {
  type ContextMenuItem,
  type ProjectId,
  type ServerLocalServerProcess,
  type ThreadId,
} from "@t3tools/contracts";
import { localServerAddressLabel, localServerMatchesRun } from "@t3tools/shared/localServers";
import { pluralize } from "@t3tools/shared/text";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { showConfirmDialogFallback } from "~/confirmDialogFallback";
import { useAppSettings } from "~/appSettings";
import {
  findDeepestWorkspaceRootMatch,
  getFallbackThreadIdAfterDelete,
  resolveSidebarNewThreadEnvMode,
} from "~/components/Sidebar.logic";
import { terminalRuntimeRegistry } from "~/components/terminal/terminalRuntimeRegistry";
import { useComposerDraftStore } from "~/composerDraftStore";
import { useCopyPathToClipboard } from "~/hooks/useCopyToClipboard";
import { useHandleNewChat } from "~/hooks/useHandleNewChat";
import { useHandleNewThread } from "~/hooks/useHandleNewThread";
import { gitRemoveWorktreeMutationOptions } from "~/lib/gitReactQuery";
import { useProjectRemoval } from "~/hooks/useProjectRemoval";
import { newCommandId } from "~/lib/utils";
import { readNativeApi } from "~/nativeApi";
import { useProjectRunStore, type ProjectRunState } from "~/projectRunStore";
import { selectPrimaryProjectRunCommand, upsertProjectRunCommandScripts } from "~/projectRunTargets";
import { projectScriptRuntimeEnv } from "~/projectScripts";
import {
  LOCAL_SERVERS_BACKGROUND_REFETCH_INTERVAL_MS,
  LOCAL_SERVERS_VISIBLE_REFETCH_INTERVAL_MS,
  serverLocalServersQueryOptions,
  serverQueryKeys,
} from "~/lib/serverReactQuery";
import { usePinnedProjectsStore } from "~/pinnedProjectsStore";
import { usePinnedThreadsStore } from "~/pinnedThreadsStore";
import { useSplitViewStore, resolveSplitViewPaneIdForThread, resolveSplitViewFocusedThreadId, selectSplitView } from "~/splitViewStore";
import { useStore } from "~/store";
import { getThreadFromState, getThreadsFromState } from "~/threadDerivation";
import { useTerminalStateStore } from "~/terminalStateStore";
import { useTemporaryThreadStore } from "~/temporaryThreadStore";
import { useThreadSelectionStore } from "~/threadSelectionStore";
import { toastManager } from "~/components/ui/toast";
import { formatWorktreePathForDisplay, getOrphanedWorktreePathForThread } from "~/worktreeCleanup";
import type { SidebarThreadSummary } from "~/types";

export type ProjectContextMenuId =
  | "open-in-finder"
  | "open-in-kanban"
  | "copy-path"
  | "new-terminal-thread"
  | "new-temporary-thread"
  | "start-dev"
  | "stop-dev"
  | "open-dev-server"
  | "rename"
  | "toggle-pin"
  | "archive-threads"
  | "delete-threads"
  | "delete";

export type ProjectContextMenuState = {
  projectId: ProjectId;
  position: { x: number; y: number };
};

export function buildNativeProjectContextMenuItems(input: {
  isPinned: boolean;
  isRunning: boolean;
  hasOpenServer: boolean;
  hasArchivableThreads: boolean;
  hasAnyThreads: boolean;
}): ContextMenuItem<ProjectContextMenuId>[] {
  const items: ContextMenuItem<ProjectContextMenuId>[] = [
    { id: "open-in-finder", label: "Open in Finder" },
    { id: "open-in-kanban", label: "Open in Kanban" },
    { id: "copy-path", label: "Copy Path", separatorBefore: false },
  ];

  items.push(
    { id: "new-terminal-thread", label: "New terminal thread", separatorBefore: true },
    { id: "new-temporary-thread", label: "New temporary chat" },
  );

  items.push({ id: input.isRunning ? "stop-dev" : "start-dev", label: input.isRunning ? "Stop dev" : "Start dev", separatorBefore: true });

  if (input.hasOpenServer) {
    items.push({ id: "open-dev-server", label: "Open dev server" });
  }

  items.push(
    { id: "rename", label: "Edit name", separatorBefore: true },
    {
      id: "toggle-pin",
      label: input.isPinned ? "Unpin project" : "Pin project",
    },
  );

  if (input.hasArchivableThreads) {
    items.push({ id: "archive-threads", label: "Archive threads", separatorBefore: true });
  }
  if (input.hasAnyThreads) {
    items.push({ id: "delete-threads", label: "Delete threads" });
  }

  items.push({ id: "delete", label: "Remove", separatorBefore: true, destructive: true });
  return items;
}

function firstLocalServerUrl(server: ServerLocalServerProcess): string | null {
  return server.addresses.find((address) => address.url)?.url ?? null;
}

function findTrackedProjectRunServer(
  run: ProjectRunState | null | undefined,
  servers: readonly ServerLocalServerProcess[],
): ServerLocalServerProcess | null {
  if (!run) {
    return null;
  }
  return servers.find((server) => localServerMatchesRun(server, run)) ?? null;
}

export function useProjectContextMenuActions(input: {
  sidebarThreads: readonly SidebarThreadSummary[];
  routeThreadId: ThreadId | null;
  routeSplitViewId?: string | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { settings: appSettings } = useAppSettings();
  const { handleNewChat } = useHandleNewChat();
  const { handleNewThread } = useHandleNewThread();
  const copyPathToClipboard = useCopyPathToClipboard();
  const projects = useStore((state) => state.projects);
  const renameProjectLocally = useStore((state) => state.renameProjectLocally);
  const clearProjectDraftThreads = useComposerDraftStore((store) => store.clearProjectDraftThreads);
  const clearComposerDraftForThread = useComposerDraftStore((store) => store.clearDraftThread);
  const clearProjectDraftThreadById = useComposerDraftStore((store) => store.clearProjectDraftThreadById);
  const clearTerminalState = useTerminalStateStore((state) => state.clearTerminalState);
  const removeThreadFromSplitViews = useSplitViewStore((store) => store.removeThreadFromSplitViews);
  const clearTemporaryThread = useTemporaryThreadStore((store) => store.clearTemporaryThread);
  const removeFromSelection = useThreadSelectionStore((store) => store.removeFromSelection);
  const pinProjectLocally = usePinnedProjectsStore((store) => store.pinProject);
  const unpinProject = usePinnedProjectsStore((store) => store.unpinProject);
  const pinnedProjectIds = usePinnedProjectsStore((store) => store.pinnedProjectIds);
  const unpinThread = usePinnedThreadsStore((store) => store.unpinThread);
  const projectRunsByProjectId = useProjectRunStore((state) => state.runsByProjectId);
  const storeUpsertProjectRun = useProjectRunStore((state) => state.upsertRun);
  const storeRemoveProjectRun = useProjectRunStore((state) => state.removeRun);
  const removeWorktreeMutation = useMutation(gitRemoveWorktreeMutationOptions({ queryClient }));

  const [projectContextMenuState, setProjectContextMenuState] = useState<ProjectContextMenuState | null>(null);
  const [projectRunDialogProjectId, setProjectRunDialogProjectId] = useState<ProjectId | null>(null);
  const [projectRunDialogCommandDraft, setProjectRunDialogCommandDraft] = useState("");
  const [renameProjectDialogId, setRenameProjectDialogId] = useState<ProjectId | null>(null);

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project] as const)),
    [projects],
  );
  const projectRunCommandByProjectIdRef = useRef<
    Map<ProjectId, ReturnType<typeof selectPrimaryProjectRunCommand>>
  >(new Map());
  const projectRunServerByProjectIdRef = useRef<Map<ProjectId, ServerLocalServerProcess>>(new Map());

  const projectRunCommandByProjectId = useMemo(() => {
    const commandByProjectId = new Map<
      ProjectId,
      ReturnType<typeof selectPrimaryProjectRunCommand>
    >();
    for (const project of projects) {
      if (project.kind !== "project") continue;
      commandByProjectId.set(
        project.id,
        selectPrimaryProjectRunCommand({
          project,
          discoveredTargets: [],
        }),
      );
    }
    return commandByProjectId;
  }, [projects]);
  projectRunCommandByProjectIdRef.current = projectRunCommandByProjectId;

  const hasActiveProjectRun = useMemo(
    () => Object.keys(projectRunsByProjectId).length > 0,
    [projectRunsByProjectId],
  );
  const localServersRefetchInterval = hasActiveProjectRun
    ? LOCAL_SERVERS_VISIBLE_REFETCH_INTERVAL_MS
    : LOCAL_SERVERS_BACKGROUND_REFETCH_INTERVAL_MS;
  const projectRunLocalServersQuery = useQuery(
    serverLocalServersQueryOptions({
      enabled: projects.length > 0 || hasActiveProjectRun,
      refetchInterval: localServersRefetchInterval,
    }),
  );

  const projectRunServerByProjectId = useMemo(() => {
    const servers = projectRunLocalServersQuery.data?.servers ?? [];
    const serverByProjectId = new Map<ProjectId, ServerLocalServerProcess>();
    for (const run of Object.values(projectRunsByProjectId)) {
      const server = findTrackedProjectRunServer(run, servers);
      if (server) {
        serverByProjectId.set(run.projectId, server);
      }
    }
    for (const server of servers) {
      if (!server.cwd) {
        continue;
      }
      const project = findDeepestWorkspaceRootMatch(
        projects.filter((candidate) => candidate.kind === "project"),
        server.cwd,
        (candidate) => candidate.cwd,
      );
      if (project && !serverByProjectId.has(project.id)) {
        serverByProjectId.set(project.id, server);
      }
    }
    return serverByProjectId;
  }, [projectRunLocalServersQuery.data?.servers, projectRunsByProjectId, projects]);
  projectRunServerByProjectIdRef.current = projectRunServerByProjectId;

  useEffect(() => {
    if (projectRunDialogProjectId === null) {
      return;
    }
    const defaultCommand =
      projectRunCommandByProjectIdRef.current.get(projectRunDialogProjectId)?.command ?? "";
    setProjectRunDialogCommandDraft(defaultCommand);
  }, [projectRunDialogProjectId]);

  const activeSplitView = useSplitViewStore(selectSplitView(input.routeSplitViewId ?? null));

  const deleteThread = useCallback(
    async (
      threadId: ThreadId,
      opts: {
        deletedThreadIds?: ReadonlySet<ThreadId>;
        worktreeCleanupMode?: "prompt" | "skip";
      } = {},
    ): Promise<void> => {
      const api = readNativeApi();
      if (!api) return;
      const state = useStore.getState();
      const thread = getThreadFromState(state, threadId);
      if (!thread) return;
      const threadProject = projectById.get(thread.projectId);
      const allThreads = getThreadsFromState(state);
      const deletedIds = opts.deletedThreadIds;
      const survivingThreads =
        deletedIds && deletedIds.size > 0
          ? allThreads.filter((entry) => entry.id === threadId || !deletedIds.has(entry.id))
          : allThreads;
      const orphanedWorktreePath = getOrphanedWorktreePathForThread(survivingThreads, threadId);
      const displayWorktreePath = orphanedWorktreePath
        ? formatWorktreePathForDisplay(orphanedWorktreePath)
        : null;
      const canDeleteWorktree = orphanedWorktreePath !== null && threadProject !== undefined;
      const worktreeCleanupMode = opts.worktreeCleanupMode ?? "prompt";
      const shouldDeleteWorktree =
        worktreeCleanupMode === "prompt" &&
        canDeleteWorktree &&
        (await api.dialogs.confirm(
          [
            "This thread is the only one linked to this worktree:",
            displayWorktreePath ?? orphanedWorktreePath,
            "",
            "Delete the worktree too?",
          ].join("\n"),
        ));

      if (thread.session && thread.session.status !== "closed") {
        await api.orchestration
          .dispatchCommand({
            type: "thread.session.stop",
            commandId: newCommandId(),
            threadId,
            createdAt: new Date().toISOString(),
          })
          .catch(() => undefined);
      }

      try {
        terminalRuntimeRegistry.disposeThread(threadId);
        await api.terminal.close({ threadId, deleteHistory: true });
      } catch {
        // Terminal may already be closed.
      }

      const allDeletedIds = deletedIds ?? new Set<ThreadId>();
      const shouldNavigateToFallback = input.routeThreadId === threadId;
      const fallbackThreadId = getFallbackThreadIdAfterDelete({
        threads: input.sidebarThreads,
        deletedThreadId: threadId,
        deletedThreadIds: allDeletedIds,
        sortOrder: appSettings.sidebarThreadSortOrder,
      });
      const activeSplitViewId = input.routeSplitViewId ?? null;
      const deletedPaneInActiveSplit = activeSplitView
        ? resolveSplitViewPaneIdForThread(activeSplitView, threadId)
        : null;

      await api.orchestration.dispatchCommand({
        type: "thread.delete",
        commandId: newCommandId(),
        threadId,
      });
      unpinThread(threadId);
      clearComposerDraftForThread(threadId);
      clearProjectDraftThreadById(thread.projectId, thread.id);
      clearTerminalState(threadId);
      removeThreadFromSplitViews(threadId);
      clearTemporaryThread(threadId);

      if (activeSplitViewId && deletedPaneInActiveSplit) {
        const nextActiveSplitView =
          useSplitViewStore.getState().splitViewsById[activeSplitViewId] ?? null;
        const nextFocusedThreadId = nextActiveSplitView
          ? resolveSplitViewFocusedThreadId(nextActiveSplitView)
          : null;
        if (nextActiveSplitView && nextFocusedThreadId) {
          void navigate({
            to: "/$threadId",
            params: { threadId: nextFocusedThreadId },
            replace: true,
            search: () => ({ splitViewId: nextActiveSplitView.id }),
          });
        } else if (shouldNavigateToFallback && fallbackThreadId) {
          void navigate({
            to: "/$threadId",
            params: { threadId: fallbackThreadId },
            replace: true,
          });
        } else if (shouldNavigateToFallback) {
          void handleNewChat({ fresh: true });
        }
      } else if (shouldNavigateToFallback) {
        if (fallbackThreadId) {
          void navigate({
            to: "/$threadId",
            params: { threadId: fallbackThreadId },
            replace: true,
          });
        } else {
          void handleNewChat({ fresh: true });
        }
      }

      if (!shouldDeleteWorktree || !orphanedWorktreePath || !threadProject) {
        return;
      }

      try {
        await removeWorktreeMutation.mutateAsync({
          cwd: threadProject.cwd,
          path: orphanedWorktreePath,
          force: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error removing worktree.";
        toastManager.add({
          type: "error",
          title: "Thread deleted, but worktree removal failed",
          description: `Could not remove ${displayWorktreePath ?? orphanedWorktreePath}. ${message}`,
        });
      }
    },
    [
      activeSplitView,
      appSettings.sidebarThreadSortOrder,
      clearComposerDraftForThread,
      clearProjectDraftThreadById,
      clearTemporaryThread,
      clearTerminalState,
      handleNewChat,
      input.routeSplitViewId,
      input.routeThreadId,
      input.sidebarThreads,
      navigate,
      projectById,
      removeThreadFromSplitViews,
      removeWorktreeMutation,
      unpinThread,
    ],
  );

  const archiveThread = useCallback(
    async (threadId: ThreadId): Promise<void> => {
      const api = readNativeApi();
      if (!api) return;
      const thread = getThreadFromState(useStore.getState(), threadId);
      if (!thread) return;

      if (thread.session?.status === "running" && thread.session.activeTurnId != null) {
        toastManager.add({
          type: "error",
          title: "Cannot archive",
          description: "Stop the running session before archiving this thread.",
        });
        return;
      }

      await api.orchestration.dispatchCommand({
        type: "thread.archive",
        commandId: newCommandId(),
        threadId,
      });

      if (input.routeThreadId === threadId) {
        const fallbackThreadId = getFallbackThreadIdAfterDelete({
          threads: input.sidebarThreads,
          deletedThreadId: threadId,
          deletedThreadIds: new Set<ThreadId>(),
          sortOrder: appSettings.sidebarThreadSortOrder,
        });
        if (fallbackThreadId) {
          void navigate({
            to: "/$threadId",
            params: { threadId: fallbackThreadId },
            replace: true,
          });
        } else {
          void handleNewChat({ fresh: true });
        }
      }
    },
    [
      appSettings.sidebarThreadSortOrder,
      handleNewChat,
      input.routeThreadId,
      input.sidebarThreads,
      navigate,
    ],
  );

  const archiveAllThreadsInProject = useCallback(
    async (projectId: ProjectId): Promise<void> => {
      const api = readNativeApi();
      if (!api) return;
      const project = projectById.get(projectId);
      if (!project) return;

      const projectThreads = input.sidebarThreads.filter(
        (thread) => thread.projectId === projectId && thread.archivedAt == null,
      );
      if (projectThreads.length === 0) {
        toastManager.add({
          type: "info",
          title: "Nothing to archive",
          description: `"${project.name}" has no threads to archive.`,
        });
        return;
      }

      const archivableThreads = projectThreads.filter(
        (thread) => !(thread.session?.status === "running" && thread.session.activeTurnId != null),
      );
      const runningCount = projectThreads.length - archivableThreads.length;

      if (archivableThreads.length === 0) {
        toastManager.add({
          type: "error",
          title: "Cannot archive threads",
          description:
            runningCount === 1
              ? "The only thread in this project is running. Stop it before archiving."
              : `All ${runningCount} threads in this project are running. Stop them before archiving.`,
        });
        return;
      }

      const archiveLines = [
        `Archive ${archivableThreads.length} ${pluralize(archivableThreads.length, "thread")} in "${project.name}"?`,
        "Archived threads are hidden from the sidebar but can be restored later.",
      ];
      if (runningCount > 0) {
        archiveLines.push(
          "",
          `${runningCount} running ${pluralize(runningCount, "thread is", "threads are")} currently active and will be skipped.`,
        );
      }
      const archiveConfirmed = api
        ? await api.dialogs.confirm(archiveLines.join("\n"))
        : await showConfirmDialogFallback(archiveLines.join("\n"));
      if (!archiveConfirmed) return;

      let archivedCount = 0;
      let failureCount = 0;
      for (const thread of archivableThreads) {
        try {
          await archiveThread(thread.id);
          archivedCount += 1;
        } catch {
          failureCount += 1;
        }
      }

      removeFromSelection(archivableThreads.map((thread) => thread.id));

      if (archivedCount > 0) {
        const skippedDescription =
          runningCount > 0
            ? ` Skipped ${runningCount} running ${pluralize(runningCount, "thread")}.`
            : "";
        toastManager.add({
          type: failureCount > 0 ? "warning" : "success",
          title: archivedCount === 1 ? "Thread archived" : `Archived ${archivedCount} threads`,
          description:
            failureCount > 0
              ? `Failed to archive ${failureCount} ${pluralize(failureCount, "thread")}.${skippedDescription}`
              : runningCount > 0
                ? skippedDescription.trim()
                : `"${project.name}" cleared.`,
        });
      } else if (failureCount > 0) {
        toastManager.add({
          type: "error",
          title: "Failed to archive threads",
          description: `Could not archive ${failureCount} ${pluralize(failureCount, "thread")} in "${project.name}".`,
        });
      }
    },
    [archiveThread, input.sidebarThreads, projectById, removeFromSelection],
  );

  const deleteProjectThreads = useCallback(
    async (
      projectId: ProjectId,
      options?: {
        confirmMessage?: string | null;
        showEmptyToast?: boolean;
        showResultToast?: boolean;
        worktreeCleanupMode?: "prompt" | "skip";
      },
    ): Promise<{
      deletedCount: number;
      failureCount: number;
      totalCount: number;
      projectName: string;
    } | null> => {
      const api = readNativeApi();
      if (!api) return null;
      const project = projectById.get(projectId);
      if (!project) return null;

      const projectThreads = input.sidebarThreads.filter((thread) => thread.projectId === projectId);
      if (projectThreads.length === 0) {
        if (options?.showEmptyToast ?? true) {
          toastManager.add({
            type: "info",
            title: "Nothing to delete",
            description: `"${project.name}" has no threads to delete.`,
          });
        }
        return {
          deletedCount: 0,
          failureCount: 0,
          totalCount: 0,
          projectName: project.name,
        };
      }

      const deleteConfirmationMessage =
        options?.confirmMessage === undefined
          ? [
              `Delete ${projectThreads.length} ${pluralize(projectThreads.length, "thread")} in "${project.name}"?`,
              "This permanently clears conversation history for these threads.",
            ].join("\n")
          : options.confirmMessage;
      if (deleteConfirmationMessage !== null) {
        const deleteConfirmed = await api.dialogs.confirm(deleteConfirmationMessage);
        if (!deleteConfirmed) return null;
      }

      const deletedIds = new Set<ThreadId>(projectThreads.map((thread) => thread.id));
      let deletedCount = 0;
      let failureCount = 0;
      for (const thread of projectThreads) {
        try {
          await deleteThread(thread.id, {
            deletedThreadIds: deletedIds,
            ...(options?.worktreeCleanupMode
              ? { worktreeCleanupMode: options.worktreeCleanupMode }
              : {}),
          });
          deletedCount += 1;
        } catch {
          failureCount += 1;
        }
      }

      removeFromSelection([...deletedIds]);

      if (options?.showResultToast ?? true) {
        if (deletedCount > 0) {
          toastManager.add({
            type: failureCount > 0 ? "warning" : "success",
            title: deletedCount === 1 ? "Thread deleted" : `Deleted ${deletedCount} threads`,
            description:
              failureCount > 0
                ? `Failed to delete ${failureCount} ${pluralize(failureCount, "thread")}.`
                : `"${project.name}" cleared.`,
          });
        } else if (failureCount > 0) {
          toastManager.add({
            type: "error",
            title: "Failed to delete threads",
            description: `Could not delete ${failureCount} ${pluralize(failureCount, "thread")} in "${project.name}".`,
          });
        }
      }

      return {
        deletedCount,
        failureCount,
        totalCount: projectThreads.length,
        projectName: project.name,
      };
    },
    [deleteThread, input.sidebarThreads, projectById, removeFromSelection],
  );

  const deleteAllThreadsInProject = useCallback(
    async (projectId: ProjectId): Promise<void> => {
      await deleteProjectThreads(projectId);
    },
    [deleteProjectThreads],
  );

  const toggleProjectPinned = useCallback(
    async (projectId: ProjectId) => {
      const api = readNativeApi();
      if (!api) return;
      const locallyPinned = pinnedProjectIds.includes(projectId);
      const serverPinned = projectById.get(projectId)?.isPinned === true;
      const isPinned = locallyPinned || serverPinned;
      const nextPinned = !isPinned;
      if (nextPinned) {
        pinProjectLocally(projectId);
      } else {
        unpinProject(projectId);
      }
      try {
        await api.orchestration.dispatchCommand({
          type: "project.meta.update",
          commandId: newCommandId(),
          projectId,
          isPinned: nextPinned,
        });
      } catch (error) {
        if (nextPinned) {
          unpinProject(projectId);
        } else {
          pinProjectLocally(projectId);
        }
        toastManager.add({
          type: "error",
          title: nextPinned ? "Unable to pin project" : "Unable to unpin project",
          description: error instanceof Error ? error.message : undefined,
        });
      }
    },
    [pinProjectLocally, pinnedProjectIds, projectById, unpinProject],
  );

  const handleStartProjectRun = useCallback(
    async (projectId: ProjectId, commandOverride?: string) => {
      const api = readNativeApi();
      const project = projectById.get(projectId);
      const runCommand = projectRunCommandByProjectIdRef.current.get(projectId);
      if (!api || !project || !runCommand) {
        return;
      }
      if (projectRunsByProjectId[projectId]) {
        return;
      }
      const command = commandOverride?.trim() || runCommand.command;
      const env = projectScriptRuntimeEnv({
        project: { cwd: project.cwd },
        worktreePath: null,
      });

      storeUpsertProjectRun({
        projectId,
        command,
        cwd: runCommand.cwd,
        pid: null,
        startedAt: new Date().toISOString(),
        status: "starting",
      });
      try {
        const { server } = await api.projects.runDevServer({
          projectId,
          command,
          cwd: runCommand.cwd,
          env,
        });
        storeUpsertProjectRun(server);
        void queryClient.invalidateQueries({ queryKey: serverQueryKeys.localServers() });
      } catch (error) {
        storeRemoveProjectRun(projectId);
        toastManager.add({
          type: "error",
          title: `Failed to run "${project.name}"`,
          description: error instanceof Error ? error.message : "Unable to start the run command.",
        });
      }
    },
    [projectById, projectRunsByProjectId, queryClient, storeRemoveProjectRun, storeUpsertProjectRun],
  );

  const handleStopProjectRun = useCallback(
    async (projectId: ProjectId) => {
      const api = readNativeApi();
      if (!api) {
        storeRemoveProjectRun(projectId);
        return;
      }
      storeRemoveProjectRun(projectId);
      try {
        await api.projects.stopDevServer({ projectId });
      } catch (error) {
        try {
          const { servers } = await api.projects.listDevServers();
          useProjectRunStore.getState().replaceAll(servers);
        } catch {
          // Ignore resync failures.
        }
        toastManager.add({
          type: "error",
          title: "Failed to stop run",
          description: error instanceof Error ? error.message : "Unable to stop the dev server.",
        });
      } finally {
        void queryClient.invalidateQueries({ queryKey: serverQueryKeys.localServers() });
      }
    },
    [queryClient, storeRemoveProjectRun],
  );

  const handleOpenProjectRunServer = useCallback(async (projectId: ProjectId) => {
    const api = readNativeApi();
    const server = projectRunServerByProjectIdRef.current.get(projectId);
    const url = server ? firstLocalServerUrl(server) : null;
    if (!api || !server || !url) {
      return;
    }
    try {
      await api.shell.openExternal(url);
    } catch (error) {
      toastManager.add({
        type: "error",
        title: `Unable to open ${localServerAddressLabel(server)}`,
        description: error instanceof Error ? error.message : "Unable to open the local server.",
      });
    }
  }, []);

  const closeProjectRunDialog = useCallback(() => {
    setProjectRunDialogProjectId(null);
  }, []);

  const persistProjectRunCommand = useCallback(
    async (projectId: ProjectId, command: string) => {
      const api = readNativeApi();
      if (!api) return;
      const project = projectById.get(projectId);
      if (!project) return;
      const nextScripts = upsertProjectRunCommandScripts({ scripts: project.scripts, command });
      if (!nextScripts) return;
      try {
        await api.orchestration.dispatchCommand({
          type: "project.meta.update",
          commandId: newCommandId(),
          projectId,
          scripts: nextScripts,
        });
      } catch (error) {
        console.error("Failed to save project run command", { projectId, error });
      }
    },
    [projectById],
  );

  const handleConfirmProjectRun = useCallback(() => {
    const projectId = projectRunDialogProjectId;
    if (!projectId) {
      return;
    }
    const command = projectRunDialogCommandDraft.trim();
    if (!command) {
      return;
    }
    setProjectRunDialogProjectId(null);
    void persistProjectRunCommand(projectId, command);
    void handleStartProjectRun(projectId, command);
  }, [
    handleStartProjectRun,
    persistProjectRunCommand,
    projectRunDialogCommandDraft,
    projectRunDialogProjectId,
  ]);

  const handleRenameProjectSave = useCallback(
    (projectId: ProjectId, nextName: string, previousLocalName: string | null) => {
      const trimmed = nextName.trim();
      const normalizedPrevious = previousLocalName?.trim() ?? "";
      if (trimmed === normalizedPrevious) {
        return;
      }
      renameProjectLocally(projectId, trimmed.length > 0 ? trimmed : null);
    },
    [renameProjectLocally],
  );

  const handleProjectContextMenuAction = useCallback(
    async (projectId: ProjectId, clicked: ProjectContextMenuId) => {
      setProjectContextMenuState(null);
      const api = readNativeApi();
      if (!api) return;
      const project = projectById.get(projectId);
      if (!project) return;

      if (clicked === "open-in-finder") {
        try {
          await api.shell.showInFolder(project.cwd);
        } catch (error) {
          toastManager.add({
            type: "error",
            title: "Unable to open in Finder",
            description:
              error instanceof Error
                ? error.message
                : "An unknown error occurred opening the folder.",
          });
        }
        return;
      }
      if (clicked === "open-in-kanban") {
        void navigate({ to: "/kanban/$projectId", params: { projectId } });
        return;
      }
      if (clicked === "copy-path") {
        copyPathToClipboard(project.cwd);
        return;
      }
      if (clicked === "new-terminal-thread") {
        void handleNewThread(projectId, {
          envMode: resolveSidebarNewThreadEnvMode({
            defaultEnvMode: appSettings.defaultThreadEnvMode,
          }),
          entryPoint: "terminal",
        });
        return;
      }
      if (clicked === "new-temporary-thread") {
        void handleNewThread(projectId, {
          envMode: resolveSidebarNewThreadEnvMode({
            defaultEnvMode: appSettings.defaultThreadEnvMode,
          }),
          temporary: true,
        });
        return;
      }
      if (clicked === "start-dev") {
        setProjectRunDialogProjectId(projectId);
        return;
      }
      if (clicked === "stop-dev") {
        await handleStopProjectRun(projectId);
        return;
      }
      if (clicked === "open-dev-server") {
        await handleOpenProjectRunServer(projectId);
        return;
      }
      if (clicked === "rename") {
        setRenameProjectDialogId(projectId);
        return;
      }
      if (clicked === "toggle-pin") {
        await toggleProjectPinned(projectId);
        return;
      }
      if (clicked === "archive-threads") {
        await archiveAllThreadsInProject(projectId);
        return;
      }
      if (clicked === "delete-threads") {
        await deleteAllThreadsInProject(projectId);
        return;
      }
      if (clicked !== "delete") return;

      const projectThreads = input.sidebarThreads.filter((thread) => thread.projectId === projectId);
      const confirmed = await api.dialogs.confirm(
        projectThreads.length > 0
          ? [
              `Remove project "${project.name}"?`,
              `This will delete ${projectThreads.length} ${pluralize(projectThreads.length, "thread")} in this folder and remove the project.`,
            ].join("\n")
          : `Remove project "${project.name}"?`,
      );
      if (!confirmed) return;

      try {
        const deletionResult = await deleteProjectThreads(projectId, {
          confirmMessage: null,
          showEmptyToast: false,
          showResultToast: false,
          worktreeCleanupMode: "skip",
        });
        if (deletionResult === null) {
          return;
        }
        if (deletionResult.failureCount > 0) {
          toastManager.add({
            type: "error",
            title: `Failed to remove "${project.name}"`,
            description: `Could not delete ${deletionResult.failureCount} ${pluralize(deletionResult.failureCount, "thread")} in "${project.name}".`,
          });
          return;
        }

        await api.orchestration.dispatchCommand({
          type: "project.delete",
          commandId: newCommandId(),
          projectId,
        });
        clearProjectDraftThreads(projectId);
        toastManager.add({
          type: "success",
          title: `Removed "${project.name}"`,
          description:
            deletionResult.deletedCount > 0
              ? `Deleted ${deletionResult.deletedCount} ${pluralize(deletionResult.deletedCount, "thread")} and removed the project.`
              : "Project removed.",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error removing project.";
        toastManager.add({
          type: "error",
          title: `Failed to remove "${project.name}"`,
          description: message,
        });
      }
    },
    [
      appSettings.defaultThreadEnvMode,
      archiveAllThreadsInProject,
      clearProjectDraftThreads,
      copyPathToClipboard,
      deleteAllThreadsInProject,
      deleteProjectThreads,
      handleNewThread,
      handleOpenProjectRunServer,
      handleStopProjectRun,
      input.sidebarThreads,
      navigate,
      projectById,
      toggleProjectPinned,
    ],
  );

  const showNativeProjectContextMenu = useCallback(
    async (projectId: ProjectId, position: { x: number; y: number }) => {
      const api = readNativeApi();
      if (!api) return;
      const project = projectById.get(projectId);
      if (!project) return;

      const projectThreads = input.sidebarThreads.filter((thread) => thread.projectId === projectId);
      const isPinned =
        pinnedProjectIds.includes(projectId) || project.isPinned === true;
      const isRunning = Boolean(projectRunsByProjectId[projectId]);
      const server = projectRunServerByProjectIdRef.current.get(projectId) ?? null;
      const hasOpenServer = server !== null && firstLocalServerUrl(server) !== null;
      const hasAnyThreads = projectThreads.length > 0;
      const hasArchivableThreads = projectThreads.some((thread) => thread.archivedAt == null);

      const clicked = await api.contextMenu.show(
        buildNativeProjectContextMenuItems({
          isPinned,
          isRunning,
          hasOpenServer,
          hasArchivableThreads,
          hasAnyThreads,
        }),
        position,
      );
      if (!clicked) return;
      await handleProjectContextMenuAction(projectId, clicked);
    },
    [
      handleProjectContextMenuAction,
      input.sidebarThreads,
      pinnedProjectIds,
      projectById,
      projectRunsByProjectId,
    ],
  );

  const { confirmAndRemoveProject } = useProjectRemoval({
    sidebarThreads: input.sidebarThreads,
    routeThreadId: input.routeThreadId,
  });

  const projectRunDialogProject = projectRunDialogProjectId
    ? (projectById.get(projectRunDialogProjectId) ?? null)
    : null;
  const projectRunDialogExistingRun = projectRunDialogProjectId
    ? (projectRunsByProjectId[projectRunDialogProjectId] ?? null)
    : null;
  const projectRunDialogCommandIsValid = projectRunDialogCommandDraft.trim().length > 0;

  const projectContextMenuProject = projectContextMenuState
    ? (projectById.get(projectContextMenuState.projectId) ?? null)
    : null;
  const projectContextMenuThreads = projectContextMenuState
    ? input.sidebarThreads.filter((thread) => thread.projectId === projectContextMenuState.projectId)
    : [];
  const projectContextMenuIsPinned = projectContextMenuProject
    ? pinnedProjectIds.includes(projectContextMenuProject.id) ||
      projectContextMenuProject.isPinned === true
    : false;
  const projectContextMenuIsRunning = projectContextMenuProject
    ? Boolean(projectRunsByProjectId[projectContextMenuProject.id])
    : false;
  const projectContextMenuServer = projectContextMenuProject
    ? (projectRunServerByProjectId.get(projectContextMenuProject.id) ?? null)
    : null;
  const projectContextMenuHasOpenServer =
    projectContextMenuServer !== null && firstLocalServerUrl(projectContextMenuServer) !== null;
  const projectContextMenuHasAnyThreads = projectContextMenuThreads.length > 0;
  const projectContextMenuHasArchivableThreads = projectContextMenuThreads.some(
    (thread) => thread.archivedAt == null,
  );

  return {
    buildNativeProjectContextMenuItems,
    handleProjectContextMenuAction,
    showNativeProjectContextMenu,
    projectContextMenuState,
    setProjectContextMenuState,
    projectRunDialogProjectId,
    setProjectRunDialogProjectId,
    projectRunDialogProject,
    projectRunDialogExistingRun,
    projectRunDialogCommandDraft,
    setProjectRunDialogCommandDraft,
    projectRunDialogCommandIsValid,
    handleStartProjectRun,
    handleStopProjectRun,
    handleOpenProjectRunServer,
    closeProjectRunDialog,
    handleConfirmProjectRun,
    renameProjectDialogId,
    setRenameProjectDialogId,
    handleRenameProjectSave,
    confirmAndRemoveProject,
    archiveAllThreadsInProject,
    deleteAllThreadsInProject,
    deleteProjectThreads,
    projectContextMenuProject,
    projectContextMenuIsPinned,
    projectContextMenuIsRunning,
    projectContextMenuHasOpenServer,
    projectContextMenuHasAnyThreads,
    projectContextMenuHasArchivableThreads,
  };
}
