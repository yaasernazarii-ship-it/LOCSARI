import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { getUserRoleKeys } from "@/lib/rbac";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId } from "@/lib/validation";

// ثبت درخواست CIP بدون پرداخت — فقط مدیر کل.
// درخواست مستقیماً با وضعیت «پرداخت‌شده» ساخته می‌شود و هیچ رکوردی در cip_payment_orders ثبت نمی‌شود،
// بنابراین در گزارش درآمد (که از cip_payment_orders محاسبه می‌شود) اثری ندارد.
export async function POST(req: NextRequest) {
  const auth = await requirePermission("cip.manage");
  if (auth.response) return auth.response;
  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });

  const roles = await getUserRoleKeys(auth.user.id);
  if (!roles.includes("super_admin")) {
    return NextResponse.json({ error: "انتشار آگهی CIP بدون پرداخت فقط برای مدیر کل مجاز است" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const planId = parseId(String(body.planId ?? ""));
  const advertisementId = parseId(String(body.advertisementId ?? ""));
  if (!planId || !advertisementId) return NextResponse.json({ error: "پلن یا آگهی نامعتبر است" }, { status: 400 });

  const [plan, advertisement] = await Promise.all([
    db.selectFrom("cip_plans").select(["id", "price"]).where("id", "=", planId).where("is_active", "=", true).executeTakeFirst(),
    db.selectFrom("advertisements").select(["id", "created_by_user_id"]).where("id", "=", advertisementId).executeTakeFirst(),
  ]);
  if (!plan || !advertisement) return NextResponse.json({ error: "پلن یا آگهی انتخاب‌شده یافت نشد" }, { status: 404 });

  const request = await db
    .insertInto("cip_requests")
    .values({
      user_id: advertisement.created_by_user_id,
      advertisement_id: advertisement.id,
      plan_id: plan.id,
      price: Number(plan.price),
      status: "paid",
      video_url: null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "create", "cip_request", request.id, { freePublish: true, advertisementId: advertisement.id });

  return NextResponse.json({ request: { ...request, price: Number(request.price) } }, { status: 201 });
}
