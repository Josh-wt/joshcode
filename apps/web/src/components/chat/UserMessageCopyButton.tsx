import { memo, useRef, useState, type RefObject } from "react";
import { CheckIcon, CopyIcon } from "~/lib/icons";
import {
  copyUserMessageToClipboard,
  describeUserMessageCopyContent,
} from "../../lib/userMessageCopy";
import type { ChatMessage } from "../../types";
import { anchoredToastManager } from "../ui/toast";
import { MessageActionButton, MESSAGE_ACTION_ICON_CLASS_NAME } from "./MessageActionButton";

const ANCHORED_TOAST_TIMEOUT_MS = 1000;

function showCopyToast(
  ref: RefObject<HTMLButtonElement | null>,
  title: string,
  description?: string,
): void {
  if (!ref.current) return;

  anchoredToastManager.add({
    data: {
      tooltipStyle: true,
    },
    positionerProps: {
      anchor: ref.current,
    },
    timeout: ANCHORED_TOAST_TIMEOUT_MS,
    title,
    ...(description ? { description } : {}),
  });
}

export const UserMessageCopyButton = memo(function UserMessageCopyButton({
  message,
  className,
}: {
  message: ChatMessage;
  className?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [isCopied, setIsCopied] = useState(false);
  const timeoutIdRef = useRef<number | null>(null);

  const onClick = () => {
    void copyUserMessageToClipboard(message).then(
      () => {
        if (timeoutIdRef.current !== null) {
          window.clearTimeout(timeoutIdRef.current);
        }
        setIsCopied(true);
        showCopyToast(ref, describeUserMessageCopyContent(message));
        timeoutIdRef.current = window.setTimeout(() => {
          setIsCopied(false);
          timeoutIdRef.current = null;
        }, ANCHORED_TOAST_TIMEOUT_MS);
      },
      (error: unknown) => {
        const description =
          error instanceof Error ? error.message : "The message could not be copied.";
        showCopyToast(ref, "Failed to copy", description);
      },
    );
  };

  return (
    <MessageActionButton
      ref={ref}
      label="Copy message"
      tooltip="Copy to clipboard"
      disabled={isCopied}
      className={className}
      onClick={onClick}
    >
      {isCopied ? (
        <CheckIcon className={`${MESSAGE_ACTION_ICON_CLASS_NAME} text-success`} />
      ) : (
        <CopyIcon className={MESSAGE_ACTION_ICON_CLASS_NAME} />
      )}
    </MessageActionButton>
  );
});
