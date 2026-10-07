"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

type Role = { id: number; key: string; title_fa: string };
type Permission = { id: number; key: string; description_fa: string | null };

export default function AdminPermissionMatrix({
  roles,
  permissions,
  grantSet,
  editable,
}: {
  roles: Role[];
  permissions: Permission[];
  grantSet: string[]; // "roleId:permissionId"
  editable: boolean;
}) {
  const router = useRouter();
  const [busyCell, setBusyCell] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const granted = new Set(grantSet);

  async function toggle(role: Role, permission: Permission, currentlyGranted: boolean) {
    const cellKey = `${role.id}:${permission.id}`;
    setBusyCell(cellKey);
    setError(null);
    try {
      const res = currentlyGranted
        ? await fetch(`/api/admin/permissions?role=${encodeURIComponent(role.key)}&permission=${encodeURIComponent(permission.key)}`, {
            method: "DELETE",
          })
        : await fetch(`/api/admin/permissions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roleKey: role.key, permissionKey: permission.key }),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "خطا در به‌روزرسانی مجوز");
        return;
      }
      router.refresh();
    } finally {
      setBusyCell(null);
    }
  }

  return (
    <>
      {error && <p style={{ color: "#991b1b" }}>{error}</p>}
      <table className="admin-table">
        <thead>
          <tr>
            <th>مجوز</th>
            {roles.map((r) => (
              <th key={r.id}>{r.title_fa}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {permissions.map((p) => (
            <tr key={p.id}>
              <td>
                {p.key}
                {p.description_fa ? <div style={{ color: "#888", fontSize: "0.75rem" }}>{p.description_fa}</div> : null}
              </td>
              {roles.map((r) => {
                const isGranted = r.key === "super_admin" ? true : granted.has(`${r.id}:${p.id}`);
                const locked = r.key === "super_admin" || !editable;
                const cellKey = `${r.id}:${p.id}`;
                return (
                  <td key={r.id} style={{ textAlign: "center" }}>
                    {locked ? (
                      isGranted ? <Check size={16} className="admin-perm-yes" /> : ""
                    ) : (
                      <input
                        type="checkbox"
                        checked={isGranted}
                        disabled={busyCell === cellKey}
                        onChange={() => toggle(r, p, isGranted)}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
