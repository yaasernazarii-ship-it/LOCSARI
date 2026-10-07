import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import SitePageForm from "@/components/SitePageForm";

export default async function AdminContentNewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "content.create");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز ایجاد محتوای جدید را ندارید.</p>
      </div>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1>صفحهٔ محتوای جدید</h1>
      </div>
      <SitePageForm mode="create" />
    </>
  );
}
