import { useState, useEffect } from "react";
import "./Sidebar.css";

interface Repo { name: string; full_name: string; description: string; url: string; updated_at: string; }
interface Note { id: number; content: string; created_at: string; }
interface Health { model: string; github: boolean; status: string; }

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const [tab, setTab] = useState<"github" | "notes">("github");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [health, setHealth] = useState<Health | null>(null);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open) {
      fetch("/api/health").then(r => r.json()).then(setHealth).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    // Create a single AbortController per effect run so that if `open` or `tab`
    // changes while a fetch is in-flight, the cleanup function cancels it and we
    // never apply stale results to the wrong tab's state.
    const controller = new AbortController();
    const { signal } = controller;

    if (open && tab === "github") {
      setRepos([]);           // clear stale data so old repos don't show alongside loading indicator
      setReposLoading(true);
      setReposError(null);
      fetch("/api/github/repos", { signal })
        .then(r => r.json())
        .then(data => {
          if (data.error) throw new Error(data.error);
          setRepos(data);
        })
        .catch(err => {
          if (err.name === "AbortError") return; // component unmounted or tab switched — ignore
          setReposError(err.message || "Failed to load repos");
        })
        .finally(() => setReposLoading(false));
    }
    if (open && tab === "notes") {
      setNotes([]);           // clear stale data before re-syncing from server
      setNotesError(null);
      setNotesLoading(true);
      fetch("/api/notes", { signal })
        .then(r => r.json())
        .then(data => {
          if (data.error) throw new Error(data.error);
          setNotes(data);
        })
        .catch(err => {
          if (err.name === "AbortError") return;
          setNotesError(err.message || "Failed to load notes");
        })
        .finally(() => setNotesLoading(false));
    }

    return () => controller.abort(); // cancel any in-flight fetch on cleanup
  }, [open, tab]);

  async function addNote() {
    if (!newNote.trim() || adding) return;
    setAdding(true);
    setNotesError(null);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote.trim() }),
      });
      if (!res.ok) {
        setNotesError("Failed to save note — server returned an error");
        return;
      }
      const note = await res.json();
      if (note.error) {
        setNotesError(note.error);
        return;
      }
      setNotes(prev => [...prev, note]);
      setNewNote("");
    } catch {
      setNotesError("Failed to save note — check your connection");
    } finally {
      setAdding(false);
    }
  }

  async function deleteNote(id: number) {
    // Optimistic update — remove from UI immediately; server failure is recoverable on next load
    setNotes(prev => prev.filter(n => n.id !== id));
    try {
      await fetch(`/api/notes/${id}`, { method: "DELETE" });
    } catch {
      // Network error — note will reappear on next sidebar open (re-fetch from server)
    }
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
            <span className="dot green" />
            <span className="health-model" title={health.model}>
              {/* Strip "claude-" prefix and date suffix (e.g. "claude-sonnet-4-5-20250929" → "sonnet-4-5") */}
              {health.model.replace(/^claude-/, "").replace(/-\d{8}$/, "")}
            </span>
            {health.github && <><span className="dot green" style={{marginLeft: "0.35rem"}} /> GitHub</>}
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
                <button className="note-add-btn" onClick={addNote} disabled={adding}>+</button>
              </div>
              {notesLoading && <div className="empty-msg">Loading notes…</div>}
              {notesError && <div className="error-msg">⚠ {notesError}</div>}
              {!notesLoading && !notesError && notes.length === 0 && (
                <div className="empty-msg">No notes yet.</div>
              )}
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
