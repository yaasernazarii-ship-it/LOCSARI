"use client";

// بخش مشترک نمایش پیام‌ها + فرم ارسال یک Thread گفتگو — هم در ChatBox (صفحهٔ آگهی) و هم در
// /account/messages/[id] استفاده می‌شود. Polling سادهٔ چندثانیه‌ای برای دریافت پیام‌های جدید.

import { useEffect, useRef, useState } from "react";

type Message = { id: number; sender_user_id: number; body: string; created_at: string };

export default function ChatThreadPanel({ threadId, currentUserId }: { threadId: number; currentUserId: number | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  async function loadMessages() {
    try {
      const res = await fetch(`/api/chats/${threadId}/messages`);
      const data = await res.json();
      if (res.ok) {
        setMessages(data.messages);
        setError("");
      } else if (!loading) {
        // در Polling بعدی، خطای موقت شبکه را نادیده می‌گیریم
      } else {
        setError(data.error || "خطا در دریافت پیام‌ها");
      }
    } catch {
      // خطای شبکه در polling نادیده گرفته می‌شود
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMessages();
    const timer = setInterval(loadMessages, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/chats/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ارسال پیام");
      setDraft("");
      await loadMessages();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ارسال پیام");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <p className="chat-box__loading">در حال بارگذاری…</p>;

  return (
    <div className="chat-box__panel">
      <div className="chat-box__messages" ref={listRef}>
        {messages.length === 0 && <p className="chat-box__empty">هنوز پیامی رد و بدل نشده؛ اولین پیام را بفرستید.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.sender_user_id === currentUserId ? "chat-bubble--mine" : "chat-bubble--theirs"}`}>
            <p>{m.body}</p>
            <span className="chat-bubble__time">{new Date(m.created_at).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        ))}
      </div>
      <form className="chat-box__form" onSubmit={sendMessage}>
        <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="پیام خود را بنویسید…" maxLength={2000} />
        <button type="submit" className="btn-primary" disabled={sending || !draft.trim()}>
          ارسال
        </button>
      </form>
      {error && <div className="error-box">{error}</div>}
    </div>
  );
}
