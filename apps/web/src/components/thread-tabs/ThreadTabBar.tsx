// FILE: ThreadTabBar.tsx
// Purpose: Scrollable project-grouped thread tabs for the unified top bar.
// Layer: Route chrome

import type { MouseEvent as ReactMouseEvent } from "react";

import { NewThreadIcon } from "~/lib/icons";
import { IconButton } from "~/components/ui/icon-button";
import { cn } from "~/lib/utils";

import { ThreadTab } from "./ThreadTab";
import { ThreadTabGroup } from "./ThreadTabGroup";
import { useThreadTabStrip } from "./useThreadTabStrip";

export function ThreadTabStrip(props: { className?: string; showNewThreadButton?: boolean }) {
  const {
    tabGroups,
    scrollContainerRef,
    toggleProjectCollapsed,
    createThreadInProject,
    createWorktreeThreadInProject,
    navigateToThread,
    confirmAndArchiveThread,
    confirmAndRemoveProject,
    showThreadContextMenu,
    openProjectContextMenu,
    openProjectSearchPalette,
    handleGlobalNewThread,
  } = useThreadTabStrip();

  return (
    <div
      className={cn(
        "flex min-w-0 items-end gap-1.5 [-webkit-app-region:no-drag]",
        props.className,
      )}
    >
      <div
        ref={scrollContainerRef}
        className="flex min-w-0 flex-1 items-end gap-2 overflow-x-auto overflow-y-visible pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabGroups.map((group) => (
          <ThreadTabGroup
            key={group.projectId}
            group={group}
            onToggleExpanded={() => toggleProjectCollapsed(group.projectId)}
            onNewThread={() => createThreadInProject(group.projectId)}
            onNewWorktreeThread={() => createWorktreeThreadInProject(group.projectId)}
            onOpenProjectMenu={(position) => openProjectContextMenu(group.projectId, position)}
            onOpenHiddenThreads={
              group.hiddenThreadCount > 0
                ? () => openProjectSearchPalette(group.projectId, group.label)
                : undefined
            }
            onRemoveProject={
              group.isHomeChat
                ? undefined
                : () => {
                    void confirmAndRemoveProject(group.projectId);
                  }
            }
            onContextMenu={(event) => {
              if (group.isHomeChat) return;
              event.preventDefault();
              openProjectContextMenu(group.projectId, {
                x: event.clientX,
                y: event.clientY,
              });
            }}
          >
            {group.threads.map((tab) => (
              <ThreadTab
                key={tab.threadId}
                tab={tab}
                accentColor={group.accentColor}
                onSelect={() => navigateToThread(tab.threadId)}
                onClose={() => {
                  void confirmAndArchiveThread(tab.threadId);
                }}
                onContextMenu={(event: ReactMouseEvent<HTMLDivElement>) => {
                  event.preventDefault();
                  void showThreadContextMenu(tab.threadId, {
                    x: event.clientX,
                    y: event.clientY,
                  });
                }}
              />
            ))}
          </ThreadTabGroup>
        ))}
      </div>
      {props.showNewThreadButton === false ? null : (
        <IconButton
          className="shrink-0"
          label="New thread"
          tooltip="New thread"
          tooltipSide="bottom"
          size="icon-sm"
          variant="chrome"
          onClick={handleGlobalNewThread}
        >
          <NewThreadIcon className="size-4" />
        </IconButton>
      )}
    </div>
  );
}

/** @deprecated Use AppTopBar instead. */
export function ThreadTabBar() {
  return null;
}
