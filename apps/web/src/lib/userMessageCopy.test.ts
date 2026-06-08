import { MessageId } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import { IMAGE_ONLY_BOOTSTRAP_PROMPT } from "./terminalContext";
import {
  buildUserMessageCopyText,
  hasCopyableUserMessageContent,
} from "./userMessageCopy";
import type { ChatMessage } from "../types";

function makeUserMessage(
  overrides: Partial<ChatMessage> & Pick<ChatMessage, "text">,
): ChatMessage {
  return {
    id: MessageId.makeUnsafe("message-1"),
    role: "user",
    createdAt: "2026-03-17T19:12:28.000Z",
    streaming: false,
    ...overrides,
  };
}

describe("buildUserMessageCopyText", () => {
  it("keeps assistant selection markup from the stored prompt", () => {
    const message = makeUserMessage({
      text: "Investigate this\n\n<assistant_selection>\n- assistant message msg-1:\n  selected line\n</assistant_selection>",
      attachments: [
        {
          type: "assistant-selection",
          id: "selection-1",
          assistantMessageId: MessageId.makeUnsafe("msg-1"),
          text: "selected line",
        },
      ],
    });

    expect(buildUserMessageCopyText(message)).toBe(message.text);
  });

  it("appends assistant selection markup when only attachments are present", () => {
    const message = makeUserMessage({
      text: "Investigate this",
      attachments: [
        {
          type: "assistant-selection",
          id: "selection-1",
          assistantMessageId: MessageId.makeUnsafe("msg-1"),
          text: "selected line",
        },
      ],
    });

    expect(buildUserMessageCopyText(message)).toBe(
      "Investigate this\n\n<assistant_selection>\n- assistant message msg-1:\n  selected line\n</assistant_selection>",
    );
  });

  it("removes the image-only bootstrap prompt while keeping user text", () => {
    const message = makeUserMessage({
      text: `Please compare these\n\n${IMAGE_ONLY_BOOTSTRAP_PROMPT}`,
      attachments: [
        {
          type: "image",
          id: "image-1",
          name: "diagram.png",
          mimeType: "image/png",
          sizeBytes: 42,
          previewUrl: "/attachments/image-1",
        },
      ],
    });

    expect(buildUserMessageCopyText(message)).toBe("Please compare these");
  });
});

describe("hasCopyableUserMessageContent", () => {
  it("returns true for image-only messages", () => {
    const message = makeUserMessage({
      text: IMAGE_ONLY_BOOTSTRAP_PROMPT,
      attachments: [
        {
          type: "image",
          id: "image-1",
          name: "diagram.png",
          mimeType: "image/png",
          sizeBytes: 42,
          previewUrl: "/attachments/image-1",
        },
      ],
    });

    expect(hasCopyableUserMessageContent(message)).toBe(true);
  });
});
