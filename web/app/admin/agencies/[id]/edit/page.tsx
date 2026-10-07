import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { parseId } from "@/lib/validation";
import AdminAgencyForm from "@/components/AdminAgencyForm";

export default async function AdminEditAgencyPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "agency.approve");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز ویرایش آژانس را ندارید.</p>
      </div>
    );
  }

  const id = parseId(params.id);
  if (!id) notFound();

  const agency = await db
    .selectFrom("agencies")
    .select(["id", "name", "description", "phone", "mobile", "email", "website", "address", "neighborhood_id"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!agency) notFound();

  return (
    <>
      <div className="admin-page-header">
        <h1>ویرایش آژانس: {agency.name}</h1>
      </div>
      <AdminAgencyForm
        mode="edit"
        agencyId={agency.id}
        initial={{
          name: agency.name,
          description: agency.description,
          phone: agency.phone,
          mobile: agency.mobile,
          email: agency.email,
          website: agency.website,
          address: agency.address,
          neighborhoodId: agency.neighborhood_id,
        }}
      />
    </>
  );
}
