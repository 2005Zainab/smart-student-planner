import { useEffect, useRef, memo } from "react";
import Markdown from "react-markdown";
import { RotateCcw, SendHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAiChatContext } from "../context/AiChatContext";

const SUGGESTIONS = [
  "Plan my day today",
  "What's due this week?",
  "What should I prioritise first?",
  "Recommend me some study methods",
];

// Tailwind's reset strips list and heading styles, so style Markdown elements explicitly.
// `node` is pulled out so it isn't spread onto the DOM element.
/* eslint-disable no-unused-vars */
const markdownComponents = {
  p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
  ul: ({ node, ...props }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0" {...props} />,
  ol: ({ node, ...props }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0" {...props} />
  ),
  h1: ({ node, ...props }) => <h3 className="mb-1 mt-3 text-base font-semibold" {...props} />,
  h2: ({ node, ...props }) => <h3 className="mb-1 mt-3 text-base font-semibold" {...props} />,
  h3: ({ node, ...props }) => <h4 className="mb-1 mt-3 font-semibold" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
};
/* eslint-enable no-unused-vars */

const MessageBubble = memo(function MessageBubble({ message, isStreaming }) {
  const isUser = message.role === "user";

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground"
            : "max-w-[85%] rounded-2xl bg-muted px-4 py-2 text-sm"
        }
      >
        {isUser ? (
          message.text
        ) : message.text ? (
          <Markdown components={markdownComponents}>{message.text}</Markdown>
        ) : (
          <span className="text-muted-foreground">{isStreaming ? "Thinking..." : ""}</span>
        )}
      </div>
    </div>
  );
});

function AiChatPage() {
  const {
    messages,
    isStreaming,
    error,
    draft: input,
    setDraft: setInput,
    sendMessage,
    resetChat,
  } = useAiChatContext();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function submit(text) {
    if (!text.trim() || isStreaming) return;
    sendMessage(text);
    setInput("");
  }

  function handleKeyDown(event) {
    // Enter sends, Shift+Enter adds a new line. Ignore Enter while an IME is composing.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit(input);
    }
  }

  return (
    // Adjust the height offset if your AppShell header is taller or shorter.
    <div className="mx-auto flex h-[calc(100dvh-5rem)] w-full max-w-3xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Sparkles className="size-5" />
            AI Planner
          </h1>
          <p className="text-xs text-muted-foreground">
            Ask AI to help you plan your time, prioritise tasks, or suggest what to do next.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={resetChat}
          disabled={isStreaming || messages.length === 0}
        >
          <RotateCcw />
          New chat
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              Ask how to spend your time, or try one of these:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map(suggestion => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => submit(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(message => (
            <MessageBubble key={message.id} message={message} isStreaming={isStreaming} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <form
        className="flex items-end gap-2"
        onSubmit={event => {
          event.preventDefault();
          submit(input);
        }}
      >
        <Textarea
          value={input}
          onChange={event => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask for suggestions on how to spend your time..."
          rows={2}
          className="min-h-0 resize-none"
        />
        <Button type="submit" size="icon" disabled={isStreaming || !input.trim()} aria-label="Send">
          <SendHorizontal />
        </Button>
      </form>
    </div>
  );
}

export { AiChatPage };
