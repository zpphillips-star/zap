import "./MessageBubble.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

function renderContent(text: string) {
  // Simple markdown-ish rendering
  const lines = text.split("\n");
  const elements: JSX.Element[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let codeLang = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (!inCode) {
        inCode = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      } else {
        elements.push(
          <pre key={i}>
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        inCode = false;
        codeLines = [];
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="md-h3">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="md-h2">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="md-h1">{line.slice(2)}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(<li key={i} className="md-li">{line.slice(2)}</li>);
    } else if (line === "") {
      elements.push(<div key={i} className="md-spacer" />);
    } else {
      // Inline code
      const parts = line.split(/(`[^`]+`)/);
      const rendered = parts.map((p, j) =>
        p.startsWith("`") && p.endsWith("`") ? <code key={j}>{p.slice(1, -1)}</code> : p
      );
      elements.push(<p key={i} className="md-p">{rendered}</p>);
    }
  }

  return elements;
}

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`bubble-wrapper ${isUser ? "user" : "assistant"}`}>
      <div className={`bubble ${isUser ? "bubble-user" : "bubble-assistant"}`}>
        {isUser ? (
          <p className="md-p">{message.content}</p>
        ) : (
          <div className="bubble-content">
            {renderContent(message.content)}
            {message.streaming && <span className="cursor">▋</span>}
          </div>
        )}
      </div>
    </div>
  );
}
