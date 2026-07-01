// FILE: ThreadTabStatusDot.tsx
// Purpose: Compact status indicator for thread tabs (working, pending approval/input).
// Layer: Thread tab presentation

import { cn } from "~/lib/utils";

export function ThreadTabStatusDot(props: {
  hasLiveTailWork: boolean;
  hasPendingAction: boolean;
  className?: string;
}) {
  if (!props.hasLiveTailWork && !props.hasPendingAction) {
    return null;
  }

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-1.5 shrink-0 rounded-full",
        props.hasPendingAction
          ? "bg-amber-500 dark:bg-amber-300/90"
          : "bg-sky-500 dark:bg-sky-300/80",
        props.hasLiveTailWork && !props.hasPendingAction && "animate-pulse",
        props.className,
      )}
    />
  );
}
