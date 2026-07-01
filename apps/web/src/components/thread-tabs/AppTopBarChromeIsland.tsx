// FILE: AppTopBarChromeIsland.tsx
// Purpose: Control clusters in the top chrome row (islands) or overlaid thread actions.
// Layer: Route chrome presentation

import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export function AppTopBarChromeIslandDivider() {
  return <div className="mx-0.5 h-4 w-px shrink-0 bg-border/30" aria-hidden />;
}

export function AppTopBarChromeIsland(props: {
  children: ReactNode;
  side: "left" | "right";
  className?: string;
  /** Utility pages omit the tab strip and can use the full row width for islands. */
  layout?: "thread" | "utility";
}) {
  if (!props.children) {
    return null;
  }

  const layout = props.layout ?? "thread";

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 overflow-x-auto",
        layout === "thread" ? "max-w-[min(100%,36rem)]" : "max-w-none min-w-0 flex-1",
        "[-webkit-app-region:no-drag] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}
