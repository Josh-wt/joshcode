import type { ResolvedKeybindingsConfig, GitBranch } from "@t3tools/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Outlet, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import {
  goBackInAppHistory,
  goForwardInAppHistory,
  resolveAppNavigationState,
} from "../appNavigation";
import ShortcutsDialog from "../components/ShortcutsDialog";
import { RecentViewSwitcher } from "../components/RecentViewSwitcher";
import { AppTopBar } from "../components/thread-tabs/AppTopBar";
import { AppTopBarIslands } from "../components/thread-tabs/AppTopBarIslands";
import { AppChromeOverlays } from "../components/app-chrome/AppChromeOverlays";
import { AppChromeProvider } from "../components/app-chrome/AppChromeProvider";
import { shouldRenderTerminalWorkspace } from "../components/ChatView.logic";
import ThreadSidebar from "../components/Sidebar";
import { isElectron } from "../env";
import { useHandleNewChat } from "../hooks/useHandleNewChat";
import { useDisposableThreadLifecycle } from "../hooks/useDisposableThreadLifecycle";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { useRecentViewSwitcher } from "../hooks/useRecentViewSwitcher";
import { useLatestProjectStore } from "../latestProjectStore";
import {
  resolveCurrentProjectTargetId,
  resolveLatestProjectTargetId,
} from "../lib/projectShortcutTargets";
import { useAppSettings } from "../appSettings";
import { gitQueryKeys } from "../lib/gitReactQuery";
import {
  resolveNewThreadInProjectOptions,
  resolveWorktreeBaseBranchForProject,
} from "../lib/newThreadInProject";
import { resolveThreadEnvironmentMode } from "../lib/threadEnvironment";
import { isTerminalFocused } from "../lib/terminalFocus";
import { serverConfigQueryOptions } from "../lib/serverReactQuery";
import { resolveShortcutCommand } from "../keybindings";
import { useStore } from "../store";
import { selectThreadTerminalState, useTerminalStateStore } from "../terminalStateStore";
import { useThreadSelectionStore } from "../threadSelectionStore";
import { onServerMaintenanceUpdated } from "../wsNativeApi";
import { useProviderStatusesForLocalConfig } from "~/hooks/useProviderStatusesForLocalConfig";
import { resolveProviderSendAvailability } from "~/lib/providerAvailability";
import { toastManager } from "~/components/ui/toast";
import { SidebarProvider } from "~/components/ui/sidebar";
import { ChatChromeActionsProvider } from "../chatChromeActionsContext";
import { useAppChromeStore } from "../appChromeStore";

const EMPTY_KEYBINDINGS: ResolvedKeybindingsConfig = [];
const MAINTENANCE_EVENT_STALE_MS = 5 * 60 * 1000;

type MaintenanceToastId = ReturnType<typeof toastManager.add>;

function ThreadRetentionMaintenanceToast() {
  const toastIdRef = useRef<MaintenanceToastId | null>(null);

  useEffect(() => {
    return onServerMaintenanceUpdated((event) => {
      if (event.type !== "maintenance" || event.payload.task !== "thread-retention") {
        return;
      }

      const { state, deletedCount, totalCount, error } = event.payload;
      const eventMs = Date.parse(event.payload.at);
      const isStaleEvent = Number.isFinite(eventMs)
        ? Date.now() - eventMs > MAINTENANCE_EVENT_STALE_MS
        : false;
      if (isStaleEvent && toastIdRef.current === null) {
        return;
      }

      if (state === "started") {
        toastIdRef.current = toastManager.add({
          type: "loading",
          title: "Hiding old chats...",
          description: "Preparing background maintenance.",
          timeout: 0,
          data: { allowCrossThreadVisibility: true },
        });
        return;
      }

      if (state === "progress") {
        const toastId =
          toastIdRef.current ??
          toastManager.add({
            type: "loading",
            title: "Hiding old chats...",
            timeout: 0,
            data: { allowCrossThreadVisibility: true },
          });
        toastIdRef.current = toastId;
        toastManager.update(toastId, {
          type: "loading",
          title: "Hiding old chats...",
          description:
            totalCount && totalCount > 0
              ? `${deletedCount ?? 0} of ${totalCount} chats hidden.`
              : `${deletedCount ?? 0} chats hidden.`,
          timeout: 0,
          data: { allowCrossThreadVisibility: true },
        });
        return;
      }

      if (state === "failed") {
        const toastId = toastIdRef.current;
        toastIdRef.current = null;
        if (toastId) {
          toastManager.update(toastId, {
            type: "warning",
            title: "Chat maintenance paused",
            description: error ?? "Old chats will be retried later.",
            timeout: 6000,
            data: { allowCrossThreadVisibility: true },
          });
          return;
        }
        toastManager.add({
          type: "warning",
          title: "Chat maintenance paused",
          description: error ?? "Old chats will be retried later.",
          timeout: 6000,
          data: { allowCrossThreadVisibility: true },
        });
        return;
      }

      const toastId = toastIdRef.current;
      toastIdRef.current = null;
      if (!toastId) return;
      toastManager.update(toastId, {
        type: "success",
        title: "Old chats hidden",
        description:
          deletedCount && deletedCount > 0
            ? `${deletedCount} old chats hidden from the app.`
            : "No old chats needed hiding.",
        timeout: 3500,
        data: { allowCrossThreadVisibility: true },
      });
    });
  }, []);

  return null;
}

function resolveBrowserNavigationShortcut(
  event: KeyboardEvent,
  platform: string,
): "back" | "forward" | null {
  const isMac = /Mac|iPhone|iPad|iPod/i.test(platform);
  const key = event.key.toLowerCase();

  if (
    isMac &&
    event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey &&
    (key === "[" || key === "]")
  ) {
    return key === "[" ? "back" : "forward";
  }

  if (
    !isMac &&
    event.altKey &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    (event.key === "ArrowLeft" || event.key === "ArrowRight")
  ) {
    return event.key === "ArrowLeft" ? "back" : "forward";
  }

  return null;
}

function isRecentViewSwitcherCommitKey(event: KeyboardEvent): boolean {
  return event.key === "Enter" || event.key === " " || event.key === "Spacebar";
}

function ChatRouteGlobalShortcuts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { settings: appSettings } = useAppSettings();
  const pathname = useLocation({ select: (location) => location.pathname });
  const toggleSearchPalette = useAppChromeStore((state) => state.toggleSearchPalette);
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const clearSelection = useThreadSelectionStore((state) => state.clearSelection);
  const selectedThreadIdsSize = useThreadSelectionStore((state) => state.selectedThreadIds.size);
  const terminalStateByThreadId = useTerminalStateStore((state) => state.terminalStateByThreadId);
  const {
    activeContextThreadId,
    activeDraftThread,
    activeProjectId,
    activeThread,
    handleNewThread,
    projects,
  } = useHandleNewThread();
  const {
    recentSwitcherState,
    recentViewEntries,
    openOrAdvanceRecentSwitcher,
    commitRecentSwitcherSelection,
    cancelRecentSwitcher,
  } = useRecentViewSwitcher({
    activeContextThreadId,
    activeDraftThread,
    projects,
  });
  const { handleNewChat } = useHandleNewChat();
  const latestProjectId = useLatestProjectStore((state) => state.latestProjectId);
  const setLatestProjectId = useLatestProjectStore((state) => state.setLatestProjectId);
  const clearLatestProjectId = useLatestProjectStore((state) => state.clearLatestProjectId);
  const threadsHydrated = useStore((state) => state.threadsHydrated);
  useDisposableThreadLifecycle(activeContextThreadId);
  const serverConfigQuery = useQuery(serverConfigQueryOptions());
  const keybindings = serverConfigQuery.data?.keybindings ?? EMPTY_KEYBINDINGS;
  const platform = typeof navigator === "undefined" ? "" : navigator.platform;
  const providerStatuses = useProviderStatusesForLocalConfig();
  const activeThreadTerminalState = activeContextThreadId
    ? selectThreadTerminalState(terminalStateByThreadId, activeContextThreadId)
    : null;
  const terminalOpen = activeThreadTerminalState?.terminalOpen ?? false;
  const allowProjectFallback = pathname !== "/";
  const activeProject =
    activeProjectId !== null
      ? (projects.find((project) => project.id === activeProjectId) ?? null)
      : null;
  const activeProjectScripts = activeProject?.kind === "project" ? activeProject.scripts : [];
  const terminalWorkspaceOpen = shouldRenderTerminalWorkspace({
    presentationMode: activeThreadTerminalState?.presentationMode ?? "drawer",
    terminalOpen,
  });
  const currentProjectId = resolveCurrentProjectTargetId(projects, activeProject?.id ?? null);
  const latestUsableProjectId = resolveLatestProjectTargetId(projects, latestProjectId);

  useEffect(() => {
    if (!currentProjectId) {
      return;
    }
    setLatestProjectId(currentProjectId);
  }, [currentProjectId, setLatestProjectId]);

  useEffect(() => {
    if (threadsHydrated && latestProjectId && latestUsableProjectId === null) {
      clearLatestProjectId(latestProjectId);
    }
  }, [clearLatestProjectId, latestProjectId, latestUsableProjectId, threadsHydrated]);

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const shortcutContext = {
        terminalFocus: isTerminalFocused(),
        terminalOpen,
        terminalWorkspaceOpen,
      };

      if (recentSwitcherState && event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancelRecentSwitcher();
        return;
      }

      if (recentSwitcherState && isRecentViewSwitcherCommitKey(event)) {
        event.preventDefault();
        event.stopPropagation();
        commitRecentSwitcherSelection();
        return;
      }

      const isShortcutsHelpShortcut =
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        !event.repeat &&
        (event.key === "/" || event.code === "Slash");
      if (isShortcutsHelpShortcut) {
        event.preventDefault();
        event.stopPropagation();
        setShortcutsDialogOpen(true);
        return;
      }

      const appNavigationShortcut = isElectron
        ? resolveBrowserNavigationShortcut(event, platform)
        : null;
      if (appNavigationShortcut) {
        event.preventDefault();
        event.stopPropagation();
        const navigationState = resolveAppNavigationState();
        if (appNavigationShortcut === "back" && navigationState.canGoBack) {
          goBackInAppHistory();
        }
        if (appNavigationShortcut === "forward" && navigationState.canGoForward) {
          goForwardInAppHistory();
        }
        return;
      }

      if (event.key === "Escape" && selectedThreadIdsSize > 0) {
        event.preventDefault();
        clearSelection();
        return;
      }

      const command = resolveShortcutCommand(event, keybindings, { context: shortcutContext });
      if (command === "sidebar.toggle" || command === "sidebar.search") {
        event.preventDefault();
        event.stopPropagation();
        toggleSearchPalette("search");
        return;
      }

      if (!command) return;

      if (command === "view.recent.next" || command === "view.recent.previous") {
        event.preventDefault();
        event.stopPropagation();
        // Ignore auto-repeat: holding Ctrl+Tab should not race-advance the selection.
        if (event.repeat) return;
        openOrAdvanceRecentSwitcher(command === "view.recent.next" ? "next" : "previous");
        return;
      }

      if (command === "chat.newChat" || command === "chat.newLocal") {
        event.preventDefault();
        event.stopPropagation();
        void handleNewChat({ fresh: true });
        return;
      }

      if (command === "chat.newLatestProject") {
        if (!latestUsableProjectId) return;
        event.preventDefault();
        event.stopPropagation();
        const projectCwd =
          projects.find((project) => project.id === latestUsableProjectId)?.cwd ?? null;
        const branches =
          queryClient.getQueryData<{ branches: ReadonlyArray<GitBranch> }>(
            gitQueryKeys.branches(projectCwd),
          )?.branches ?? null;
        void handleNewThread(
          latestUsableProjectId,
          resolveNewThreadInProjectOptions({
            defaultThreadEnvMode: appSettings.defaultThreadEnvMode,
            preferredBaseBranch: resolveWorktreeBaseBranchForProject({
              projectCwd,
              sourceThreadBranch: activeThread?.branch ?? activeDraftThread?.branch ?? null,
              branches,
            }),
          }),
        );
        return;
      }

      if (command === "chat.newTerminal") {
        const projectId = activeProjectId ?? (allowProjectFallback ? projects[0]?.id : null);
        if (!projectId) return;
        event.preventDefault();
        event.stopPropagation();
        void handleNewThread(projectId, {
          branch: activeThread?.branch ?? activeDraftThread?.branch ?? null,
          worktreePath: activeThread?.worktreePath ?? activeDraftThread?.worktreePath ?? null,
          envMode:
            activeDraftThread?.envMode ??
            resolveThreadEnvironmentMode({
              envMode: activeThread?.envMode,
              worktreePath: activeThread?.worktreePath ?? null,
            }),
          entryPoint: "terminal",
        });
        return;
      }

      if (
        command === "chat.newClaude" ||
        command === "chat.newCodex" ||
        command === "chat.newCursor" ||
        command === "chat.newGemini"
      ) {
        const provider =
          command === "chat.newClaude"
            ? "claudeAgent"
            : command === "chat.newCodex"
              ? "codex"
              : command === "chat.newCursor"
                ? "cursor"
                : "gemini";
        const providerAvailability = resolveProviderSendAvailability({
          provider,
          statuses: providerStatuses,
        });
        if (!providerAvailability.usable) {
          event.preventDefault();
          event.stopPropagation();
          toastManager.add({
            type: "error",
            title: providerAvailability.unavailableReason,
          });
          return;
        }
        const projectId = activeProjectId ?? (allowProjectFallback ? projects[0]?.id : null);
        if (!projectId) return;
        event.preventDefault();
        event.stopPropagation();
        void handleNewThread(projectId, {
          provider,
          branch: activeThread?.branch ?? activeDraftThread?.branch ?? null,
          worktreePath: activeThread?.worktreePath ?? activeDraftThread?.worktreePath ?? null,
          envMode:
            activeDraftThread?.envMode ??
            resolveThreadEnvironmentMode({
              envMode: activeThread?.envMode,
              worktreePath: activeThread?.worktreePath ?? null,
            }),
        });
        return;
      }

      if (command !== "chat.new") return;
      if (!currentProjectId) return;
      event.preventDefault();
      event.stopPropagation();
      void handleNewThread(currentProjectId, {
        branch: activeThread?.branch ?? activeDraftThread?.branch ?? null,
        worktreePath: activeThread?.worktreePath ?? activeDraftThread?.worktreePath ?? null,
        envMode:
          activeDraftThread?.envMode ??
          resolveThreadEnvironmentMode({
            envMode: activeThread?.envMode,
            worktreePath: activeThread?.worktreePath ?? null,
          }),
      });
    };

    window.addEventListener("keydown", onWindowKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown, { capture: true });
    };
  }, [
    activeDraftThread,
    activeProjectId,
    activeThread,
    allowProjectFallback,
    cancelRecentSwitcher,
    clearSelection,
    commitRecentSwitcherSelection,
    currentProjectId,
    handleNewChat,
    handleNewThread,
    keybindings,
    latestUsableProjectId,
    appSettings.defaultThreadEnvMode,
    openOrAdvanceRecentSwitcher,
    providerStatuses,
    projects,
    queryClient,
    recentSwitcherState,
    selectedThreadIdsSize,
    terminalOpen,
    terminalWorkspaceOpen,
    toggleSearchPalette,
  ]);

  useEffect(() => {
    const onMenuAction = window.desktopBridge?.onMenuAction;
    if (typeof onMenuAction !== "function") {
      return;
    }

    const unsubscribe = onMenuAction((action) => {
      if (action === "toggle-sidebar") {
        toggleSearchPalette("search");
        return;
      }
      if (action !== "open-settings") return;
      void navigate({ to: "/settings" });
    });

    return () => {
      unsubscribe?.();
    };
  }, [navigate, toggleSearchPalette]);

  return (
    <>
      <ShortcutsDialog
        open={shortcutsDialogOpen}
        onOpenChange={setShortcutsDialogOpen}
        keybindings={keybindings}
        projectScripts={activeProjectScripts}
        platform={platform}
        context={{
          terminalFocus: isTerminalFocused(),
          terminalOpen,
          terminalWorkspaceOpen,
        }}
      />
      {recentSwitcherState ? (
        <RecentViewSwitcher
          entries={recentViewEntries}
          selectedIndex={recentSwitcherState.selectedIndex}
        />
      ) : null}
    </>
  );
}

function ChatRouteLayout() {
  const isEditorView = useLocation({
    select: (location) => (location.search as { view?: unknown }).view === "editor",
  });

  return (
    <SidebarProvider defaultOpen={false} open={false} className="bg-[var(--app-shell-background)]">
      <AppChromeProvider>
        <ChatChromeActionsProvider>
          <ThreadRetentionMaintenanceToast />
          <ChatRouteGlobalShortcuts />
          <ThreadSidebar chromeOnly />
          <AppChromeOverlays />
          <div className="chat-content-card-backing relative flex h-svh min-h-0 min-w-0 flex-1 flex-col">
            {isEditorView ? null : <AppTopBar />}
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-background-surface)]">
              {isEditorView ? null : <AppTopBarIslands />}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-background-surface)]">
                <Outlet />
              </div>
            </div>
          </div>
        </ChatChromeActionsProvider>
      </AppChromeProvider>
    </SidebarProvider>
  );
}

export const Route = createFileRoute("/_chat")({
  component: ChatRouteLayout,
});
