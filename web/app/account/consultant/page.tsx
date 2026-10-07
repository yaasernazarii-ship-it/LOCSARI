import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import ConsultantAccountPanel from "@/components/ConsultantAccountPanel";

// صفحهٔ حساب مشاور (فاز ۶، بخش ۹) — اپلای/ویرایش/وضعیت تأیید/دعوت‌های آژانس.
export default async function ConsultantAccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/consultant");

  return (
    <>
      <div className="account-page-header">
        <h1>پروفایل مشاور املاک</h1>
      </div>
      <div className="account-form">
        <ConsultantAccountPanel />
      </div>
    </>
  );
}
