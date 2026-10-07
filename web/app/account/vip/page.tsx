import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import VipAccountPanel from "@/components/VipAccountPanel";

// صفحهٔ «آگهی VIP» در حساب کاربری — خرید اشتراک (تأیید دستی ادمین) + فعال‌سازی نمایش VIP روی آگهی‌های خودِ کاربر.
export default async function AccountVipPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/vip");

  const [ads, agencyMembership] = await Promise.all([
    db
      .selectFrom("advertisements")
      .select(["id", "title", "slug", "status", "is_vip", "vip_expires_at"])
      .where("created_by_user_id", "=", user.id)
      .where("status", "not in", ["archived", "rejected"])
      .orderBy("created_at", "desc")
      .execute(),
    db
      .selectFrom("agency_memberships")
      .select("id")
      .where("user_id", "=", user.id)
      .where("status", "=", "active")
      .executeTakeFirst(),
  ]);

  return (
    <>
      <div className="account-page-header">
        <h1>آگهی VIP</h1>
        <p>با تهیهٔ اشتراک VIP، آگهی‌های شما در بخش ویژهٔ سایت با اولویت نمایش داده می‌شوند.</p>
      </div>
      <div className="account-form">
        <VipAccountPanel
          isAgencyMember={Boolean(agencyMembership)}
          initialAds={ads.map((a) => ({
            ...a,
            vip_expires_at: a.vip_expires_at ? new Date(a.vip_expires_at).toISOString() : null,
          }))}
        />
      </div>
    </>
  );
}
