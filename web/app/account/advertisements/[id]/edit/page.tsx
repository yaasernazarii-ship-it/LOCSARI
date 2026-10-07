import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { parseId } from "@/lib/validation";
import PropertyAdForm from "@/components/PropertyAdForm";

// صفحهٔ ویرایش آگهی/ملک — مالکیت و مجوز دقیق در خودِ APIهای properties/advertisements بررسی می‌شود؛
// این صفحه فقط شناسهٔ معتبر و ورود کاربر را تضمین می‌کند.
export default async function EditAdvertisementPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/account/advertisements/${encodeURIComponent(params.id)}/edit`);

  const id = parseId(params.id);
  if (!id) notFound();

  return (
    <>
      <div className="account-page-header">
        <h1>ویرایش آگهی</h1>
      </div>
      <PropertyAdForm mode="edit" advertisementId={id} />
    </>
  );
}
