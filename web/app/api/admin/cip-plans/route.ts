import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, isValidTomanAmount } from "@/lib/validation";

export async function GET() {
  const auth = await requirePermission("cip.manage");
  if (auth.response) return auth.response;
  const plans = await db.selectFrom("cip_plans").selectAll().orderBy("sort_order", "asc").execute();
  return NextResponse.json({ plans: plans.map((plan) => ({ ...plan, price: Number(plan.price) })) });
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("cip.manage");
  if (auth.response) return auth.response;
  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!isNonEmptyString(title, 160)) return NextResponse.json({ error: "عنوان پلن نامعتبر است" }, { status: 400 });

  const price = Number(body.price);
  if (!isValidTomanAmount(price) || price <= 0) return NextResponse.json({ error: "قیمت باید عددی بزرگ‌تر از صفر باشد" }, { status: 400 });

  const plan = await db
    .insertInto("cip_plans")
    .values({
      title,
      description: typeof body.description === "string" ? body.description.trim() : "",
      features: typeof body.features === "string" ? body.features.trim() : "",
      price,
      is_active: typeof body.isActive === "boolean" ? body.isActive : true,
      sort_order: Number.isInteger(body.sortOrder) ? body.sortOrder : 0,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "create", "cip_plan", plan.id, { title, price });
  return NextResponse.json({ plan: { ...plan, price: Number(plan.price) } }, { status: 201 });
}
