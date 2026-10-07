import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId } from "@/lib/validation";
import { ACTION_TO_STATUS, canTransitionVerification, VerificationAction } from "@/lib/verificationWorkflow";

type Params = { params: { id: string } };

// PATCH /api/admin/consultants/[id] — تأیید/رد/تعلیق مشاور توسط Admin (بخش ۱۱)
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requirePermission("consultant.approve");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-verify:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسهٔ نامعتبر است" }, { status: 400 });

  const consultant = await db.selectFrom("consultants").selectAll().where("id", "=", id).executeTakeFirst();
  if (!consultant) return NextResponse.json({ error: "مشاور یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const action = (body as { action?: unknown } | null)?.action;
  const reason = (body as { reason?: unknown } | null)?.reason;
  if (typeof action !== "string" || !["approve", "reject", "suspend"].includes(action)) {
    return NextResponse.json({ error: "action نامعتبر است (approve/reject/suspend)" }, { status: 400 });
  }
  if ((action === "reject" || action === "suspend") && (typeof reason !== "string" || !reason.trim())) {
    return NextResponse.json({ error: "دلیل الزامی است" }, { status: 400 });
  }

  const target = ACTION_TO_STATUS[action as VerificationAction];
  if (!canTransitionVerification(consultant.verification_status as any, target)) {
    return NextResponse.json({ error: `تغییر وضعیت از ${consultant.verification_status} به ${target} مجاز نیست` }, { status: 400 });
  }

  const update: Record<string, unknown> = { verification_status: target, updated_at: new Date().toISOString() };
  if (action === "reject") update.rejection_reason = (reason as string).trim();
  if (action === "suspend") update.suspension_reason = (reason as string).trim();
  if (action === "approve") {
    update.rejection_reason = null;
    update.suspension_reason = null;
  }

  const updated = await db.updateTable("consultants").set(update).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
  await logAdminAction(auth.user.id, "update", "consultant", id, { event: action, reason: reason ?? null });
  return NextResponse.json({ consultant: updated });
}
