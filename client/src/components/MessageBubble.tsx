import { useEffect, useRef } from "react";
import { marked } from "marked";
import hljs from "highlight.js";
import DOMPurify from "dompurify";
import "highlight.js/styles/github-dark.css";
import "./MessageBubble.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

// Configure marked with highlight.js
marked.setOptions({
  breaks: true,
  gfm: true,
});

const renderer = new marked.Renderer();
renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
  const highlighted = hljs.highlight(text, { language }).value;
  return `<div class="code-block">
    <span class="code-lang">${language !== "plaintext" ? language : ""}</span>
    <button class="code-copy-btn" onclick="(function(btn){var code=btn.closest('.code-block').querySelector('code');navigator.clipboard.writeText(code.innerText).then(function(){btn.textContent='✓';setTimeout(function(){btn.textContent='Copy'},1500)}).catch(function(){btn.textContent='!'});})(this)">Copy</button>
    <pre><code class="hljs language-${language}">${highlighted}</code></pre>
  </div>`;
};

function renderMarkdown(text: string): string {
  const html = marked.parse(text) as string;
  return DOMPurify.sanitize(html, { ADD_ATTR: ["onclick"] });
}

function MarkdownContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = renderMarkdown(text) + (streaming ? '<span class="cursor">▋</span>' : "");
    }
  }, [text, streaming]);

  return <div ref={ref} className="bubble-content" />;
}

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`bubble-wrapper ${isUser ? "user" : "assistant"}`}>
      <div className={`bubble ${isUser ? "bubble-user" : "bubble-assistant"}`}>
        {isUser ? (
          <p className="md-p">{message.content}</p>
        ) : (
          <MarkdownContent text={message.content} streaming={message.streaming} />
        )}
      </div>
    </div>
  );
}
