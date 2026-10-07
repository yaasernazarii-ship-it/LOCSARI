import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, parsePagination, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, agencyIdsOrNone } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { logCrmActivity } from "@/lib/crmActivity";
import { validateCustomerInput, validateCustomerTypeIds } from "@/lib/crmValidation";
import { isValidCustomerStatus } from "@/lib/validation";

// GET /api/crm/customers — لیست مشتریان با pagination/search/filter/sort (بخش ۵)
export async function GET(req: NextRequest) {
  const auth = await requireCrmPermission("customer.view");
  if (auth.response) return auth.response;

  const scope = await resolveCrmScope(auth.user.id);
  const { page, limit, offset } = parsePagination(req);
  const sp = req.nextUrl.searchParams;

  let query = db.selectFrom("customers").selectAll();
  let countQuery = db.selectFrom("customers");

  const q = sp.get("q");
  if (q) {
    query = query.where((eb) => eb.or([eb("name", "ilike", `%${q}%`), eb("mobile", "like", `%${q}%`)]));
    countQuery = countQuery.where((eb) => eb.or([eb("name", "ilike", `%${q}%`), eb("mobile", "like", `%${q}%`)]));
  }
  const mobile = sp.get("mobile");
  if (mobile) {
    query = query.where("mobile", "=", mobile);
    countQuery = countQuery.where("mobile", "=", mobile);
  }
  const status = sp.get("status");
  if (status) {
    if (!isValidCustomerStatus(status)) return errData(400, "INVALID_STATUS", "status نامعتبر است");
    query = query.where("status", "=", status);
    countQuery = countQuery.where("status", "=", status);
  }
  const agency = sp.get("agency");
  if (agency) {
    const id = Number(agency);
    if (!Number.isInteger(id) || id <= 0) return errData(400, "INVALID_AGENCY", "agency نامعتبر است");
    query = query.where("agency_id", "=", id);
    countQuery = countQuery.where("agency_id", "=", id);
  }
  const assignedTo = sp.get("assignedTo");
  if (assignedTo) {
    const id = Number(assignedTo);
    if (!Number.isInteger(id) || id <= 0) return errData(400, "INVALID_ASSIGNED_TO", "assignedTo نامعتبر است");
    query = query.where("assigned_to_user_id", "=", id);
    countQuery = countQuery.where("assigned_to_user_id", "=", id);
  }
  const customerType = sp.get("customerType");
  if (customerType) {
    const typeId = Number(customerType);
    if (!Number.isInteger(typeId) || typeId <= 0) return errData(400, "INVALID_CUSTOMER_TYPE", "customerType نامعتبر است");
    const idsRows = await db.selectFrom("customer_type_assignments").select("customer_id").where("customer_type_id", "=", typeId).execute();
    const ids = idsRows.map((r) => r.customer_id);
    query = query.where("id", "in", ids.length ? ids : [-1]);
    countQuery = countQuery.where("id", "in", ids.length ? ids : [-1]);
  }
  const dateFrom = sp.get("dateFrom");
  if (dateFrom) {
    query = query.where("created_at", ">=", new Date(dateFrom));
    countQuery = countQuery.where("created_at", ">=", new Date(dateFrom));
  }
  const dateTo = sp.get("dateTo");
  if (dateTo) {
    query = query.where("created_at", "<=", new Date(dateTo));
    countQuery = countQuery.where("created_at", "<=", new Date(dateTo));
  }

  if (scope.kind === "agency") {
    const ids = agencyIdsOrNone(scope);
    query = query.where("agency_id", "in", ids);
    countQuery = countQuery.where("agency_id", "in", ids);
  } else if (scope.kind === "assigned") {
    query = query.where((eb) => eb.or([eb("assigned_to_user_id", "=", scope.userId), eb("created_by_user_id", "=", scope.userId)]));
    countQuery = countQuery.where((eb) => eb.or([eb("assigned_to_user_id", "=", scope.userId), eb("created_by_user_id", "=", scope.userId)]));
  }

  const sort = sp.get("sort") === "created_at_asc" ? "asc" : "desc";
  query = query.orderBy("created_at", sort).limit(limit).offset(offset);

  const [rows, totalRow] = await Promise.all([
    query.execute(),
    countQuery.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
  ]);

  return okData(rows, { page, limit, total: Number(totalRow?.count ?? 0) });
}

// POST /api/crm/customers — ثبت مشتری جدید (بدون تکرار موبایل، طبق UNIQUE سطح دیتابیس)
export async function POST(req: NextRequest) {
  const auth = await requireCrmPermission("customer.create");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-customer-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");
  const rawBody = body as Record<string, unknown>;

  const validated = await validateCustomerInput(rawBody, { partial: false });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  const dup = await db.selectFrom("customers").select("id").where("mobile", "=", data.mobile!).executeTakeFirst();
  if (dup) return errData(409, "DUPLICATE_MOBILE", "مشتری با این موبایل قبلاً ثبت شده است");

  let typeIds: number[] = [];
  if (rawBody.typeIds !== undefined) {
    const r = await validateCustomerTypeIds(db, rawBody.typeIds);
    if (!r.ok) return errData(400, "VALIDATION_ERROR", r.error);
    typeIds = r.ids;
  }

  const customer = await db.transaction().execute(async (trx) => {
    const created = await trx
      .insertInto("customers")
      .values({
        user_id: data.userId ?? null,
        source_lead_id: null,
        agency_id: data.agencyId ?? null,
        assigned_to_user_id: data.assignedToUserId ?? null,
        name: data.name!,
        mobile: data.mobile!,
        email: data.email ?? null,
        national_id: data.nationalId ?? null,
        status: data.status ?? "active",
        notes: data.notes ?? null,
        created_by_user_id: auth.user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    if (typeIds.length > 0) {
      await trx.insertInto("customer_type_assignments").values(typeIds.map((customer_type_id) => ({ customer_id: created.id, customer_type_id }))).execute();
    }

    return created;
  });

  await logAdminAction(auth.user.id, "create", "customer", customer.id);
  await logCrmActivity(db, "customer", customer.id, "created", "مشتری جدید ثبت شد", auth.user.id);

  return okData(customer, undefined, 201);
}
