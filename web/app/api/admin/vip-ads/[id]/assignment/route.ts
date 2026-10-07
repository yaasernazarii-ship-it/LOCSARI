import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId, isValidTaskStatus } from "@/lib/validation";

// PATCH /api/admin/vip-ads/:id/assignment — تعیین/تغییر مشاور مسئول پیگیری آگهی VIP توسط ادمین
// :id شناسهٔ آگهی است، نه شناسهٔ رکورد واگذاری (چون هر آگهی حداکثر یک واگذاری دارد).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("vip.manage");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const adId = parseId(params.id);
  if (!adId) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const ad = await db
    .selectFrom("advertisements")
    .select(["id", "is_vip"])
    .where("id", "=", adId)
    .executeTakeFirst();
  if (!ad || !ad.is_vip) return NextResponse.json({ error: "آگهی VIP یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const consultantIdRaw = body.consultantId;
  const consultantId = consultantIdRaw === null || consultantIdRaw === undefined ? null : Number(consultantIdRaw);
  if (consultantId !== null && (!Number.isInteger(consultantId) || consultantId <= 0)) {
    return NextResponse.json({ error: "consultantId نامعتبر است" }, { status: 400 });
  }
  if (consultantId !== null) {
    const consultant = await db.selectFrom("consultants").select("id").where("id", "=", consultantId).executeTakeFirst();
    if (!consultant) return NextResponse.json({ error: "مشاور یافت نشد" }, { status: 404 });
  }

  const status = typeof body.status === "string" ? body.status : "pending";
  if (!isValidTaskStatus(status)) return NextResponse.json({ error: "status نامعتبر است" }, { status: 400 });

  const resultNote = typeof body.resultNote === "string" ? body.resultNote.trim() || null : null;

  const updated = await db
    .insertInto("vip_ad_assignments")
    .values({
      advertisement_id: adId,
      consultant_id: consultantId,
      status,
      result_note: resultNote,
      assigned_by: auth.user.id,
    })
    .onConflict((oc) =>
      oc.column("advertisement_id").doUpdateSet({
        consultant_id: consultantId,
        status,
        result_note: resultNote,
        assigned_by: auth.user.id,
        updated_at: new Date().toISOString(),
      })
    )
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "vip_ad_assignment", adId, { consultantId, status });
  return NextResponse.json({ assignment: updated });
}
