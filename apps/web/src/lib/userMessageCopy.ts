import { appendAssistantSelectionsToPrompt } from "./assistantSelections";
import { copyRichContentToClipboard } from "../hooks/useCopyToClipboard";
import { IMAGE_ONLY_BOOTSTRAP_PROMPT } from "./terminalContext";
import type { ChatAssistantSelectionAttachment, ChatImageAttachment, ChatMessage } from "../types";

export function getUserMessageImageAttachments(
  message: ChatMessage,
): ReadonlyArray<ChatImageAttachment> {
  return (message.attachments ?? []).filter(
    (attachment): attachment is ChatImageAttachment => attachment.type === "image",
  );
}

export function getUserMessageAssistantSelectionAttachments(
  message: ChatMessage,
): ReadonlyArray<ChatAssistantSelectionAttachment> {
  return (message.attachments ?? []).filter(
    (attachment): attachment is ChatAssistantSelectionAttachment =>
      attachment.type === "assistant-selection",
  );
}

export function buildUserMessageCopyText(message: ChatMessage): string {
  const imageAttachments = getUserMessageImageAttachments(message);
  const assistantSelectionAttachments = getUserMessageAssistantSelectionAttachments(message);

  let text = message.text;
  if (imageAttachments.length > 0) {
    text = text.split(IMAGE_ONLY_BOOTSTRAP_PROMPT).join("").trim();
  }

  if (
    assistantSelectionAttachments.length > 0 &&
    !text.includes("<assistant_selection>")
  ) {
    text = appendAssistantSelectionsToPrompt(text, assistantSelectionAttachments);
  }

  return text.trim();
}

export function hasCopyableUserMessageContent(message: ChatMessage): boolean {
  return (
    buildUserMessageCopyText(message).length > 0 ||
    getUserMessageImageAttachments(message).length > 0
  );
}

async function fetchImageAttachmentBlob(image: ChatImageAttachment): Promise<Blob | null> {
  if (!image.previewUrl) {
    return null;
  }

  try {
    const response = await fetch(image.previewUrl);
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

export async function copyUserMessageToClipboard(message: ChatMessage): Promise<void> {
  const text = buildUserMessageCopyText(message);
  const imageBlobs = (
    await Promise.all(getUserMessageImageAttachments(message).map(fetchImageAttachmentBlob))
  ).filter((blob): blob is Blob => blob !== null);

  await copyRichContentToClipboard({
    ...(text.length > 0 ? { text } : {}),
    ...(imageBlobs.length > 0 ? { blobs: imageBlobs } : {}),
  });
}

export function describeUserMessageCopyContent(message: ChatMessage): string {
  const text = buildUserMessageCopyText(message);
  const imageCount = getUserMessageImageAttachments(message).length;
  const selectionCount = getUserMessageAssistantSelectionAttachments(message).length;

  const parts: string[] = [];
  if (text.length > 0) {
    parts.push("message text");
  }
  if (selectionCount > 0 && text.includes("<assistant_selection>")) {
    parts.push(selectionCount === 1 ? "referenced selection" : "referenced selections");
  }
  if (imageCount > 0) {
    parts.push(imageCount === 1 ? "image attachment" : "image attachments");
  }

  if (parts.length === 0) {
    return "Copied!";
  }
  if (parts.length === 1) {
    return `Copied ${parts[0]}!`;
  }
  return `Copied ${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}!`;
}
