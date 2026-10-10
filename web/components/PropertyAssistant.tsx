"use client";

import { useState } from "react";
import Link from "next/link";

type Result = { id: number; slug: string; title: string; primary_image: string | null };

export default function PropertyAssistant() {
  const [query, setQuery] = useState("");
  const [phone, setPhone] = useState("");
  const [needsPhone, setNeedsPhone] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(subscribe = false) {
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/property-assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, phone: phone || undefined, subscribe }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "جست‌وجو انجام نشد");
      setResults(data.results ?? []);
      setNeedsPhone(Boolean(data.needsPhone));
      if (data.alertCreated) setMessage("درخواست شما ثبت شد؛ آگهی‌های جدید را پیامک می‌کنیم.");
      else if ((data.results ?? []).length === 0) setMessage("فعلاً آگهی منطبق پیدا نشد. شماره‌تان را وارد کنید تا اطلاع دهیم.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "خطا در جست‌وجو"); }
    finally { setLoading(false); }
  }

  return <section className="property-assistant">
    <h2>دنبال چه ملکی در ساری هستید؟ (تایپ کنید)</h2>
    <div className="property-assistant__form">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثلاً آپارتمان ۲ خوابه حوالی طالقانی تا ۴ میلیارد خرید" />
      <button type="button" className="btn-primary" disabled={loading || !query.trim()} onClick={() => submit()}> {loading ? "در حال جست‌وجو…" : "جست‌وجو"} </button>
    </div>
    {(needsPhone || results.length > 0) && <div className="property-assistant__alert">
      <label><input type="checkbox" checked={needsPhone} onChange={(event) => setNeedsPhone(event.target.checked)} /> آگهی‌های جدید این منطقه را به من پیامک کن</label>
      {needsPhone && <div className="property-assistant__form"><input value={phone} inputMode="tel" onChange={(event) => setPhone(event.target.value)} placeholder="شماره موبایل" /><button type="button" className="btn-secondary" disabled={loading} onClick={() => submit(true)}>ثبت اطلاع‌رسانی</button></div>}
    </div>}
    {message && <p className="form-hint">{message}</p>}
    {results.length > 0 && <div className="property-assistant__results">{results.map((item) => <Link key={item.id} href={`/agahi/${item.slug}`}>{item.primary_image && <img src={item.primary_image} alt="" />}<span>{item.title}</span></Link>)}</div>}
  </section>;
}
