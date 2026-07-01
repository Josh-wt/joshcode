// FILE: useThreadContextMenuActions.ts
// Purpose: Thread row context menu actions (native menu, rename, archive, delete, terminal).
// Layer: Hook

import {
  PROVIDER_DISPLAY_NAMES,
  type ProviderKind,
  type ThreadId,
} from "@t3tools/contracts";
import { resolveThreadWorkspaceCwd } from "@t3tools/shared/threadEnvironment";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";

import { showConfirmDialogFallback } from "~/confirmDialogFallback";
import { useAppSettings } from "~/appSettings";
import {
  getFallbackThreadIdAfterDelete,
  isLatestPinnedThreadMutation,
  resolveThreadStatusPill,
  type ThreadStatusPill,
} from "~/components/Sidebar.logic";
import { terminalRuntimeRegistry } from "~/components/terminal/terminalRuntimeRegistry";
import { useComposerDraftStore } from "~/composerDraftStore";
import { useCopyPathToClipboard, useCopyThreadIdToClipboard } from "~/hooks/useCopyToClipboard";
import { useHandleNewChat } from "~/hooks/useHandleNewChat";
import { useThreadHandoff } from "~/hooks/useThreadHandoff";
import { gitRemoveWorktreeMutationOptions } from "~/lib/gitReactQuery";
import {
  canCreateThreadHandoff,
  resolveAvailableHandoffTargetProviders,
} from "~/lib/threadHandoff";
import { quotePosixShellArgument } from "~/lib/shellQuote";
import { newCommandId, randomUUID } from "~/lib/utils";
import { readNativeApi } from "~/nativeApi";
import { derivePendingApprovals, derivePendingUserInputs } from "~/session-logic";
import { usePinnedThreadsStore } from "~/pinnedThreadsStore";
import {
  resolveSplitViewFocusedThreadId,
  resolveSplitViewPaneIdForThread,
  selectSplitView,
  useSplitViewStore,
} from "~/splitViewStore";
import { useStore } from "~/store";
import { getThreadFromState, getThreadsFromState } from "~/threadDerivation";
import { selectThreadTerminalState, useTerminalStateStore } from "~/terminalStateStore";
import { useTemporaryThreadStore } from "~/temporaryThreadStore";
import { useThreadSelectionStore } from "~/threadSelectionStore";
import { toastManager } from "~/components/ui/toast";
import { formatWorktreePathForDisplay, getOrphanedWorktreePathForThread } from "~/worktreeCleanup";
import { DEFAULT_THREAD_TERMINAL_ID, type SidebarThreadSummary, type Thread } from "~/types";

export function useThreadContextMenuActions(input: {
  sidebarThreads: readonly SidebarThreadSummary[];
  sidebarThreadSummaryById: Readonly<Record<string, SidebarThreadSummary | undefined>>;
  routeThreadId: ThreadId | null;
  routeSplitViewId?: string | null;
  dismissedThreadStatusKeyByThreadId?: Readonly<Record<string, string>>;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { settings: appSettings } = useAppSettings();
  const { handleNewChat } = useHandleNewChat();
  const { createThreadHandoff } = useThreadHandoff();
  const copyPathToClipboard = useCopyPathToClipboard();
  const copyThreadIdToClipboard = useCopyThreadIdToClipboard();

  const projects = useStore((state) => state.projects);
  const markThreadUnread = useStore((state) => state.markThreadUnread);
  const markThreadVisited = useStore((state) => state.markThreadVisited);
  const clearComposerDraftForThread = useComposerDraftStore((store) => store.clearDraftThread);
  const clearProjectDraftThreadById = useComposerDraftStore((store) => store.clearProjectDraftThreadById);
  const clearTerminalState = useTerminalStateStore((state) => state.clearTerminalState);
  const removeThreadFromSplitViews = useSplitViewStore((store) => store.removeThreadFromSplitViews);
  const clearTemporaryThread = useTemporaryThreadStore((store) => store.clearTemporaryThread);
  const removeFromSelection = useThreadSelectionStore((store) => store.removeFromSelection);
  const pinThreadLocally = usePinnedThreadsStore((store) => store.pinThread);
  const unpinThread = usePinnedThreadsStore((store) => store.unpinThread);
  const persistedPinnedThreadIds = usePinnedThreadsStore((store) => store.pinnedThreadIds);
  const removeWorktreeMutation = useMutation(gitRemoveWorktreeMutationOptions({ queryClient }));

  const [renameDialogThreadId, setRenameDialogThreadId] = useState<ThreadId | null>(null);
  const latestPinnedMutationVersionByThreadIdRef = useRef(new Map<ThreadId, number>());
  const sidebarThreadSummaryByIdRef = useRef(input.sidebarThreadSummaryById);

  sidebarThreadSummaryByIdRef.current = input.sidebarThreadSummaryById;

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project] as const)),
    [projects],
  );
  const projectCwdById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.cwd] as const)),
    [projects],
  );
  const pinnedThreadIdSet = useMemo(
    () => new Set(persistedPinnedThreadIds),
    [persistedPinnedThreadIds],
  );

  const activeSplitView = useSplitViewStore(selectSplitView(input.routeSplitViewId ?? null));

  const resolveThreadStatusForSidebar = useCallback(
    (thread: SidebarThreadSummary): ThreadStatusPill | null =>
      resolveThreadStatusPill({
        thread: {
          ...thread,
          dismissedStatusKey: input.dismissedThreadStatusKeyByThreadId?.[thread.id],
        },
        hasPendingApprovals: thread.hasPendingApprovals,
        hasPendingUserInput: thread.hasPendingUserInput,
      }),
    [input.dismissedThreadStatusKeyByThreadId],
  );

  const clearDismissedThreadStatus = useCallback((_threadId: ThreadId) => {
    // Dismissed status is owned by Sidebar UI state; no-op when unavailable.
  }, []);

  const clearThreadNotification = useCallback(
    (threadId: ThreadId) => {
      const thread = input.sidebarThreadSummaryById[threadId];
      if (!thread) {
        return;
      }
      const threadStatus = resolveThreadStatusForSidebar(thread);
      if (!threadStatus?.dismissible) {
        return;
      }
      if (threadStatus.label === "Completed") {
        markThreadVisited(threadId, thread.latestTurn?.completedAt ?? undefined);
      }
    },
    [input.sidebarThreadSummaryById, markThreadVisited, resolveThreadStatusForSidebar],
  );

  const setThreadPinned = useCallback(
    async (threadId: ThreadId, isPinned: boolean) => {
      const api = readNativeApi();
      if (!api) return;
      const requestVersion =
        (latestPinnedMutationVersionByThreadIdRef.current.get(threadId) ?? 0) + 1;
      latestPinnedMutationVersionByThreadIdRef.current.set(threadId, requestVersion);

      if (isPinned) {
        pinThreadLocally(threadId);
      } else {
        unpinThread(threadId);
      }

      try {
        await api.orchestration.dispatchCommand({
          type: "thread.meta.update",
          commandId: newCommandId(),
          threadId,
          isPinned,
        });
      } catch (error) {
        if (
          !isLatestPinnedThreadMutation({
            threadId,
            requestVersion,
            latestMutationVersionByThreadId: latestPinnedMutationVersionByThreadIdRef.current,
          })
        ) {
          return;
        }

        const confirmedPinned = sidebarThreadSummaryByIdRef.current[threadId]?.isPinned === true;
        if (confirmedPinned) {
          pinThreadLocally(threadId);
        } else {
          unpinThread(threadId);
        }
        throw error;
      }
    },
    [pinThreadLocally, unpinThread],
  );

  const toggleThreadPinned = useCallback(
    (threadId: ThreadId) => {
      const isPinned = pinnedThreadIdSet.has(threadId);
      void setThreadPinned(threadId, !isPinned).catch((error) => {
        console.error("Failed to update pinned thread state", { threadId, error });
        toastManager.add({
          type: "error",
          title: isPinned ? "Unable to unpin thread" : "Unable to pin thread",
        });
      });
    },
    [pinnedThreadIdSet, setThreadPinned],
  );

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

  const confirmAndArchiveThread = useCallback(
    async (threadId: ThreadId) => {
      const thread = input.sidebarThreadSummaryById[threadId];
      if (!thread) return;

      if (appSettings.confirmThreadArchive) {
        const api = readNativeApi();
        const confirmationMessage = [
          `Archive thread "${thread.title}"?`,
          "Archived threads are hidden from the sidebar but can be restored later.",
        ].join("\n");
        const confirmed = api
          ? await api.dialogs.confirm(confirmationMessage)
          : await showConfirmDialogFallback(confirmationMessage);
        if (!confirmed) return;
      }

      await archiveThread(threadId);
    },
    [appSettings.confirmThreadArchive, archiveThread, input.sidebarThreadSummaryById],
  );

  const confirmAndDeleteThread = useCallback(
    async (threadId: ThreadId) => {
      const thread = input.sidebarThreadSummaryById[threadId];
      if (!thread) return;

      if (appSettings.confirmThreadDelete) {
        const api = readNativeApi();
        const confirmationMessage = [
          `Delete thread "${thread.title}"?`,
          "This permanently clears conversation history for this thread.",
        ].join("\n");
        const confirmed = api
          ? await api.dialogs.confirm(confirmationMessage)
          : await showConfirmDialogFallback(confirmationMessage);
        if (!confirmed) return;
      }

      await deleteThread(threadId);
    },
    [appSettings.confirmThreadDelete, deleteThread, input.sidebarThreadSummaryById],
  );

  const openRenameThreadDialog = useCallback((threadId: ThreadId) => {
    setRenameDialogThreadId(threadId);
  }, []);

  const handoffThread = useCallback(
    async (thread: Thread, targetProvider: ProviderKind) => {
      try {
        await createThreadHandoff(thread, targetProvider);
      } catch (error) {
        toastManager.add({
          type: "error",
          title: "Could not create handoff thread",
          description:
            error instanceof Error
              ? error.message
              : "An error occurred while creating the handoff thread.",
        });
      }
    },
    [createThreadHandoff],
  );

  const showThreadContextMenu = useCallback(
    async (
      threadId: ThreadId,
      position: { x: number; y: number },
      options?: {
        extraItems?: Array<{
          id: "return-to-single-chat";
          label: string;
        }>;
        onExtraAction?: (itemId: "return-to-single-chat") => Promise<void> | void;
      },
    ) => {
      const api = readNativeApi();
      if (!api) return;
      const thread = getThreadFromState(useStore.getState(), threadId);
      if (!thread) return;
      const threadSummary = input.sidebarThreadSummaryById[threadId];
      const isPinned = pinnedThreadIdSet.has(threadId);
      const hasPendingApprovals =
        threadSummary?.hasPendingApprovals ?? derivePendingApprovals(thread.activities).length > 0;
      const hasPendingUserInput =
        threadSummary?.hasPendingUserInput ?? derivePendingUserInputs(thread.activities).length > 0;
      const canHandoff = canCreateThreadHandoff({
        thread,
        hasPendingApprovals,
        hasPendingUserInput,
      });
      const threadStatus = threadSummary ? resolveThreadStatusForSidebar(threadSummary) : null;
      const handoffTargets = canHandoff
        ? resolveAvailableHandoffTargetProviders(thread.modelSelection.provider)
        : [];
      const handoffItems = handoffTargets.map((provider, index) => ({
        id: `handoff:${provider}`,
        label: `Handoff to ${PROVIDER_DISPLAY_NAMES[provider]}`,
        separatorBefore: index === 0,
      }));
      const threadWorkspacePath = resolveThreadWorkspaceCwd({
        projectCwd: projectCwdById.get(thread.projectId) ?? null,
        envMode: thread.envMode,
        worktreePath: thread.worktreePath,
      });

      const clicked = await api.contextMenu.show(
        [
          { id: "rename", label: "Rename thread" },
          { id: "toggle-pin", label: isPinned ? "Unpin thread" : "Pin thread" },
          ...(threadStatus?.dismissible
            ? [{ id: "clear-notification", label: "Clear notification" }]
            : []),
          { id: "mark-unread", label: "Mark unread" },
          ...handoffItems,
          { id: "copy-path", label: "Copy Path", separatorBefore: true },
          ...(threadWorkspacePath
            ? [{ id: "open-path-in-terminal", label: "Open Path in Terminal" }]
            : []),
          { id: "copy-thread-id", label: "Copy Thread ID" },
          ...(options?.extraItems ?? []),
          { id: "archive", label: "Archive", separatorBefore: true },
          { id: "delete", label: "Delete", destructive: true },
        ],
        position,
      );

      if (clicked === "rename") {
        openRenameThreadDialog(threadId);
        return;
      }
      if (clicked === "toggle-pin") {
        toggleThreadPinned(threadId);
        return;
      }
      if (clicked === "mark-unread") {
        clearDismissedThreadStatus(threadId);
        markThreadUnread(threadId);
        return;
      }
      if (clicked === "clear-notification") {
        clearThreadNotification(threadId);
        return;
      }
      if (typeof clicked === "string" && clicked.startsWith("handoff:")) {
        const targetProvider = clicked.slice("handoff:".length);
        if (handoffTargets.includes(targetProvider as ProviderKind)) {
          await handoffThread(thread, targetProvider as ProviderKind);
        }
        return;
      }
      if (clicked === "copy-path") {
        if (!threadWorkspacePath) {
          toastManager.add({
            type: "error",
            title: "Path unavailable",
            description: "This thread does not have a workspace path to copy.",
          });
          return;
        }
        copyPathToClipboard(threadWorkspacePath);
        return;
      }
      if (clicked === "open-path-in-terminal") {
        if (!threadWorkspacePath) {
          toastManager.add({
            type: "error",
            title: "Path unavailable",
            description: "This thread does not have a workspace path to open.",
          });
          return;
        }
        await navigate({ to: "/$threadId", params: { threadId } });
        const terminalStore = useTerminalStateStore.getState();
        const currentTerminalState = selectThreadTerminalState(
          terminalStore.terminalStateByThreadId,
          threadId,
        );

        const candidateBaseTerminalId =
          currentTerminalState.activeTerminalId ||
          currentTerminalState.terminalIds[0] ||
          DEFAULT_THREAD_TERMINAL_ID;
        const baseTerminalAvailable =
          currentTerminalState.terminalOpen &&
          currentTerminalState.terminalIds.includes(candidateBaseTerminalId) &&
          !currentTerminalState.runningTerminalIds.includes(candidateBaseTerminalId);
        const shouldCreateNewTerminal = !baseTerminalAvailable;
        const targetTerminalId = shouldCreateNewTerminal
          ? `terminal-${randomUUID()}`
          : candidateBaseTerminalId;

        const previousTerminalOpen = currentTerminalState.terminalOpen;
        const previousPresentationMode = currentTerminalState.presentationMode;
        const previousActiveTerminalId = currentTerminalState.activeTerminalId;

        terminalStore.setTerminalPresentationMode(threadId, "drawer");
        terminalStore.setTerminalOpen(threadId, true);
        if (shouldCreateNewTerminal) {
          terminalStore.newTerminal(threadId, targetTerminalId);
        } else {
          terminalStore.setActiveTerminal(threadId, targetTerminalId);
        }

        const cdCommand = `cd ${quotePosixShellArgument(threadWorkspacePath)}\r`;
        try {
          if (shouldCreateNewTerminal) {
            await api.terminal.open({
              threadId,
              terminalId: targetTerminalId,
              cwd: threadWorkspacePath,
            });
          }
          await api.terminal.write({
            threadId,
            terminalId: targetTerminalId,
            data: cdCommand,
          });
        } catch (error) {
          if (shouldCreateNewTerminal) {
            terminalStore.closeTerminal(threadId, targetTerminalId);
          }
          terminalStore.setTerminalPresentationMode(threadId, previousPresentationMode);
          terminalStore.setTerminalOpen(threadId, previousTerminalOpen);
          if (previousActiveTerminalId) {
            terminalStore.setActiveTerminal(threadId, previousActiveTerminalId);
          }
          toastManager.add({
            type: "error",
            title: "Unable to open terminal",
            description:
              error instanceof Error ? error.message : "The terminal could not be opened.",
          });
        }
        return;
      }
      if (clicked === "copy-thread-id") {
        copyThreadIdToClipboard(threadId);
        return;
      }
      if (clicked === "return-to-single-chat") {
        await options?.onExtraAction?.("return-to-single-chat");
        return;
      }
      if (clicked === "archive") {
        await confirmAndArchiveThread(threadId);
        return;
      }
      if (clicked !== "delete") return;
      await confirmAndDeleteThread(threadId);
    },
    [
      clearDismissedThreadStatus,
      clearThreadNotification,
      confirmAndArchiveThread,
      confirmAndDeleteThread,
      copyPathToClipboard,
      copyThreadIdToClipboard,
      handoffThread,
      markThreadUnread,
      navigate,
      openRenameThreadDialog,
      pinnedThreadIdSet,
      projectCwdById,
      resolveThreadStatusForSidebar,
      input.sidebarThreadSummaryById,
      toggleThreadPinned,
    ],
  );

  return {
    showThreadContextMenu,
    openRenameThreadDialog,
    renameDialogThreadId,
    setRenameDialogThreadId,
    confirmAndArchiveThread,
    confirmAndDeleteThread,
    archiveThread,
    deleteThread,
    toggleThreadPinned,
  };
}
