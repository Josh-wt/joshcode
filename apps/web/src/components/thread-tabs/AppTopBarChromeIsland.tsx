// FILE: AppTopBarChromeIsland.tsx
// Purpose: Floating control clusters overlaid on the chat column below the tab bar.
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
}) {
  if (!props.children) {
    return null;
  }

  return (
    <div
      className={cn(
        "inline-flex max-w-[min(100%,36rem)] shrink-0 items-center gap-0.5 overflow-x-auto",
        "[-webkit-app-region:no-drag] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}
