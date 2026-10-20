import { createContext, useContext } from "react";

import { useAiChat } from "../hooks/useAiChat";

const AiChatContext = createContext(null);

/**
 * Holds the chat state above the router's page switch, so navigating away from
 * the AI Chat page doesn't destroy the conversation. Any reply that is still
 * streaming keeps updating this state while the user is on another page.
 *
 * Mount it inside RequireAuth so the chat is discarded when the user signs out.
 */
export function AiChatProvider({ children }) {
  const chat = useAiChat();
  return <AiChatContext.Provider value={chat}>{children}</AiChatContext.Provider>;
}

export function useAiChatContext() {
  const context = useContext(AiChatContext);
  if (!context) {
    throw new Error("useAiChatContext must be used inside <AiChatProvider>");
  }
  return context;
}
