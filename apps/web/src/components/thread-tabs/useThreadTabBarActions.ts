// FILE: useThreadTabBarActions.ts
// Purpose: Thread tab bar interactions (navigate, archive, context menu, new thread).
// Layer: Hook

import {
  PROVIDER_DISPLAY_NAMES,
  type GitBranch,
  type ProjectId,
  type ProviderKind,
  type ThreadId,
} from "@t3tools/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { showConfirmDialogFallback } from "~/confirmDialogFallback";
import { useAppSettings } from "~/appSettings";
import { useComposerDraftStore } from "~/composerDraftStore";
import { derivePendingApprovals, derivePendingUserInputs } from "~/session-logic";
import {
  canCreateThreadHandoff,
  resolveAvailableHandoffTargetProviders,
} from "~/lib/threadHandoff";
import { getFallbackThreadIdAfterDelete } from "~/components/Sidebar.logic";
import { useHandleNewChat } from "~/hooks/useHandleNewChat";
import { useHandleNewThread } from "~/hooks/useHandleNewThread";
import { gitQueryKeys } from "~/lib/gitReactQuery";
import {
  resolveNewThreadInProjectOptions,
  resolveSourceThreadBranchForProject,
  resolveWorktreeBaseBranchForProject,
  type NewThreadInProjectIntent,
} from "~/lib/newThreadInProject";
import { usePinnedThreadsStore } from "~/pinnedThreadsStore";
import { readNativeApi } from "~/nativeApi";
import { getThreadFromState } from "~/threadDerivation";
import { useStore } from "~/store";
import { toastManager } from "~/components/ui/toast";
import { newCommandId } from "~/lib/utils";
import type { SidebarThreadSummary } from "~/types";

export function useThreadTabBarActions(input: {
  sidebarThreads: readonly SidebarThreadSummary[];
  sidebarThreadSummaryById: Readonly<Record<string, SidebarThreadSummary | undefined>>;
  routeThreadId: ThreadId | null;
  projectCwdById: ReadonlyMap<ProjectId, string>;
  onRequestRename?: ((threadId: ThreadId) => void) | undefined;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { settings: appSettings } = useAppSettings();
  const { handleNewChat } = useHandleNewChat();
  const { handleNewThread } = useHandleNewThread();
  const draftThreadsByThreadId = useComposerDraftStore((state) => state.draftThreadsByThreadId);
  const pinnedThreadIds = usePinnedThreadsStore((state) => state.pinnedThreadIds);
  const pinThread = usePinnedThreadsStore((state) => state.pinThread);
  const unpinThread = usePinnedThreadsStore((state) => state.unpinThread);
  const markThreadUnread = useStore((state) => state.markThreadUnread);

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
          "Archived threads are hidden from the tab bar but can be restored later.",
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

  const navigateToThread = useCallback(
    (threadId: ThreadId) => {
      void navigate({ to: "/$threadId", params: { threadId } });
    },
    [navigate],
  );

  const buildNewThreadOptions = useCallback(
    (projectId: ProjectId, intent: NewThreadInProjectIntent = "default") => {
      const projectCwd = input.projectCwdById.get(projectId) ?? null;
      const branches =
        queryClient.getQueryData<{ branches: ReadonlyArray<GitBranch> }>(
          gitQueryKeys.branches(projectCwd),
        )?.branches ?? null;
      const sourceThreadBranch = resolveSourceThreadBranchForProject({
        projectId,
        routeThreadId: input.routeThreadId,
        threads: input.sidebarThreads,
        draftThreadsByThreadId,
      });

      return resolveNewThreadInProjectOptions({
        defaultThreadEnvMode: appSettings.defaultThreadEnvMode,
        intent,
        preferredBaseBranch: resolveWorktreeBaseBranchForProject({
          projectCwd,
          sourceThreadBranch,
          branches,
        }),
      });
    },
    [
      appSettings.defaultThreadEnvMode,
      draftThreadsByThreadId,
      input.projectCwdById,
      input.routeThreadId,
      input.sidebarThreads,
      queryClient,
    ],
  );

  const createThreadInProject = useCallback(
    (projectId: ProjectId, intent: NewThreadInProjectIntent = "default") => {
      void handleNewThread(projectId, buildNewThreadOptions(projectId, intent));
    },
    [buildNewThreadOptions, handleNewThread],
  );

  const createWorktreeThreadInProject = useCallback(
    (projectId: ProjectId) => {
      createThreadInProject(projectId, "worktree");
    },
    [createThreadInProject],
  );

  const showThreadContextMenu = useCallback(
    async (threadId: ThreadId, position: { x: number; y: number }) => {
      const api = readNativeApi();
      if (!api) return;
      const thread = getThreadFromState(useStore.getState(), threadId);
      if (!thread) return;
      const threadSummary = input.sidebarThreadSummaryById[threadId];
      const isPinned = pinnedThreadIds.includes(threadId);
      const hasPendingApprovals =
        threadSummary?.hasPendingApprovals ?? derivePendingApprovals(thread.activities).length > 0;
      const hasPendingUserInput =
        threadSummary?.hasPendingUserInput ?? derivePendingUserInputs(thread.activities).length > 0;
      const canHandoff = canCreateThreadHandoff({
        thread,
        hasPendingApprovals,
        hasPendingUserInput,
      });
      const handoffTargets = canHandoff
        ? resolveAvailableHandoffTargetProviders(thread.modelSelection.provider)
        : [];
      const handoffItems = handoffTargets.map((provider, index) => ({
        id: `handoff:${provider}`,
        label: `Handoff to ${PROVIDER_DISPLAY_NAMES[provider]}`,
        separatorBefore: index === 0,
      }));

      const clicked = await api.contextMenu.show(
        [
          { id: "rename", label: "Rename thread" },
          { id: "toggle-pin", label: isPinned ? "Unpin thread" : "Pin thread" },
          { id: "mark-unread", label: "Mark unread" },
          ...handoffItems,
          { id: "archive", label: "Archive", separatorBefore: true },
        ],
        position,
      );

      if (clicked === "rename") {
        input.onRequestRename?.(threadId);
        return;
      }
      if (clicked === "toggle-pin") {
        if (isPinned) {
          unpinThread(threadId);
        } else {
          pinThread(threadId);
        }
        return;
      }
      if (clicked === "mark-unread") {
        markThreadUnread(threadId);
        return;
      }
      if (typeof clicked === "string" && clicked.startsWith("handoff:")) {
        const handoffPrefix = "handoff:";
        const targetProvider = clicked.slice(handoffPrefix.length) as ProviderKind;
        if (handoffTargets.includes(targetProvider)) {
          toastManager.add({
            type: "info",
            title: "Handoff",
            description: `Use the chat header to hand off to ${PROVIDER_DISPLAY_NAMES[targetProvider]}.`,
          });
        }
        return;
      }
      if (clicked === "archive") {
        await confirmAndArchiveThread(threadId);
      }
    },
    [
      confirmAndArchiveThread,
      input.onRequestRename,
      input.sidebarThreadSummaryById,
      markThreadUnread,
      pinThread,
      pinnedThreadIds,
      unpinThread,
    ],
  );

  return {
    archiveThread,
    confirmAndArchiveThread,
    createThreadInProject,
    createWorktreeThreadInProject,
    navigateToThread,
    showThreadContextMenu,
  };
}
