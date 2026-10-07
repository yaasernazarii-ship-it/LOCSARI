"use client";

// دکمه‌های عملیات روی هر ردیف در «آگهی‌های من» — ارسال برای بررسی، آرشیو کردن.
// پس از هر عملیات موفق صفحه را رفرش می‌کند تا وضعیت جدید از سرور بیاید.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function MyAdvertisementActions({
  advertisementId,
  status,
  slug,
}: {
  advertisementId: number;
  status: string;
  slug: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(action: "submit" | "archive") {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/advertisements/${advertisementId}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در انجام عملیات");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در انجام عملیات");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="my-ad__actions">
      {["draft", "rejected", "expired"].includes(status) && (
        <Link href={`/account/advertisements/${advertisementId}/edit`} className="btn-secondary">
          ویرایش
        </Link>
      )}
      {["draft", "rejected", "expired"].includes(status) && (
        <button type="button" className="btn-primary" onClick={() => run("submit")} disabled={loading}>
          ارسال برای بررسی
        </button>
      )}
      {status === "published" && (
        <Link href={`/agahi/${slug}`} className="btn-secondary">
          مشاهده در سایت
        </Link>
      )}
      {status !== "archived" && (
        <button type="button" className="btn-danger" onClick={() => run("archive")} disabled={loading}>
          آرشیو کردن
        </button>
      )}
      {error && <span className="my-ad__error">{error}</span>}
    </div>
  );
}
