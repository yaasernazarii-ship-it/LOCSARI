"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DEFAULT_ASSISTANT_NAME = "دستیار نیازسنجی هوشمند شما";

type Result = { id: number; slug: string; title: string; primary_image: string | null };
type PushAlert = { id: number; pushToken: string };

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const bytes = atob(base64);
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

export default function PropertyAssistant() {
  const [query, setQuery] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [assistantName, setAssistantName] = useState(DEFAULT_ASSISTANT_NAME);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [pushAlert, setPushAlert] = useState<PushAlert | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/property-assistant")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (typeof data?.name === "string" && data.name.trim()) setAssistantName(data.name);
      })
      .catch(() => undefined);
  }, []);

  async function submit(subscribe = false) {
    if (!query.trim()) {
      setMessage("خلاصه‌ای از ملک موردنیازتان را بنویسید.");
      return;
    }

    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/property-assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, phone: phone || undefined, name: name || undefined, subscribe }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "جست‌وجو انجام نشد");
      setResults(data.results ?? []);
      setNeedsPhone(Boolean(data.needsPhone));
      setPushAlert(data.alert?.id && data.alert?.pushToken ? data.alert : null);
      if (data.alertCreated) setMessage("درخواست شما ثبت شد؛ آگهی‌های جدید را پیامک می‌کنیم.");
      else if ((data.results ?? []).length === 0) setMessage("فعلاً آگهی منطبق پیدا نشد. شماره‌تان را وارد کنید تا اطلاع دهیم.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "خطا در جست‌وجو"); }
    finally { setLoading(false); }
  }

  async function enablePush() {
    if (!pushAlert || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMessage("اعلان مرورگر در این دستگاه پشتیبانی نمی‌شود.");
      return;
    }
    try {
      const keyResponse = await fetch("/api/push/public-key");
      const keyData = await keyResponse.json();
      if (!keyData.enabled || typeof keyData.publicKey !== "string") {
        setMessage("اعلان Push هنوز توسط سامانه فعال نشده است.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(keyData.publicKey) });
      const response = await fetch("/api/push/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alertId: pushAlert.id, pushToken: pushAlert.pushToken, subscription: subscription.toJSON() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "فعال‌سازی اعلان انجام نشد");
      setPushAlert(null);
      setMessage("اعلان Push این دستگاه فعال شد.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "فعال‌سازی اعلان انجام نشد");
    }
  }

  return <section className="property-assistant">
    <h2>{assistantName} <span>(خلاصه‌ای از ملکی که نیاز داری بنویس)</span></h2>
    <div className="property-assistant__form">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثلاً آپارتمان ۲ خوابه حوالی طالقانی تا ۴ میلیارد برای خرید" />
      <button type="button" className="btn-primary" disabled={loading} onClick={() => submit()}> {loading ? "در حال جست‌وجو…" : "جست‌وجو"} </button>
    </div>
    {(needsPhone || results.length > 0) && <div className="property-assistant__alert">
      <label><input type="checkbox" checked={needsPhone} onChange={(event) => setNeedsPhone(event.target.checked)} /> آگهی‌های جدید این منطقه را به من پیامک کن</label>
      {needsPhone && <div className="property-assistant__form"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="نام و نام خانوادگی" /><input value={phone} inputMode="tel" onChange={(event) => setPhone(event.target.value)} placeholder="شماره موبایل" /><button type="button" className="btn-secondary" disabled={loading} onClick={() => submit(true)}>ثبت اطلاع‌رسانی</button></div>}
    </div>}
    {message && <p className="form-hint">{message}</p>}
    {pushAlert && <button type="button" className="btn-secondary property-assistant__push" onClick={enablePush}>فعال‌سازی اعلان در این دستگاه</button>}
    {results.length > 0 && <div className="property-assistant__results">{results.map((item) => <Link key={item.id} href={`/agahi/${item.slug}`}>{item.primary_image && <img src={item.primary_image} alt="" />}<span>{item.title}</span></Link>)}</div>}
  </section>;
}
