import { useState, useEffect } from "react";
import "./Sidebar.css";

interface Repo { name: string; full_name: string; description: string; url: string; updated_at: string; }
interface Note { id: number; content: string; created_at: string; }

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const [tab, setTab] = useState<"github" | "notes">("github");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [health, setHealth] = useState<any>(null);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health").then(r => r.json()).then(setHealth).catch(() => {});
  }, []);

  useEffect(() => {
    if (open && tab === "github") {
      setReposLoading(true);
      setReposError(null);
      fetch("/api/github/repos")
        .then(r => r.json())
        .then(data => {
          if (data.error) throw new Error(data.error);
          setRepos(data);
        })
        .catch(err => setReposError(err.message || "Failed to load repos"))
        .finally(() => setReposLoading(false));
    }
    if (open && tab === "notes") {
      fetch("/api/notes").then(r => r.json()).then(setNotes).catch(() => {});
    }
  }, [open, tab]);

  async function addNote() {
    if (!newNote.trim()) return;
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote.trim() }),
      });
      if (!res.ok) return;
      const note = await res.json();
      if (note.error) return; // guard against unexpected error payload
      setNotes(prev => [...prev, note]);
      setNewNote("");
    } catch {
      // network error — don't add bad data to state
    }
  }

  async function deleteNote(id: number) {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setNotes(prev => prev.filter(n => n.id !== id));
  }

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <div className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">⚡ ZAP</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {health && (
          <div className="health-badge">
            <span className="dot green" /> {health.model}
            {health.github && <><span className="dot green" style={{marginLeft: "0.5rem"}} /> GitHub</>}
          </div>
        )}

        <div className="tab-bar">
          <button className={tab === "github" ? "tab active" : "tab"} onClick={() => setTab("github")}>GitHub</button>
          <button className={tab === "notes" ? "tab active" : "tab"} onClick={() => setTab("notes")}>Notes</button>
        </div>

        <div className="sidebar-content">
          {tab === "github" && (
            <div className="repo-list">
              {reposLoading && <div className="empty-msg">Loading repos…</div>}
              {reposError && <div className="error-msg">⚠ {reposError}</div>}
              {!reposLoading && !reposError && repos.length === 0 && (
                <div className="empty-msg">No repos found or GitHub not connected.</div>
              )}
              {repos.map(r => (
                <a key={r.full_name} href={r.url} target="_blank" rel="noreferrer" className="repo-item">
                  <div className="repo-name">{r.name}</div>
                  {r.description && <div className="repo-desc">{r.description}</div>}
                </a>
              ))}
            </div>
          )}

          {tab === "notes" && (
            <div className="notes-section">
              <div className="note-input-row">
                <input
                  className="note-input"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addNote()}
                  placeholder="Add a note…"
                />
                <button className="note-add-btn" onClick={addNote}>+</button>
              </div>
              {notes.map(n => (
                <div key={n.id} className="note-item">
                  <span>{n.content}</span>
                  <button className="note-del-btn" onClick={() => deleteNote(n.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
