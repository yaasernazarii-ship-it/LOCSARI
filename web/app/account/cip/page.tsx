import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import CipRequestForm from "@/components/CipRequestForm";

export default async function AccountCipPage({ searchParams }: { searchParams: { plan?: string; advertisement?: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    const next = `/account/cip${searchParams.plan ? `?plan=${encodeURIComponent(searchParams.plan)}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const [plans, advertisements, requests] = await Promise.all([
    db.selectFrom("cip_plans").select(["id", "title", "price"]).where("is_active", "=", true).orderBy("sort_order", "asc").execute(),
    db.selectFrom("advertisements").select(["id", "title"]).where("created_by_user_id", "=", user.id).where("status", "in", ["draft", "pending_review", "published"]).orderBy("created_at", "desc").execute(),
    db.selectFrom("cip_requests").innerJoin("cip_plans", "cip_plans.id", "cip_requests.plan_id").innerJoin("advertisements", "advertisements.id", "cip_requests.advertisement_id").leftJoin("consultants", "consultants.id", "cip_requests.assigned_consultant_id").select(["cip_requests.id", "cip_requests.status", "cip_requests.admin_note", "cip_requests.video_url", "cip_requests.created_at", "cip_plans.title as plan_title", "advertisements.title as advertisement_title", "consultants.display_name as consultant_name", "consultants.phone as consultant_phone"]).where("cip_requests.user_id", "=", user.id).orderBy("cip_requests.created_at", "desc").execute(),
  ]);
  const labels: Record<string, string> = { awaiting_payment: "در انتظار پرداخت", paid: "پرداخت‌شده", contacted: "هماهنگی اولیه", scheduled: "تصویربرداری زمان‌بندی شد", filmed: "در حال تدوین", published: "ویدیو آماده است", cancelled: "لغوشده" };
  return <><div className="account-page-header"><h1>ویدیوی CIP</h1><p>سفارش تولید ویدیوی حرفه‌ای برای آگهی‌های شما.</p></div><CipRequestForm plans={plans.map((p) => ({ ...p, price: Number(p.price) }))} advertisements={advertisements} selectedPlanId={Number(searchParams.plan) || undefined} selectedAdvertisementId={Number(searchParams.advertisement) || undefined} /><section className="form-section"><h2>درخواست‌های من</h2>{requests.length === 0 ? <p className="search-empty">درخواستی ثبت نشده است.</p> : requests.map((request) => <div key={request.id} className="my-ad-row"><div className="my-ad-row__body"><h3>{request.advertisement_title} — {request.plan_title}</h3><p><span className={`status-badge status-badge--${request.status === "published" ? "approved" : "pending"}`}>{labels[request.status]}</span></p>{request.admin_note && <p className="my-ad-row__meta">توضیح مدیریت: {request.admin_note}</p>}{request.consultant_name && <p className="my-ad-row__meta">مشاور مسئول: {request.consultant_name}{request.consultant_phone ? ` — ${request.consultant_phone}` : ""}</p>}{request.video_url && <p><a href={request.video_url} target="_blank">مشاهدهٔ ویدیوی نهایی</a></p>}</div></div>)}</section></>;
}
