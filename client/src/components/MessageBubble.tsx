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
      const highlighted = hljs.highlight(text, { language }).value;
      return `<div class="code-block">
    <span class="code-lang">${language !== "plaintext" ? language : ""}</span>
    <button class="code-copy-btn" onclick="(function(btn){var code=btn.closest('.code-block').querySelector('code');navigator.clipboard.writeText(code.innerText).then(function(){btn.textContent='✓';setTimeout(function(){btn.textContent='Copy'},1500)}).catch(function(){btn.textContent='!'});})(this)">Copy</button>
    <pre><code class="hljs language-${language}">${highlighted}</code></pre>
  </div>`;
    },
  },
});

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
