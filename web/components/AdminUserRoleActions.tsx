"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = { id: number; key: string; title_fa: string };

const SENSITIVE_ROLES = ["super_admin", "system_admin"];

export default function AdminUserRoleActions({
  userId,
  assignedRoleKeys,
  allRoles,
  canManageSensitive,
  isSelf,
}: {
  userId: number;
  assignedRoleKeys: string[];
  allRoles: Role[];
  canManageSensitive: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignableRoles = allRoles.filter(
    (r) => !assignedRoleKeys.includes(r.key) && (canManageSensitive || !SENSITIVE_ROLES.includes(r.key))
  );
  const [selected, setSelected] = useState(assignableRoles[0]?.key ?? "");

  async function addRole() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleKey: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "خطا در افزودن نقش");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeRole(roleKey: string) {
    if (!window.confirm(`نقش «${roleKey}» از این کاربر حذف شود؟`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/roles?role=${encodeURIComponent(roleKey)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "خطا در حذف نقش");
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

      {assignedRoleKeys.length > 0 && (
        <ul className="admin-history-list">
          {assignedRoleKeys.map((key) => {
            const role = allRoles.find((r) => r.key === key);
            const locked = SENSITIVE_ROLES.includes(key) && (!canManageSensitive || (isSelf && key === "super_admin"));
            return (
              <li key={key} className="admin-inline-form">
                <span>{role?.title_fa ?? key} ({key})</span>
                {!locked && (
                  <button className="btn-danger" disabled={busy} onClick={() => removeRole(key)}>
                    حذف
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {assignableRoles.length > 0 && (
        <div className="admin-inline-form" style={{ marginTop: 10 }}>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} disabled={busy}>
            {assignableRoles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.title_fa} ({r.key})
              </option>
            ))}
          </select>
          <button className="btn-primary" disabled={busy || !selected} onClick={addRole}>
            افزودن نقش
          </button>
        </div>
      )}
    </div>
  );
}
