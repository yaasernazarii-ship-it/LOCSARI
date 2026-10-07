import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, getEntityOwnerFields, scopeAllowsRow, CrmOwnedEntityType } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { validateActivityInput } from "@/lib/crmValidation";
import { logCrmActivity } from "@/lib/crmActivity";

// POST /api/crm/activities — ثبت دستیِ یک رویداد در Timeline کسب‌وکاری (بخش ۱۱)؛ فقط روی موجودیتِ داخل Scope کاربر
export async function POST(req: NextRequest) {
  const auth = await requireCrmPermission("crm.activity.create");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-activity-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const validated = validateActivityInput(body as Record<string, unknown>);
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  const scope = await resolveCrmScope(auth.user.id);
  const owner = await getEntityOwnerFields(db, data.entityType as CrmOwnedEntityType, data.entityId!);
  if (!owner || !scopeAllowsRow(scope, owner)) return errData(404, "NOT_FOUND", "موجودیت یافت نشد");

  await logCrmActivity(db, data.entityType as CrmOwnedEntityType, data.entityId!, data.activityType!, data.description ?? "", auth.user.id, data.meta ?? undefined);

  return okData({ ok: true }, undefined, 201);
}
