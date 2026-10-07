import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId } from "@/lib/validation";
import { ACTION_TO_STATUS, canTransitionVerification, VerificationAction } from "@/lib/verificationWorkflow";
import { validateAgencyInput } from "@/lib/agencyInput";
import { validateSocialLinks, replaceSocialLinks } from "@/lib/socialLinks";

type Params = { params: { id: string } };

// PATCH /api/admin/agencies/[id] — دو کاربرد: ۱) با فیلد action: تأیید/رد/تعلیق (بخش ۱۱)
// ۲) بدون action: ویرایش کامل فیلدهای آژانس توسط ادمین (مالکیت لازم نیست، فقط agency.approve)
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requirePermission("agency.approve");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-verify:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسهٔ نامعتبر است" }, { status: 400 });

  const agency = await db.selectFrom("agencies").selectAll().where("id", "=", id).executeTakeFirst();
  if (!agency) return NextResponse.json({ error: "آژانس یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const action = (body as { action?: unknown } | null)?.action;

  if (action !== undefined) {
    const reason = (body as { reason?: unknown } | null)?.reason;
    if (typeof action !== "string" || !["approve", "reject", "suspend"].includes(action)) {
      return NextResponse.json({ error: "action نامعتبر است (approve/reject/suspend)" }, { status: 400 });
    }
    if ((action === "reject" || action === "suspend") && (typeof reason !== "string" || !reason.trim())) {
      return NextResponse.json({ error: "دلیل الزامی است" }, { status: 400 });
    }

    const target = ACTION_TO_STATUS[action as VerificationAction];
    if (!canTransitionVerification(agency.verification_status as any, target)) {
      return NextResponse.json({ error: `تغییر وضعیت از ${agency.verification_status} به ${target} مجاز نیست` }, { status: 400 });
    }

    const update: Record<string, unknown> = { verification_status: target, updated_at: new Date().toISOString() };
    if (action === "reject") update.rejection_reason = (reason as string).trim();
    if (action === "suspend") update.suspension_reason = (reason as string).trim();
    if (action === "approve") {
      update.rejection_reason = null;
      update.suspension_reason = null;
    }

    const updated = await db.updateTable("agencies").set(update).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
    await logAdminAction(auth.user.id, "update", "agency", id, { event: action, reason: reason ?? null });
    return NextResponse.json({ agency: updated });
  }

  // ---- ویرایش کامل فیلدها (بدون action) ----
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const validated = await validateAgencyInput(body, { partial: true });
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
  const data = validated.data;

  const linksResult = validateSocialLinks((body as Record<string, unknown>).socialLinks);
  if (!linksResult.ok) return NextResponse.json({ error: linksResult.error }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fieldMap: Record<string, string> = {
    name: "name",
    description: "description",
    phone: "phone",
    mobile: "mobile",
    email: "email",
    website: "website",
    address: "address",
    cityId: "city_id",
    districtId: "district_id",
    marketZoneId: "market_zone_id",
    neighborhoodId: "neighborhood_id",
    latitude: "latitude",
    longitude: "longitude",
  };
  for (const [key, column] of Object.entries(fieldMap)) {
    if ((data as Record<string, unknown>)[key] !== undefined) update[column] = (data as Record<string, unknown>)[key];
  }

  if (Object.keys(update).length === 1) return NextResponse.json({ error: "هیچ فیلدی برای به‌روزرسانی ارسال نشده" }, { status: 400 });

  const updated = await db.transaction().execute(async (trx) => {
    const row = await trx.updateTable("agencies").set(update).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
    if ((body as Record<string, unknown>).socialLinks !== undefined) {
      await replaceSocialLinks(trx, "agency", id, linksResult.links);
    }
    return row;
  });

  await logAdminAction(auth.user.id, "update", "agency", id, { fields: Object.keys(update) });
  return NextResponse.json({ agency: updated });
}

// DELETE /api/admin/agencies/[id] — حذف کامل آژانس (عضویت‌ها cascade می‌شوند؛ مشاور/آگهی مرتبط فقط ارجاعشان null می‌شود)
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requirePermission("agency.delete");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسهٔ نامعتبر است" }, { status: 400 });

  const deleted = await db.deleteFrom("agencies").where("id", "=", id).returningAll().executeTakeFirst();
  if (!deleted) return NextResponse.json({ error: "آژانس یافت نشد" }, { status: 404 });

  await logAdminAction(auth.user.id, "delete", "agency", id, { name: deleted.name });
  return NextResponse.json({ ok: true });
}
