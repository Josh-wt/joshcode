// FILE: AddProjectDialog.tsx
// Purpose: Dialog for adding a project via folder browse or typed path.
// Layer: UI component

import { FolderIcon } from "~/lib/icons";
import { useCallback, useMemo, useRef, useState } from "react";
import { TbCursorText } from "react-icons/tb";

import { useAppChromeStore } from "~/appChromeStore";
import { useAppChrome } from "~/appChromeContext";
import { isElectron } from "~/env";
import { describeAddProjectError } from "~/components/Sidebar.logic";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { toastManager } from "~/components/ui/toast";
import { readNativeApi } from "~/nativeApi";

export function AddProjectDialog() {
  const addProjectDialogOpen = useAppChromeStore((state) => state.addProjectDialogOpen);
  const closeAddProjectDialog = useAppChromeStore((state) => state.closeAddProjectDialog);
  const { addProjectFromPath } = useAppChrome();
  const [showManualPathInput, setShowManualPathInput] = useState(false);
  const [newCwd, setNewCwd] = useState("");
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [addProjectError, setAddProjectError] = useState<string | null>(null);
  const addProjectInputRef = useRef<HTMLInputElement | null>(null);
  const addProjectErrorMeaning = useMemo(
    () => (addProjectError ? describeAddProjectError(addProjectError) : null),
    [addProjectError],
  );
  const canAddProject = newCwd.trim().length > 0 && !isAddingProject;

  const resetState = useCallback(() => {
    setShowManualPathInput(false);
    setNewCwd("");
    setIsPickingFolder(false);
    setIsAddingProject(false);
    setAddProjectError(null);
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeAddProjectDialog();
        resetState();
      }
    },
    [closeAddProjectDialog, resetState],
  );

  const submitPath = useCallback(
    async (path: string) => {
      if (!path.trim() || isAddingProject) return;
      setIsAddingProject(true);
      setAddProjectError(null);
      try {
        await addProjectFromPath(path, { createIfMissing: true });
        closeAddProjectDialog();
        resetState();
      } catch (error) {
        const description =
          error instanceof Error ? error.message : "An error occurred while adding the project.";
        setAddProjectError(description);
      } finally {
        setIsAddingProject(false);
      }
    },
    [addProjectFromPath, closeAddProjectDialog, isAddingProject, resetState],
  );

  const handlePickFolder = useCallback(async () => {
    const api = readNativeApi();
    if (!api || isPickingFolder) return;
    setIsPickingFolder(true);
    try {
      const pickedPath = await api.dialogs.pickFolder();
      setIsPickingFolder(false);
      if (pickedPath) {
        setAddProjectError(null);
        await submitPath(pickedPath).catch((error: unknown) => {
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
  }, [isPickingFolder, submitPath]);

  const handleAddProject = useCallback(() => {
    void submitPath(newCwd);
  }, [newCwd, submitPath]);

  return (
    <Dialog open={addProjectDialogOpen} onOpenChange={handleOpenChange}>
      <DialogPopup surface="solid" className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add project</DialogTitle>
          <DialogDescription>Open a repository or folder in the sidebar.</DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-3">
          {!showManualPathInput ? (
            <div className="flex gap-2">
              {isElectron ? (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => void handlePickFolder()}
                  disabled={isPickingFolder || isAddingProject}
                >
                  <FolderIcon className="size-4" />
                  {isPickingFolder ? "Opening..." : isAddingProject ? "Adding..." : "Browse"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowManualPathInput(true);
                  window.requestAnimationFrame(() => addProjectInputRef.current?.focus());
                }}
              >
                <TbCursorText className="size-4" />
                Type path
              </Button>
            </div>
          ) : (
            <div
              className={`flex items-center rounded-lg border bg-[var(--color-background-control-opaque)] transition-colors ${
                addProjectError
                  ? "border-red-500/70 focus-within:border-red-500"
                  : "border-[color:var(--color-border)] focus-within:border-[color:var(--color-border-focus)]"
              }`}
            >
              <Input
                ref={addProjectInputRef}
                nativeInput
                className="min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
                placeholder="/path/to/project"
                value={newCwd}
                onChange={(event) => {
                  setNewCwd(event.target.value);
                  setAddProjectError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleAddProject();
                  if (event.key === "Escape") {
                    setShowManualPathInput(false);
                    setAddProjectError(null);
                  }
                }}
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={handleAddProject}
                disabled={!canAddProject}
              >
                {isAddingProject ? "Adding..." : "Add"}
              </Button>
            </div>
          )}
          {addProjectError ? (
            <div className="space-y-1">
              <p className="text-xs leading-tight text-red-400">{addProjectError}</p>
              {addProjectErrorMeaning ? (
                <p className="text-xs leading-tight text-muted-foreground/70">
                  {addProjectErrorMeaning}
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
