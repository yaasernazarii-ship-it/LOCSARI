import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { parseId } from "@/lib/validation";
import SitePageForm from "@/components/SitePageForm";

export default async function AdminContentEditPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "content.edit");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز ویرایش محتوا را ندارید.</p>
      </div>
    );
  }

  const id = parseId(params.id);
  if (!id) notFound();

  return (
    <>
      <div className="admin-page-header">
        <h1>ویرایش صفحهٔ محتوا</h1>
      </div>
      <SitePageForm mode="edit" pageId={id} />
    </>
  );
}
