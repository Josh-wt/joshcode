// FILE: draggableFloatingPanel.ts
// Purpose: Clamp and default positioning helpers for draggable floating panels.

export interface FloatingPanelPosition {
  readonly x: number;
  readonly y: number;
}

export interface FloatingPanelSize {
  readonly width: number;
  readonly height: number;
}

export interface FloatingPanelViewport {
  readonly width: number;
  readonly height: number;
}

export const FLOATING_SUBSCRIPTIONS_PANEL_WIDTH_PX = 288;
export const FLOATING_SUBSCRIPTIONS_PANEL_DEFAULT_HEIGHT_PX = 360;
const FLOATING_PANEL_MARGIN_PX = 12;

export function resolveDefaultSubscriptionsPanelPosition(
  viewport: FloatingPanelViewport = {
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  },
): FloatingPanelPosition {
  const panelWidth = FLOATING_SUBSCRIPTIONS_PANEL_WIDTH_PX;
  const panelHeight = FLOATING_SUBSCRIPTIONS_PANEL_DEFAULT_HEIGHT_PX;
  const sidebarOffset = 256;
  const x = Math.min(
    Math.max(FLOATING_PANEL_MARGIN_PX, sidebarOffset + FLOATING_PANEL_MARGIN_PX),
    Math.max(FLOATING_PANEL_MARGIN_PX, viewport.width - panelWidth - FLOATING_PANEL_MARGIN_PX),
  );
  const y = Math.max(
    FLOATING_PANEL_MARGIN_PX,
    viewport.height - panelHeight - FLOATING_PANEL_MARGIN_PX,
  );
  return { x, y };
}

export function clampFloatingPanelPosition(input: {
  position: FloatingPanelPosition;
  panelSize: FloatingPanelSize;
  viewport: FloatingPanelViewport;
  margin?: number;
}): FloatingPanelPosition {
  const margin = input.margin ?? FLOATING_PANEL_MARGIN_PX;
  const maxX = Math.max(margin, input.viewport.width - input.panelSize.width - margin);
  const maxY = Math.max(margin, input.viewport.height - input.panelSize.height - margin);
  return {
    x: Math.min(maxX, Math.max(margin, input.position.x)),
    y: Math.min(maxY, Math.max(margin, input.position.y)),
  };
}
