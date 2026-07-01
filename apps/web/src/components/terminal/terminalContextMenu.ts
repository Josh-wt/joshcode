// FILE: terminalContextMenu.ts
// Purpose: Copy/paste/select context menu for xterm surfaces (native menu on desktop).
// Layer: Terminal UI helpers

import type { ContextMenuItem } from "@t3tools/contracts";
import type { Terminal } from "@xterm/xterm";

import { showContextMenuFallback } from "~/contextMenuFallback";
import type { TerminalContextSelection } from "~/lib/terminalContext";
import { readNativeApi } from "~/nativeApi";

export type TerminalContextMenuItemId = "copy" | "paste" | "select-all" | "add-to-chat";

export function buildTerminalContextMenuItems(input: {
  hasSelection: boolean;
  canAddToChat: boolean;
}): ContextMenuItem<TerminalContextMenuItemId>[] {
  const items: ContextMenuItem<TerminalContextMenuItemId>[] = [];
  if (input.canAddToChat && input.hasSelection) {
    items.push({ id: "add-to-chat", label: "Add to chat" });
  }
  items.push(
    { id: "copy", label: "Copy", separatorBefore: items.length > 0 },
    { id: "paste", label: "Paste" },
    { id: "select-all", label: "Select all", separatorBefore: true },
  );
  return items;
}

export function normalizeTerminalSelectionText(selection: string): string {
  return selection.replace(/\r\n/g, "\n").replace(/^\n+|\n+$/g, "");
}

export async function copyTerminalSelection(terminal: Terminal): Promise<boolean> {
  if (!terminal.hasSelection()) {
    return false;
  }
  const selection = normalizeTerminalSelectionText(terminal.getSelection());
  if (selection.length === 0) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(selection);
    return true;
  } catch {
    return false;
  }
}

export async function pasteIntoTerminal(terminal: Terminal): Promise<void> {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      return;
    }
    terminal.paste(text);
  } catch {
    // Clipboard access can fail when unfocused or denied.
  }
}

export async function showTerminalContextMenu(input: {
  terminal: Terminal;
  position: { x: number; y: number };
  canAddToChat: boolean;
  onAddToChat?: ((selection: TerminalContextSelection) => void) | undefined;
  contextSelection?: TerminalContextSelection | null | undefined;
}): Promise<TerminalContextMenuItemId | null> {
  const hasSelection = input.terminal.hasSelection();
  const items = buildTerminalContextMenuItems({
    hasSelection,
    canAddToChat: input.canAddToChat && input.contextSelection != null,
  });
  const api = readNativeApi();
  const clicked = api
    ? await api.contextMenu.show(items, input.position)
    : await showContextMenuFallback(items, input.position);
  if (!clicked) {
    return null;
  }

  switch (clicked) {
    case "copy":
      await copyTerminalSelection(input.terminal);
      break;
    case "paste":
      await pasteIntoTerminal(input.terminal);
      break;
    case "select-all":
      input.terminal.selectAll();
      break;
    case "add-to-chat":
      if (input.contextSelection && input.onAddToChat) {
        input.onAddToChat(input.contextSelection);
        input.terminal.clearSelection();
      }
      break;
  }

  return clicked;
}
