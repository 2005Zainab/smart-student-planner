import { useCallback, useRef, useState } from "react";
import { getGenerativeModel } from "firebase/ai";
import { ai } from "../../../shared/auth";
import { getCalendarTasks } from "../../calendar/api/get-calendar-tasks";
import { buildSystemInstruction, getContextRange } from "../utils/buildScheduleContext";

const MODEL_NAME = "gemini-3.8-flash";

function getFriendlyError(error) {
  const message = String(error?.message ?? error).toLowerCase();

  if (message.includes("app check") || message.includes("appcheck")) {
    return "The request was rejected by App Check. Make sure your debug token is registered in the Firebase console.";
  }
  if (message.includes("429") || message.includes("quota")) {
    return "Too many requests right now. Wait a moment and try again.";
  }
  return "The assistant couldn't respond. Please try again.";
}

/**
 * Multi-turn chat with Gemini through Firebase AI Logic.
 * Tasks are fetched from the calendar endpoint when the first message of a chat
 * is sent, so each new chat starts from fresh data. "New chat" (resetChat) clears it.
 */
export function useAiChat() {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const chatRef = useRef(null);

  const sendMessage = useCallback(
    async rawText => {
      const text = rawText.trim();
      if (!text || isStreaming) return;

      const replyId = crypto.randomUUID();
      let stage = "model";
      setError(null);
      setIsStreaming(true);
      setMessages(previous => [
        ...previous,
        { id: crypto.randomUUID(), role: "user", text },
        { id: replyId, role: "model", text: "" },
      ]);

      try {
        if (!chatRef.current) {
          stage = "tasks";
          const { from, to } = getContextRange();
          const tasks = await getCalendarTasks(from, to);

          stage = "model";
          const model = getGenerativeModel(ai, {
            model: MODEL_NAME,
            systemInstruction: buildSystemInstruction(tasks),
          });
          chatRef.current = model.startChat();
        }

        const result = await chatRef.current.sendMessageStream(text);
        let reply = "";
        for await (const chunk of result.stream) {
          reply += chunk.text();
          setMessages(previous =>
            previous.map(message =>
              message.id === replyId ? { ...message, text: reply } : message,
            ),
          );
        }
      } catch (caught) {
        console.error(caught);
        setError(
          stage === "tasks"
            ? "Couldn't load your tasks, so the assistant has nothing to plan with. Please try again."
            : getFriendlyError(caught),
        );
        // Drop the empty placeholder if nothing streamed in.
        setMessages(previous =>
          previous.filter(message => !(message.id === replyId && message.text === "")),
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming],
  );

  const resetChat = useCallback(() => {
    chatRef.current = null;
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isStreaming, error, draft, setDraft, sendMessage, resetChat };
}
