import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import PropertyAdForm from "@/components/PropertyAdForm";

// صفحهٔ ثبت آگهی جدید (بخش «Advertisement Form» فاز ۵) — فقط برای کاربران واردشده.
export default async function NewAdvertisementPage({ searchParams }: { searchParams: { cipPlan?: string } }) {
  const user = await getCurrentUser();
  const cipPlanId = Number(searchParams.cipPlan);
  if (!user) redirect(`/login?next=/account/advertisements/new${cipPlanId ? `?cipPlan=${cipPlanId}` : ""}`);

  return (
    <>
      <div className="account-page-header">
        <h1>{cipPlanId ? "ثبت ملک برای سفارش CIP" : "ثبت آگهی جدید"}</h1>
        {cipPlanId && <p>مشخصات ملک را کامل کنید تا پس از ثبت به مرحلهٔ پرداخت سفارش CIP بروید.</p>}
      </div>
      <PropertyAdForm mode="create" cipPlanId={cipPlanId || undefined} />
    </>
  );
}
