import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, isValidSlug, parseOptionalId } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const auth = await requirePermission("location.view");
  if (auth.response) return auth.response;

  const provinceId = parseOptionalId(req.nextUrl.searchParams.get("provinceId"));
  if (provinceId === null) return NextResponse.json({ error: "provinceId نامعتبر است" }, { status: 400 });

  let query = db.selectFrom("cities").selectAll().orderBy("sort_order", "asc");
  if (provinceId !== undefined) query = query.where("province_id", "=", provinceId);

  const cities = await query.execute();
  return NextResponse.json({ cities });
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("location.create");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  const provinceId = Number(body?.provinceId);

  if (!isNonEmptyString(name, 100)) return NextResponse.json({ error: "نام نامعتبر است" }, { status: 400 });
  if (!isValidSlug(slug)) return NextResponse.json({ error: "Slug نامعتبر است" }, { status: 400 });
  if (!Number.isInteger(provinceId) || provinceId <= 0)
    return NextResponse.json({ error: "provinceId نامعتبر است" }, { status: 400 });

  const province = await db.selectFrom("provinces").select("id").where("id", "=", provinceId).executeTakeFirst();
  if (!province) return NextResponse.json({ error: "استان یافت نشد" }, { status: 400 });

  try {
    const city = await db
      .insertInto("cities")
      .values({
        province_id: provinceId,
        name,
        slug,
        sort_order: Number.isInteger(body?.sortOrder) ? body.sortOrder : 0,
        is_active: typeof body?.isActive === "boolean" ? body.isActive : true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await logAdminAction(auth.user.id, "create", "city", city.id, { name, slug, provinceId });
    return NextResponse.json({ city }, { status: 201 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json({ error: "این Slug در این استان قبلاً ثبت شده است" }, { status: 409 });
    }
    throw err;
  }
}
