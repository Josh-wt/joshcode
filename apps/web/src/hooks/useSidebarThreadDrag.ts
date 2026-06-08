// FILE: useSidebarThreadDrag.ts
// Purpose: Sidebar drag-and-drop for moving and reordering chats across project folders.

import { type ProjectId, type ThreadId } from "@t3tools/contracts";
import { useCallback, useState, type DragEvent as ReactDragEvent } from "react";

import {
  canSidebarThreadBeDragged,
  resolveSidebarThreadDropPosition,
} from "../components/Sidebar.logic";
import { THREAD_DRAG_MIME } from "../components/chat-drop-overlay/ChatPaneDropOverlay";
import { readNativeApi } from "../nativeApi";
import type { Project, SidebarThreadSummary } from "../types";
import { newCommandId } from "../lib/utils";
import {
  insertThreadIdIntoProjectOrder,
  readPersistedThreadOrderIdsForProject,
  rememberThreadOrderForProject,
  reorderThreadIdsInProject,
} from "../lib/sidebarThreadOrder";
import type { SidebarThreadSortOrder } from "../appSettings";

export type SidebarThreadDropTarget =
  | { kind: "project"; projectId: ProjectId }
  | { kind: "thread"; projectId: ProjectId; threadId: ThreadId; position: "before" | "after" };

export function useSidebarThreadDrag(input: {
  projects: readonly Project[];
  threadsById: ReadonlyMap<ThreadId, SidebarThreadSummary>;
  threadSortOrder: SidebarThreadSortOrder;
  onThreadSortOrderChange: (sortOrder: SidebarThreadSortOrder) => void;
}) {
  const [draggedThreadId, setDraggedThreadId] = useState<ThreadId | null>(null);
  const [dropTarget, setDropTarget] = useState<SidebarThreadDropTarget | null>(null);
  const [threadOrderRevision, setThreadOrderRevision] = useState(0);

  const bumpThreadOrderRevision = useCallback(() => {
    setThreadOrderRevision((value) => value + 1);
  }, []);

  const resolveProjectById = useCallback(
    (projectId: ProjectId) => input.projects.find((project) => project.id === projectId) ?? null,
    [input.projects],
  );

  const ensureManualThreadSort = useCallback(() => {
    if (input.threadSortOrder !== "manual") {
      input.onThreadSortOrderChange("manual");
    }
  }, [input]);

  const moveThreadToProject = useCallback(
    async (threadId: ThreadId, targetProjectId: ProjectId, targetThreadId?: ThreadId | null, position?: "before" | "after") => {
      const thread = input.threadsById.get(threadId);
      const targetProject = resolveProjectById(targetProjectId);
      const api = readNativeApi();
      if (!thread || !targetProject || !api) {
        return;
      }
      if (!canSidebarThreadBeDragged(thread)) {
        return;
      }
      if (thread.projectId === targetProjectId && !targetThreadId) {
        return;
      }

      ensureManualThreadSort();

      if (thread.projectId !== targetProjectId) {
        await api.orchestration.dispatchCommand({
          type: "thread.meta.update",
          commandId: newCommandId(),
          threadId,
          projectId: targetProjectId,
        });
      }

      const sourceProject = resolveProjectById(thread.projectId);
      if (sourceProject && sourceProject.id !== targetProjectId) {
        const sourceOrder = readPersistedThreadOrderIdsForProject(sourceProject.cwd).filter(
          (id) => id !== threadId,
        );
        rememberThreadOrderForProject(sourceProject.cwd, sourceOrder);
        bumpThreadOrderRevision();
      }

      const targetBaseOrder = readPersistedThreadOrderIdsForProject(targetProject.cwd);
      const nextTargetOrder = insertThreadIdIntoProjectOrder({
        orderedThreadIds: targetBaseOrder.length > 0 ? targetBaseOrder : [threadId],
        threadId,
        targetThreadId: targetThreadId ?? null,
        position: position ?? "before",
      });
      rememberThreadOrderForProject(targetProject.cwd, nextTargetOrder);
      bumpThreadOrderRevision();
    },
    [bumpThreadOrderRevision, ensureManualThreadSort, input.threadsById, resolveProjectById],
  );

  const reorderThreadWithinProject = useCallback(
    (threadId: ThreadId, targetThreadId: ThreadId, projectId: ProjectId) => {
      const thread = input.threadsById.get(threadId);
      const project = resolveProjectById(projectId);
      if (!thread || !project || threadId === targetThreadId) {
        return;
      }
      if (!canSidebarThreadBeDragged(thread)) {
        return;
      }

      ensureManualThreadSort();
      const baseOrder = readPersistedThreadOrderIdsForProject(project.cwd);
      const projectThreadIds = [...input.threadsById.values()]
        .filter((entry) => entry.projectId === projectId && canSidebarThreadBeDragged(entry))
        .map((entry) => entry.id);
      const seedOrder = baseOrder.length > 0 ? baseOrder : projectThreadIds;
      rememberThreadOrderForProject(
        project.cwd,
        reorderThreadIdsInProject({
          orderedThreadIds: seedOrder,
          draggedThreadId: threadId,
          targetThreadId,
        }),
      );
      bumpThreadOrderRevision();
    },
    [bumpThreadOrderRevision, ensureManualThreadSort, input.threadsById, resolveProjectById],
  );

  const resetDragState = useCallback(() => {
    setDraggedThreadId(null);
    setDropTarget(null);
  }, []);

  const handleThreadDragStart = useCallback(
    (event: ReactDragEvent<HTMLElement>, thread: SidebarThreadSummary) => {
      if (!canSidebarThreadBeDragged(thread)) {
        event.preventDefault();
        return;
      }
      setDraggedThreadId(thread.id);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(THREAD_DRAG_MIME, JSON.stringify({ threadId: thread.id }));
      const dragImage = event.currentTarget as HTMLElement | null;
      if (dragImage) {
        const rect = dragImage.getBoundingClientRect();
        event.dataTransfer.setDragImage(
          dragImage,
          Math.max(0, event.clientX - rect.left),
          Math.max(0, event.clientY - rect.top),
        );
      }
    },
    [],
  );

  const handleProjectDragOver = useCallback(
    (event: ReactDragEvent<HTMLElement>, projectId: ProjectId) => {
      if (!draggedThreadId) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropTarget({ kind: "project", projectId });
    },
    [draggedThreadId],
  );

  const handleThreadDragOver = useCallback(
    (event: ReactDragEvent<HTMLElement>, projectId: ProjectId, threadId: ThreadId) => {
      if (!draggedThreadId || draggedThreadId === threadId) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      const targetRect = event.currentTarget.getBoundingClientRect();
      setDropTarget({
        kind: "thread",
        projectId,
        threadId,
        position: resolveSidebarThreadDropPosition({
          clientY: event.clientY,
          targetRect,
        }),
      });
    },
    [draggedThreadId],
  );

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!draggedThreadId || !dropTarget) {
        resetDragState();
        return;
      }

      if (dropTarget.kind === "project") {
        void moveThreadToProject(draggedThreadId, dropTarget.projectId);
      } else {
        const targetThread = input.threadsById.get(dropTarget.threadId);
        if (!targetThread) {
          resetDragState();
          return;
        }
        if (targetThread.projectId === input.threadsById.get(draggedThreadId)?.projectId) {
          reorderThreadWithinProject(
            draggedThreadId,
            dropTarget.threadId,
            targetThread.projectId,
          );
        } else {
          void moveThreadToProject(
            draggedThreadId,
            dropTarget.projectId,
            dropTarget.threadId,
            dropTarget.position,
          );
        }
      }

      resetDragState();
    },
    [
      draggedThreadId,
      dropTarget,
      input.threadsById,
      moveThreadToProject,
      reorderThreadWithinProject,
      resetDragState,
    ],
  );

  const isProjectDropTarget = useCallback(
    (projectId: ProjectId) =>
      dropTarget?.kind === "project" && dropTarget.projectId === projectId,
    [dropTarget],
  );

  const isThreadDropTarget = useCallback(
    (threadId: ThreadId) => dropTarget?.kind === "thread" && dropTarget.threadId === threadId,
    [dropTarget],
  );

  const threadDropPosition = useCallback(
    (threadId: ThreadId) =>
      dropTarget?.kind === "thread" && dropTarget.threadId === threadId
        ? dropTarget.position
        : null,
    [dropTarget],
  );

  return {
    draggedThreadId,
    handleDrop,
    handleProjectDragOver,
    handleThreadDragOver,
    handleThreadDragStart,
    isProjectDropTarget,
    isThreadDropTarget,
    resetDragState,
    threadDropPosition,
    threadOrderRevision,
  };
}
