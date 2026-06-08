import { describe, expect, it } from "vitest";

import {
  clampFloatingPanelPosition,
  resolveDefaultSubscriptionsPanelPosition,
} from "./draggableFloatingPanel";

describe("draggableFloatingPanel", () => {
  it("places the default panel above the bottom edge beside the sidebar", () => {
    expect(resolveDefaultSubscriptionsPanelPosition({ width: 1280, height: 900 })).toEqual({
      x: 268,
      y: 528,
    });
  });

  it("clamps dragged positions inside the viewport", () => {
    expect(
      clampFloatingPanelPosition({
        position: { x: -40, y: 900 },
        panelSize: { width: 288, height: 360 },
        viewport: { width: 1280, height: 900 },
      }),
    ).toEqual({ x: 12, y: 528 });
  });
});
