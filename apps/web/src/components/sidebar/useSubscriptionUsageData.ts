// FILE: useSubscriptionUsageData.ts
// Purpose: Shared CrossUsage subscription query and launcher logic for sidebar + floating panel.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { toastManager } from "~/components/ui/toast";
import { launchCrossUsage } from "~/lib/crossUsageLaunch";
import { openUsageAllProvidersQueryOptions, openUsageQueryKeys } from "~/lib/openUsageReactQuery";
import type { OpenUsageProviderSnapshot } from "~/lib/openUsageSnapshots";

const CROSSUSAGE_REFETCH_DELAYS_MS = [2_000, 5_000, 10_000] as const;

export function useSubscriptionUsageData(): {
  snapshots: OpenUsageProviderSnapshot[];
  hasSnapshots: boolean;
  isLaunching: boolean;
  openCrossUsage: () => void;
} {
  const [isLaunching, setIsLaunching] = useState(false);
  const queryClient = useQueryClient();
  const usageQuery = useQuery(openUsageAllProvidersQueryOptions());
  const snapshots = useMemo(
    () =>
      (usageQuery.data ?? []).filter((snapshot) =>
        snapshot.lines.some((line) => line.type === "progress"),
      ),
    [usageQuery.data],
  );

  const scheduleUsageRefetches = useCallback(() => {
    for (const delayMs of CROSSUSAGE_REFETCH_DELAYS_MS) {
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: openUsageQueryKeys.providers });
      }, delayMs);
    }
  }, [queryClient]);

  const openCrossUsage = useCallback(() => {
    if (isLaunching) {
      return;
    }

    setIsLaunching(true);
    void launchCrossUsage()
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: openUsageQueryKeys.providers });
        scheduleUsageRefetches();
      })
      .catch((error: unknown) => {
        toastManager.add({
          title: "Could not start CrossUsage",
          description:
            error instanceof Error ? error.message : "Failed to run the usage launcher.",
          type: "error",
        });
        void queryClient.invalidateQueries({ queryKey: openUsageQueryKeys.providers });
        scheduleUsageRefetches();
      })
      .finally(() => {
        setIsLaunching(false);
      });
  }, [isLaunching, queryClient, scheduleUsageRefetches]);

  return {
    snapshots,
    hasSnapshots: snapshots.length > 0,
    isLaunching,
    openCrossUsage,
  };
}
