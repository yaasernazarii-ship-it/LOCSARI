import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { isValidVerificationStatus } from "@/lib/validation";
import { isValidIranianPhone } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { validateAgencyInput } from "@/lib/agencyInput";
import { validateSocialLinks, replaceSocialLinks } from "@/lib/socialLinks";
import { buildUniqueSlug } from "@/lib/slug";

// GET /api/admin/agencies?status=pending — صفِ بررسیِ آژانس‌ها برای Admin (بخش ۱۱ و ۲۰)
export async function GET(req: NextRequest) {
  const auth = await requirePermission("agency.approve");
  if (auth.response) return auth.response;

  const statusParam = req.nextUrl.searchParams.get("status") ?? "pending";
  if (!isValidVerificationStatus(statusParam)) return NextResponse.json({ error: "status نامعتبر است" }, { status: 400 });

  const agencies = await db
    .selectFrom("agencies")
    .innerJoin("users", "users.id", "agencies.owner_user_id")
    .innerJoin("cities", "cities.id", "agencies.city_id")
    .select([
      "agencies.id",
      "agencies.name",
      "agencies.slug",
      "agencies.phone",
      "agencies.mobile",
      "agencies.verification_status",
      "agencies.is_active",
      "agencies.created_at",
      "users.name as owner_name",
      "users.phone as owner_phone",
      "cities.name as city_name",
    ])
    .where("agencies.verification_status", "=", statusParam)
    .orderBy("agencies.created_at", "asc")
    .execute();

  return NextResponse.json({ agencies });
}

// POST /api/admin/agencies — ثبت مستقیم آژانس توسط ادمین (بدون جریان تأییدِ تدریجی؛ verification_status پیش‌فرض approved).
// مالک باید از قبل کاربر ثبت‌نامی داشته باشد (با شمارهٔ موبایل مشخص می‌شود)؛ در غیر این صورت باید ابتدا ثبت‌نام کند.
export async function POST(req: NextRequest) {
  const auth = await requirePermission("agency.approve");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const ownerPhone = typeof (body as Record<string, unknown>).ownerPhone === "string" ? ((body as Record<string, unknown>).ownerPhone as string).trim() : "";
  if (!isValidIranianPhone(ownerPhone)) {
    return NextResponse.json({ error: "شمارهٔ موبایل مالک نامعتبر است" }, { status: 400 });
  }
  const owner = await db.selectFrom("users").select(["id", "name", "phone"]).where("phone", "=", ownerPhone).executeTakeFirst();
  if (!owner) {
    return NextResponse.json({ error: "کاربری با این شمارهٔ موبایل یافت نشد؛ ابتدا باید در سایت ثبت‌نام کند" }, { status: 404 });
  }
  const existingAgency = await db.selectFrom("agencies").select("id").where("owner_user_id", "=", owner.id).executeTakeFirst();
  if (existingAgency) return NextResponse.json({ error: "این کاربر قبلاً صاحب یک آژانس است" }, { status: 409 });

  const validated = await validateAgencyInput(body, { partial: false });
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
  const data = validated.data;

  const linksResult = validateSocialLinks((body as Record<string, unknown>).socialLinks);
  if (!linksResult.ok) return NextResponse.json({ error: linksResult.error }, { status: 400 });

  const verificationStatus =
    typeof (body as Record<string, unknown>).verificationStatus === "string" &&
    isValidVerificationStatus((body as Record<string, unknown>).verificationStatus)
      ? ((body as Record<string, unknown>).verificationStatus as string)
      : "approved";

  const created = await db.transaction().execute(async (trx) => {
    const agency = await trx
      .insertInto("agencies")
      .values({
        owner_user_id: owner.id,
        name: data.name!,
        slug: "temp",
        description: data.description ?? null,
        phone: data.phone ?? null,
        mobile: data.mobile ?? null,
        email: data.email ?? null,
        website: data.website ?? null,
        address: data.address ?? null,
        city_id: data.cityId!,
        district_id: data.districtId ?? null,
        market_zone_id: data.marketZoneId ?? null,
        neighborhood_id: data.neighborhoodId ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        verification_status: verificationStatus,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const finalAgency = await trx
      .updateTable("agencies")
      .set({ slug: buildUniqueSlug(data.name!, "agency", agency.id) })
      .where("id", "=", agency.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    await replaceSocialLinks(trx, "agency", agency.id, linksResult.links);

    await trx
      .insertInto("agency_memberships")
      .values({
        agency_id: agency.id,
        user_id: owner.id,
        consultant_id: null,
        membership_role: "owner",
        status: "active",
        invited_by_user_id: auth.user.id,
      })
      .execute();

    return finalAgency;
  });

  await logAdminAction(auth.user.id, "create", "agency", created.id, { event: "admin_create", ownerUserId: owner.id });
  return NextResponse.json({ agency: created }, { status: 201 });
}
