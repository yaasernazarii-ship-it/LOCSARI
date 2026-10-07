import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { assignDefaultRole } from "@/lib/rbac";
import { hashPassword, isValidIranianPhone } from "@/lib/auth";
import { validateConsultantInput } from "@/lib/consultantInput";
import { buildUniqueSlug } from "@/lib/slug";
import { isValidVerificationStatus, isNonEmptyString, parseId } from "@/lib/validation";

// GET /api/admin/consultants?status=pending — صفِ بررسیِ مشاوران برای Admin (بخش ۱۱ و ۲۰)
export async function GET(req: NextRequest) {
  const auth = await requirePermission("consultant.approve");
  if (auth.response) return auth.response;

  const statusParam = req.nextUrl.searchParams.get("status") ?? "pending";
  if (!isValidVerificationStatus(statusParam)) return NextResponse.json({ error: "status نامعتبر است" }, { status: 400 });

  const consultants = await db
    .selectFrom("consultants")
    .innerJoin("users", "users.id", "consultants.user_id")
    .leftJoin("agencies", "agencies.id", "consultants.agency_id")
    .select([
      "consultants.id",
      "consultants.display_name",
      "consultants.slug",
      "consultants.phone",
      "consultants.license_number",
      "consultants.verification_status",
      "consultants.is_active",
      "consultants.created_at",
      "users.name as user_name",
      "users.phone as user_phone",
      "agencies.name as agency_name",
    ])
    .where("consultants.verification_status", "=", statusParam)
    .orderBy("consultants.created_at", "asc")
    .execute();

  return NextResponse.json({ consultants });
}

// POST /api/admin/consultants — ثبت مستقیم مشاور توسط ادمین (بدون نیاز به درخواست/تأیید مشاور)
// اگر کاربری با شمارهٔ ورود داده‌شده وجود نداشته باشد، همان‌جا ساخته می‌شود (بدون رمز عبور، مثل ورود پیامکی)
// تا مشاور فقط با وارد کردن همان شماره از مسیر عادی ورود پیامکی مستقیم به پروفایل تأییدشدهٔ خود دسترسی داشته باشد.
export async function POST(req: NextRequest) {
  const auth = await requirePermission("consultant.approve");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const loginPhone = typeof body.loginPhone === "string" ? body.loginPhone.trim() : "";
  if (!isValidIranianPhone(loginPhone)) return NextResponse.json({ error: "شمارهٔ ورود معتبر نیست" }, { status: 400 });

  const userName = typeof body.userName === "string" ? body.userName.trim() : "";
  if (!isNonEmptyString(userName, 120)) return NextResponse.json({ error: "نام کاربر الزامی است" }, { status: 400 });

  const validated = validateConsultantInput(body, { partial: false });
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
  const data = validated.data;

  let agencyId: number | null = null;
  const rawAgencyId = body.agencyId;
  if (rawAgencyId !== undefined && rawAgencyId !== null && rawAgencyId !== "") {
    agencyId = parseId(String(rawAgencyId));
    if (!agencyId) return NextResponse.json({ error: "agencyId نامعتبر است" }, { status: 400 });
    const agency = await db.selectFrom("agencies").select("id").where("id", "=", agencyId).executeTakeFirst();
    if (!agency) return NextResponse.json({ error: "آژانس یافت نشد" }, { status: 400 });
  }

  const created = await db
    .transaction()
    .execute(async (trx) => {
      let loginUser = await trx.selectFrom("users").select(["id"]).where("phone", "=", loginPhone).executeTakeFirst();

      if (!loginUser) {
        const randomPasswordHash = await hashPassword(randomBytes(32).toString("hex"));
        loginUser = await trx
          .insertInto("users")
          .values({ name: userName, phone: loginPhone, password_hash: randomPasswordHash })
          .returning(["id"])
          .executeTakeFirstOrThrow();
        await assignDefaultRole(loginUser.id, "user");
      } else {
        const existingConsultant = await trx
          .selectFrom("consultants")
          .select("id")
          .where("user_id", "=", loginUser.id)
          .executeTakeFirst();
        if (existingConsultant) throw new Error("ALREADY_CONSULTANT");
      }

      const consultant = await trx
        .insertInto("consultants")
        .values({
          user_id: loginUser.id,
          agency_id: agencyId,
          display_name: data.displayName!,
          slug: "temp",
          bio: data.bio ?? null,
          phone: data.phone ?? loginPhone,
          license_number: data.licenseNumber ?? null,
          verification_status: "approved",
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return trx
        .updateTable("consultants")
        .set({ slug: buildUniqueSlug(data.displayName!, "moshaver", consultant.id) })
        .where("id", "=", consultant.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    })
    .catch((e) => {
      if (e instanceof Error && e.message === "ALREADY_CONSULTANT") return null;
      throw e;
    });

  if (!created) return NextResponse.json({ error: "کاربری با این شماره قبلاً پروفایل مشاور دارد" }, { status: 409 });

  await logAdminAction(auth.user.id, "create", "consultant", created.id, { event: "admin_create", loginPhone });
  return NextResponse.json({ consultant: created }, { status: 201 });
}
