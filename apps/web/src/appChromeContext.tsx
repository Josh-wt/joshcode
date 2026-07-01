// FILE: appChromeContext.tsx
// Purpose: Shared overlay state and actions for app chrome (search palette, dialogs, menus).
// Layer: UI context

import type { ProjectId, ResolvedKeybindingsConfig, ThreadId } from "@t3tools/contracts";
import { createContext, useContext } from "react";

import type { ImportProviderKind } from "~/components/SidebarSearchPalette";
import type { SidebarSearchProject } from "~/components/SidebarSearchPalette.logic";
import type { ProjectRunState } from "~/projectRunStore";

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

export type AppChromeRenameProject = {
  id: ProjectId;
  name: string;
  localName: string | null;
  folderName: string;
};

export interface AppChromeContextValue {
  addProjectFromPath: (
    path: string,
    options?: { createIfMissing?: boolean },
  ) => Promise<void>;
  searchPaletteProjects: readonly SidebarSearchProject[];
  searchPaletteProjectById: ReadonlyMap<ProjectId, { name: string; remoteName: string }>;
  homeDir: string | null;
  keybindings: ResolvedKeybindingsConfig;
  onCreateChat: () => void;
  onCreateThread: () => void;
  onOpenSettings: () => void;
  onOpenUsageSettings: () => void;
  onOpenProject: (projectId: string) => void;
  onOpenThread: (threadId: string) => void;
  onImportThread: (provider: ImportProviderKind, externalId: string) => Promise<void>;
  onNavigateAutomations: () => void;
  onNavigatePlugins: () => void;
  onNavigateArchivedThreads: () => void;
  onNavigateWorktrees: () => void;
  projectContextMenuState: ProjectContextMenuState | null;
  setProjectContextMenuState: (state: ProjectContextMenuState | null) => void;
  projectContextMenuProject: AppChromeRenameProject | null;
  projectContextMenuIsPinned: boolean;
  projectContextMenuIsRunning: boolean;
  projectContextMenuHasOpenServer: boolean;
  projectContextMenuHasAnyThreads: boolean;
  projectContextMenuHasArchivableThreads: boolean;
  onProjectContextMenuAction: (projectId: ProjectId, action: ProjectContextMenuId) => void;
  projectRunDialogProjectId: ProjectId | null;
  setProjectRunDialogProjectId: (projectId: ProjectId | null) => void;
  projectRunDialogProject: { id: ProjectId; name: string } | null;
  projectRunDialogCommandDraft: string;
  setProjectRunDialogCommandDraft: (command: string) => void;
  projectRunDialogCommandIsValid: boolean;
  projectRunDialogExistingRun: ProjectRunState | null;
  closeProjectRunDialog: () => void;
  confirmProjectRun: () => void;
  renameDialogThreadId: ThreadId | null;
  setRenameDialogThreadId: (threadId: ThreadId | null) => void;
  renameDialogThreadTitle: string;
  onRenameThreadSave: (newTitle: string) => void;
  renameProjectDialogId: ProjectId | null;
  setRenameProjectDialogId: (projectId: ProjectId | null) => void;
  renameProjectDialogProject: AppChromeRenameProject | null;
  onRenameProjectSave: (nextName: string) => void;
  showNativeProjectContextMenu: (
    projectId: ProjectId,
    position: { x: number; y: number },
  ) => Promise<void>;
  showThreadContextMenu: (
    threadId: ThreadId,
    position: { x: number; y: number },
  ) => Promise<void>;
  confirmAndArchiveThread: (threadId: ThreadId) => Promise<void>;
  confirmAndRemoveProject: (projectId: ProjectId) => Promise<boolean>;
  openAddProjectDialog: () => void;
}

export const AppChromeContext = createContext<AppChromeContextValue | null>(null);

export function useAppChrome(): AppChromeContextValue {
  const context = useContext(AppChromeContext);
  if (!context) {
    throw new Error("useAppChrome must be used within AppChromeProvider.");
  }
  return context;
}
