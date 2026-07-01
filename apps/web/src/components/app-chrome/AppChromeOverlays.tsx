// FILE: AppChromeOverlays.tsx
// Purpose: Renders app chrome overlay surfaces (search palette, dialogs, context menus).
// Layer: UI component

import { useMemo } from "react";

import { useAppChrome } from "~/appChromeContext";
import { ComposerPickerMenuPopup } from "~/components/chat/ComposerPickerMenuPopup";
import { RenameDialog } from "~/components/RenameDialog";
import { RenameThreadDialog } from "~/components/RenameThreadDialog";
import { Menu } from "~/components/ui/menu";

import { AddProjectDialog } from "./AddProjectDialog";
import { AppChromeSearchPaletteHost } from "./AppChromeSearchPaletteHost";
import {
  createClientPointMenuAnchor,
  PROJECT_CONTEXT_MENU_PANEL_CLASS_NAME,
  ProjectContextMenuItems,
} from "./ProjectContextMenuItems";
import { ProjectRunDialog } from "./ProjectRunDialog";

export function AppChromeOverlays() {
  const {
    projectContextMenuState,
    setProjectContextMenuState,
    projectContextMenuProject,
    projectContextMenuIsPinned,
    projectContextMenuIsRunning,
    projectContextMenuHasOpenServer,
    projectContextMenuHasAnyThreads,
    projectContextMenuHasArchivableThreads,
    onProjectContextMenuAction,
    renameDialogThreadId,
    setRenameDialogThreadId,
    renameDialogThreadTitle,
    onRenameThreadSave,
    renameProjectDialogId,
    setRenameProjectDialogId,
    renameProjectDialogProject,
    onRenameProjectSave,
  } = useAppChrome();

  const projectContextMenuAnchor = useMemo(
    () =>
      projectContextMenuState
        ? createClientPointMenuAnchor(projectContextMenuState.position)
        : null,
    [projectContextMenuState],
  );

  return (
    <>
      <AppChromeSearchPaletteHost />
      <AddProjectDialog />
      {projectContextMenuState && projectContextMenuProject && projectContextMenuAnchor ? (
        <Menu
          open
          onOpenChange={(open) => {
            if (!open) {
              setProjectContextMenuState(null);
            }
          }}
        >
          <ComposerPickerMenuPopup
            anchor={projectContextMenuAnchor}
            align="start"
            side="bottom"
            sideOffset={0}
            className={PROJECT_CONTEXT_MENU_PANEL_CLASS_NAME}
          >
            <ProjectContextMenuItems
              projectId={projectContextMenuState.projectId}
              isPinned={projectContextMenuIsPinned}
              isRunning={projectContextMenuIsRunning}
              hasOpenServer={projectContextMenuHasOpenServer}
              hasAnyThreads={projectContextMenuHasAnyThreads}
              hasArchivableThreads={projectContextMenuHasArchivableThreads}
              onAction={onProjectContextMenuAction}
            />
          </ComposerPickerMenuPopup>
        </Menu>
      ) : null}
      <ProjectRunDialog />
      <RenameThreadDialog
        open={renameDialogThreadId !== null}
        currentTitle={renameDialogThreadTitle}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setRenameDialogThreadId(null);
        }}
        onSave={onRenameThreadSave}
      />
      <RenameDialog
        open={renameProjectDialogId !== null && renameProjectDialogProject !== null}
        title="Rename project"
        description="Keep it short and recognizable."
        initialValue={
          renameProjectDialogProject?.localName ?? renameProjectDialogProject?.name ?? ""
        }
        allowEmpty
        placeholder={renameProjectDialogProject?.folderName}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setRenameProjectDialogId(null);
        }}
        onSave={(nextName) => {
          if (!renameProjectDialogProject) return;
          onRenameProjectSave(nextName);
        }}
      />
    </>
  );
}
