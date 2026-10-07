import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, parsePagination, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, agencyIdsOrNone, idsOrNone } from "@/lib/crmScope";
import { isValidRequirementStatus, isValidTransactionType } from "@/lib/validation";

// GET /api/crm/requirements — لیست نیازمندی‌ها فارغ از مشتری خاص (بخش ۷)، محدود به Scope کاربر
export async function GET(req: NextRequest) {
  const auth = await requireCrmPermission("requirement.view");
  if (auth.response) return auth.response;

  const scope = await resolveCrmScope(auth.user.id);
  const { page, limit, offset } = parsePagination(req);
  const sp = req.nextUrl.searchParams;

  let query = db.selectFrom("customer_requirements").selectAll();
  let countQuery = db.selectFrom("customer_requirements");

  const customerId = sp.get("customerId");
  if (customerId) {
    const id = Number(customerId);
    if (!Number.isInteger(id) || id <= 0) return errData(400, "INVALID_CUSTOMER_ID", "customerId نامعتبر است");
    query = query.where("customer_id", "=", id);
    countQuery = countQuery.where("customer_id", "=", id);
  }
  const status = sp.get("status");
  if (status) {
    if (!isValidRequirementStatus(status)) return errData(400, "INVALID_STATUS", "status نامعتبر است");
    query = query.where("status", "=", status);
    countQuery = countQuery.where("status", "=", status);
  }
  const transactionType = sp.get("transactionType");
  if (transactionType) {
    if (!isValidTransactionType(transactionType)) return errData(400, "INVALID_TRANSACTION_TYPE", "transactionType نامعتبر است");
    query = query.where("transaction_type", "=", transactionType);
    countQuery = countQuery.where("transaction_type", "=", transactionType);
  }
  const assignedTo = sp.get("assignedTo");
  if (assignedTo) {
    const id = Number(assignedTo);
    if (!Number.isInteger(id) || id <= 0) return errData(400, "INVALID_ASSIGNED_TO", "assignedTo نامعتبر است");
    query = query.where("assigned_to_user_id", "=", id);
    countQuery = countQuery.where("assigned_to_user_id", "=", id);
  }

  if (scope.kind === "agency") {
    const ids = idsOrNone((await db.selectFrom("customers").select("id").where("agency_id", "in", agencyIdsOrNone(scope)).execute()).map((r) => r.id));
    query = query.where("customer_id", "in", ids);
    countQuery = countQuery.where("customer_id", "in", ids);
  } else if (scope.kind === "assigned") {
    query = query.where((eb) => eb.or([eb("assigned_to_user_id", "=", scope.userId), eb("created_by_user_id", "=", scope.userId)]));
    countQuery = countQuery.where((eb) => eb.or([eb("assigned_to_user_id", "=", scope.userId), eb("created_by_user_id", "=", scope.userId)]));
  }

  query = query.orderBy("created_at", "desc").limit(limit).offset(offset);

  const [rows, totalRow] = await Promise.all([query.execute(), countQuery.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()]);

  return okData(rows, { page, limit, total: Number(totalRow?.count ?? 0) });
}
