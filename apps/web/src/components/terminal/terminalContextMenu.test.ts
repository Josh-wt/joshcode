import { describe, expect, it } from "vitest";

import { buildTerminalContextMenuItems, normalizeTerminalSelectionText } from "./terminalContextMenu";

describe("buildTerminalContextMenuItems", () => {
  it("includes copy, paste, and select all by default", () => {
    expect(buildTerminalContextMenuItems({ hasSelection: false, canAddToChat: false })).toEqual([
      { id: "copy", label: "Copy", separatorBefore: false },
      { id: "paste", label: "Paste" },
      { id: "select-all", label: "Select all", separatorBefore: true },
    ]);
  });

  it("adds add-to-chat when selection and chat handoff are available", () => {
    expect(buildTerminalContextMenuItems({ hasSelection: true, canAddToChat: true })).toEqual([
      { id: "add-to-chat", label: "Add to chat" },
      { id: "copy", label: "Copy", separatorBefore: true },
      { id: "paste", label: "Paste" },
      { id: "select-all", label: "Select all", separatorBefore: true },
    ]);
  });
});

describe("normalizeTerminalSelectionText", () => {
  it("normalizes line endings and trims outer blank lines", () => {
    expect(normalizeTerminalSelectionText("\nhello\r\nworld\n")).toBe("hello\nworld");
  });
});
