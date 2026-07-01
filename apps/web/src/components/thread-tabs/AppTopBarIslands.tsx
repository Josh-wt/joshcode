// FILE: AppTopBarIslands.tsx
// Purpose: Top-bar island clusters — left chrome in AppTopBar, thread actions overlaid on chat.
// Layer: Route chrome

import type { ResolvedKeybindingsConfig } from "@t3tools/contracts";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { LuFolderPlus } from "react-icons/lu";

import { AppNavigationButtons } from "~/components/AppNavigationButtons";
import { IconButton } from "~/components/ui/icon-button";
import { useAppChrome } from "~/appChromeContext";
import { useAppChromeStore } from "~/appChromeStore";
import { useChatChromeActions } from "~/chatChromeActionsContext";
import { useHandleNewChat } from "~/hooks/useHandleNewChat";
import { useDesktopTopBarWindowControlsGutterClassName } from "~/hooks/useDesktopTopBarGutter";
import { shortcutLabelForCommand } from "~/keybindings";
import {
  AutomationIcon,
  KanbanIcon,
  NewThreadIcon,
  PluginIcon,
  SearchIcon,
  SettingsIcon,
} from "~/lib/icons";
import { serverConfigQueryOptions } from "~/lib/serverReactQuery";
import { cn } from "~/lib/utils";

import { AppTopBarChromeIsland, AppTopBarChromeIslandDivider } from "./AppTopBarChromeIsland";
import { AppTopBarViewModeSwitch } from "./AppTopBarViewModeSwitch";
import { APP_TOP_BAR_ISLAND_TOP_OFFSET_PX, isThreadRoutePathname } from "./threadTabBar.logic";

const EMPTY_KEYBINDINGS: ResolvedKeybindingsConfig = [];

export function AppTopBarLeftIslands(props: { layout: "thread" | "utility" }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const isOnSettings = pathname === "/settings";
  const isOnKanban = pathname.startsWith("/kanban");
  const isOnAutomations = pathname.startsWith("/automations");
  const isOnPlugins = pathname.startsWith("/plugins");
  const openSearchPalette = useAppChromeStore((state) => state.openSearchPalette);
  const { openAddProjectDialog } = useAppChrome();
  const { handleNewChat } = useHandleNewChat();
  const { data: keybindings = EMPTY_KEYBINDINGS } = useQuery({
    ...serverConfigQueryOptions(),
    select: (config) => config.keybindings,
  });
  const searchShortcutLabel = shortcutLabelForCommand(keybindings, "sidebar.search");
  const addProjectShortcutLabel = shortcutLabelForCommand(keybindings, "sidebar.addProject");

  return (
    <AppTopBarChromeIsland side="left" layout={props.layout}>
      <div className="inline-flex items-center gap-0.5">
        <AppNavigationButtons compact />
        <AppTopBarViewModeSwitch compact />
      </div>
      <AppTopBarChromeIslandDivider />
      <div className="inline-flex items-center gap-0.5">
        <IconButton
          label="New chat"
          tooltip="New chat"
          tooltipSide="bottom"
          size="icon-xs"
          variant="chrome"
          onClick={() => void handleNewChat({ fresh: true })}
        >
          <NewThreadIcon className="size-3.5" />
        </IconButton>
        <IconButton
          label="Add project"
          tooltip={
            addProjectShortcutLabel ? `Add project (${addProjectShortcutLabel})` : "Add project"
          }
          tooltipSide="bottom"
          size="icon-xs"
          variant="chrome"
          onClick={openAddProjectDialog}
        >
          <LuFolderPlus className="size-3.5" />
        </IconButton>
      </div>
      <AppTopBarChromeIslandDivider />
      <div className="inline-flex items-center gap-0.5">
        <IconButton
          label="Search"
          tooltip={searchShortcutLabel ? `Search (${searchShortcutLabel})` : "Search"}
          tooltipSide="bottom"
          size="icon-xs"
          variant="chrome"
          onClick={() => openSearchPalette({ mode: "search" })}
        >
          <SearchIcon className="size-3.5" />
        </IconButton>
        <IconButton
          label="Automations"
          tooltip="Automations"
          tooltipSide="bottom"
          size="icon-xs"
          variant={isOnAutomations ? "secondary" : "chrome"}
          onClick={() => void navigate({ to: "/automations" })}
        >
          <AutomationIcon className="size-3.5" />
        </IconButton>
        <IconButton
          label="Plugins"
          tooltip="Plugins"
          tooltipSide="bottom"
          size="icon-xs"
          variant={isOnPlugins ? "secondary" : "chrome"}
          onClick={() => void navigate({ to: "/plugins" })}
        >
          <PluginIcon className="size-3.5" />
        </IconButton>
      </div>
      <AppTopBarChromeIslandDivider />
      <div className="inline-flex items-center gap-0.5">
        <IconButton
          label="Kanban"
          tooltip="Kanban"
          tooltipSide="bottom"
          size="icon-xs"
          variant={isOnKanban ? "secondary" : "chrome"}
          onClick={() => void navigate({ to: "/kanban" })}
        >
          <KanbanIcon className="size-3.5" />
        </IconButton>
        <IconButton
          label="Settings"
          tooltip="Settings"
          tooltipSide="bottom"
          size="icon-xs"
          variant={isOnSettings ? "secondary" : "chrome"}
          onClick={() => void navigate({ to: "/settings" })}
        >
          <SettingsIcon className="size-3.5" />
        </IconButton>
      </div>
    </AppTopBarChromeIsland>
  );
}

/** Thread-route header actions; mounted after route content so Electron no-drag wins. */
export function AppTopBarThreadActionsIsland() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { threadActions } = useChatChromeActions();
  const windowControlsGutterClassName = useDesktopTopBarWindowControlsGutterClassName();

  if (!isThreadRoutePathname(pathname) || !threadActions) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-40 flex items-start justify-end px-2 sm:px-3"
      style={{ top: APP_TOP_BAR_ISLAND_TOP_OFFSET_PX }}
    >
      <AppTopBarChromeIsland
        side="right"
        className={cn(
          "pointer-events-auto",
          windowControlsGutterClassName && "mr-[138px] sm:mr-[138px]",
        )}
      >
        {threadActions}
      </AppTopBarChromeIsland>
    </div>
  );
}
