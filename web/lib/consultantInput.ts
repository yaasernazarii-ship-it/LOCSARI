// اعتبارسنجی مشترک فیلدهای Consultant (فاز ۶، بخش ۵ و ۹)

import { isNonEmptyString } from "./validation";

export interface ConsultantBaseFields {
  displayName: string;
  bio: string | null;
  phone: string | null;
  licenseNumber: string | null;
}

export type ConsultantValidationResult =
  | { ok: true; data: Partial<ConsultantBaseFields> }
  | { ok: false; error: string };

export function validateConsultantInput(
  body: Record<string, unknown>,
  opts: { partial: boolean }
): ConsultantValidationResult {
  const data: Record<string, unknown> = {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  const need = (key: string) => !opts.partial || has(key);

  if (need("displayName")) {
    if (!isNonEmptyString(body.displayName, 150)) return { ok: false, error: "نام نمایشی نامعتبر است" };
    data.displayName = (body.displayName as string).trim();
  }

  if (has("bio")) {
    data.bio = typeof body.bio === "string" ? body.bio.slice(0, 3000) : null;
  }

  if (has("phone")) {
    if (body.phone === null || body.phone === "") {
      data.phone = null;
    } else if (typeof body.phone === "string" && body.phone.length <= 20) {
      data.phone = body.phone.trim();
    } else {
      return { ok: false, error: "phone نامعتبر است" };
    }
  }

  if (has("licenseNumber")) {
    if (body.licenseNumber === null || body.licenseNumber === "") {
      data.licenseNumber = null;
    } else if (typeof body.licenseNumber === "string" && body.licenseNumber.length <= 50) {
      data.licenseNumber = body.licenseNumber.trim();
    } else {
      return { ok: false, error: "licenseNumber نامعتبر است" };
    }
  }

  return { ok: true, data: data as Partial<ConsultantBaseFields> };
}
