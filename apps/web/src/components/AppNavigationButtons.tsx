// FILE: AppNavigationButtons.tsx
// Purpose: Renders Electron-only browser-style route back/forward controls.
// Layer: Shared web shell chrome
// Depends on: appNavigation history helpers, header Button/Tooltip primitives

import { goBackInAppHistory, goForwardInAppHistory, useAppNavigationState } from "~/appNavigation";
import { isElectron } from "~/env";
import { cn } from "~/lib/utils";
import { IoIosArrowRoundBack, IoIosArrowRoundForward } from "react-icons/io";
import { Button } from "./ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

export function AppNavigationButtons(props: { className?: string; compact?: boolean }) {
  const { canGoBack, canGoForward } = useAppNavigationState();
  const platform = typeof navigator === "undefined" ? "" : navigator.platform;
  const isMac = /Mac|iPhone|iPad|iPod/i.test(platform);
  const backShortcutLabel = isMac ? "⌘[" : "Alt+Left";
  const forwardShortcutLabel = isMac ? "⌘]" : "Alt+Right";
  const buttonClass = props.compact ? "size-7 rounded-md" : "size-8 rounded-lg";
  const iconClass = props.compact ? "size-5" : "size-6";

  if (!isElectron) {
    return null;
  }

  return (
    <div
      className={cn(
        "-ms-1 flex shrink-0 items-center gap-0.5 [-webkit-app-region:no-drag]",
        props.className,
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={buttonClass}
              aria-label="Back"
              disabled={!canGoBack}
              onClick={() => goBackInAppHistory()}
            />
          }
        >
          <IoIosArrowRoundBack className={iconClass} />
        </TooltipTrigger>
        <TooltipPopup side="bottom">Back ({backShortcutLabel})</TooltipPopup>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={buttonClass}
              aria-label="Forward"
              disabled={!canGoForward}
              onClick={() => goForwardInAppHistory()}
            />
          }
        >
          <IoIosArrowRoundForward className={iconClass} />
        </TooltipTrigger>
        <TooltipPopup side="bottom">Forward ({forwardShortcutLabel})</TooltipPopup>
      </Tooltip>
    </div>
  );
}
