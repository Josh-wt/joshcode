import { useEffect, useState } from "react";

import { isElectron } from "~/env";
import type { DesktopWindowState } from "@t3tools/contracts";
import { cn, isLinuxPlatform, isWindowsPlatform } from "~/lib/utils";

const DEFAULT_WINDOW_STATE: DesktopWindowState = {
  isMaximized: false,
  isFullscreen: false,
};

/** Caption cluster height — independent of the taller thread tab bar. */
const CAPTION_BAR_HEIGHT_PX = 32;
const CAPTION_BUTTON_WIDTH_WINDOWS_PX = 46;
const CAPTION_BUTTON_WIDTH_LINUX_PX = 40;

// Native Windows caption glyphs (Segoe Fluent / MDL2 private-use area).
const GLYPH_MINIMIZE = "\uE921";
const GLYPH_MAXIMIZE = "\uE922";
const GLYPH_RESTORE = "\uE923";
const GLYPH_CLOSE = "\uE8BB";

const CAPTION_BUTTON_BASE_CLASS =
  "flex shrink-0 items-center justify-center text-foreground/85 outline-none transition-colors duration-75 select-none [-webkit-app-region:no-drag]";

const CLOSE_BUTTON_CLASS = "hover:bg-[#c42b1c] hover:text-white active:bg-[#b9281b]";

function WindowsCaptionGlyph({ glyph }: { glyph: string }) {
  return (
    <span
      aria-hidden="true"
      className="text-[10px] leading-none"
      style={{ fontFamily: '"Segoe Fluent Icons", "Segoe MDL2 Assets"' }}
    >
      {glyph}
    </span>
  );
}

function LinuxCaptionIcon(props: { kind: "minimize" | "maximize" | "restore" | "close" }) {
  const className = "size-3 shrink-0";
  switch (props.kind) {
    case "minimize":
      return (
        <svg viewBox="0 0 12 12" className={className} aria-hidden>
          <rect x="2" y="8" width="8" height="1.25" fill="currentColor" />
        </svg>
      );
    case "maximize":
      return (
        <svg viewBox="0 0 12 12" className={className} aria-hidden>
          <rect
            x="2.75"
            y="2.75"
            width="6.5"
            height="6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
          />
        </svg>
      );
    case "restore":
      return (
        <svg viewBox="0 0 12 12" className={className} aria-hidden>
          <rect
            x="3.5"
            y="1.75"
            width="5.5"
            height="5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
          />
          <rect
            x="1.75"
            y="3.5"
            width="5.5"
            height="5.5"
            fill="var(--color-background-surface)"
            stroke="currentColor"
            strokeWidth="1.1"
          />
        </svg>
      );
    case "close":
      return (
        <svg viewBox="0 0 12 12" className={className} aria-hidden>
          <path
            d="M3 3l6 6M9 3L3 9"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

export function DesktopWindowControls({ className }: { className?: string }) {
  const [windowState, setWindowState] = useState<DesktopWindowState>(DEFAULT_WINDOW_STATE);
  const platform = typeof navigator === "undefined" ? "" : navigator.platform;
  const isWindows = isWindowsPlatform(platform);
  const isLinux = isLinuxPlatform(platform);
  const isFramelessDesktop = isWindows || isLinux;
  const controls = typeof window === "undefined" ? undefined : window.desktopBridge?.windowControls;

  useEffect(() => {
    if (!controls) return;
    let cancelled = false;

    void controls.getState().then((state) => {
      if (!cancelled) setWindowState(state);
    });
    const unsubscribe = controls.onState(setWindowState);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [controls]);

  if (!isElectron || !isFramelessDesktop || !controls) {
    return null;
  }

  const { isMaximized } = windowState;
  const buttonWidthPx = isLinux ? CAPTION_BUTTON_WIDTH_LINUX_PX : CAPTION_BUTTON_WIDTH_WINDOWS_PX;
  const buttonClass = cn(
    CAPTION_BUTTON_BASE_CLASS,
    "h-full hover:bg-foreground/[0.09] active:bg-foreground/[0.05]",
  );

  const renderIcon = (kind: "minimize" | "maximize" | "restore" | "close") => {
    if (isLinux) {
      return <LinuxCaptionIcon kind={kind} />;
    }
    switch (kind) {
      case "minimize":
        return <WindowsCaptionGlyph glyph={GLYPH_MINIMIZE} />;
      case "maximize":
        return <WindowsCaptionGlyph glyph={GLYPH_MAXIMIZE} />;
      case "restore":
        return <WindowsCaptionGlyph glyph={GLYPH_RESTORE} />;
      case "close":
        return <WindowsCaptionGlyph glyph={GLYPH_CLOSE} />;
    }
  };

  return (
    <div
      className={cn("mt-2 flex items-stretch [-webkit-app-region:no-drag]", className)}
      style={{ height: CAPTION_BAR_HEIGHT_PX }}
    >
      <button
        type="button"
        aria-label="Minimize"
        className={buttonClass}
        style={{ width: buttonWidthPx }}
        onClick={() => {
          void controls.minimize();
        }}
      >
        {renderIcon("minimize")}
      </button>
      <button
        type="button"
        aria-label={isMaximized ? "Restore" : "Maximize"}
        className={buttonClass}
        style={{ width: buttonWidthPx }}
        onClick={() => {
          void controls.toggleMaximize().then(setWindowState);
        }}
      >
        {renderIcon(isMaximized ? "restore" : "maximize")}
      </button>
      <button
        type="button"
        aria-label="Close"
        className={cn(buttonClass, CLOSE_BUTTON_CLASS)}
        style={{ width: buttonWidthPx }}
        onClick={() => {
          void controls.close();
        }}
      >
        {renderIcon("close")}
      </button>
    </div>
  );
}
