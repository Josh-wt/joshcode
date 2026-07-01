// FILE: ProjectRunDialog.tsx
// Purpose: Dev server start dialog for a project.
// Layer: UI component

import { PlayIcon } from "~/lib/icons";

import { useAppChrome } from "~/appChromeContext";
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

export function ProjectRunDialog() {
  const {
    projectRunDialogProjectId,
    projectRunDialogProject,
    projectRunDialogCommandDraft,
    setProjectRunDialogCommandDraft,
    projectRunDialogCommandIsValid,
    projectRunDialogExistingRun,
    closeProjectRunDialog,
    confirmProjectRun,
  } = useAppChrome();

  return (
    <Dialog
      open={projectRunDialogProjectId !== null}
      onOpenChange={(open) => {
        if (!open) {
          closeProjectRunDialog();
        }
      }}
    >
      <DialogPopup surface="solid" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PlayIcon className="size-4 text-emerald-500" />
            Start dev
          </DialogTitle>
          <DialogDescription>
            {projectRunDialogProject ? projectRunDialogProject.name : "Project"}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-2">
          <label
            htmlFor="project-run-command-input"
            className="block text-[length:var(--app-font-size-ui-xs,10px)] font-medium uppercase tracking-[0.08em] text-[var(--color-text-foreground-secondary)]"
          >
            Command
          </label>
          <Input
            id="project-run-command-input"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="e.g. npm run dev"
            className="font-mono"
            value={projectRunDialogCommandDraft}
            aria-invalid={projectRunDialogCommandIsValid ? undefined : true}
            onChange={(event) => setProjectRunDialogCommandDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                confirmProjectRun();
              }
            }}
          />
          {projectRunDialogCommandIsValid ? null : (
            <p className="text-[length:var(--app-font-size-ui-sm,11px)] text-destructive">
              Enter a command to run.
            </p>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={closeProjectRunDialog}>
            Cancel
          </Button>
          <Button
            onClick={confirmProjectRun}
            disabled={!projectRunDialogCommandIsValid || Boolean(projectRunDialogExistingRun)}
          >
            <PlayIcon className="size-4" />
            Run
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
