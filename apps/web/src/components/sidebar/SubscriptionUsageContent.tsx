// FILE: SubscriptionUsageContent.tsx
// Purpose: Shared subscription usage cards for the sidebar and floating panel.

import { memo, useMemo } from "react";

import { ProviderIcon } from "~/components/ProviderIcon";
import {
  formatOpenUsageProgressSummary,
  formatOpenUsageResetLabel,
  openUsageProgressPercent,
  openUsageProviderDisplayName,
  openUsageSidebarProgressLines,
  type OpenUsageProgressLine,
  type OpenUsageProviderSnapshot,
} from "~/lib/openUsageSnapshots";
import { cn } from "~/lib/utils";

function UsageProgressRow({ line }: { line: OpenUsageProgressLine }) {
  const usedPercent = openUsageProgressPercent(line);
  const resetLabel = line.resetsAt ? formatOpenUsageResetLabel(line.resetsAt) : "";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[length:var(--app-font-size-ui-xs,10px)]">
        <span className="truncate text-muted-foreground/82">{line.label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground/72">
          {formatOpenUsageProgressSummary(line)}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted/55"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={usedPercent}
        aria-label={`${line.label} usage`}
      >
        <div
          className="h-full rounded-full bg-primary/78 transition-[width] duration-300 ease-out"
          style={{
            width: `${usedPercent}%`,
            ...(line.color ? { backgroundColor: line.color } : {}),
          }}
        />
      </div>
      {resetLabel ? (
        <p className="text-[length:var(--app-font-size-ui-xs,10px)] tabular-nums text-muted-foreground/58">
          {resetLabel}
        </p>
      ) : null}
    </div>
  );
}

const SubscriptionUsageProviderCard = memo(function SubscriptionUsageProviderCard({
  snapshot,
  variant,
}: {
  snapshot: OpenUsageProviderSnapshot;
  variant: "sidebar" | "floating";
}) {
  const progressLines = useMemo(() => openUsageSidebarProgressLines(snapshot), [snapshot]);
  const displayName = openUsageProviderDisplayName(snapshot);

  if (progressLines.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border px-2.5 py-2",
        variant === "floating"
          ? "border-border/45 bg-background/55"
          : "border-border/35 bg-background/35",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {snapshot.providerKind ? (
          <ProviderIcon
            provider={snapshot.providerKind}
            className="size-3.5 shrink-0 text-muted-foreground/88"
            aria-hidden
          />
        ) : (
          <span className="size-3.5 shrink-0 rounded-full bg-muted/70" aria-hidden />
        )}
        <div className="min-w-0 flex-1 truncate text-[length:var(--app-font-size-ui,12px)] font-medium text-foreground/92">
          {displayName}
        </div>
      </div>

      <div className="space-y-2.5">
        {progressLines.map((line) => (
          <UsageProgressRow key={`${snapshot.providerId}:${line.label}`} line={line} />
        ))}
      </div>
    </div>
  );
});

export function SubscriptionUsageContent({
  snapshots,
  variant = "sidebar",
  className,
}: {
  snapshots: readonly OpenUsageProviderSnapshot[];
  variant?: "sidebar" | "floating";
  className?: string | undefined;
}) {
  if (snapshots.length === 0) {
    return (
      <p
        className={cn(
          "px-1 text-[length:var(--app-font-size-ui-xs,10px)] text-muted-foreground/68",
          className,
        )}
      >
        Open CrossUsage to load subscription usage.
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {snapshots.map((snapshot) => (
        <SubscriptionUsageProviderCard
          key={snapshot.providerId}
          snapshot={snapshot}
          variant={variant}
        />
      ))}
    </div>
  );
}
