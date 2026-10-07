import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { validateAgencyInput } from "@/lib/agencyInput";
import { validateSocialLinks, replaceSocialLinks, getSocialLinks } from "@/lib/socialLinks";
import { buildUniqueSlug } from "@/lib/slug";

// GET /api/account/agency — آژانسِ متعلق به کاربر واردشده (یا null)
export async function GET() {
  const auth = await requirePermission("agency.view");
  if (auth.response) return auth.response;

  const agency = await db.selectFrom("agencies").selectAll().where("owner_user_id", "=", auth.user.id).executeTakeFirst();
  if (!agency) return NextResponse.json({ agency: null });

  const socialLinks = await getSocialLinks(db, "agency", agency.id);
  return NextResponse.json({ agency, socialLinks });
}

// POST /api/account/agency — درخواست ثبت آژانس جدید (بخش ۱۰). هر کاربر حداکثر یک آژانس مالکیت می‌کند.
export async function POST(req: NextRequest) {
  const auth = await requirePermission("agency.create");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`agency-apply:${auth.user.id}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }
  if (!checkRateLimit(`agency-apply-ip:${getClientIp(req)}`, 15, 10 * 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const existing = await db.selectFrom("agencies").select("id").where("owner_user_id", "=", auth.user.id).executeTakeFirst();
  if (existing) return NextResponse.json({ error: "شما قبلاً یک آژانس ثبت کرده‌اید" }, { status: 409 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const validated = await validateAgencyInput(body, { partial: false });
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
  const data = validated.data;

  const linksResult = validateSocialLinks((body as Record<string, unknown>).socialLinks);
  if (!linksResult.ok) return NextResponse.json({ error: linksResult.error }, { status: 400 });

  const created = await db.transaction().execute(async (trx) => {
    const agency = await trx
      .insertInto("agencies")
      .values({
        owner_user_id: auth.user.id,
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
        user_id: auth.user.id,
        consultant_id: null,
        membership_role: "owner",
        status: "active",
        invited_by_user_id: null,
      })
      .execute();

    return finalAgency;
  });

  await logAdminAction(auth.user.id, "create", "agency", created.id, { event: "apply" });
  return NextResponse.json({ agency: created }, { status: 201 });
}

// PATCH /api/account/agency — ویرایش آژانس خودِ کاربر (فقط مالک؛ verification_status تغییر نمی‌کند)
export async function PATCH(req: NextRequest) {
  const auth = await requirePermission("agency.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`agency-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const agency = await db.selectFrom("agencies").selectAll().where("owner_user_id", "=", auth.user.id).executeTakeFirst();
  if (!agency) return NextResponse.json({ error: "آژانسی یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
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

  const updated = await db.transaction().execute(async (trx) => {
    const row = await trx
      .updateTable("agencies")
      .set(update)
      .where("id", "=", agency.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    if ((body as Record<string, unknown>).socialLinks !== undefined) {
      await replaceSocialLinks(trx, "agency", agency.id, linksResult.links);
    }
    return row;
  });

  await logAdminAction(auth.user.id, "update", "agency", agency.id, { fields: Object.keys(update) });
  return NextResponse.json({ agency: updated });
}
