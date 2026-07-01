// FILE: ThreadTab.tsx
// Purpose: Single thread tab chip in the top tab bar.
// Layer: Thread tab presentation

import type { MouseEvent } from "react";

import { ProviderIcon } from "~/components/ProviderIcon";
import { SurfaceTabChip } from "~/components/chat/chatHeaderControls";
import { cn } from "~/lib/utils";

import {
  resolveThreadTabAccentCssVars,
  THREAD_TAB_ACTIVE_UNDERLINE_CLASS,
  THREAD_TAB_CHIP_CLASS_NAME,
  type ThreadTabModel,
} from "./threadTabBar.logic";
import { ThreadTabStatusDot } from "./ThreadTabStatusDot";

export function ThreadTab(props: {
  tab: ThreadTabModel;
  accentColor: string;
  onSelect: () => void;
  onClose?: (() => void) | undefined;
  onContextMenu?: ((event: MouseEvent<HTMLDivElement>) => void) | undefined;
}) {
  const { tab } = props;
  const closeLabel = `Close ${tab.title}`;

  return (
    <div
      data-thread-tab-id={tab.threadId}
      className={cn(
        "flex shrink-0 items-center rounded-md",
        tab.isSubagent && "pl-0.5",
        tab.isDraft && "opacity-75",
        tab.isActive && THREAD_TAB_ACTIVE_UNDERLINE_CLASS,
      )}
      style={tab.isActive ? resolveThreadTabAccentCssVars(props.accentColor) : undefined}
      onContextMenu={props.onContextMenu}
    >
      <SurfaceTabChip
        active={false}
        title={tab.title}
        label={
          <span className={cn(tab.isSubagent && "pl-0.5")}>
            {tab.isSubagent ? <span className="mr-0.5 text-current/45">↳</span> : null}
            {tab.title}
          </span>
        }
        labelClassName="max-w-52"
        closeLabel={closeLabel}
        icon={<ProviderIcon provider={tab.provider} className="size-4" />}
        leading={
          <ThreadTabStatusDot
            hasLiveTailWork={tab.hasLiveTailWork}
            hasPendingAction={tab.hasPendingAction}
          />
        }
        className={cn(
          THREAD_TAB_CHIP_CLASS_NAME,
          tab.isActive
            ? "font-medium text-[var(--color-text-foreground)]"
            : "text-[var(--color-text-foreground-secondary)] hover:bg-[var(--color-background-button-secondary-hover)] hover:text-[var(--color-text-foreground)]",
        )}
        onSelect={props.onSelect}
        onClose={props.onClose}
      />
    </div>
  );
}
