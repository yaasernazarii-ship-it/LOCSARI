// ماشین وضعیت Advertisement (بخش ۷ و ۸ پرامپت فاز ۳) + تاریخچهٔ تغییر وضعیت اجباری

import { DbOrTx } from "./propertyAttributes";
import { AdvertisementStatus } from "./validation";

export const ADVERTISEMENT_TRANSITIONS: Record<AdvertisementStatus, AdvertisementStatus[]> = {
  draft: ["pending_review", "archived"],
  pending_review: ["published", "rejected", "archived"],
  published: ["sold", "rented", "archived"],
  rejected: ["pending_review", "archived"],
  expired: ["pending_review", "archived"],
  sold: ["archived"],
  rented: ["archived"],
  archived: [],
};

export function canTransition(from: AdvertisementStatus, to: AdvertisementStatus): boolean {
  return ADVERTISEMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

/** تغییر وضعیت + ثبت ردیف تاریخچه، همیشه با هم (اتمیک در صورت فراخوانی داخل Transaction) */
export async function transitionAdvertisementStatus(
  tx: DbOrTx,
  params: {
    advertisementId: number;
    from: AdvertisementStatus;
    to: AdvertisementStatus;
    changedBy: number | null;
    reason?: string | null;
    extra?: Record<string, unknown>;
  }
): Promise<void> {
  const update: Record<string, unknown> = {
    status: params.to,
    updated_at: new Date().toISOString(),
    ...(params.extra ?? {}),
  };
  await tx.updateTable("advertisements").set(update).where("id", "=", params.advertisementId).execute();
  await tx
    .insertInto("advertisement_status_history")
    .values({
      advertisement_id: params.advertisementId,
      from_status: params.from,
      to_status: params.to,
      changed_by: params.changedBy,
      reason: params.reason ?? null,
    })
    .execute();
}

/** اگر آگهی منتشرشده از expiresAt عبور کرده باشد، به‌صورت Lazy به expired تبدیل می‌شود (بخش ۲۵) */
export async function syncExpiredStatus(
  tx: DbOrTx,
  ad: { id: number; status: string; expires_at: Date | string | null }
): Promise<boolean> {
  if (ad.status !== "published" || !ad.expires_at) return false;
  const expiresAt = ad.expires_at instanceof Date ? ad.expires_at : new Date(ad.expires_at);
  if (expiresAt.getTime() >= Date.now()) return false;
  await transitionAdvertisementStatus(tx, {
    advertisementId: ad.id,
    from: "published",
    to: "expired",
    changedBy: null,
    reason: "auto-expired",
  });
  return true;
}

export const DEFAULT_LISTING_DURATION_DAYS = 30;
