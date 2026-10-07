"use client";

// دکمه‌های عملیات بازبین مرکزی روی آگهی (فاز ۷.۱) — از Endpointهای موجود publish/reject/archive/edit/delete استفاده می‌کند،
// هیچ منطق تصمیم‌گیری جدیدی اینجا نیست؛ فقط فراخوانی و بازتاب وضعیت.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConfirmButton from "./ConfirmButton";
import { showToast } from "@/lib/adminToast";

export default function AdminAdvertisementActions({
  advertisementId,
  status,
  canPublish,
  canReject,
  canArchive,
  canEdit,
  canDelete,
}: {
  advertisementId: number;
  status: string;
  canPublish: boolean;
  canReject: boolean;
  canArchive: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(action: "publish" | "reject" | "archive", body?: Record<string, unknown>) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/advertisements/${advertisementId}/${action}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در انجام عملیات");
      showToast("عملیات با موفقیت انجام شد", "success");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در انجام عملیات");
    } finally {
      setLoading(false);
    }
  }

  function onReject() {
    const reason = window.prompt("دلیل رد آگهی را وارد کنید:");
    if (!reason || !reason.trim()) return;
    run("reject", { reason: reason.trim() });
  }

  async function onDelete() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/advertisements/${advertisementId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در حذف آگهی");
      showToast("آگهی حذف شد", "success");
      router.push("/admin/advertisements");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در حذف آگهی");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {canPublish && status === "pending_review" && (
        <button type="button" className="btn-primary" disabled={loading} onClick={() => run("publish")}>
          تأیید و انتشار
        </button>
      )}
      {canReject && status === "pending_review" && (
        <button type="button" className="btn-danger" disabled={loading} onClick={onReject}>
          رد آگهی
        </button>
      )}
      {canArchive && status !== "archived" && (
        <button type="button" className="btn-secondary" disabled={loading} onClick={() => run("archive")}>
          آرشیو کردن
        </button>
      )}
      {canEdit && (
        <Link href={`/admin/advertisements/${advertisementId}/edit`} className="btn-secondary">
          ویرایش
        </Link>
      )}
      {canDelete && (
        <ConfirmButton
          label="حذف کامل"
          confirmText="این آگهی برای همیشه حذف می‌شود."
          disabled={loading}
          onConfirm={onDelete}
        />
      )}
      {error && <span className="my-ad__error">{error}</span>}
    </>
  );
}
