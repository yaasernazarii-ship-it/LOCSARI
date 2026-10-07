// ماشین وضعیت مشترک Verification برای Agency و Consultant (فاز ۶، بخش ۱۱)
// هر دو موجودیت دقیقاً همان واژگان وضعیت را دارند؛ به‌جای تکرار منطق، یک ماشین وضعیت مشترک.

import { VerificationStatus } from "./validation";

export const VERIFICATION_TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  pending: ["approved", "rejected"],
  approved: ["suspended"],
  rejected: ["approved"],
  suspended: ["approved"],
};

export function canTransitionVerification(from: VerificationStatus, to: VerificationStatus): boolean {
  return VERIFICATION_TRANSITIONS[from]?.includes(to) ?? false;
}

export type VerificationAction = "approve" | "reject" | "suspend";

export const ACTION_TO_STATUS: Record<VerificationAction, VerificationStatus> = {
  approve: "approved",
  reject: "rejected",
  suspend: "suspended",
};
