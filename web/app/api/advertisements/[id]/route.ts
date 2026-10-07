import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, isPropertyReviewer } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, isValidAdvertisementStatus, isValidTransactionType, parseId, AdvertisementStatus } from "@/lib/validation";
import { validateTransactionAmounts } from "@/lib/transactionAmounts";
import { canTransition, syncExpiredStatus, transitionAdvertisementStatus } from "@/lib/advertisementWorkflow";

async function loadAd(id: number) {
  return db.selectFrom("advertisements").selectAll().where("id", "=", id).executeTakeFirst();
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  let ad = await loadAd(id);
  if (!ad) return NextResponse.json({ error: "آگهی یافت نشد" }, { status: 404 });

  const expired = await syncExpiredStatus(db, ad);
  if (expired) ad = { ...ad, status: "expired" };

  if (ad.status === "published") {
    const property = await db.selectFrom("properties").selectAll().where("id", "=", ad.property_id).executeTakeFirst();
    return NextResponse.json({ advertisement: ad, property });
  }

  const auth = await requireAuth();
  const isOwner = !auth.response && auth.user.id === ad.created_by_user_id;
  const reviewer = !auth.response && (await isPropertyReviewer(auth.user.id));
  if (!isOwner && !reviewer) return NextResponse.json({ error: "آگهی یافت نشد" }, { status: 404 });

  const property = await db.selectFrom("properties").selectAll().where("id", "=", ad.property_id).executeTakeFirst();
  const history = await db
    .selectFrom("advertisement_status_history")
    .selectAll()
    .where("advertisement_id", "=", id)
    .orderBy("created_at", "asc")
    .execute();

  return NextResponse.json({ advertisement: ad, property, history });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("advertisement.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`advertisement-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  let ad = await loadAd(id);
  if (!ad) return NextResponse.json({ error: "آگهی یافت نشد" }, { status: 404 });
  await syncExpiredStatus(db, ad);
  ad = (await loadAd(id))!;

  const reviewer = await isPropertyReviewer(auth.user.id);
  const isOwner = ad.created_by_user_id === auth.user.id;
  if (!reviewer && !isOwner) return NextResponse.json({ error: "دسترسی مجاز نیست" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  // ---- تغییر وضعیت به sold/rented (فقط از published، توسط مالک یا بازبین) ----
  if (body.status !== undefined) {
    if (!isValidAdvertisementStatus(body.status)) return NextResponse.json({ error: "status نامعتبر است" }, { status: 400 });
    const target = body.status as AdvertisementStatus;
    if (!["sold", "rented"].includes(target) || !canTransition(ad.status as AdvertisementStatus, target)) {
      return NextResponse.json({ error: `تغییر وضعیت از ${ad.status} به ${target} مجاز نیست` }, { status: 400 });
    }
    await transitionAdvertisementStatus(db, {
      advertisementId: id,
      from: ad.status as AdvertisementStatus,
      to: target,
      changedBy: auth.user.id,
      reason: typeof body.reason === "string" ? body.reason : null,
    });
    await logAdminAction(auth.user.id, "update", "advertisement", id, { status: target });
    const updated = await loadAd(id);
    return NextResponse.json({ advertisement: updated });
  }

  // ---- ویرایش محتوا: فقط در draft/rejected (مالک) یا هر وضعیتی (بازبین) ----
  if (!reviewer && !["draft", "rejected"].includes(ad.status)) {
    return NextResponse.json({ error: "آگهی در این وضعیت فقط توسط بازبین قابل ویرایش است" }, { status: 409 });
  }

  const update: Record<string, unknown> = {};

  if (body.title !== undefined) {
    if (!isNonEmptyString(body.title, 200)) return NextResponse.json({ error: "title نامعتبر است" }, { status: 400 });
    update.title = body.title.trim();
  }
  if (body.description !== undefined) update.description = typeof body.description === "string" ? body.description : null;

  const transactionType = body.transactionType ?? ad.transaction_type;
  if (body.transactionType !== undefined || body.price !== undefined || body.deposit !== undefined || body.monthlyRent !== undefined) {
    if (!isValidTransactionType(transactionType)) return NextResponse.json({ error: "transactionType نامعتبر است" }, { status: 400 });
    const amounts = validateTransactionAmounts(transactionType, {
      price: body.price !== undefined ? body.price : ad.price !== null ? Number(ad.price) : null,
      deposit: body.deposit !== undefined ? body.deposit : ad.deposit !== null ? Number(ad.deposit) : null,
      monthlyRent: body.monthlyRent !== undefined ? body.monthlyRent : ad.monthly_rent !== null ? Number(ad.monthly_rent) : null,
    });
    if (!amounts.ok) return NextResponse.json({ error: amounts.error }, { status: 400 });
    update.transaction_type = transactionType;
    update.price = amounts.price;
    update.deposit = amounts.deposit;
    update.monthly_rent = amounts.monthlyRent;
  }

  if (body.expiresAt !== undefined) {
    if (body.expiresAt === null) {
      update.expires_at = null;
    } else {
      const d = new Date(body.expiresAt);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "expiresAt نامعتبر است" }, { status: 400 });
      update.expires_at = d.toISOString();
    }
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "هیچ فیلدی برای به‌روزرسانی ارسال نشده" }, { status: 400 });
  update.updated_at = new Date().toISOString();

  const advertisement = await db.updateTable("advertisements").set(update).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
  await logAdminAction(auth.user.id, "update", "advertisement", id, { fields: Object.keys(update) });
  return NextResponse.json({ advertisement });
}

// حذف کامل — برای مالک عادی فقط در وضعیت پیش‌نویس/در انتظار بررسی (برای بقیه از /archive استفاده شود)؛
// بازبین مرکزی (ادمین) اختیار حذف کامل در هر وضعیتی را دارد (مدیریت واقعی آگهی‌ها از پنل ادمین).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("advertisement.delete");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`advertisement-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const ad = await loadAd(id);
  if (!ad) return NextResponse.json({ error: "آگهی یافت نشد" }, { status: 404 });

  const reviewer = await isPropertyReviewer(auth.user.id);
  if (!reviewer && ad.created_by_user_id !== auth.user.id) {
    return NextResponse.json({ error: "دسترسی مجاز نیست" }, { status: 403 });
  }

  if (!reviewer && !["draft", "pending_review"].includes(ad.status)) {
    return NextResponse.json({ error: "فقط آگهی در وضعیت پیش‌نویس یا در انتظار بررسی قابل حذف است؛ از آرشیو استفاده کنید" }, { status: 409 });
  }

  await db.deleteFrom("advertisements").where("id", "=", id).execute();
  await logAdminAction(auth.user.id, "delete", "advertisement", id, { propertyId: ad.property_id });
  return NextResponse.json({ success: true });
}
