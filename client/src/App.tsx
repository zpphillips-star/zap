import { useState } from "react";
import ChatView from "./components/ChatView";
import Sidebar from "./components/Sidebar";
import "./App.css";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-area">
        <header className="app-header">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)} title="Menu">
            <span>☰</span>
          </button>
          <div className="header-title">
            <span className="zap-icon">⚡</span>
            <span>ZAP</span>
          </div>
          <div className="header-spacer" />
        </header>
        <ChatView sessionId={sessionId} />
      </div>
    </div>
  );
}
