// FILE: useAddProjectFlow.ts
// Purpose: Add-project dialog flow (path entry, folder picker, server recovery).
// Layer: Hook

import {
  type OrchestrationShellSnapshot,
  ProjectId,
} from "@t3tools/contracts";
import { getDefaultModel } from "@t3tools/shared/model";
import { useNavigate } from "@tanstack/react-router";
import { isNonEmpty as isNonEmptyString } from "effect/String";
import { useCallback, useState } from "react";

import { useAppSettings } from "~/appSettings";
import { useAppChromeStore } from "~/appChromeStore";
import {
  extractDuplicateProjectCreateProjectId,
  findWorkspaceRootMatch,
  recoverExistingAddProjectTarget,
  sortThreadsForSidebar,
} from "~/components/Sidebar.logic";
import { useHandleNewThread } from "~/hooks/useHandleNewThread";
import {
  isDuplicateProjectCreateError,
  waitForRecoverableProjectForDuplicateCreate,
  waitForRecoverableProjectInReadModel,
} from "~/lib/projectCreateRecovery";
import { newCommandId, newProjectId } from "~/lib/utils";
import { readNativeApi } from "~/nativeApi";
import { useStore } from "~/store";
import { toastManager } from "~/components/ui/toast";

const ADD_PROJECT_SNAPSHOT_CATCH_UP_MAX_ATTEMPTS = 6;
const ADD_PROJECT_SNAPSHOT_CATCH_UP_DELAY_MS = 50;
const ADD_PROJECT_EXISTING_SYNC_ERROR =
  "This folder is already linked, but the existing project has not synced into the sidebar yet. Try again in a moment.";

export function useAddProjectFlow() {
  const navigate = useNavigate();
  const { settings: appSettings } = useAppSettings();
  const { handleNewThread } = useHandleNewThread();
  const projects = useStore((state) => state.projects);
  const setProjectExpanded = useStore((state) => state.setProjectExpanded);
  const syncServerShellSnapshot = useStore((state) => state.syncServerShellSnapshot);
  const addProjectDialogOpen = useAppChromeStore((state) => state.addProjectDialogOpen);
  const openAddProjectDialog = useAppChromeStore((state) => state.openAddProjectDialog);
  const closeAddProjectDialog = useAppChromeStore((state) => state.closeAddProjectDialog);

  const [newCwd, setNewCwd] = useState("");
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [addProjectError, setAddProjectError] = useState<string | null>(null);

  const openOrCreateProjectThreadFromSnapshot = useCallback(
    async (projectId: ProjectId, snapshot: OrchestrationShellSnapshot) => {
      const latestThread = sortThreadsForSidebar(
        snapshot.threads
          .filter(
            (thread) => thread.projectId === projectId && (thread.archivedAt ?? null) === null,
          )
          .map((thread) => ({
            id: thread.id,
            createdAt: thread.createdAt,
            updatedAt: thread.updatedAt,
            latestUserMessageAt: thread.latestUserMessageAt,
          })),
        appSettings.sidebarThreadSortOrder,
      )[0];
      if (latestThread) {
        await navigate({
          to: "/$threadId",
          params: { threadId: latestThread.id },
        });
        return;
      }

      void handleNewThread(projectId, {
        envMode: appSettings.defaultThreadEnvMode,
      }).catch(() => undefined);
    },
    [
      appSettings.defaultThreadEnvMode,
      appSettings.sidebarThreadSortOrder,
      handleNewThread,
      navigate,
    ],
  );

  const openExistingProjectFromSnapshot = useCallback(
    async (projectId: ProjectId, snapshot: OrchestrationShellSnapshot): Promise<boolean> => {
      const existingProject =
        snapshot.projects.find((candidate) => candidate.id === projectId) ?? null;
      if (!existingProject) {
        return false;
      }

      const latestThread = sortThreadsForSidebar(
        snapshot.threads
          .filter(
            (thread) => thread.projectId === projectId && (thread.archivedAt ?? null) === null,
          )
          .map((thread) => ({
            id: thread.id,
            createdAt: thread.createdAt,
            updatedAt: thread.updatedAt,
            latestUserMessageAt: thread.latestUserMessageAt,
          })),
        appSettings.sidebarThreadSortOrder,
      )[0];
      if (latestThread) {
        await navigate({
          to: "/$threadId",
          params: { threadId: latestThread.id },
        });
        return true;
      }

      setProjectExpanded(projectId, true);
      void handleNewThread(projectId, {
        envMode: appSettings.defaultThreadEnvMode,
      }).catch(() => undefined);
      return true;
    },
    [
      appSettings.defaultThreadEnvMode,
      appSettings.sidebarThreadSortOrder,
      handleNewThread,
      navigate,
      setProjectExpanded,
    ],
  );

  const waitForProjectInSnapshot = useCallback(
    async (
      api: NonNullable<ReturnType<typeof readNativeApi>>,
      projectId: ProjectId,
    ): Promise<{
      project: OrchestrationShellSnapshot["projects"][number] | null;
      snapshot: OrchestrationShellSnapshot | null;
    }> =>
      waitForRecoverableProjectInReadModel({
        projectId,
        loadSnapshot: () => api.orchestration.getShellSnapshot().catch(() => null),
        maxAttempts: ADD_PROJECT_SNAPSHOT_CATCH_UP_MAX_ATTEMPTS,
        delayMs: ADD_PROJECT_SNAPSHOT_CATCH_UP_DELAY_MS,
      }),
    [],
  );

  const waitForProjectWorkspaceRootInSnapshot = useCallback(
    async (
      api: NonNullable<ReturnType<typeof readNativeApi>>,
      workspaceRoot: string,
    ): Promise<{
      project: OrchestrationShellSnapshot["projects"][number] | null;
      snapshot: OrchestrationShellSnapshot | null;
    }> =>
      waitForRecoverableProjectInReadModel({
        workspaceRoot,
        loadSnapshot: () => api.orchestration.getShellSnapshot().catch(() => null),
        maxAttempts: ADD_PROJECT_SNAPSHOT_CATCH_UP_MAX_ATTEMPTS,
        delayMs: ADD_PROJECT_SNAPSHOT_CATCH_UP_DELAY_MS,
      }),
    [],
  );

  const recoverProjectThreadFromServer = useCallback(
    async (
      api: NonNullable<ReturnType<typeof readNativeApi>>,
      projectId: ProjectId,
    ): Promise<boolean> => {
      const { project, snapshot } = await waitForProjectInSnapshot(api, projectId);
      if (snapshot) {
        syncServerShellSnapshot(snapshot);
      }
      if (!project || !snapshot) {
        return false;
      }

      await openOrCreateProjectThreadFromSnapshot(project.id, snapshot);
      return true;
    },
    [openOrCreateProjectThreadFromSnapshot, syncServerShellSnapshot, waitForProjectInSnapshot],
  );

  const recoverExistingProjectFromServer = useCallback(
    async (
      api: NonNullable<ReturnType<typeof readNativeApi>>,
      projectId: ProjectId,
    ): Promise<boolean> => {
      const { project, snapshot } = await waitForProjectInSnapshot(api, projectId);
      if (snapshot) {
        syncServerShellSnapshot(snapshot);
      }
      if (!project || !snapshot) {
        return false;
      }

      return openExistingProjectFromSnapshot(project.id, snapshot);
    },
    [openExistingProjectFromSnapshot, syncServerShellSnapshot, waitForProjectInSnapshot],
  );

  const recoverExistingProjectByWorkspaceRootFromServer = useCallback(
    async (
      api: NonNullable<ReturnType<typeof readNativeApi>>,
      workspaceRoot: string,
    ): Promise<boolean> => {
      const { project, snapshot } = await waitForProjectWorkspaceRootInSnapshot(api, workspaceRoot);
      if (snapshot) {
        syncServerShellSnapshot(snapshot);
      }
      if (!project || !snapshot) {
        return false;
      }

      return openExistingProjectFromSnapshot(project.id, snapshot);
    },
    [
      openExistingProjectFromSnapshot,
      syncServerShellSnapshot,
      waitForProjectWorkspaceRootInSnapshot,
    ],
  );

  const addProjectFromPath = useCallback(
    async (rawCwd: string, options: { createIfMissing?: boolean } = {}) => {
      const cwd = rawCwd.trim();
      if (!cwd || isAddingProject) return;
      const api = readNativeApi();
      if (!api) return;

      setIsAddingProject(true);
      const finishAddingProject = () => {
        setIsAddingProject(false);
        setNewCwd("");
        setAddProjectError(null);
        closeAddProjectDialog();
      };

      try {
        const existing = findWorkspaceRootMatch(projects, cwd, (project) => project.cwd);
        const existingRecovery = await recoverExistingAddProjectTarget({
          existingProjectId: existing?.id,
          workspaceRoot: cwd,
          recoverByProjectId: (projectId) => recoverExistingProjectFromServer(api, projectId),
          recoverByWorkspaceRoot: (workspaceRoot) =>
            recoverExistingProjectByWorkspaceRootFromServer(api, workspaceRoot),
        });
        if (existingRecovery === "recovered") {
          finishAddingProject();
          return;
        }

        const projectId = newProjectId();
        const createdAt = new Date().toISOString();
        const title = cwd.split(/[/\\]/).findLast(isNonEmptyString) ?? cwd;
        await api.orchestration.dispatchCommand({
          type: "project.create",
          commandId: newCommandId(),
          projectId,
          kind: "project",
          title,
          workspaceRoot: cwd,
          createWorkspaceRootIfMissing: options.createIfMissing === true,
          defaultModelSelection: {
            provider: "codex",
            model: getDefaultModel("codex"),
          },
          createdAt,
        });
        const recovered = await recoverProjectThreadFromServer(api, projectId);
        if (recovered) {
          finishAddingProject();
          return;
        }

        setProjectExpanded(projectId, true);
        void handleNewThread(projectId, {
          envMode: appSettings.defaultThreadEnvMode,
        }).catch(() => undefined);
        finishAddingProject();
      } catch (error) {
        const description =
          error instanceof Error ? error.message : "An error occurred while adding the project.";
        if (isDuplicateProjectCreateError(description)) {
          try {
            const { project, snapshot } = await waitForRecoverableProjectForDuplicateCreate({
              message: description,
              workspaceRoot: cwd,
              loadSnapshot: () => api.orchestration.getShellSnapshot().catch(() => null),
              maxAttempts: ADD_PROJECT_SNAPSHOT_CATCH_UP_MAX_ATTEMPTS,
              delayMs: ADD_PROJECT_SNAPSHOT_CATCH_UP_DELAY_MS,
            });
            if (snapshot) {
              syncServerShellSnapshot(snapshot);
            }
            if (project && snapshot) {
              const recovered = await openExistingProjectFromSnapshot(project.id, snapshot);
              if (recovered) {
                finishAddingProject();
                return;
              }
            }

            const duplicateProjectId = extractDuplicateProjectCreateProjectId(description);
            const recovered = duplicateProjectId
              ? await recoverExistingProjectFromServer(
                  api,
                  ProjectId.makeUnsafe(duplicateProjectId),
                )
              : await recoverExistingProjectByWorkspaceRootFromServer(api, cwd);
            if (recovered) {
              finishAddingProject();
              return;
            }

            setIsAddingProject(false);
            throw new Error(ADD_PROJECT_EXISTING_SYNC_ERROR, { cause: error });
          } catch (recoveryError) {
            setIsAddingProject(false);
            throw recoveryError;
          }
        }
        setIsAddingProject(false);
        throw error instanceof Error ? error : new Error(description);
      }
    },
    [
      appSettings.defaultThreadEnvMode,
      closeAddProjectDialog,
      handleNewThread,
      isAddingProject,
      openExistingProjectFromSnapshot,
      projects,
      recoverExistingProjectByWorkspaceRootFromServer,
      recoverExistingProjectFromServer,
      recoverProjectThreadFromServer,
      setProjectExpanded,
      syncServerShellSnapshot,
    ],
  );

  const handleAddProject = useCallback(() => {
    void addProjectFromPath(newCwd, { createIfMissing: true }).catch((error: unknown) => {
      const description =
        error instanceof Error ? error.message : "An error occurred while adding the project.";
      setAddProjectError(description);
    });
  }, [addProjectFromPath, newCwd]);

  const canAddProject = newCwd.trim().length > 0 && !isAddingProject;

  const pickFolderAndAdd = useCallback(async () => {
    const api = readNativeApi();
    if (!api || isPickingFolder) return;
    setIsPickingFolder(true);
    try {
      const pickedPath = await api.dialogs.pickFolder();
      setIsPickingFolder(false);
      if (pickedPath) {
        setAddProjectError(null);
        await addProjectFromPath(pickedPath).catch((error: unknown) => {
          const description =
            error instanceof Error ? error.message : "An error occurred while adding the project.";
          setAddProjectError(description);
          toastManager.add({
            type: "error",
            title: "Unable to add project",
            description,
          });
        });
      }
    } catch (error) {
      const description =
        error instanceof Error ? error.message : "Unable to open the folder picker.";
      setAddProjectError(description);
      toastManager.add({
        type: "error",
        title: "Unable to open folder picker",
        description,
      });
      setIsPickingFolder(false);
    }
  }, [addProjectFromPath, isPickingFolder]);

  const handleStartAddProject = useCallback(() => {
    setAddProjectError(null);
    openAddProjectDialog();
  }, [openAddProjectDialog]);

  return {
    addProjectFromPath,
    pickFolderAndAdd,
    addProjectDialogOpen,
    openAddProjectDialog,
    closeAddProjectDialog,
    handleStartAddProject,
    newCwd,
    setNewCwd,
    isAddingProject,
    isPickingFolder,
    addProjectError,
    handleAddProject,
    canAddProject,
  };
}
