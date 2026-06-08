// FILE: SidebarSubscriptionUsage.tsx
// Purpose: Show CrossUsage subscription usage for all enabled providers in the sidebar.

import { useCallback, type MouseEvent } from "react";
import { HiOutlineChartBarSquare } from "react-icons/hi2";

import { SidebarSectionToolbar } from "~/components/SidebarSectionToolbar";
import { SidebarGlyph } from "~/components/sidebarGlyphs";
import { SidebarLeadingIcon } from "~/components/SidebarLeadingIcon";
import { SidebarMenuButton } from "~/components/ui/sidebar";
import {
  disclosureContentClassName,
  disclosureShellClassName,
  DISCLOSURE_INNER_CLASS,
} from "~/lib/disclosureMotion";
import { PanelLeftIcon, WindowIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import { useSubscriptionsPanelStore } from "~/subscriptionsPanelStore";

import {
  SIDEBAR_HEADER_ROW_CLASS_NAME,
  SIDEBAR_ROW_HOVER_CLASS_NAME,
  SIDEBAR_ROW_IDLE_TEXT_CLASS_NAME,
} from "~/sidebarRowStyles";

import { SubscriptionUsageContent } from "./SubscriptionUsageContent";
import { useSubscriptionUsageData } from "./useSubscriptionUsageData";

export function SidebarSubscriptionUsage({ className }: { className?: string | undefined }) {
  const floatingOpen = useSubscriptionsPanelStore((state) => state.open);
  const expanded = useSubscriptionsPanelStore((state) => state.sidebarExpanded);
  const setSidebarExpanded = useSubscriptionsPanelStore((state) => state.setSidebarExpanded);
  const openFloatingPanel = useSubscriptionsPanelStore((state) => state.openPanel);
  const dockPanel = useSubscriptionsPanelStore((state) => state.dockPanel);
  const { snapshots, hasSnapshots, isLaunching, openCrossUsage } = useSubscriptionUsageData();

  const handleOpenCrossUsage = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setSidebarExpanded(true);
      openCrossUsage();
    },
    [openCrossUsage, setSidebarExpanded],
  );

  const handleTogglePopOut = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (floatingOpen) {
        dockPanel();
        return;
      }
      openFloatingPanel();
    },
    [dockPanel, floatingOpen, openFloatingPanel],
  );

  const handleHeaderToggle = useCallback(() => {
    if (floatingOpen) {
      dockPanel();
      return;
    }
    setSidebarExpanded(!expanded);
  }, [dockPanel, expanded, floatingOpen, setSidebarExpanded]);

  return (
    <div className={cn("group/collapsible", className)}>
      <div className="group/project-header relative">
        <SidebarMenuButton
          size="sm"
          className={cn(
            SIDEBAR_HEADER_ROW_CLASS_NAME,
            SIDEBAR_ROW_IDLE_TEXT_CLASS_NAME,
            SIDEBAR_ROW_HOVER_CLASS_NAME,
            "cursor-pointer",
          )}
          onClick={handleHeaderToggle}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            handleHeaderToggle();
          }}
        >
          <SidebarLeadingIcon size="sm">
            <SidebarGlyph icon={HiOutlineChartBarSquare} variant="chrome" />
          </SidebarLeadingIcon>
          <div className="flex min-w-0 flex-1 items-baseline gap-2 overflow-hidden">
            <span className="truncate font-system-ui text-[length:var(--app-font-size-ui,12px)] font-normal text-muted-foreground/79">
              Subscriptions
            </span>
            {hasSnapshots ? (
              <span className="shrink-0 text-[length:var(--app-font-size-ui-xs,10px)] tabular-nums text-muted-foreground/52">
                {snapshots.length}
              </span>
            ) : null}
            {floatingOpen ? (
              <span className="shrink-0 text-[length:var(--app-font-size-ui-xs,10px)] text-muted-foreground/52">
                popped out
              </span>
            ) : null}
          </div>
        </SidebarMenuButton>
        <SidebarSectionToolbar placement="overlay">
          <button
            type="button"
            className="inline-flex h-[18px] shrink-0 cursor-pointer items-center rounded px-1.5 text-[length:var(--app-font-size-ui-xs,10px)] font-medium text-muted-foreground/76 transition-colors hover:text-foreground/88"
            aria-label={
              floatingOpen ? "Pop subscriptions back into sidebar" : "Pop out subscriptions panel"
            }
            onClick={handleTogglePopOut}
          >
            {floatingOpen ? (
              <PanelLeftIcon className="size-3" aria-hidden />
            ) : (
              <WindowIcon className="size-3" aria-hidden />
            )}
          </button>
          <button
            type="button"
            className="inline-flex h-[18px] shrink-0 cursor-pointer items-center rounded px-1.5 text-[length:var(--app-font-size-ui-xs,10px)] font-medium text-muted-foreground/76 transition-colors hover:text-foreground/88 disabled:cursor-default disabled:opacity-60"
            aria-label="Open CrossUsage"
            disabled={isLaunching}
            onClick={handleOpenCrossUsage}
          >
            Open
          </button>
        </SidebarSectionToolbar>
      </div>

      <div className={cn(disclosureShellClassName(expanded && !floatingOpen), "pt-1")}>
        <div className={DISCLOSURE_INNER_CLASS}>
          <div
            className={cn("space-y-2 px-1", disclosureContentClassName(expanded && !floatingOpen))}
          >
            <SubscriptionUsageContent snapshots={snapshots} variant="sidebar" />
          </div>
        </div>
      </div>
    </div>
  );
}
