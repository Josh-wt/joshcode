// FILE: ProjectContextMenuItems.tsx
// Purpose: Shared project context menu items for sidebar and app chrome overlays.
// Layer: UI component

import {
  ArchiveIcon,
  CopyIcon,
  TemporaryThreadIcon,
  ExternalLinkIcon,
  FolderOpenIcon,
  KanbanIcon,
  type LucideIcon,
  PencilIcon,
  PinIcon,
  PlayIcon,
  StopFilledIcon,
  TerminalIcon,
  Trash2,
  XIcon,
} from "~/lib/icons";
import type { ProjectId } from "@t3tools/contracts";

import { MenuGroup, MenuItem, MenuSeparator } from "~/components/ui/menu";

import type { ProjectContextMenuId } from "~/appChromeContext";

export const PROJECT_CONTEXT_MENU_PANEL_CLASS_NAME = "w-48 min-w-48";
export const PROJECT_CONTEXT_MENU_ITEM_CLASS_NAME =
  "text-[var(--color-text-foreground)] data-highlighted:text-[var(--color-text-foreground)]";
export const PROJECT_CONTEXT_MENU_ICON_CLASS_NAME =
  "inline-flex size-3.5 shrink-0 items-center justify-center text-[var(--color-text-foreground-secondary)] [&>svg]:size-3.5 [&>[data-slot=central-icon]]:size-3.5";

function ProjectContextMenuIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className={PROJECT_CONTEXT_MENU_ICON_CLASS_NAME}>
      <Icon aria-hidden="true" />
    </span>
  );
}

export function createClientPointMenuAnchor(position: { x: number; y: number }) {
  return {
    getBoundingClientRect: () => ({
      x: position.x,
      y: position.y,
      width: 0,
      height: 0,
      top: position.y,
      right: position.x,
      bottom: position.y,
      left: position.x,
    }),
  };
}

export function ProjectContextMenuItems(props: {
  projectId: ProjectId;
  isPinned: boolean;
  isRunning: boolean;
  hasOpenServer: boolean;
  hasAnyThreads: boolean;
  hasArchivableThreads: boolean;
  onAction: (projectId: ProjectId, action: ProjectContextMenuId) => void;
}) {
  return (
    <MenuGroup>
      <MenuItem
        className={PROJECT_CONTEXT_MENU_ITEM_CLASS_NAME}
        onClick={() => void props.onAction(props.projectId, "open-in-finder")}
      >
        <ProjectContextMenuIcon icon={FolderOpenIcon} />
        <span>Open in Finder</span>
      </MenuItem>
      <MenuItem
        className={PROJECT_CONTEXT_MENU_ITEM_CLASS_NAME}
        onClick={() => void props.onAction(props.projectId, "open-in-kanban")}
      >
        <ProjectContextMenuIcon icon={KanbanIcon} />
        <span>Open in Kanban</span>
      </MenuItem>
      <MenuItem
        className={PROJECT_CONTEXT_MENU_ITEM_CLASS_NAME}
        onClick={() => void props.onAction(props.projectId, "copy-path")}
      >
        <ProjectContextMenuIcon icon={CopyIcon} />
        <span>Copy Path</span>
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        className={PROJECT_CONTEXT_MENU_ITEM_CLASS_NAME}
        onClick={() => void props.onAction(props.projectId, "new-terminal-thread")}
      >
        <ProjectContextMenuIcon icon={TerminalIcon} />
        <span>New terminal thread</span>
      </MenuItem>
      <MenuItem
        className={PROJECT_CONTEXT_MENU_ITEM_CLASS_NAME}
        onClick={() => void props.onAction(props.projectId, "new-temporary-thread")}
      >
        <ProjectContextMenuIcon icon={TemporaryThreadIcon} />
        <span>New temporary chat</span>
      </MenuItem>
      <MenuSeparator />
      {props.isRunning ? (
        <MenuItem
          className={PROJECT_CONTEXT_MENU_ITEM_CLASS_NAME}
          onClick={() => void props.onAction(props.projectId, "stop-dev")}
        >
          <ProjectContextMenuIcon icon={StopFilledIcon} />
          <span>Stop dev</span>
        </MenuItem>
      ) : (
        <MenuItem
          className={PROJECT_CONTEXT_MENU_ITEM_CLASS_NAME}
          onClick={() => void props.onAction(props.projectId, "start-dev")}
        >
          <ProjectContextMenuIcon icon={PlayIcon} />
          <span>Start dev</span>
        </MenuItem>
      )}
      {props.hasOpenServer ? (
        <MenuItem
          className={PROJECT_CONTEXT_MENU_ITEM_CLASS_NAME}
          onClick={() => void props.onAction(props.projectId, "open-dev-server")}
        >
          <ProjectContextMenuIcon icon={ExternalLinkIcon} />
          <span>Open dev server</span>
        </MenuItem>
      ) : null}
      <MenuSeparator />
      <MenuItem
        className={PROJECT_CONTEXT_MENU_ITEM_CLASS_NAME}
        onClick={() => void props.onAction(props.projectId, "rename")}
      >
        <ProjectContextMenuIcon icon={PencilIcon} />
        <span>Edit name</span>
      </MenuItem>
      <MenuItem
        className={PROJECT_CONTEXT_MENU_ITEM_CLASS_NAME}
        onClick={() => void props.onAction(props.projectId, "toggle-pin")}
      >
        <ProjectContextMenuIcon icon={PinIcon} />
        <span>{props.isPinned ? "Unpin project" : "Pin project"}</span>
      </MenuItem>
      {props.hasArchivableThreads || props.hasAnyThreads ? <MenuSeparator /> : null}
      {props.hasArchivableThreads ? (
        <MenuItem
          className={PROJECT_CONTEXT_MENU_ITEM_CLASS_NAME}
          onClick={() => void props.onAction(props.projectId, "archive-threads")}
        >
          <ProjectContextMenuIcon icon={ArchiveIcon} />
          <span>Archive threads</span>
        </MenuItem>
      ) : null}
      {props.hasAnyThreads ? (
        <MenuItem
          className={PROJECT_CONTEXT_MENU_ITEM_CLASS_NAME}
          onClick={() => void props.onAction(props.projectId, "delete-threads")}
        >
          <ProjectContextMenuIcon icon={Trash2} />
          <span>Delete threads</span>
        </MenuItem>
      ) : null}
      <MenuSeparator />
      <MenuItem
        className={PROJECT_CONTEXT_MENU_ITEM_CLASS_NAME}
        onClick={() => void props.onAction(props.projectId, "delete")}
      >
        <ProjectContextMenuIcon icon={XIcon} />
        <span>Remove</span>
      </MenuItem>
    </MenuGroup>
  );
}
