import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";

const CONTENT_GROUPS: Record<string, { title: string; description: string }> = {
  global: { title: "اجزای مشترک سایت", description: "نام سایت در هدر و متن معرفی در فوتر — در تمام صفحات نمایش داده می‌شود." },
  home: { title: "صفحهٔ اصلی", description: "هیرو، متن جستجو، تیتر جدیدترین آگهی‌ها و بخش دعوت به ثبت آگهی." },
  vip: { title: "صفحهٔ آگهی‌های VIP", description: "هیرو، پیام نبود آگهی فعال و بخش دعوت به تهیهٔ اشتراک VIP." },
  cip: { title: "صفحهٔ آگهی‌های CIP", description: "هیرو، تیتر فهرست ویدیوها، پیام نبود ویدیو و بخش معرفی پلن‌ها." },
  contact: { title: "صفحهٔ تماس با ما", description: "متن معرفی بالای صفحهٔ تماس با ما." },
};

export default async function AdminSiteContentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  if (!(await userHasPermission(user.id, "content.edit"))) {
    return <div className="admin-denied"><h1>عدم دسترسی</h1><p>مجوز ویرایش محتوا را ندارید.</p></div>;
  }

  const counts = await db
    .selectFrom("site_content_blocks")
    .select(["page_key"])
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .groupBy("page_key")
    .execute();
  const countByPage = new Map(counts.map((row) => [row.page_key, Number(row.count)]));
  const pageKeys = Object.keys(CONTENT_GROUPS);

  return (
    <>
      <div className="admin-page-header">
        <h1>ویرایش اجزای سایت</h1>
        <p>هر صفحه را جداگانه باز کنید و جزئیات متن‌های همان صفحه را ویرایش کنید. اطلاعات تماس و ویدیوی VIP از بخش تنظیمات مدیریت می‌شوند.</p>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>صفحه</th>
              <th>توضیح</th>
              <th>تعداد بخش قابل ویرایش</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {pageKeys.map((pageKey) => (
              <tr key={pageKey}>
                <td>{CONTENT_GROUPS[pageKey].title}</td>
                <td>{CONTENT_GROUPS[pageKey].description}</td>
                <td>{(countByPage.get(pageKey) ?? 0).toLocaleString("fa-IR")}</td>
                <td>
                  <Link href={`/admin/content/site/${pageKey}`} className="btn-secondary admin-header-btn">
                    ویرایش جزئیات
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
