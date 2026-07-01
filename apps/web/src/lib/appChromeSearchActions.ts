// FILE: appChromeSearchActions.ts
// Purpose: Search palette action definitions for app chrome (shared by palette host).
// Layer: UI logic

import type { ResolvedKeybindingsConfig } from "@t3tools/contracts";

import { shortcutLabelForCommand } from "~/keybindings";
import type { SidebarSearchAction } from "~/components/SidebarSearchPalette.logic";

export function buildAppChromeSearchActions(input: {
  keybindings: ResolvedKeybindingsConfig;
}): SidebarSearchAction[] {
  const newChatShortcutLabel = shortcutLabelForCommand(input.keybindings, "chat.new");
  const newThreadShortcutLabel = shortcutLabelForCommand(input.keybindings, "chat.new");
  const addProjectShortcutLabel = shortcutLabelForCommand(input.keybindings, "sidebar.addProject");
  const importThreadShortcutLabel = shortcutLabelForCommand(input.keybindings, "sidebar.importThread");
  const usageSettingsShortcutLabel = shortcutLabelForCommand(input.keybindings, "settings.usage");

  return [
    {
      id: "new-chat",
      label: "New chat",
      description: "Open the new chat landing screen.",
      keywords: ["chat", "new", "home"],
      shortcutLabel: newChatShortcutLabel,
    },
    {
      id: "new-thread",
      label: "New thread",
      description: "Start a fresh thread in the current project.",
      keywords: ["thread", "new", "project"],
      shortcutLabel: newThreadShortcutLabel,
    },
    {
      id: "add-project",
      label: "Add project",
      description: "Open a repository or folder.",
      keywords: ["folder", "repo", "repository", "open"],
      shortcutLabel: addProjectShortcutLabel,
    },
    {
      id: "import-thread",
      label: "Import thread from...",
      description: "Attach a local thread to an existing provider session.",
      keywords: ["import", "resume", "thread", "session", "codex", "claude", "cursor", "opencode"],
      shortcutLabel: importThreadShortcutLabel,
    },
    {
      id: "automations",
      label: "Automations",
      description: "Scheduled agent work and run history.",
      keywords: ["automation", "schedule", "cron", "heartbeat"],
    },
    {
      id: "plugins",
      label: "Plugins",
      description: "Browse installed plugins.",
      keywords: ["plugin", "extensions", "marketplace"],
    },
    {
      id: "archived-threads",
      label: "Archived threads",
      description: "View and restore archived threads.",
      keywords: ["archive", "restore", "hidden"],
    },
    {
      id: "worktrees",
      label: "Worktrees",
      description: "Review and clean up Synara worktrees.",
      keywords: ["worktree", "git", "branch"],
    },
    {
      id: "sort-projects",
      label: "Sort projects…",
      description: "Open settings to change project sort order.",
      keywords: ["sort", "projects", "order"],
    },
    {
      id: "sort-threads",
      label: "Sort threads…",
      description: "Open settings to change thread sort order.",
      keywords: ["sort", "threads", "order"],
    },
    {
      id: "settings",
      label: "Settings",
      description: "Open app settings.",
      keywords: ["preferences", "config"],
    },
    {
      id: "usage-settings",
      label: "Usage settings",
      description: "Open provider usage and remaining credits.",
      keywords: ["usage", "limits", "credits", "quota", "providers"],
      shortcutLabel: usageSettingsShortcutLabel,
    },
  ];
}
