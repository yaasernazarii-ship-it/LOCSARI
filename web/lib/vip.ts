// منطق مشترک بخش «آگهی VIP» — اشتراک فعال بر اساس سقف آگهی، بدون تاریخ انقضا.

import { DbOrTx } from "./propertyAttributes";

export interface VipSubscriptionRow {
  id: number;
  user_id: number;
  plan_id: number;
  status: string;
  ends_at: Date | string | null;
  ad_limit: number;
}

/** آخرین اشتراک «فعال و منقضی‌نشدهٔ» کاربر را برمی‌گرداند (در صورت نبود، null). */
async function getLatestActiveVipSubscription(
  tx: DbOrTx,
  filter: { userId?: number; agencyId?: number }
): Promise<VipSubscriptionRow | null> {
  let query = tx
    .selectFrom("vip_subscriptions")
    .select(["id", "user_id", "plan_id", "status", "ends_at", "ad_limit"])
    .where("status", "=", "active");

  if (filter.userId !== undefined) query = query.where("user_id", "=", filter.userId);
  if (filter.agencyId !== undefined) query = query.where("agency_id", "=", filter.agencyId);

  const rows = await query.orderBy("created_at", "desc").execute();
  return rows[0] ?? null;
}

export function getActiveVipSubscription(tx: DbOrTx, userId: number): Promise<VipSubscriptionRow | null> {
  return getLatestActiveVipSubscription(tx, { userId });
}

export function getActiveVipSubscriptionForAgency(tx: DbOrTx, agencyId: number): Promise<VipSubscriptionRow | null> {
  return getLatestActiveVipSubscription(tx, { agencyId });
}
