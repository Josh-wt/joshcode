// FILE: ChatHeaderActionCluster.tsx
// Purpose: Thread-scoped header actions (handoff, environment, diff, split) for the top-bar island.
// Layer: Chat shell chrome

import {
  type EditorId,
  type ProjectScript,
  PROVIDER_DISPLAY_NAMES,
  type ProviderKind,
  type ResolvedKeybindingsConfig,
  type ThreadId,
} from "@t3tools/contracts";
import { memo, useRef, useState, useEffect } from "react";
import { FiGitBranch } from "react-icons/fi";
import { HiMiniArrowsPointingOut } from "react-icons/hi2";
import { TbExchange } from "react-icons/tb";

import GitActionsControl from "../GitActionsControl";
import {
  ArrowRightIcon,
  HandoffIcon,
  PanelRightCloseIcon,
  SquareSplitVertical,
} from "~/lib/icons";
import {
  CHAT_HEADER_TOGGLE_CLASS_NAME,
  ChatHeaderButton,
  ChatHeaderIconButton,
  SurfaceChipIcon,
} from "./chatHeaderControls";
import { Badge } from "../ui/badge";
import { Menu, MenuItem, MenuTrigger } from "../ui/menu";
import { ComposerPickerMenuPopup } from "./ComposerPickerMenuPopup";
import { OpenInPicker } from "./OpenInPicker";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import ProjectScriptsControl, { type NewProjectScriptInput } from "../ProjectScriptsControl";
import { Toggle } from "../ui/toggle";
import { useIsDisposableThread } from "~/hooks/useIsDisposableThread";
import { useOpenFavoriteEditorShortcut } from "~/hooks/useOpenFavoriteEditorShortcut";
import type { RepoDiffTotals } from "~/hooks/useRepoDiffTotals";
import { ProviderIcon } from "../ProviderIcon";
import { ProviderUsageMenuControl } from "../ProviderUsageMenuControl";
import { EnvironmentToggle, type EnvironmentToggleState } from "./environment/EnvironmentToggle";
import { cn } from "~/lib/utils";

const ISLAND_COMPACT_BREAKPOINT = 520;

export interface ChatHeaderActionClusterProps {
  activeThreadId: ThreadId;
  activeProvider: ProviderKind;
  activeProjectName: string | undefined;
  hideHandoffControls?: boolean;
  /** Island chrome uses icon-only, tighter spacing. */
  variant?: "header" | "island";
  isGitRepo: boolean;
  openInTarget: string | null;
  activeProjectScripts: ProjectScript[] | undefined;
  preferredScriptId: string | null;
  keybindings: ResolvedKeybindingsConfig;
  availableEditors: ReadonlyArray<EditorId>;
  diffToggleShortcutLabel: string | null;
  handoffBadgeLabel: string | null;
  handoffActionLabel: string;
  handoffDisabled: boolean;
  handoffActionTargetProviders: ReadonlyArray<ProviderKind>;
  handoffBadgeSourceProvider: ProviderKind | null;
  handoffBadgeTargetProvider: ProviderKind | null;
  gitCwd: string | null;
  diffTotals: RepoDiffTotals;
  showGitActions?: boolean;
  showDiffToggle?: boolean;
  diffOpen: boolean;
  diffDisabledReason?: string | null;
  environment?: EnvironmentToggleState | null;
  chatLayoutAction?: {
    kind: "split" | "maximize";
    label: string;
    shortcutLabel: string | null;
    onClick: () => void;
  } | null;
  changeThreadAction?: {
    label: string;
    onClick: () => void;
  } | null;
  onRunProjectScript: (script: ProjectScript) => void;
  onAddProjectScript: (input: NewProjectScriptInput) => Promise<void>;
  onUpdateProjectScript: (scriptId: string, input: NewProjectScriptInput) => Promise<void>;
  onDeleteProjectScript: (scriptId: string) => Promise<void>;
  onToggleDiff: () => void;
  onCreateHandoff: (targetProvider: ProviderKind) => void;
}

export const ChatHeaderActionCluster = memo(function ChatHeaderActionCluster({
  activeThreadId,
  activeProvider,
  activeProjectName,
  hideHandoffControls = false,
  variant = "header",
  isGitRepo,
  openInTarget,
  activeProjectScripts,
  preferredScriptId,
  keybindings,
  availableEditors,
  diffToggleShortcutLabel,
  handoffBadgeLabel,
  handoffActionLabel,
  handoffDisabled,
  handoffActionTargetProviders,
  handoffBadgeSourceProvider,
  handoffBadgeTargetProvider,
  gitCwd,
  diffTotals,
  showGitActions = true,
  showDiffToggle = true,
  diffOpen,
  diffDisabledReason = null,
  environment = null,
  chatLayoutAction = null,
  changeThreadAction = null,
  onRunProjectScript,
  onAddProjectScript,
  onUpdateProjectScript,
  onDeleteProjectScript,
  onToggleDiff,
  onCreateHandoff,
}: ChatHeaderActionClusterProps) {
  const clusterRef = useRef<HTMLDivElement>(null);
  const isIsland = variant === "island";
  const [compact, setCompact] = useState(isIsland);
  const [openAddActionNonce, setOpenAddActionNonce] = useState(0);
  const {
    additions: diffAdditions,
    deletions: diffDeletions,
    hasChanges: showDiffTotals,
  } = diffTotals;
  const isDisposableThread = useIsDisposableThread(activeThreadId);

  useOpenFavoriteEditorShortcut({
    keybindings,
    availableEditors,
    openInTarget,
    enabled: !isDisposableThread && Boolean(activeProjectName),
  });

  useEffect(() => {
    if (isIsland) {
      setCompact(true);
      return;
    }
    const el = clusterRef.current;
    if (!el) return;
    const measure = () => setCompact(el.clientWidth < ISLAND_COMPACT_BREAKPOINT);
    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [isIsland]);

  const renderProviderIcon = (provider: ProviderKind | null, className: string) => (
    <ProviderIcon
      provider={provider}
      tone="header"
      className={className}
      fallback={<FiGitBranch className={className} />}
    />
  );

  const diffToggleControl = showDiffToggle ? (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle
            className={cn(
              CHAT_HEADER_TOGGLE_CLASS_NAME,
              showDiffTotals ? null : "!size-7 [&_svg,&_[data-slot=central-icon]]:mx-0",
            )}
            pressed={diffOpen}
            onPressedChange={onToggleDiff}
            aria-label="Toggle diff panel"
            variant="default"
            size="xs"
            disabled={!isGitRepo || (diffDisabledReason !== null && !diffOpen)}
          >
            {showDiffTotals ? (
              <span className="inline-flex items-center gap-1">
                <span className="font-system-ui text-[length:var(--app-font-size-ui-xs,10px)] font-normal tracking-normal tabular-nums text-success">
                  +{diffAdditions}
                </span>
                <span className="font-system-ui text-[length:var(--app-font-size-ui-xs,10px)] font-normal tracking-normal tabular-nums text-destructive">
                  -{diffDeletions}
                </span>
              </span>
            ) : null}
            <SurfaceChipIcon icon={PanelRightCloseIcon} className="size-4" />
          </Toggle>
        }
      />
      <TooltipPopup side="bottom">
        {!isGitRepo
          ? "Diff panel is unavailable because this project is not a git repository."
          : diffDisabledReason && !diffOpen
            ? diffDisabledReason
            : diffToggleShortcutLabel
              ? `Toggle diff panel (${diffToggleShortcutLabel})`
              : "Toggle diff panel"}
      </TooltipPopup>
    </Tooltip>
  ) : null;

  return (
    <div ref={clusterRef} className={cn("flex min-w-0 items-center", isIsland ? "gap-0.5" : "gap-1")}>
      {!isDisposableThread && !hideHandoffControls && !environment ? (
        <ProviderUsageMenuControl provider={activeProvider} />
      ) : null}
      {!isDisposableThread && !hideHandoffControls ? (
        <Menu modal={false}>
          <Tooltip>
            <TooltipTrigger
              render={
                <MenuTrigger
                  render={
                    <ChatHeaderButton
                      type="button"
                      tone="outline"
                      className={compact ? "gap-1" : "gap-1.5"}
                      aria-label={handoffActionLabel}
                      disabled={handoffDisabled || handoffActionTargetProviders.length === 0}
                    />
                  }
                >
                  <HandoffIcon className="size-[1em] shrink-0 opacity-80" />
                  {!compact && !isIsland ? <span className="truncate font-normal">Hand off</span> : null}
                </MenuTrigger>
              }
            />
            <TooltipPopup side="bottom">{handoffActionLabel}</TooltipPopup>
          </Tooltip>
          <ComposerPickerMenuPopup align="end" side="bottom" className="w-48 min-w-48">
            {handoffActionTargetProviders.map((provider) => (
              <MenuItem key={provider} onClick={() => onCreateHandoff(provider)}>
                {renderProviderIcon(provider, "size-3.5 shrink-0")}
                <span>Handoff to {PROVIDER_DISPLAY_NAMES[provider]}</span>
              </MenuItem>
            ))}
          </ComposerPickerMenuPopup>
        </Menu>
      ) : null}
      {!isDisposableThread && activeProjectScripts ? (
        <ProjectScriptsControl
          scripts={activeProjectScripts}
          keybindings={keybindings}
          preferredScriptId={preferredScriptId}
          showInlineControls={false}
          openAddActionNonce={openAddActionNonce}
          onRunScript={onRunProjectScript}
          onAddScript={onAddProjectScript}
          onUpdateScript={onUpdateProjectScript}
          onDeleteScript={onDeleteProjectScript}
        />
      ) : null}
      {!isDisposableThread && chatLayoutAction ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <ChatHeaderIconButton
                type="button"
                label={chatLayoutAction.label}
                onClick={chatLayoutAction.onClick}
              >
                {chatLayoutAction.kind === "split" ? (
                  <SquareSplitVertical className="size-3.5" />
                ) : (
                  <HiMiniArrowsPointingOut className="size-3.5" />
                )}
              </ChatHeaderIconButton>
            }
          />
          <TooltipPopup side="bottom">
            {chatLayoutAction.shortcutLabel
              ? `${chatLayoutAction.label} (${chatLayoutAction.shortcutLabel})`
              : chatLayoutAction.label}
          </TooltipPopup>
        </Tooltip>
      ) : null}
      {!isDisposableThread && changeThreadAction ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <ChatHeaderIconButton
                type="button"
                label={changeThreadAction.label}
                onClick={changeThreadAction.onClick}
              >
                <TbExchange className="size-3.5" />
              </ChatHeaderIconButton>
            }
          />
          <TooltipPopup side="bottom">{changeThreadAction.label}</TooltipPopup>
        </Tooltip>
      ) : null}
      {environment && !isDisposableThread ? (
        <>
          <EnvironmentToggle environment={environment} />
          {diffToggleControl}
        </>
      ) : (
        <>
          {!isDisposableThread && activeProjectName ? (
            <OpenInPicker
              keybindings={keybindings}
              availableEditors={availableEditors}
              openInTarget={openInTarget}
              {...(activeProjectScripts
                ? { onAddAction: () => setOpenAddActionNonce((current) => current + 1) }
                : {})}
            />
          ) : null}
          {!isDisposableThread && activeProjectName && showGitActions ? (
            <GitActionsControl
              gitCwd={gitCwd}
              activeThreadId={activeThreadId}
              hideQuickActionLabel={compact}
            />
          ) : null}
          {diffToggleControl}
        </>
      )}
      {!hideHandoffControls && handoffBadgeLabel && !isIsland ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Badge
                variant="outline"
                className="hidden !h-6 shrink-0 items-center justify-center gap-1 rounded-md px-1.5 text-[10px] sm:inline-flex"
              >
                <span className="inline-flex size-4 shrink-0 items-center justify-center">
                  {renderProviderIcon(handoffBadgeSourceProvider, "size-3")}
                </span>
                <ArrowRightIcon className="size-2.5 shrink-0 opacity-45" />
                <span className="inline-flex size-4 shrink-0 items-center justify-center">
                  {renderProviderIcon(handoffBadgeTargetProvider, "size-3")}
                </span>
              </Badge>
            }
          />
          <TooltipPopup side="bottom">{handoffBadgeLabel}</TooltipPopup>
        </Tooltip>
      ) : null}
    </div>
  );
});
