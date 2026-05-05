import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { Octokit } from "@octokit/rest";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Startup validation ───────────────────────────────────────────────────────
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("❌  ANTHROPIC_API_KEY is not set.");
  console.error("    Copy server/.env.example to server/.env and add your Anthropic API key.");
  console.error("    ZAP cannot start without it.");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// ─── Anthropic client ─────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── GitHub client ────────────────────────────────────────────────────────────
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// ─── Memory (simple JSON file) ────────────────────────────────────────────────
const MEMORY_FILE = join(__dirname, "memory.json");
if (!existsSync(MEMORY_FILE)) writeFileSync(MEMORY_FILE, JSON.stringify({ conversations: [], notes: [] }));

function loadMemory() {
  try {
    return JSON.parse(readFileSync(MEMORY_FILE, "utf8"));
  } catch {
    // Return safe default if file is missing or corrupted
    return { conversations: [], notes: [] };
  }
}
function saveMemory(data) {
  try {
    writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to save memory:", err.message);
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are ZAP, a personal AI assistant. You are direct, helpful, and focused.
You have access to the user's personal GitHub and can help with code, PRs, issues, and repositories.
You can also help with email drafting and general tasks.
Keep responses concise unless detail is specifically needed.
You remember things the user tells you about themselves and their projects.`;

// ─── Conversation history (in-memory per session, persisted to file) ──────────
const sessions = new Map();       // sessionId -> messages[]
const sessionLastUsed = new Map(); // sessionId -> Date.now() ms timestamp

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours of inactivity → evict

// Purge sessions idle for more than SESSION_TTL_MS.
// Runs every 6 hours; .unref() lets Node exit cleanly without waiting for this timer.
setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, ts] of sessionLastUsed) {
    if (ts < cutoff) {
      sessions.delete(id);
      sessionLastUsed.delete(id);
    }
  }
}, 6 * 60 * 60 * 1000).unref();

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    const memory = loadMemory();
    const lastConversations = memory.conversations.slice(-3);
    let context = "";
    if (lastConversations.length > 0) {
      context = `[Recent context from previous sessions: ${lastConversations.map(c => c.summary || "").join("; ")}]`;
    }
    sessions.set(sessionId, context ? [{ role: "user", content: context }, { role: "assistant", content: "Got it, I remember." }] : []);
  }
  sessionLastUsed.set(sessionId, Date.now()); // refresh TTL on every access
  return sessions.get(sessionId);
}

// ─── Chat endpoint (streaming) ────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { message, sessionId = "default" } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });

  const history = getOrCreateSession(sessionId);
  history.push({ role: "user", content: message });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Abort the Anthropic stream if the client disconnects mid-response (saves API tokens)
  const abortController = new AbortController();
  req.on("close", () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    let fullText = "";
    const stream = anthropic.messages.stream(
      {
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
        max_tokens: 8096,
        system: SYSTEM_PROMPT,
        messages: history.slice(-20), // keep last 20 turns
      },
      { signal: abortController.signal }
    );

    stream.on("text", (text) => {
      if (res.writableEnded) return;
      fullText += text;
      res.write(`data: ${JSON.stringify({ type: "chunk", text })}\n\n`);
      // Flush immediately — prevents buffering by compression middleware or reverse proxies
      res.flush?.();
    });

    stream.on("message", () => {
      history.push({ role: "assistant", content: fullText });
      // Trim in-memory history to prevent unbounded growth on long-running sessions
      if (history.length > 100) history.splice(0, history.length - 100);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
      }

      // Persist summary periodically
      if (history.length % 10 === 0) {
        const memory = loadMemory();
        memory.conversations.push({
          timestamp: new Date().toISOString(),
          summary: `Session ${sessionId}: ${history.length} turns`,
        });
        if (memory.conversations.length > 50) memory.conversations = memory.conversations.slice(-50);
        saveMemory(memory);
      }
    });

    stream.on("error", (err) => {
      if (err.name === "AbortError") {
        // Client disconnected mid-stream — push whatever we streamed so far so history stays balanced
        if (fullText) history.push({ role: "assistant", content: fullText });
        else history.pop(); // no assistant response at all — remove the dangling user message
        return;
      }
      // Push a placeholder so history stays balanced (user msg is already in history)
      history.push({ role: "assistant", content: `[Error: ${err.message}]` });
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: "error", text: err.message })}\n\n`);
        res.end();
      }
    });
  } catch (err) {
    // Error before stream started — user message is already in history, remove it to stay balanced
    history.pop();
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: "error", text: err.message })}\n\n`);
      res.end();
    }
  }
});

// ─── Clear session ────────────────────────────────────────────────────────────
app.post("/api/clear", (req, res) => {
  const { sessionId = "default" } = req.body;
  sessions.delete(sessionId);
  sessionLastUsed.delete(sessionId);
  res.json({ ok: true });
});

// ─── GitHub: list repos ───────────────────────────────────────────────────────
app.get("/api/github/repos", async (req, res) => {
  try {
    const { data } = await octokit.repos.listForAuthenticatedUser({ sort: "updated", per_page: 30 });
    res.json(data.map(r => ({ name: r.name, full_name: r.full_name, description: r.description, private: r.private, url: r.html_url, updated_at: r.updated_at })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GitHub: list PRs ─────────────────────────────────────────────────────────
app.get("/api/github/prs", async (req, res) => {
  try {
    const { data } = await octokit.pulls.list({ owner: req.query.owner, repo: req.query.repo, state: "open" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GitHub: list issues ──────────────────────────────────────────────────────
app.get("/api/github/issues", async (req, res) => {
  try {
    const { data } = await octokit.issues.listForAuthenticatedUser({ filter: "assigned", state: "open" });
    res.json(data.map(i => ({ title: i.title, url: i.html_url, repo: i.repository?.full_name, created_at: i.created_at })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Notes (simple persistent scratch pad) ────────────────────────────────────
app.get("/api/notes", (req, res) => {
  res.json(loadMemory().notes);
});

app.post("/api/notes", (req, res) => {
  const { content } = req.body;
  if (!content || typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ error: "content required" });
  }
  const memory = loadMemory();
  const note = { id: Date.now(), content: content.trim(), created_at: new Date().toISOString() };
  memory.notes.push(note);
  saveMemory(memory);
  res.json(note);
});

app.delete("/api/notes/:id", (req, res) => {
  const memory = loadMemory();
  memory.notes = memory.notes.filter(n => String(n.id) !== req.params.id);
  saveMemory(memory);
  res.json({ ok: true });
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929", github: !!process.env.GITHUB_TOKEN });
});

// ─── Serve built React app (production) ───────────────────────────────────────
const publicDir = join(__dirname, "public");
if (existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get("*", (req, res) => {
    // Don't serve index.html for unknown /api/* routes — return proper JSON 404
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: `Unknown API endpoint: ${req.path}` });
    }
    res.sendFile(join(publicDir, "index.html"));
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`⚡ ZAP server running on http://localhost:${PORT}`);
  console.log(`   Model: ${process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929"}`);
  console.log(`   GitHub: ${process.env.GITHUB_TOKEN ? "✓ connected" : "✗ no token"}`);
});
