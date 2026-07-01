// FILE: ThreadTabGroup.tsx
// Purpose: Chrome-style project tab group with collapsible thread tabs.
// Layer: Thread tab presentation

import type { CSSProperties, MouseEvent, ReactNode } from "react";

import {
  EllipsisIcon,
  FolderIcon,
  FolderOpenIcon,
  NewThreadIcon,
  XIcon,
} from "~/lib/icons";
import { cn } from "~/lib/utils";
import { IconButton } from "~/components/ui/icon-button";
import {
  DOCK_HEADER_ICON_BUTTON_CLASS,
} from "~/components/chat/chatHeaderControls";

import {
  THREAD_TAB_GROUP_ACTIVE_UNDERLINE_CLASS,
  THREAD_TAB_GROUP_PILL_CLASS_NAME,
  type ThreadTabGroupModel,
} from "./threadTabBar.logic";

export function ThreadTabGroup(props: {
  group: ThreadTabGroupModel;
  children: ReactNode;
  onToggleExpanded: () => void;
  onNewThread?: (() => void) | undefined;
  onNewWorktreeThread?: (() => void) | undefined;
  onOpenProjectMenu?: ((position: { x: number; y: number }) => void) | undefined;
  onOpenHiddenThreads?: (() => void) | undefined;
  onRemoveProject?: (() => void) | undefined;
  onContextMenu?: ((event: MouseEvent<HTMLDivElement>) => void) | undefined;
}) {
  const { group } = props;
  const canRemove = !group.isHomeChat && props.onRemoveProject;
  const groupStyle = {
    "--thread-group-accent": group.accentColor,
  } as CSSProperties;

  return (
    <div
      data-project-tab-group-id={group.projectId}
      className={cn(
        "group/project-tab shrink-0",
        "flex items-end gap-0.5",
        group.isExpanded ? "pr-1" : "pr-0.5",
      )}
      style={groupStyle}
      onContextMenu={props.onContextMenu}
    >
      <div className="relative inline-flex shrink-0 items-center overflow-visible">
        <button
          type="button"
          className={cn(
            THREAD_TAB_GROUP_PILL_CLASS_NAME,
            "inline-flex max-w-60 items-center gap-2 border-0 text-left font-normal transition-colors",
            "text-[var(--color-text-foreground-secondary)] hover:bg-[var(--color-background-button-secondary-hover)] hover:text-[var(--color-text-foreground)]",
            group.isActiveGroup &&
              cn(
                "font-medium text-[var(--color-text-foreground)]",
                THREAD_TAB_GROUP_ACTIVE_UNDERLINE_CLASS,
              ),
            (canRemove || props.onOpenProjectMenu) && "pr-14",
          )}
          title={group.isExpanded ? `Collapse ${group.label}` : `Expand ${group.label}`}
          aria-expanded={group.isExpanded}
          onClick={props.onToggleExpanded}
        >
          <span
            aria-hidden
            className="inline-flex size-2 shrink-0 rounded-sm"
            style={{ backgroundColor: group.accentColor }}
          />
          {group.isExpanded ? (
            <FolderOpenIcon className="size-3.5 shrink-0 opacity-70" />
          ) : (
            <FolderIcon className="size-3.5 shrink-0 opacity-70" />
          )}
          <span className="truncate">{group.label}</span>
          {!group.isExpanded && group.threadCount > 0 ? (
            <span className="shrink-0 text-[11px] tabular-nums text-current/55">
              {group.threadCount}
            </span>
          ) : null}
        </button>
        {props.onOpenProjectMenu && !group.isHomeChat ? (
          <IconButton
            className={cn(
              DOCK_HEADER_ICON_BUTTON_CLASS,
              "absolute right-7 top-1/2 z-10 -translate-y-1/2 opacity-50 transition-opacity hover:opacity-100 group-hover/project-tab:opacity-100 focus-visible:opacity-100",
            )}
            label={`${group.label} menu`}
            tooltip={`${group.label} menu`}
            tooltipSide="bottom"
            size="icon-xs"
            variant="chrome"
            onClick={(event) => {
              event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              props.onOpenProjectMenu?.({
                x: rect.left,
                y: rect.bottom,
              });
            }}
          >
            <EllipsisIcon className="size-3" />
          </IconButton>
        ) : null}
        {canRemove ? (
          <IconButton
            className={cn(
              DOCK_HEADER_ICON_BUTTON_CLASS,
              "absolute right-0.5 top-1/2 z-10 -translate-y-1/2 opacity-50 transition-opacity hover:opacity-100 group-hover/project-tab:opacity-100 focus-visible:opacity-100",
            )}
            label={`Remove ${group.label}`}
            tooltip={`Remove ${group.label}`}
            tooltipSide="bottom"
            size="icon-xs"
            variant="chrome"
            onClick={(event) => {
              event.stopPropagation();
              props.onRemoveProject?.();
            }}
          >
            <XIcon className="size-3" />
          </IconButton>
        ) : null}
      </div>

      {group.isExpanded ? (
        <>
          <div className="flex min-w-0 items-end gap-1">{props.children}</div>
          {props.onNewThread ? (
            <IconButton
              className={cn(DOCK_HEADER_ICON_BUTTON_CLASS, "self-end")}
              label={
                props.onNewWorktreeThread
                  ? `New thread in ${group.label} (middle-click for worktree)`
                  : `New thread in ${group.label}`
              }
              tooltip={
                props.onNewWorktreeThread
                  ? `New thread in ${group.label} (middle-click for worktree)`
                  : `New thread in ${group.label}`
              }
              tooltipSide="bottom"
              size="icon-xs"
              variant="chrome"
              onClick={(event) => {
                event.stopPropagation();
                props.onNewThread?.();
              }}
              onMouseDown={(event) => {
                if (event.button !== 1 || !props.onNewWorktreeThread) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                props.onNewWorktreeThread();
              }}
            >
              <NewThreadIcon className="size-3.5" />
            </IconButton>
          ) : null}
          {group.hiddenThreadCount > 0 ? (
            <button
              type="button"
              className="shrink-0 self-end rounded px-1 text-[10px] text-muted-foreground/70 transition-colors hover:bg-[var(--color-background-button-secondary-hover)] hover:text-[var(--color-text-foreground)]"
              title={`${group.hiddenThreadCount} more threads`}
              onClick={(event) => {
                event.stopPropagation();
                props.onOpenHiddenThreads?.();
              }}
            >
              +{group.hiddenThreadCount}
            </button>
          ) : null}
        </>
      ) : group.hiddenThreadCount > 0 ? (
        <button
          type="button"
          className="shrink-0 self-end rounded px-1 text-[10px] tabular-nums text-muted-foreground/70 transition-colors hover:bg-[var(--color-background-button-secondary-hover)] hover:text-[var(--color-text-foreground)]"
          title={`${group.hiddenThreadCount} threads in ${group.label}`}
          onClick={(event) => {
            event.stopPropagation();
            props.onOpenHiddenThreads?.();
          }}
        >
          +{group.hiddenThreadCount}
        </button>
      ) : null}
    </div>
  );
}

export type ThreadTabGroupContextMenuHandler = (event: MouseEvent<HTMLDivElement>) => void;
