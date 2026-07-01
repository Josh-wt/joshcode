// FILE: AppTopBarViewModeSwitch.tsx
// Purpose: Compact threads/workspace mode switch for the unified top bar.
// Layer: App chrome

import { useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { TerminalIcon } from "~/lib/icons";
import { BsChat } from "react-icons/bs";

import { useAppSettings } from "~/appSettings";
import { useHandleNewChat } from "~/hooks/useHandleNewChat";
import { useWorkspaceStore } from "~/workspaceStore";
import { IconButton } from "~/components/ui/icon-button";
import { cn } from "~/lib/utils";

export function AppTopBarViewModeSwitch(props: { compact?: boolean }) {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const routeWorkspaceId = useParams({
    strict: false,
    select: (params) => (typeof params.workspaceId === "string" ? params.workspaceId : null),
  });
  const { settings: appSettings } = useAppSettings();
  const workspaceSectionVisible = appSettings.showWorkspaceSection;
  const workspacePages = useWorkspaceStore((state) => state.workspacePages);
  const { handleNewChat } = useHandleNewChat();

  const isOnWorkspace = pathname.startsWith("/workspace");
  const isOnSettings = pathname === "/settings";

  if (!workspaceSectionVisible || isOnSettings) {
    return null;
  }

  const goThreads = () => {
    void handleNewChat({ fresh: false });
  };

  const goWorkspace = () => {
    const targetId = routeWorkspaceId ?? workspacePages[0]?.id;
    if (!targetId) {
      return;
    }
    void navigate({ to: "/workspace/$workspaceId", params: { workspaceId: targetId } });
  };

  return (
    <div className="inline-flex shrink-0 items-center rounded-md border border-border/55 bg-[var(--color-background-elevated-secondary)] p-0.5 [-webkit-app-region:no-drag]">
      <IconButton
        className={cn(props.compact ? "!size-6 rounded-sm" : "!size-7 rounded-md", isOnWorkspace && "opacity-55")}
        label="Threads"
        tooltip="Threads"
        tooltipSide="bottom"
        size="icon-xs"
        variant={isOnWorkspace ? "chrome" : "secondary"}
        aria-pressed={!isOnWorkspace}
        onClick={goThreads}
      >
        <BsChat className="size-3.5" />
      </IconButton>
      <IconButton
        className={cn(props.compact ? "!size-6 rounded-sm" : "!size-7 rounded-md", !isOnWorkspace && "opacity-55")}
        label="Workspace"
        tooltip="Workspace"
        tooltipSide="bottom"
        size="icon-xs"
        variant={isOnWorkspace ? "secondary" : "chrome"}
        aria-pressed={isOnWorkspace}
        onClick={goWorkspace}
      >
        <TerminalIcon className="size-3.5" />
      </IconButton>
    </div>
  );
}
