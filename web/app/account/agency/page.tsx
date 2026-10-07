import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import AgencyAccountPanel from "@/components/AgencyAccountPanel";
import VipAccountPanel from "@/components/VipAccountPanel";

// صفحهٔ حساب آژانس (فاز ۶، بخش ۱۰) — اپلای/ویرایش/وضعیت تأیید/مدیریت اعضا
// + دسترسی سریع به ثبت آگهی و خرید/مدیریت اشتراک VIP برای تغییر جایگاه انتشار آگهی، بدون خروج از این صفحه.
export default async function AgencyAccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/agency");

  const ads = await db
    .selectFrom("advertisements")
    .select(["id", "title", "slug", "status", "is_vip", "vip_expires_at"])
    .where("created_by_user_id", "=", user.id)
    .where("status", "not in", ["archived", "rejected"])
    .orderBy("created_at", "desc")
    .execute();

  return (
    <>
      <div className="account-page-header">
        <h1>آژانس من</h1>
      </div>
      <div className="account-form">
        <AgencyAccountPanel />
      </div>

      <div className="account-page-header">
        <h2>ثبت آگهی و جایگاه انتشار</h2>
        <p>
          می‌توانید همین‌جا آگهی جدید ثبت کنید و با تهیهٔ اشتراک VIP، جایگاه انتشار آگهی‌هایتان را تغییر دهید.{" "}
          <Link href="/account/advertisements/new">+ ثبت آگهی جدید</Link>
        </p>
      </div>
      <div className="account-form">
        <VipAccountPanel
          isAgencyMember
          initialAds={ads.map((a) => ({
            ...a,
            vip_expires_at: a.vip_expires_at ? new Date(a.vip_expires_at).toISOString() : null,
          }))}
        />
      </div>
    </>
  );
}
