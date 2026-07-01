// FILE: useProjectRemoval.ts
// Purpose: Remove a project and its threads from the app (shared by tab bar and sidebar flows).
// Layer: Hook

import { type ProjectId, type ThreadId } from "@t3tools/contracts";
import { pluralize } from "@t3tools/shared/text";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { terminalRuntimeRegistry } from "~/components/terminal/terminalRuntimeRegistry";
import { getFallbackThreadIdAfterDelete } from "~/components/Sidebar.logic";
import { useAppSettings } from "~/appSettings";
import { useComposerDraftStore } from "~/composerDraftStore";
import { useHandleNewChat } from "~/hooks/useHandleNewChat";
import { readNativeApi } from "~/nativeApi";
import { getThreadFromState } from "~/threadDerivation";
import { useStore } from "~/store";
import { useTerminalStateStore } from "~/terminalStateStore";
import { useThreadSelectionStore } from "~/threadSelectionStore";
import { usePinnedThreadsStore } from "~/pinnedThreadsStore";
import { useSplitViewStore } from "~/splitViewStore";
import { useTemporaryThreadStore } from "~/temporaryThreadStore";
import { toastManager } from "~/components/ui/toast";
import { newCommandId } from "~/lib/utils";
import type { SidebarThreadSummary } from "~/types";

async function deleteThreadForProjectRemoval(threadId: ThreadId): Promise<void> {
  const api = readNativeApi();
  if (!api) return;
  const thread = getThreadFromState(useStore.getState(), threadId);
  if (!thread) return;

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

  await api.orchestration.dispatchCommand({
    type: "thread.delete",
    commandId: newCommandId(),
    threadId,
  });

  usePinnedThreadsStore.getState().unpinThread(threadId);
  useComposerDraftStore.getState().clearDraftThread(threadId);
  useComposerDraftStore.getState().clearProjectDraftThreadById(thread.projectId, threadId);
  useTerminalStateStore.getState().clearTerminalState(threadId);
  useSplitViewStore.getState().removeThreadFromSplitViews(threadId);
  useTemporaryThreadStore.getState().clearTemporaryThread(threadId);
}

export function useProjectRemoval(input: {
  sidebarThreads: readonly SidebarThreadSummary[];
  routeThreadId: ThreadId | null;
  onNewThreadInProject?: ((projectId: ProjectId) => void) | undefined;
  onNewWorktreeThreadInProject?: ((projectId: ProjectId) => void) | undefined;
}) {
  const navigate = useNavigate();
  const { settings: appSettings } = useAppSettings();
  const { handleNewChat } = useHandleNewChat();
  const clearProjectDraftThreads = useComposerDraftStore((store) => store.clearProjectDraftThreads);
  const removeFromSelection = useThreadSelectionStore((store) => store.removeFromSelection);
  const projects = useStore((state) => state.projects);

  const removeProject = useCallback(
    async (projectId: ProjectId, options?: { skipConfirm?: boolean }) => {
      const api = readNativeApi();
      if (!api) return false;

      const project = projects.find((entry) => entry.id === projectId);
      if (!project) return false;

      const projectThreads = input.sidebarThreads.filter((thread) => thread.projectId === projectId);
      if (!options?.skipConfirm) {
        const confirmationMessage =
          projectThreads.length > 0
            ? [
                `Remove project "${project.name}"?`,
                `This will delete ${projectThreads.length} ${pluralize(projectThreads.length, "thread")} in this folder and remove the project.`,
              ].join("\n")
            : `Remove project "${project.name}"?`;
        const confirmed = await api.dialogs.confirm(confirmationMessage);
        if (!confirmed) return false;
      }

      const deletedIds = new Set<ThreadId>(projectThreads.map((thread) => thread.id));
      let failureCount = 0;
      for (const thread of projectThreads) {
        try {
          await deleteThreadForProjectRemoval(thread.id);
        } catch (error) {
          failureCount += 1;
          console.error("Failed to delete thread during project removal", {
            threadId: thread.id,
            projectId,
            error,
          });
        }
      }

      if (failureCount > 0) {
        toastManager.add({
          type: "error",
          title: `Failed to remove "${project.name}"`,
          description: `Could not delete ${failureCount} ${pluralize(failureCount, "thread")} in "${project.name}".`,
        });
        return false;
      }

      removeFromSelection([...deletedIds]);

      const activeThreadInProject =
        input.routeThreadId !== null && deletedIds.has(input.routeThreadId);
      if (activeThreadInProject) {
        const fallbackThreadId = getFallbackThreadIdAfterDelete({
          threads: input.sidebarThreads.filter((thread) => !deletedIds.has(thread.id)),
          deletedThreadId: input.routeThreadId!,
          deletedThreadIds: deletedIds,
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

      try {
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
            projectThreads.length > 0
              ? `Deleted ${projectThreads.length} ${pluralize(projectThreads.length, "thread")} and removed the project.`
              : "Project removed.",
        });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error removing project.";
        toastManager.add({
          type: "error",
          title: `Failed to remove "${project.name}"`,
          description: message,
        });
        return false;
      }
    },
    [
      appSettings.sidebarThreadSortOrder,
      clearProjectDraftThreads,
      handleNewChat,
      input.routeThreadId,
      input.sidebarThreads,
      navigate,
      projects,
      removeFromSelection,
    ],
  );

  const confirmAndRemoveProject = useCallback(
    async (projectId: ProjectId) => removeProject(projectId),
    [removeProject],
  );

  const showProjectContextMenu = useCallback(
    async (projectId: ProjectId, position: { x: number; y: number }, isHomeChat: boolean) => {
      const api = readNativeApi();
      if (!api || isHomeChat) return;

      const project = projects.find((entry) => entry.id === projectId);
      if (!project) return;

      const clicked = await api.contextMenu.show(
        [
          { id: "new-thread", label: "New thread" },
          { id: "new-worktree-thread", label: "New worktree thread" },
          { id: "remove", label: "Remove project", separatorBefore: true, destructive: true },
        ],
        position,
      );

      if (clicked === "new-thread") {
        input.onNewThreadInProject?.(projectId);
        return "new-thread" as const;
      }
      if (clicked === "new-worktree-thread") {
        input.onNewWorktreeThreadInProject?.(projectId);
        return "new-worktree-thread" as const;
      }
      if (clicked === "remove") {
        await confirmAndRemoveProject(projectId);
      }
      return null;
    },
    [confirmAndRemoveProject, input.onNewThreadInProject, input.onNewWorktreeThreadInProject, projects],
  );

  return {
    confirmAndRemoveProject,
    removeProject,
    showProjectContextMenu,
  };
}
