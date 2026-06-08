// FILE: FloatingSubscriptionsPanel.tsx
// Purpose: Draggable floating subscriptions panel (Environment-style card).

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

import { IconButton } from "~/components/ui/icon-button";
import {
  ENVIRONMENT_PANEL_MOTION_CLASS,
  ENVIRONMENT_PANEL_SURFACE_CLASS_NAME,
} from "~/components/chat/composerPickerStyles";
import { ENVIRONMENT_PANEL_TITLE_CLASS_NAME } from "~/components/chat/environment/environmentPanelStyles";
import { PanelLeftIcon, XIcon } from "~/lib/icons";
import {
  clampFloatingPanelPosition,
  FLOATING_SUBSCRIPTIONS_PANEL_WIDTH_PX,
  resolveDefaultSubscriptionsPanelPosition,
} from "~/lib/draggableFloatingPanel";
import { cn } from "~/lib/utils";
import { useSubscriptionsPanelStore } from "~/subscriptionsPanelStore";

import { SubscriptionUsageContent } from "./SubscriptionUsageContent";
import { useSubscriptionUsageData } from "./useSubscriptionUsageData";

export function FloatingSubscriptionsPanel() {
  const open = useSubscriptionsPanelStore((state) => state.open);
  const position = useSubscriptionsPanelStore((state) => state.position);
  const dockPanel = useSubscriptionsPanelStore((state) => state.dockPanel);
  const closePanel = useSubscriptionsPanelStore((state) => state.closePanel);
  const setPosition = useSubscriptionsPanelStore((state) => state.setPosition);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { snapshots, isLaunching, openCrossUsage } = useSubscriptionUsageData();

  const clampCurrentPosition = useCallback(() => {
    if (!position || !panelRef.current) {
      return;
    }
    const rect = panelRef.current.getBoundingClientRect();
    const nextPosition = clampFloatingPanelPosition({
      position,
      panelSize: { width: rect.width, height: rect.height },
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
    if (nextPosition.x !== position.x || nextPosition.y !== position.y) {
      setPosition(nextPosition);
    }
  }, [position, setPosition]);

  useEffect(() => {
    if (open && !position) {
      setPosition(resolveDefaultSubscriptionsPanelPosition());
    }
  }, [open, position, setPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }
    clampCurrentPosition();
    const onResize = () => clampCurrentPosition();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampCurrentPosition, open]);

  const onDragHandlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!position || event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);

      const startX = event.clientX;
      const startY = event.clientY;
      const origin = position;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const panel = panelRef.current;
        if (!panel) {
          return;
        }
        const rect = panel.getBoundingClientRect();
        const nextPosition = clampFloatingPanelPosition({
          position: {
            x: origin.x + (moveEvent.clientX - startX),
            y: origin.y + (moveEvent.clientY - startY),
          },
          panelSize: { width: rect.width, height: rect.height },
          viewport: { width: window.innerWidth, height: window.innerHeight },
        });
        setPosition(nextPosition);
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [position, setPosition],
  );

  if (!open || !position) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div
        ref={panelRef}
        className={cn(
          ENVIRONMENT_PANEL_SURFACE_CLASS_NAME,
          ENVIRONMENT_PANEL_MOTION_CLASS,
          "pointer-events-auto fixed flex max-h-[min(70vh,28rem)] flex-col",
        )}
        style={{
          left: position.x,
          top: position.y,
          width: FLOATING_SUBSCRIPTIONS_PANEL_WIDTH_PX,
        }}
        role="dialog"
        aria-label="Subscriptions"
      >
        <div
          data-drag-handle
          className="flex cursor-grab items-center justify-between gap-2 border-b border-border/40 px-2 py-1.5 active:cursor-grabbing"
          onPointerDown={onDragHandlePointerDown}
        >
          <p className={ENVIRONMENT_PANEL_TITLE_CLASS_NAME}>Subscriptions</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex h-[18px] shrink-0 cursor-pointer items-center rounded px-1.5 text-[length:var(--app-font-size-ui-xs,10px)] font-medium text-muted-foreground/76 transition-colors hover:text-foreground/88 disabled:cursor-default disabled:opacity-60"
              disabled={isLaunching}
              onClick={openCrossUsage}
            >
              Open
            </button>
            <IconButton label="Pop subscriptions into sidebar" tooltip="Pop in" onClick={dockPanel}>
              <PanelLeftIcon className="size-3.5" />
            </IconButton>
            <IconButton label="Hide subscriptions panel" tooltip="Hide" onClick={closePanel}>
              <XIcon className="size-3.5" />
            </IconButton>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <SubscriptionUsageContent snapshots={snapshots} variant="floating" />
        </div>
      </div>
    </div>
  );
}
