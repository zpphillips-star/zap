import { useState, useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import InputBar from "./InputBar";
import "./ChatView.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface ChatViewProps {
  sessionId: string;
}

export default function ChatView({ sessionId }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  // Restore messages from localStorage on mount (survives page refresh)
  useEffect(() => {
    const saved = localStorage.getItem(`zap-messages-${sessionId}`);
    if (saved) {
      try {
        const parsed: Message[] = JSON.parse(saved);
        // Clear any stuck streaming state from a previous crashed session
        setMessages(parsed.map((m) => ({ ...m, streaming: false })));
      } catch {
        localStorage.removeItem(`zap-messages-${sessionId}`);
      }
    }
  }, [sessionId]);

  // Persist stable (non-streaming) messages to localStorage
  useEffect(() => {
    if (messages.length === 0) return; // handled by clearChat explicitly
    const stable = messages.filter((m) => !m.streaming);
    if (stable.length === 0) return; // mid-stream, wait for next update
    try {
      localStorage.setItem(
        `zap-messages-${sessionId}`,
        JSON.stringify(stable.slice(-100)) // cap at 100 messages to stay within quota
      );
    } catch {
      // localStorage quota exceeded — fail silently
    }
  }, [messages, sessionId]);

  // Smart auto-scroll: only scroll if user is near the bottom
  useEffect(() => {
    if (!userScrolledUp.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      userScrolledUp.current = !atBottom;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    userScrolledUp.current = false;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", streaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Helper to parse and apply SSE lines from a buffer string
      function processSSELines(raw: string) {
        const lines = raw.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "chunk") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + data.text } : m
                )
              );
            } else if (data.type === "done") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, streaming: false } : m
                )
              );
            } else if (data.type === "error") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: (m.content || "") + `\n\n⚠ Error: ${data.text}`, streaming: false }
                    : m
                )
              );
            }
          } catch {}
        }
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Flush TextDecoder internal state (handles multi-byte UTF-8 split across chunks)
          buffer += decoder.decode();
          // Process any SSE events that were buffered but not yet applied
          if (buffer.trim()) processSSELines(buffer);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        processSSELines(lines.join("\n"));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Error: ${message}`, streaming: false }
            : m
        )
      );
    } finally {
      setLoading(false);
      // Guarantee streaming cursor is cleared even if done SSE event was still in unprocessed buffer
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, streaming: false } : m
        )
      );
    }
  }

  async function clearChat() {
    await fetch("/api/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    setMessages([]);
    localStorage.removeItem(`zap-messages-${sessionId}`);
  }

  const lastMsg = messages[messages.length - 1];
  const showTyping = loading && lastMsg?.content === "" && lastMsg?.streaming;

  return (
    <div className="chat-layout">
      <div className="messages-area" ref={messagesRef}>
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">⚡</div>
            <div className="empty-title">ZAP</div>
            <div className="empty-subtitle">Your personal AI. What do you need?</div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {showTyping && (
          <div className="typing-indicator">
            <span /><span /><span />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <InputBar onSend={sendMessage} onClear={clearChat} loading={loading} />
    </div>
  );
}
