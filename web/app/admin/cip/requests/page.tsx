import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import AdminCipRequestRow from "@/components/AdminCipRequestRow";

const LABELS: Record<string, string> = { awaiting_payment: "در انتظار پرداخت", paid: "پرداخت‌شده", contacted: "هماهنگی اولیه", scheduled: "تصویربرداری زمان‌بندی شد", filmed: "در حال تدوین", published: "ویدیو آماده است", cancelled: "لغوشده" };

export default async function AdminCipRequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  if (!(await userHasPermission(user.id, "cip.manage"))) return <div className="admin-denied"><h1>عدم دسترسی</h1><p>مجوز مدیریت CIP را ندارید.</p></div>;

  const [requests, consultants] = await Promise.all([
    db.selectFrom("cip_requests")
      .innerJoin("cip_plans", "cip_plans.id", "cip_requests.plan_id")
      .innerJoin("advertisements", "advertisements.id", "cip_requests.advertisement_id")
      .innerJoin("properties", "properties.id", "advertisements.property_id")
      .innerJoin("users", "users.id", "cip_requests.user_id")
      .leftJoin("consultants", "consultants.id", "cip_requests.assigned_consultant_id")
      .leftJoin("categories", "categories.id", "properties.category_id")
      .leftJoin("cities", "cities.id", "properties.city_id")
      .leftJoin("neighborhoods", "neighborhoods.id", "properties.neighborhood_id")
      .select(["cip_requests.id", "cip_requests.status", "cip_requests.admin_note", "cip_requests.video_url", "cip_requests.assigned_consultant_id", "cip_requests.created_at", "cip_plans.title as plan_title", "advertisements.title as advertisement_title", "users.name as user_name", "users.phone as user_phone", "consultants.display_name as consultant_name", "properties.description as property_description", "properties.area", "properties.built_area", "properties.land_area", "properties.bedrooms", "properties.built_year", "properties.floor", "properties.total_floors", "categories.name as category_name", "cities.name as city_name", "neighborhoods.name as neighborhood_name"])
      .orderBy("cip_requests.created_at", "desc").execute(),
    db.selectFrom("consultants").select(["id", "display_name"]).where("verification_status", "=", "approved").where("is_active", "=", true).orderBy("display_name", "asc").execute(),
  ]);

  return <><div className="admin-page-header"><h1>درخواست‌های CIP</h1><p><Link href="/admin/cip">بازگشت به مدیریت CIP</Link></p></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>آگهی و مشخصات ملک</th><th>کاربر</th><th>پلن</th><th>وضعیت</th><th>یادداشت</th><th>ویدیو</th><th>مشاور مسئول</th><th>عملیات</th></tr></thead><tbody>{requests.map((item) => <tr key={item.id}><td><strong>{item.advertisement_title}</strong><br/><small>{[item.category_name, item.city_name, item.neighborhood_name].filter(Boolean).join("، ") || "موقعیت ثبت نشده"}</small><br/><small>{[item.area && `مساحت: ${Number(item.area).toLocaleString("fa-IR")} متر`, item.built_area && `زیربنا: ${Number(item.built_area).toLocaleString("fa-IR")} متر`, item.land_area && `زمین: ${Number(item.land_area).toLocaleString("fa-IR")} متر`, item.bedrooms !== null && `خواب: ${item.bedrooms.toLocaleString("fa-IR")}`, item.built_year && `سال ساخت: ${item.built_year.toLocaleString("fa-IR")}`, item.floor !== null && `طبقه: ${item.floor.toLocaleString("fa-IR")}${item.total_floors ? ` از ${item.total_floors.toLocaleString("fa-IR")}` : ""}`].filter(Boolean).join(" | ") || "جزئیات ملک ثبت نشده"}</small>{item.property_description && <><br/><small>{item.property_description}</small></>}</td><td>{item.user_name}<br/><span dir="ltr">{item.user_phone}</span></td><td>{item.plan_title}</td><td><span className="status-badge status-badge--pending">{LABELS[item.status]}</span></td><td>{item.admin_note || "—"}</td><td>{item.video_url ? <a href={item.video_url} target="_blank">مشاهده</a> : "—"}</td><td>{item.consultant_name ?? "تعیین نشده"}</td><td><AdminCipRequestRow requestId={item.id} status={item.status} adminNote={item.admin_note} videoUrl={item.video_url} consultants={consultants} assignedConsultantId={item.assigned_consultant_id} /></td></tr>)}{requests.length === 0 && <tr><td colSpan={8} className="search-empty">درخواستی ثبت نشده است.</td></tr>}</tbody></table></div></>;
}
