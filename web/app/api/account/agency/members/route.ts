import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { getManagedAgencyId } from "@/lib/agencyAccess";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isValidIranianPhone } from "@/lib/auth";
import { isValidMembershipRole } from "@/lib/validation";

function normalizePhone(value: string) {
  const phone = value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[\s-]/g, "").replace(/^\+98/, "0").replace(/^0098/, "0");
  return phone;
}

// GET /api/account/agency/members — لیست اعضای آژانسِ خودِ کاربر (owner/manager)
export async function GET() {
  const auth = await requirePermission("membership.view");
  if (auth.response) return auth.response;

  const agencyId = await getManagedAgencyId(auth.user.id);
  if (!agencyId) return NextResponse.json({ error: "آژانسی برای مدیریت یافت نشد" }, { status: 404 });

  const members = await db
    .selectFrom("agency_memberships")
    .innerJoin("users", "users.id", "agency_memberships.user_id")
    .leftJoin("consultants", "consultants.id", "agency_memberships.consultant_id")
    .select([
      "agency_memberships.id",
      "agency_memberships.user_id",
      "agency_memberships.consultant_id",
      "agency_memberships.membership_role",
      "agency_memberships.status",
      "agency_memberships.invited_by_user_id",
      "agency_memberships.created_at",
      "users.name as user_name",
      "users.phone as user_phone",
      "consultants.display_name as consultant_display_name",
    ])
    .where("agency_memberships.agency_id", "=", agencyId)
    .orderBy("agency_memberships.created_at", "desc")
    .execute();

  return NextResponse.json({ members });
}

// POST /api/account/agency/members — دعوت مشاورِ دارای حساب موجود به آژانس (بخش ۱۹؛ کاربر جدید ساخته نمی‌شود)
export async function POST(req: NextRequest) {
  const auth = await requirePermission("membership.invite");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`membership-invite:${auth.user.id}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const agencyId = await getManagedAgencyId(auth.user.id);
  if (!agencyId) return NextResponse.json({ error: "آژانسی برای مدیریت یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const { phone: rawPhone, membershipRole } = body as { phone?: unknown; membershipRole?: unknown };
  const phone = typeof rawPhone === "string" ? normalizePhone(rawPhone) : "";
  if (!isValidIranianPhone(phone)) {
    return NextResponse.json({ error: "شمارهٔ موبایل نامعتبر است" }, { status: 400 });
  }
  const role = membershipRole === undefined ? "consultant" : membershipRole;
  if (!isValidMembershipRole(role) || role === "owner") {
    return NextResponse.json({ error: "membershipRole نامعتبر است" }, { status: 400 });
  }

  const targetUser = await db.selectFrom("users").select(["id"]).where("phone", "=", phone).executeTakeFirst();
  if (!targetUser) return NextResponse.json({ error: "کاربری با این شماره یافت نشد" }, { status: 404 });

  // برای نقش مشاور: کاربر باید از قبل پروفایل Consultant داشته باشد (فقط دعوتِ فرد واقعی، بدون ساخت خودکار پروفایل)
  let consultantId: number | null = null;
  if (role === "consultant") {
    const consultant = await db
      .selectFrom("consultants")
      .select(["id", "agency_id"])
      .where("user_id", "=", targetUser.id)
      .executeTakeFirst();
    if (!consultant) return NextResponse.json({ error: "این کاربر هنوز پروفایل مشاور ندارد" }, { status: 400 });
    if (consultant.agency_id) return NextResponse.json({ error: "این مشاور از قبل عضو یک آژانس است" }, { status: 409 });
    consultantId = consultant.id;
  }

  const existingMembership = await db
    .selectFrom("agency_memberships")
    .select(["id", "status"])
    .where("agency_id", "=", agencyId)
    .where("user_id", "=", targetUser.id)
    .executeTakeFirst();
  if (existingMembership && existingMembership.status !== "removed") {
    return NextResponse.json({ error: "این کاربر از قبل عضو یا در انتظار عضویتِ این آژانس است" }, { status: 409 });
  }

  const membership = await db
    .insertInto("agency_memberships")
    .values({
      agency_id: agencyId,
      user_id: targetUser.id,
      consultant_id: consultantId,
      membership_role: role,
      status: "pending",
      invited_by_user_id: auth.user.id,
    })
    .onConflict((oc) =>
      oc.columns(["agency_id", "user_id"]).doUpdateSet({
        consultant_id: consultantId,
        membership_role: role,
        status: "pending",
        invited_by_user_id: auth.user.id,
        updated_at: new Date().toISOString(),
      })
    )
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "create", "agency_membership", membership.id, {
    event: "invite",
    agencyId,
    targetUserId: targetUser.id,
    role,
  });
  return NextResponse.json({ membership }, { status: 201 });
}
