// FILE: useDesktopTopBarGutter.test.ts
// Purpose: Covers pure desktop top-bar gutter decision helpers.
// Layer: Hook unit tests
// Depends on: useDesktopTopBarGutter pure helpers and Vitest assertions.

import { describe, expect, it } from "vitest";

import {
  shouldReserveDesktopTopBarTrafficLightGutter,
  shouldReserveDesktopTopBarWindowControlsGutter,
} from "./useDesktopTopBarGutter";

describe("shouldReserveDesktopTopBarTrafficLightGutter", () => {
  it("never reserves a gutter in the browser build", () => {
    expect(
      shouldReserveDesktopTopBarTrafficLightGutter({
        isElectron: false,
        isMacDesktop: true,
        isMobile: false,
      }),
    ).toBe(false);
  });

  it("never reserves a gutter for non-macOS desktop windows", () => {
    expect(
      shouldReserveDesktopTopBarTrafficLightGutter({
        isElectron: true,
        isMacDesktop: false,
        isMobile: false,
      }),
    ).toBe(false);
  });

  it("reserves a gutter on macOS desktop because the unified top bar owns the left edge", () => {
    expect(
      shouldReserveDesktopTopBarTrafficLightGutter({
        isElectron: true,
        isMacDesktop: true,
        isMobile: false,
      }),
    ).toBe(true);
  });

  it("reserves a gutter on mobile because the drawer floats over content", () => {
    expect(
      shouldReserveDesktopTopBarTrafficLightGutter({
        isElectron: true,
        isMacDesktop: true,
        isMobile: true,
      }),
    ).toBe(true);
  });
});

describe("shouldReserveDesktopTopBarWindowControlsGutter", () => {
  it("never reserves a gutter outside Electron", () => {
    expect(
      shouldReserveDesktopTopBarWindowControlsGutter({
        isElectron: false,
        isFramelessDesktop: true,
      }),
    ).toBe(false);
  });

  it("never reserves a gutter when the native window frame is still present", () => {
    expect(
      shouldReserveDesktopTopBarWindowControlsGutter({
        isElectron: true,
        isFramelessDesktop: false,
      }),
    ).toBe(false);
  });

  it("reserves a gutter for frameless Electron caption controls", () => {
    expect(
      shouldReserveDesktopTopBarWindowControlsGutter({
        isElectron: true,
        isFramelessDesktop: true,
      }),
    ).toBe(true);
  });
});
