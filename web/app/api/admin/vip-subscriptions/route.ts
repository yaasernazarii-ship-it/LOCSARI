import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { isValidVipSubscriptionStatus, VIP_SUBSCRIPTION_STATUSES } from "@/lib/validation";

// GET /api/admin/vip-subscriptions?status=pending — لیست درخواست‌های اشتراک VIP برای بازبینی مرکزی
export async function GET(req: NextRequest) {
  const auth = await requirePermission("vip.manage");
  if (auth.response) return auth.response;

  const statusParam = req.nextUrl.searchParams.get("status");
  if (statusParam && !isValidVipSubscriptionStatus(statusParam)) {
    return NextResponse.json({ error: "status نامعتبر است" }, { status: 400 });
  }

  let query = db
    .selectFrom("vip_subscriptions")
    .innerJoin("users", "users.id", "vip_subscriptions.user_id")
    .innerJoin("vip_plans", "vip_plans.id", "vip_subscriptions.plan_id");
  if (statusParam) query = query.where("vip_subscriptions.status", "=", statusParam);

  const rows = await query
    .select([
      "vip_subscriptions.id",
      "vip_subscriptions.status",
      "vip_subscriptions.price",
      "vip_subscriptions.starts_at",
      "vip_subscriptions.ends_at",
      "vip_subscriptions.admin_note",
      "vip_subscriptions.created_at",
      "users.id as user_id",
      "users.name as user_name",
      "users.phone as user_phone",
      "vip_plans.title as plan_title",
      "vip_plans.duration_days as plan_duration_days",
    ])
    .orderBy("vip_subscriptions.created_at", "desc")
    .execute();

  return NextResponse.json({
    statuses: VIP_SUBSCRIPTION_STATUSES,
    subscriptions: rows.map((r) => ({ ...r, price: Number(r.price) })),
  });
}
