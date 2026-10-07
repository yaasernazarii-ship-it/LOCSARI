import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { validateCustomerTypeInput } from "@/lib/crmValidation";
import { userHasPermission } from "@/lib/rbac";

// GET /api/crm/customer-types — لیست انواع مشتری (بخش ۶)؛ کاربران عادیِ CRM فقط موارد فعال را می‌بینند
export async function GET(req: NextRequest) {
  const auth = await requireCrmPermission("customer.view");
  if (auth.response) return auth.response;

  const canManage = await userHasPermission(auth.user.id, "customer_type.manage");
  const sp = req.nextUrl.searchParams;
  const includeInactive = canManage && sp.get("includeInactive") === "1";

  let query = db.selectFrom("customer_types").selectAll().orderBy("sort_order", "asc");
  if (!includeInactive) query = query.where("is_active", "=", true);

  const rows = await query.execute();
  return okData(rows);
}

// POST /api/crm/customer-types — تعریف نوع مشتری جدید (بخش ۶)
export async function POST(req: NextRequest) {
  const auth = await requireCrmPermission("customer_type.manage");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-customer-type-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const validated = await validateCustomerTypeInput(body as Record<string, unknown>, { partial: false });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  const row = await db
    .insertInto("customer_types")
    .values({
      key: data.key!,
      label_fa: data.labelFa!,
      sort_order: data.sortOrder ?? 0,
      is_active: data.isActive ?? true,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "create", "customer_type", row.id, { key: row.key });

  return okData(row, undefined, 201);
}
