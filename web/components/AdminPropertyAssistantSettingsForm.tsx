"use client";

import { useState } from "react";

type Props = {
  initialName: string;
  canEdit: boolean;
};

export default function AdminPropertyAssistantSettingsForm({ initialName, canEdit }: Props) {
  const [name, setName] = useState(initialName);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/property-assistant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ذخیره‌سازی انجام نشد");
      setName(data.settings.name);
      setMessage("نام دستیار ذخیره شد.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "خطا در ذخیره‌سازی");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="form-section">
      <h2>نام دستیار نیازسنجی</h2>
      <div className="form-group">
        <label htmlFor="property-assistant-name">نام نمایش‌داده‌شده در صفحهٔ آگهی‌ها</label>
        <input id="property-assistant-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} disabled={!canEdit || saving} />
      </div>
      {canEdit ? <button type="button" className="btn-primary" disabled={saving} onClick={save}>{saving ? "در حال ذخیره…" : "ذخیره نام"}</button> : <p className="form-hint">مجوز ویرایش نام دستیار را ندارید.</p>}
      {message && <p className="form-hint">{message}</p>}
    </section>
  );
}
