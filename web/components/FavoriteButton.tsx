"use client";

// دکمهٔ افزودن/حذف علاقه‌مندی — روی کارت نتیجهٔ جستجو و صفحهٔ جزئیات آگهی استفاده می‌شود.
// اگر کاربر وارد نشده باشد، به‌جای فراخوانی API به صفحهٔ ورود هدایت می‌شود.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";

export default function FavoriteButton({
  advertisementId,
  initialFavorited,
  isLoggedIn,
}: {
  advertisementId: number;
  initialFavorited: boolean;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    if (loading) return;
    setLoading(true);
    const prev = favorited;
    setFavorited(!prev);
    try {
      const res = prev
        ? await fetch(`/api/favorites/${advertisementId}`, { method: "DELETE" })
        : await fetch("/api/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ advertisementId }),
          });
      if (!res.ok) setFavorited(prev);
    } catch {
      setFavorited(prev);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={`favorite-btn${favorited ? " favorite-btn--active" : ""}`}
      onClick={toggle}
      disabled={loading}
      aria-pressed={favorited}
      title={favorited ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
    >
      <Heart size={16} fill={favorited ? "currentColor" : "none"} />
    </button>
  );
}
