import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import SiteContentBlocksForm from "@/components/SiteContentBlocksForm";

const CONTENT_GROUPS: Record<string, { title: string; description: string; contentKeys: string[] }> = {
  global: { title: "اجزای مشترک سایت", description: "نام سایت در هدر و متن معرفی در فوتر — در تمام صفحات نمایش داده می‌شود.", contentKeys: ["global"] },
  home: { title: "صفحهٔ اصلی", description: "هیرو، متن جستجو، تیتر جدیدترین آگهی‌ها و بخش دعوت به ثبت آگهی.", contentKeys: ["home"] },
  vip: { title: "صفحهٔ آگهی‌های VIP", description: "هیرو، پیام نبود آگهی فعال و بخش دعوت به تهیهٔ اشتراک VIP.", contentKeys: ["vip"] },
  contact: { title: "صفحهٔ تماس با ما", description: "متن معرفی بالای صفحهٔ تماس با ما.", contentKeys: ["contact"] },
  cip: { title: "صفحهٔ آگهی‌های CIP", description: "هیرو، تیتر فهرست ویدیوها، پیام نبود ویدیو و بخش معرفی پلن‌ها.", contentKeys: ["cip"] },
};

export default async function AdminSitePageContentPage({ params }: { params: { pageKey: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  if (!(await userHasPermission(user.id, "content.edit"))) {
    return <div className="admin-denied"><h1>عدم دسترسی</h1><p>مجوز ویرایش محتوا را ندارید.</p></div>;
  }

  const group = CONTENT_GROUPS[params.pageKey];
  if (!group) notFound();

  return (
    <>
      <div className="admin-page-header">
        <h1>{group.title}</h1>
        <p>{group.description}</p>
        <p><Link href="/admin/content/site">بازگشت به فهرست صفحات</Link></p>
      </div>
      <SiteContentBlocksForm pageKeys={group.contentKeys} />
    </>
  );
}
