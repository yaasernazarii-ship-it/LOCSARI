import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, parsePagination, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, agencyIdsOrNone } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { logCrmActivity } from "@/lib/crmActivity";
import { validateLeadInput } from "@/lib/crmValidation";
import { isValidLeadSource, isValidLeadStatus } from "@/lib/validation";

// GET /api/crm/leads — لیست سرنخ‌ها با pagination/search/filter/sort (بخش ۴)، محدود به Scope کاربر (بخش ۱۷-۲۲)
export async function GET(req: NextRequest) {
  const auth = await requireCrmPermission("lead.view");
  if (auth.response) return auth.response;

  const scope = await resolveCrmScope(auth.user.id);
  const { page, limit, offset } = parsePagination(req);
  const sp = req.nextUrl.searchParams;

  let query = db.selectFrom("leads").selectAll();
  let countQuery = db.selectFrom("leads");

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
    if (!isValidLeadStatus(status)) return errData(400, "INVALID_STATUS", "status نامعتبر است");
    query = query.where("status", "=", status);
    countQuery = countQuery.where("status", "=", status);
  }
  const source = sp.get("source");
  if (source) {
    if (!isValidLeadSource(source)) return errData(400, "INVALID_SOURCE", "source نامعتبر است");
    query = query.where("source", "=", source);
    countQuery = countQuery.where("source", "=", source);
  }
  const assignedTo = sp.get("assignedTo");
  if (assignedTo) {
    const id = Number(assignedTo);
    if (!Number.isInteger(id) || id <= 0) return errData(400, "INVALID_ASSIGNED_TO", "assignedTo نامعتبر است");
    query = query.where("assigned_to_user_id", "=", id);
    countQuery = countQuery.where("assigned_to_user_id", "=", id);
  }
  const agency = sp.get("agency");
  if (agency) {
    const id = Number(agency);
    if (!Number.isInteger(id) || id <= 0) return errData(400, "INVALID_AGENCY", "agency نامعتبر است");
    query = query.where("agency_id", "=", id);
    countQuery = countQuery.where("agency_id", "=", id);
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

  // اعمال Scope در لایهٔ Server (نه فقط UI) — بخش ۱۸
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

// POST /api/crm/leads — ثبت سرنخ جدید
export async function POST(req: NextRequest) {
  const auth = await requireCrmPermission("lead.create");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-lead-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const validated = await validateLeadInput(body as Record<string, unknown>, { partial: false });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  const lead = await db
    .insertInto("leads")
    .values({
      name: data.name!,
      mobile: data.mobile!,
      source: data.source ?? "other",
      status: data.status ?? "new",
      agency_id: data.agencyId ?? null,
      assigned_to_user_id: data.assignedToUserId ?? null,
      notes: data.notes ?? null,
      created_by_user_id: auth.user.id,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "create", "lead", lead.id, { source: lead.source });
  await logCrmActivity(db, "lead", lead.id, "created", "سرنخ جدید ثبت شد", auth.user.id);

  return okData(lead, undefined, 201);
}
