import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { validateConsultantInput } from "@/lib/consultantInput";
import { validateSocialLinks, replaceSocialLinks, getSocialLinks } from "@/lib/socialLinks";
import { buildUniqueSlug } from "@/lib/slug";
import { parseId } from "@/lib/validation";

// GET /api/account/consultant — پروفایل مشاورِ خودِ کاربر واردشده (یا null اگر هنوز اپلای نکرده)
export async function GET() {
  const auth = await requirePermission("consultant.view");
  if (auth.response) return auth.response;

  const consultant = await db.selectFrom("consultants").selectAll().where("user_id", "=", auth.user.id).executeTakeFirst();
  if (!consultant) return NextResponse.json({ consultant: null });

  const socialLinks = await getSocialLinks(db, "consultant", consultant.id);
  return NextResponse.json({ consultant, socialLinks });
}

// POST /api/account/consultant — درخواست تبدیل‌شدن به مشاور (بخش ۹). فقط یک‌بار مجاز؛ نتیجه همیشه pending.
export async function POST(req: NextRequest) {
  const auth = await requirePermission("consultant.create");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`consultant-apply:${auth.user.id}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }
  if (!checkRateLimit(`consultant-apply-ip:${getClientIp(req)}`, 15, 10 * 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const existing = await db.selectFrom("consultants").select("id").where("user_id", "=", auth.user.id).executeTakeFirst();
  if (existing) return NextResponse.json({ error: "شما قبلاً درخواست مشاور شدن ثبت کرده‌اید" }, { status: 409 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const validated = validateConsultantInput(body, { partial: false });
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
  const data = validated.data;

  const linksResult = validateSocialLinks((body as Record<string, unknown>).socialLinks);
  if (!linksResult.ok) return NextResponse.json({ error: linksResult.error }, { status: 400 });

  // agencyId اختیاری: درخواستِ عضویت هم‌زمان (Join Request) — تأیید نهایی عضویت با Agency Manager است (بخش ۸)
  let agencyId: number | null = null;
  const rawAgencyId = (body as Record<string, unknown>).agencyId;
  if (rawAgencyId !== undefined && rawAgencyId !== null) {
    agencyId = parseId(String(rawAgencyId));
    if (!agencyId) return NextResponse.json({ error: "agencyId نامعتبر است" }, { status: 400 });
    const agency = await db
      .selectFrom("agencies")
      .select(["id", "verification_status", "is_active"])
      .where("id", "=", agencyId)
      .executeTakeFirst();
    if (!agency || !agency.is_active || agency.verification_status !== "approved") {
      return NextResponse.json({ error: "آژانس انتخاب‌شده یافت نشد یا هنوز تأیید نشده است" }, { status: 400 });
    }
  }

  const created = await db.transaction().execute(async (trx) => {
    const consultant = await trx
      .insertInto("consultants")
      .values({
        user_id: auth.user.id,
        display_name: data.displayName!,
        slug: "temp",
        bio: data.bio ?? null,
        phone: data.phone ?? null,
        license_number: data.licenseNumber ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const finalConsultant = await trx
      .updateTable("consultants")
      .set({ slug: buildUniqueSlug(data.displayName!, "moshaver", consultant.id) })
      .where("id", "=", consultant.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    await replaceSocialLinks(trx, "consultant", consultant.id, linksResult.links);

    // درخواست عضویت آژانس (در صورت وجود) — pending تا Agency Manager تصمیم بگیرد؛ invited_by_user_id=null یعنی خودِ کاربر آغازگر است
    if (agencyId) {
      await trx
        .insertInto("agency_memberships")
        .values({
          agency_id: agencyId,
          user_id: auth.user.id,
          consultant_id: consultant.id,
          membership_role: "consultant",
          status: "pending",
          invited_by_user_id: null,
        })
        .onConflict((oc) => oc.doNothing())
        .execute();
    }

    return finalConsultant;
  });

  await logAdminAction(auth.user.id, "create", "consultant", created.id, { event: "apply", agencyId });
  return NextResponse.json({ consultant: created }, { status: 201 });
}

// PATCH /api/account/consultant — ویرایش پروفایل خودِ مشاور (هرگز verification_status از این مسیر تغییر نمی‌کند)
export async function PATCH(req: NextRequest) {
  const auth = await requirePermission("consultant.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`consultant-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const consultant = await db.selectFrom("consultants").selectAll().where("user_id", "=", auth.user.id).executeTakeFirst();
  if (!consultant) return NextResponse.json({ error: "پروفایل مشاور یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const validated = validateConsultantInput(body, { partial: true });
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
  const data = validated.data;

  const linksResult = validateSocialLinks((body as Record<string, unknown>).socialLinks);
  if (!linksResult.ok) return NextResponse.json({ error: linksResult.error }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.displayName !== undefined) update.display_name = data.displayName;
  if (data.bio !== undefined) update.bio = data.bio;
  if (data.phone !== undefined) update.phone = data.phone;
  if (data.licenseNumber !== undefined) update.license_number = data.licenseNumber;

  const updated = await db.transaction().execute(async (trx) => {
    const row = await trx
      .updateTable("consultants")
      .set(update)
      .where("id", "=", consultant.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    if ((body as Record<string, unknown>).socialLinks !== undefined) {
      await replaceSocialLinks(trx, "consultant", consultant.id, linksResult.links);
    }
    return row;
  });

  await logAdminAction(auth.user.id, "update", "consultant", consultant.id, { fields: Object.keys(update) });
  return NextResponse.json({ consultant: updated });
}
