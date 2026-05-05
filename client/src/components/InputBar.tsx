import { useState, useRef, useEffect } from "react";
import "./InputBar.css";

interface InputBarProps {
  onSend: (text: string) => void;
  onClear: () => void;
  loading: boolean;
}

export default function InputBar({ onSend, onClear, loading }: InputBarProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [value]);

  // Refocus input when loading finishes
  useEffect(() => {
    if (!loading) {
      textareaRef.current?.focus();
    }
  }, [loading]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      // If there's text in the input, clear the input first.
      // Only clear the whole chat if the input is already empty.
      if (value.trim()) {
        setValue("");
      } else {
        onClear();
      }
    }
  }

  function submit() {
    const text = value.trim();
    if (!text || loading) return;
    setValue("");
    onSend(text);
  }

  return (
    <div className="input-bar">
      <div className="input-container">
        <textarea
          ref={textareaRef}
          className="input-textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask ZAP anything…"
          rows={1}
          disabled={loading}
        />
        <div className="input-actions">
          <button className="clear-btn" onClick={onClear} title="Clear chat" disabled={loading}>
            ↺
          </button>
          <button
            className={`send-btn ${loading ? "loading" : ""}`}
            onClick={submit}
            disabled={loading || !value.trim()}
            title="Send (Enter)"
          >
            {loading ? "…" : "↑"}
          </button>
        </div>
      </div>
      <div className="input-hint">Enter to send · Shift+Enter for new line · Esc to clear</div>
    </div>
  );
}
