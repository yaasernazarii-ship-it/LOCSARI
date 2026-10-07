"use client";

// گفتگوی خصوصی خریدار با آگهی‌دهنده، مستقیماً در صفحهٔ آگهی (فاز ۸ «Advertisement Private Chat»).
// فقط برای کاربر واردشده‌ای که مالک آگهی نیست نمایش داده می‌شود؛ کاربر مهمان به ورود هدایت می‌شود.

import { useState } from "react";
import { useRouter } from "next/navigation";
import ChatThreadPanel from "@/components/ChatThreadPanel";

export default function ChatBox({
  advertisementId,
  slug,
  isLoggedIn,
  currentUserId,
}: {
  advertisementId: number;
  slug: string;
  isLoggedIn: boolean;
  currentUserId: number | null;
}) {
  const router = useRouter();
  const [threadId, setThreadId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  async function startChat() {
    if (!isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/agahi/${slug}`)}`);
      return;
    }
    setStarting(true);
    setError("");
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advertisementId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در شروع گفتگو");
      setThreadId(data.threadId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در شروع گفتگو");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="chat-box">
      <h2>گفتگوی خصوصی با آگهی‌دهنده</h2>
      {threadId === null && (
        <button type="button" className="btn-secondary" onClick={startChat} disabled={starting}>
          {starting ? "در حال شروع…" : "شروع گفتگو"}
        </button>
      )}
      {error && <div className="error-box">{error}</div>}
      {threadId !== null && <ChatThreadPanel threadId={threadId} currentUserId={currentUserId} />}
    </div>
  );
}
