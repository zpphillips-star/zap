import { useEffect, useRef } from "react";
import { marked } from "marked";
// Import only highlight.js core + common languages to keep bundle small
// Full hljs import would be ~900KB; this subset covers ~95% of real usage
import hljs from "highlight.js/lib/core";
import langBash from "highlight.js/lib/languages/bash";
import langC from "highlight.js/lib/languages/c";
import langCpp from "highlight.js/lib/languages/cpp";
import langCss from "highlight.js/lib/languages/css";
import langDiff from "highlight.js/lib/languages/diff";
import langGo from "highlight.js/lib/languages/go";
import langJava from "highlight.js/lib/languages/java";
import langJs from "highlight.js/lib/languages/javascript";
import langJson from "highlight.js/lib/languages/json";
import langMarkdown from "highlight.js/lib/languages/markdown";
import langPython from "highlight.js/lib/languages/python";
import langRust from "highlight.js/lib/languages/rust";
import langShell from "highlight.js/lib/languages/shell";
import langSql from "highlight.js/lib/languages/sql";
import langTs from "highlight.js/lib/languages/typescript";
import langXml from "highlight.js/lib/languages/xml";
import langYaml from "highlight.js/lib/languages/yaml";
import DOMPurify from "dompurify";
import "highlight.js/styles/github-dark.css";
import "./MessageBubble.css";

// Register languages with the core instance
hljs.registerLanguage("bash", langBash);
hljs.registerLanguage("c", langC);
hljs.registerLanguage("cpp", langCpp);
hljs.registerLanguage("css", langCss);
hljs.registerLanguage("diff", langDiff);
hljs.registerLanguage("go", langGo);
hljs.registerLanguage("java", langJava);
hljs.registerLanguage("javascript", langJs);
hljs.registerLanguage("js", langJs);
hljs.registerLanguage("json", langJson);
hljs.registerLanguage("markdown", langMarkdown);
hljs.registerLanguage("python", langPython);
hljs.registerLanguage("py", langPython);
hljs.registerLanguage("rust", langRust);
hljs.registerLanguage("sh", langShell);
hljs.registerLanguage("shell", langShell);
hljs.registerLanguage("sql", langSql);
hljs.registerLanguage("ts", langTs);
hljs.registerLanguage("typescript", langTs);
hljs.registerLanguage("xml", langXml);
hljs.registerLanguage("html", langXml);
hljs.registerLanguage("yaml", langYaml);
hljs.registerLanguage("yml", langYaml);

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

// Configure marked using the extension API (v12+) — renderer + options in one call
// Using `any` for the token parameter because marked v12 TypeScript types still
// declare the old Renderer.code(code, infostring, escaped) signature, but at runtime
// passes a token object { text, lang }. The extension renderer API accepts the token form.
marked.use({
  breaks: true,
  gfm: true,
  renderer: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    code(token: any): string {
      const { text, lang } = token;
      const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
      // "plaintext" is not registered with hljs core — escape and return as-is.
      // Also wrap any unexpected hljs error in a safe fallback so code blocks never crash.
      let highlighted: string;
      if (language === "plaintext") {
        highlighted = text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      } else {
        try {
          highlighted = hljs.highlight(text, { language }).value;
        } catch {
          highlighted = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        }
      }
      return `<div class="code-block">
    <span class="code-lang">${language !== "plaintext" ? language : ""}</span>
    <button class="code-copy-btn">Copy</button>
    <pre><code class="hljs language-${language}">${highlighted}</code></pre>
  </div>`;
    },
  },
});

function renderMarkdown(text: string): string {
  const html = marked.parse(text) as string;
  // No ADD_ATTR needed — copy buttons use event delegation (no inline onclick)
  return DOMPurify.sanitize(html);
}

function MarkdownContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  // Event delegation for code copy buttons — avoids inline onclick (XSS risk)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function handleCopy(e: MouseEvent) {
      const btn = (e.target as HTMLElement).closest(".code-copy-btn") as HTMLButtonElement | null;
      if (!btn) return;
      const code = btn.closest(".code-block")?.querySelector("code");
      if (!code) return;
      const text = code.innerText;

      function markDone() {
        btn!.textContent = "✓";
        setTimeout(() => { btn!.textContent = "Copy"; }, 1500);
      }
      function markFail() { btn!.textContent = "!"; }

      // navigator.clipboard requires a secure context (HTTPS or localhost).
      // When ZAP is served over plain HTTP to a remote VM IP, fall back to the
      // legacy execCommand approach so the copy button still works.
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(markDone).catch(markFail);
      } else {
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          markDone();
        } catch {
          markFail();
        }
      }
    }
    el.addEventListener("click", handleCopy);
    return () => el.removeEventListener("click", handleCopy);
  }, []); // mount only — delegation handles dynamically injected buttons

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
