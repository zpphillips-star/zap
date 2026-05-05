import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { Octokit } from "@octokit/rest";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  return JSON.parse(readFileSync(MEMORY_FILE, "utf8"));
}
function saveMemory(data) {
  writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
}

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are ZAP, a personal AI assistant. You are direct, helpful, and focused.
You have access to the user's personal GitHub and can help with code, PRs, issues, and repositories.
You can also help with email drafting and general tasks.
Keep responses concise unless detail is specifically needed.
You remember things the user tells you about themselves and their projects.`;

// ─── Conversation history (in-memory per session, persisted to file) ──────────
const sessions = new Map(); // sessionId -> messages[]

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

  try {
    let fullText = "";
    const stream = anthropic.messages.stream({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
      max_tokens: 8096,
      system: SYSTEM_PROMPT,
      messages: history.slice(-20), // keep last 20 turns
    });

    stream.on("text", (text) => {
      fullText += text;
      res.write(`data: ${JSON.stringify({ type: "chunk", text })}\n\n`);
    });

    stream.on("message", () => {
      history.push({ role: "assistant", content: fullText });
      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();

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
      res.write(`data: ${JSON.stringify({ type: "error", text: err.message })}\n\n`);
      res.end();
    });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: "error", text: err.message })}\n\n`);
    res.end();
  }
});

// ─── Clear session ────────────────────────────────────────────────────────────
app.post("/api/clear", (req, res) => {
  const { sessionId = "default" } = req.body;
  sessions.delete(sessionId);
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
  const memory = loadMemory();
  const note = { id: Date.now(), content, created_at: new Date().toISOString() };
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
  res.json({ status: "ok", model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5", github: !!process.env.GITHUB_TOKEN });
});

// ─── Serve built React app (production) ───────────────────────────────────────
const publicDir = join(__dirname, "public");
if (existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get("*", (req, res) => {
    res.sendFile(join(publicDir, "index.html"));
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`⚡ ZAP server running on http://localhost:${PORT}`);
  console.log(`   Model: ${process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5"}`);
  console.log(`   GitHub: ${process.env.GITHUB_TOKEN ? "✓ connected" : "✗ no token"}`);
});
