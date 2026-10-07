import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId, isValidTaskStatus } from "@/lib/validation";

// PATCH /api/account/consultant/vip-assignments/:id — گزارش وضعیت/نتیجهٔ پیگیری توسط خودِ مشاور
// :id شناسهٔ رکورد واگذاری است؛ فقط مشاورِ صاحبِ همان واگذاری مجاز به تغییر است.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("consultant.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`consultant-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const consultant = await db.selectFrom("consultants").select("id").where("user_id", "=", auth.user.id).executeTakeFirst();
  if (!consultant) return NextResponse.json({ error: "پروفایل مشاور یافت نشد" }, { status: 404 });

  const assignment = await db
    .selectFrom("vip_ad_assignments")
    .select(["id", "consultant_id"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!assignment || assignment.consultant_id !== consultant.id) {
    return NextResponse.json({ error: "واگذاری یافت نشد" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) {
    if (!isValidTaskStatus(body.status)) return NextResponse.json({ error: "status نامعتبر است" }, { status: 400 });
    update.status = body.status;
  }
  if (body.resultNote !== undefined) {
    update.result_note = typeof body.resultNote === "string" ? body.resultNote.trim() || null : null;
  }

  const updated = await db
    .updateTable("vip_ad_assignments")
    .set(update)
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "vip_ad_assignment", id, { fields: Object.keys(update) });
  return NextResponse.json({ assignment: updated });
}
