import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId } from "@/lib/validation";
import { isValidAparatUrl } from "@/lib/aparat";
import { storage } from "@/lib/storage";

const STATUSES = ["awaiting_payment", "paid", "contacted", "scheduled", "filmed", "published", "cancelled"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("cip.manage");
  if (auth.response) return auth.response;
  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });
  const existing = await db.selectFrom("cip_requests").select(["id", "status", "video_url"]).where("id", "=", id).executeTakeFirst();
  if (!existing) return NextResponse.json({ error: "درخواست یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });
    if (existing.status === "awaiting_payment" && body.status !== "cancelled") {
      return NextResponse.json({ error: "تا تکمیل پرداخت، امکان تغییر وضعیت نیست" }, { status: 409 });
    }
    update.status = body.status;
  }
  if (body.adminNote !== undefined) update.admin_note = typeof body.adminNote === "string" ? body.adminNote.trim() || null : null;
  if (body.consultantId !== undefined) {
    if (body.consultantId === null || body.consultantId === "") {
      update.assigned_consultant_id = null;
      update.assigned_at = null;
    } else {
      const consultantId = parseId(String(body.consultantId));
      const consultant = consultantId && await db.selectFrom("consultants").select("id").where("id", "=", consultantId).where("verification_status", "=", "approved").where("is_active", "=", true).executeTakeFirst();
      if (!consultant) return NextResponse.json({ error: "مشاور انتخاب‌شده معتبر نیست" }, { status: 400 });
      update.assigned_consultant_id = consultant.id;
      update.assigned_at = new Date().toISOString();
    }
  }
  if (body.videoUrl !== undefined) {
    if (existing.status === "awaiting_payment") return NextResponse.json({ error: "تا تکمیل پرداخت، امکان انتشار ویدیو نیست" }, { status: 409 });
    if (body.videoUrl === null || body.videoUrl === "") {
      update.video_url = null;
    } else if (!isValidAparatUrl(body.videoUrl)) {
      return NextResponse.json({ error: "لینک ویدیو باید یک آدرس معتبر آپارات باشد" }, { status: 400 });
    } else {
      update.video_url = body.videoUrl.trim();
      update.status = "published";
    }
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "هیچ فیلدی برای به‌روزرسانی ارسال نشده" }, { status: 400 });
  update.updated_at = new Date().toISOString();

  const request = await db.updateTable("cip_requests").set(update).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
  await logAdminAction(auth.user.id, "update", "cip_request", id, { fields: Object.keys(update) });
  return NextResponse.json({ request: { ...request, price: Number(request.price) } });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("cip.manage");
  if (auth.response) return auth.response;
  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });
  const request = await db.selectFrom("cip_requests").select(["id", "video_url"]).where("id", "=", id).executeTakeFirst();
  if (!request) return NextResponse.json({ error: "درخواست یافت نشد" }, { status: 404 });

  const payment = await db.selectFrom("cip_payment_orders").select("id").where("cip_request_id", "=", id).executeTakeFirst();
  if (payment) return NextResponse.json({ error: "درخواست دارای سابقهٔ پرداخت است و فقط می‌تواند آرشیو شود" }, { status: 409 });

  await db.deleteFrom("cip_requests").where("id", "=", id).executeTakeFirst();
  const key = request.video_url?.startsWith(`/uploads/cip/${id}/`) ? request.video_url.slice("/uploads/".length) : null;
  if (key) await storage.delete(key);
  await logAdminAction(auth.user.id, "delete", "cip_request", id);
  return NextResponse.json({ deleted: true });
}
