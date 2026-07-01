// FILE: chatChromeActionsContext.tsx
// Purpose: Lets thread routes register action controls into the unified AppTopBar islands.
// Layer: Route chrome context

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

interface ChatChromeActionsContextValue {
  threadActions: ReactNode | null;
  setThreadActions: (node: ReactNode | null) => void;
}

const ChatChromeActionsContext = createContext<ChatChromeActionsContextValue | null>(null);

export function ChatChromeActionsProvider({ children }: { children: ReactNode }) {
  const [threadActions, setThreadActions] = useState<ReactNode | null>(null);
  const value = useMemo(
    () => ({
      threadActions,
      setThreadActions,
    }),
    [threadActions],
  );
  return (
    <ChatChromeActionsContext.Provider value={value}>{children}</ChatChromeActionsContext.Provider>
  );
}

export function useChatChromeActions() {
  const context = useContext(ChatChromeActionsContext);
  if (!context) {
    throw new Error("useChatChromeActions must be used within ChatChromeActionsProvider.");
  }
  return context;
}

export function ChatChromeActionsBridge({ children }: { children: ReactNode }) {
  const { setThreadActions } = useChatChromeActions();
  const childrenRef = useRef(children);
  childrenRef.current = children;

  useEffect(() => {
    setThreadActions(childrenRef.current);
    return () => setThreadActions(null);
  });

  return null;
}
