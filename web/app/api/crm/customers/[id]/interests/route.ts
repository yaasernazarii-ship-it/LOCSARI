import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, parsePagination, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, scopeAllowsRow } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { logCrmActivity } from "@/lib/crmActivity";
import { validateInterestInput } from "@/lib/crmValidation";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string } };

async function loadScopedCustomer(userId: number, id: number) {
  const scope = await resolveCrmScope(userId);
  const customer = await db.selectFrom("customers").selectAll().where("id", "=", id).executeTakeFirst();
  if (!customer) return null;
  const allowed = scopeAllowsRow(scope, { agencyId: customer.agency_id, assignedToUserId: customer.assigned_to_user_id, createdByUserId: customer.created_by_user_id });
  return allowed ? customer : null;
}

// GET /api/crm/customers/[id]/interests — علاقه‌مندی‌های مشتری به آگهی‌ها (بخش ۹)
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("customer.view");
  if (auth.response) return auth.response;

  const customerId = parseId(params.id);
  if (!customerId) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const customer = await loadScopedCustomer(auth.user.id, customerId);
  if (!customer) return errData(404, "NOT_FOUND", "مشتری یافت نشد");

  const { page, limit, offset } = parsePagination(req);
  const [rows, totalRow] = await Promise.all([
    db.selectFrom("customer_property_interests").selectAll().where("customer_id", "=", customerId).orderBy("created_at", "desc").limit(limit).offset(offset).execute(),
    db.selectFrom("customer_property_interests").where("customer_id", "=", customerId).select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
  ]);

  return okData(rows, { page, limit, total: Number(totalRow?.count ?? 0) });
}

// POST /api/crm/customers/[id]/interests — ثبت علاقه‌مندی مشتری به یک آگهی
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("customer.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-interest-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const customerId = parseId(params.id);
  if (!customerId) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const customer = await loadScopedCustomer(auth.user.id, customerId);
  if (!customer) return errData(404, "NOT_FOUND", "مشتری یافت نشد");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const validated = await validateInterestInput(body as Record<string, unknown>);
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  const row = await db
    .insertInto("customer_property_interests")
    .values({
      customer_id: customerId,
      advertisement_id: data.advertisementId!,
      interest_level: data.interestLevel,
      notes: data.notes,
      created_by_user_id: auth.user.id,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "create", "customer_property_interest", row.id, { customerId, advertisementId: data.advertisementId });
  await logCrmActivity(db, "customer", customerId, "interest_added", "علاقه‌مندی به آگهی ثبت شد", auth.user.id, { advertisementId: data.advertisementId, interestLevel: data.interestLevel });

  return okData(row, undefined, 201);
}
