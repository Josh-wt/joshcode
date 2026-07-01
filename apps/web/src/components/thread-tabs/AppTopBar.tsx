// FILE: AppTopBar.tsx
// Purpose: Full-width top chrome row — left islands, thread tabs or spacer, drag region.
// Layer: Route chrome

import { useLocation } from "@tanstack/react-router";

import { isElectron } from "~/env";
import {
  useDesktopTopBarTrafficLightGutterClassName,
  useDesktopTopBarWindowControlsGutterClassName,
} from "~/hooks/useDesktopTopBarGutter";
import { cn } from "~/lib/utils";

import { AppTopBarLeftIslands } from "./AppTopBarIslands";
import { isThreadRoutePathname, THREAD_TAB_BAR_MAIN_ROW_CLASS } from "./threadTabBar.logic";
import { ThreadTabStrip } from "./ThreadTabBar";

export function AppTopBar() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const showThreadTabs = isThreadRoutePathname(pathname);
  const desktopGutterClassName = useDesktopTopBarTrafficLightGutterClassName();
  const windowControlsGutterClassName = useDesktopTopBarWindowControlsGutterClassName();
  const chromeGutterClassName = cn(desktopGutterClassName, windowControlsGutterClassName);

  return (
    <div
      className={cn(
        "relative z-30 shrink-0 bg-[var(--color-background-surface)]",
        isElectron && "drag-region",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-end gap-2 px-2 pt-1.5 pb-3 sm:px-3",
          THREAD_TAB_BAR_MAIN_ROW_CLASS,
          chromeGutterClassName,
        )}
      >
        <AppTopBarLeftIslands layout={showThreadTabs ? "thread" : "utility"} />
        {showThreadTabs ? (
          <ThreadTabStrip className="min-w-0 flex-1" showNewThreadButton={false} />
        ) : (
          <div className="min-w-0 flex-1 self-stretch" aria-hidden />
        )}
      </div>
    </div>
  );
}
