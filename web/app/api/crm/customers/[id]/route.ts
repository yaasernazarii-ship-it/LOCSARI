import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, scopeAllowsRow, CrmScope } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { logCrmActivity } from "@/lib/crmActivity";
import { validateCustomerInput, validateCustomerTypeIds } from "@/lib/crmValidation";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string } };

async function loadScopedCustomer(scope: CrmScope, id: number) {
  const customer = await db.selectFrom("customers").selectAll().where("id", "=", id).executeTakeFirst();
  if (!customer) return null;
  const allowed = scopeAllowsRow(scope, { agencyId: customer.agency_id, assignedToUserId: customer.assigned_to_user_id, createdByUserId: customer.created_by_user_id });
  return allowed ? customer : null;
}

async function loadCustomerTypes(customerId: number) {
  const rows = await db
    .selectFrom("customer_type_assignments as a")
    .innerJoin("customer_types as t", "t.id", "a.customer_type_id")
    .select(["t.id", "t.key", "t.label_fa"])
    .where("a.customer_id", "=", customerId)
    .execute();
  return rows;
}

// GET /api/crm/customers/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("customer.view");
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const scope = await resolveCrmScope(auth.user.id);
  const customer = await loadScopedCustomer(scope, id);
  if (!customer) return errData(404, "NOT_FOUND", "مشتری یافت نشد");

  const types = await loadCustomerTypes(id);
  return okData({ ...customer, types });
}

// PATCH /api/crm/customers/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("customer.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-customer-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const scope = await resolveCrmScope(auth.user.id);
  const customer = await loadScopedCustomer(scope, id);
  if (!customer) return errData(404, "NOT_FOUND", "مشتری یافت نشد");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");
  const rawBody = body as Record<string, unknown>;

  const validated = await validateCustomerInput(rawBody, { partial: true });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  if (data.mobile !== undefined && data.mobile !== customer.mobile) {
    const dup = await db.selectFrom("customers").select("id").where("mobile", "=", data.mobile).where("id", "!=", id).executeTakeFirst();
    if (dup) return errData(409, "DUPLICATE_MOBILE", "مشتری دیگری با این موبایل ثبت شده است");
  }

  let typeIds: number[] | null = null;
  if (rawBody.typeIds !== undefined) {
    const r = await validateCustomerTypeIds(db, rawBody.typeIds);
    if (!r.ok) return errData(400, "VALIDATION_ERROR", r.error);
    typeIds = r.ids;
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) update.name = data.name;
  if (data.mobile !== undefined) update.mobile = data.mobile;
  if (data.email !== undefined) update.email = data.email;
  if (data.nationalId !== undefined) update.national_id = data.nationalId;
  if (data.userId !== undefined) update.user_id = data.userId;
  if (data.agencyId !== undefined) update.agency_id = data.agencyId;
  if (data.assignedToUserId !== undefined) update.assigned_to_user_id = data.assignedToUserId;
  if (data.status !== undefined) update.status = data.status;
  if (data.notes !== undefined) update.notes = data.notes;

  const updated = await db.transaction().execute(async (trx) => {
    const row = await trx.updateTable("customers").set(update).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
    if (typeIds !== null) {
      await trx.deleteFrom("customer_type_assignments").where("customer_id", "=", id).execute();
      if (typeIds.length > 0) {
        await trx.insertInto("customer_type_assignments").values(typeIds.map((customer_type_id) => ({ customer_id: id, customer_type_id }))).execute();
      }
    }
    return row;
  });

  await logAdminAction(auth.user.id, "update", "customer", id, { fields: Object.keys(update) });
  if (data.assignedToUserId !== undefined) {
    await logCrmActivity(db, "customer", id, "assigned", "مشتری واگذار شد", auth.user.id, { assignedToUserId: data.assignedToUserId });
  }

  const types = await loadCustomerTypes(id);
  return okData({ ...updated, types });
}

// DELETE /api/crm/customers/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("customer.delete");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-customer-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const scope = await resolveCrmScope(auth.user.id);
  const customer = await loadScopedCustomer(scope, id);
  if (!customer) return errData(404, "NOT_FOUND", "مشتری یافت نشد");

  await db.deleteFrom("customers").where("id", "=", id).execute();
  await logAdminAction(auth.user.id, "delete", "customer", id);

  return okData({ id });
}
