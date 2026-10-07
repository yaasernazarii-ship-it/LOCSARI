"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Permission = { key: string; description_fa: string | null };
type Override = { key: string; effect: string; description_fa: string | null };

export default function AdminUserPermissionOverrides({
  userId,
  overrides,
  allPermissions,
}: {
  userId: number;
  overrides: Override[];
  allPermissions: Permission[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overriddenKeys = new Set(overrides.map((o) => o.key));
  const selectablePermissions = allPermissions.filter((p) => !overriddenKeys.has(p.key));
  const [selected, setSelected] = useState(selectablePermissions[0]?.key ?? "");
  const [effect, setEffect] = useState<"allow" | "deny">("deny");

  async function addOverride() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionKey: selected, effect }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "خطا در افزودن override");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeOverride(permissionKey: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/permissions?permission=${encodeURIComponent(permissionKey)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "خطا در حذف override");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <p style={{ color: "#991b1b" }}>{error}</p>}

      {overrides.length > 0 && (
        <ul className="admin-history-list">
          {overrides.map((o) => (
            <li key={o.key} className="admin-inline-form">
              <span className={`status-badge status-badge--${o.effect === "allow" ? "approved" : "rejected"}`}>
                {o.effect === "allow" ? "Allow" : "Deny"}
              </span>
              <span>
                {o.key} {o.description_fa ? `— ${o.description_fa}` : ""}
              </span>
              <button className="btn-danger" disabled={busy} onClick={() => removeOverride(o.key)}>
                حذف
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectablePermissions.length > 0 && (
        <div className="admin-inline-form" style={{ marginTop: 10, flexWrap: "wrap" }}>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} disabled={busy}>
            {selectablePermissions.map((p) => (
              <option key={p.key} value={p.key}>
                {p.key} {p.description_fa ? `— ${p.description_fa}` : ""}
              </option>
            ))}
          </select>
          <select value={effect} onChange={(e) => setEffect(e.target.value as "allow" | "deny")} disabled={busy}>
            <option value="allow">Allow</option>
            <option value="deny">Deny</option>
          </select>
          <button className="btn-primary" disabled={busy || !selected} onClick={addOverride}>
            افزودن Override
          </button>
        </div>
      )}
    </div>
  );
}
