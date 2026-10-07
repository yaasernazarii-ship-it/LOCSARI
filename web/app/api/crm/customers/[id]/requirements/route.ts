import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, parsePagination, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, scopeAllowsRow } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { logCrmActivity } from "@/lib/crmActivity";
import { validateRequirementInput, validateRequirementLocationInput } from "@/lib/crmValidation";
import { validateAndSaveRequirementAttributes, getRequirementAttributes, AttributeInput } from "@/lib/crmRequirementAttributes";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string } };

class RequirementSaveError extends Error {}

// GET /api/crm/customers/[id]/requirements — نیازمندی‌های یک مشتری (بخش ۷)
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("requirement.view");
  if (auth.response) return auth.response;

  const customerId = parseId(params.id);
  if (!customerId) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const scope = await resolveCrmScope(auth.user.id);
  const customer = await db.selectFrom("customers").selectAll().where("id", "=", customerId).executeTakeFirst();
  if (!customer) return errData(404, "NOT_FOUND", "مشتری یافت نشد");
  const allowed = scopeAllowsRow(scope, { agencyId: customer.agency_id, assignedToUserId: customer.assigned_to_user_id, createdByUserId: customer.created_by_user_id });
  if (!allowed) return errData(404, "NOT_FOUND", "مشتری یافت نشد");

  const { page, limit, offset } = parsePagination(req);
  const [rows, totalRow] = await Promise.all([
    db.selectFrom("customer_requirements").selectAll().where("customer_id", "=", customerId).orderBy("created_at", "desc").limit(limit).offset(offset).execute(),
    db.selectFrom("customer_requirements").where("customer_id", "=", customerId).select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
  ]);

  return okData(rows, { page, limit, total: Number(totalRow?.count ?? 0) });
}

// POST /api/crm/customers/[id]/requirements — ثبت نیازمندی جدید برای مشتری + Location + فیلدهای پویا (اختیاری)
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("requirement.create");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-requirement-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const customerId = parseId(params.id);
  if (!customerId) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const scope = await resolveCrmScope(auth.user.id);
  const customer = await db.selectFrom("customers").selectAll().where("id", "=", customerId).executeTakeFirst();
  if (!customer) return errData(404, "NOT_FOUND", "مشتری یافت نشد");
  const allowed = scopeAllowsRow(scope, { agencyId: customer.agency_id, assignedToUserId: customer.assigned_to_user_id, createdByUserId: customer.created_by_user_id });
  if (!allowed) return errData(404, "NOT_FOUND", "مشتری یافت نشد");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");
  const rawBody = body as Record<string, unknown>;

  const validated = await validateRequirementInput(rawBody, { partial: false });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  const rawLocations = Array.isArray(rawBody.locations) ? (rawBody.locations as unknown[]) : [];
  const rawAttributes = Array.isArray(rawBody.attributes) ? (rawBody.attributes as unknown[]) : [];
  const attributes: AttributeInput[] = [];
  for (const a of rawAttributes) {
    if (!a || typeof a !== "object" || !("fieldId" in a) || !("value" in a)) return errData(400, "VALIDATION_ERROR", "ساختار attributes نامعتبر است");
    attributes.push({ fieldId: Number((a as { fieldId: unknown }).fieldId), value: (a as { value: unknown }).value });
  }

  try {
    const result = await db.transaction().execute(async (trx) => {
      const requirement = await trx
        .insertInto("customer_requirements")
        .values({
          customer_id: customerId,
          category_id: data.categoryId!,
          transaction_type: data.transactionType!,
          min_price: data.minPrice ?? null,
          max_price: data.maxPrice ?? null,
          min_deposit: data.minDeposit ?? null,
          max_deposit: data.maxDeposit ?? null,
          min_monthly_rent: data.minMonthlyRent ?? null,
          max_monthly_rent: data.maxMonthlyRent ?? null,
          min_area: data.minArea ?? null,
          max_area: data.maxArea ?? null,
          bedrooms: data.bedrooms ?? null,
          status: data.status ?? "open",
          priority: data.priority ?? "normal",
          notes: data.notes ?? null,
          assigned_to_user_id: data.assignedToUserId ?? null,
          created_by_user_id: auth.user.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      for (const rawLoc of rawLocations) {
        if (!rawLoc || typeof rawLoc !== "object") throw new RequirementSaveError("ساختار locations نامعتبر است");
        const locValidated = await validateRequirementLocationInput(rawLoc as Record<string, unknown>, trx);
        if (!locValidated.ok) throw new RequirementSaveError(locValidated.error);
        await trx
          .insertInto("requirement_locations")
          .values({
            requirement_id: requirement.id,
            city_id: locValidated.data.cityId!,
            district_id: locValidated.data.districtId ?? null,
            market_zone_id: locValidated.data.marketZoneId ?? null,
            neighborhood_id: locValidated.data.neighborhoodId ?? null,
          })
          .execute();
      }

      if (attributes.length > 0) {
        const attrResult = await validateAndSaveRequirementAttributes(trx, requirement.id, data.categoryId!, attributes);
        if (!attrResult.ok) throw new RequirementSaveError(attrResult.error);
      }

      return requirement;
    });

    await logAdminAction(auth.user.id, "create", "customer_requirement", result.id, { customerId, categoryId: data.categoryId });
    await logCrmActivity(db, "customer_requirement", result.id, "created", "نیازمندی جدید برای مشتری ثبت شد", auth.user.id);

    const savedAttributes = await getRequirementAttributes(result.id);
    const locations = await db.selectFrom("requirement_locations").selectAll().where("requirement_id", "=", result.id).execute();
    return okData({ ...result, locations, attributes: savedAttributes }, undefined, 201);
  } catch (err: unknown) {
    if (err instanceof RequirementSaveError) return errData(400, "VALIDATION_ERROR", err.message);
    throw err;
  }
}
