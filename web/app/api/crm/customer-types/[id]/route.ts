import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { validateCustomerTypeInput } from "@/lib/crmValidation";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string } };

// PATCH /api/crm/customer-types/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("customer_type.manage");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-customer-type-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const existing = await db.selectFrom("customer_types").select("id").where("id", "=", id).executeTakeFirst();
  if (!existing) return errData(404, "NOT_FOUND", "نوع مشتری یافت نشد");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const validated = await validateCustomerTypeInput(body as Record<string, unknown>, { partial: true });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  const update: Record<string, unknown> = {};
  if (data.key !== undefined) update.key = data.key;
  if (data.labelFa !== undefined) update.label_fa = data.labelFa;
  if (data.sortOrder !== undefined) update.sort_order = data.sortOrder;
  if (data.isActive !== undefined) update.is_active = data.isActive;

  const updated = await db.updateTable("customer_types").set(update).where("id", "=", id).returningAll().executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "customer_type", id, { fields: Object.keys(update) });

  return okData(updated);
}

// DELETE /api/crm/customer-types/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("customer_type.manage");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-customer-type-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const existing = await db.selectFrom("customer_types").select("id").where("id", "=", id).executeTakeFirst();
  if (!existing) return errData(404, "NOT_FOUND", "نوع مشتری یافت نشد");

  await db.deleteFrom("customer_types").where("id", "=", id).execute();
  await logAdminAction(auth.user.id, "delete", "customer_type", id);

  return okData({ id });
}
