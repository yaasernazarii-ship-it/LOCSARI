import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, isValidSlug, parseOptionalId } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const auth = await requirePermission("location.view");
  if (auth.response) return auth.response;

  const cityId = parseOptionalId(req.nextUrl.searchParams.get("cityId"));
  if (cityId === null) return NextResponse.json({ error: "cityId نامعتبر است" }, { status: 400 });

  let query = db.selectFrom("districts").selectAll().orderBy("sort_order", "asc");
  if (cityId !== undefined) query = query.where("city_id", "=", cityId);

  const districts = await query.execute();
  return NextResponse.json({ districts });
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
  const cityId = Number(body?.cityId);

  if (!isNonEmptyString(name, 100)) return NextResponse.json({ error: "نام نامعتبر است" }, { status: 400 });
  if (!isValidSlug(slug)) return NextResponse.json({ error: "Slug نامعتبر است" }, { status: 400 });
  if (!Number.isInteger(cityId) || cityId <= 0) return NextResponse.json({ error: "cityId نامعتبر است" }, { status: 400 });

  const city = await db.selectFrom("cities").select("id").where("id", "=", cityId).executeTakeFirst();
  if (!city) return NextResponse.json({ error: "شهر یافت نشد" }, { status: 400 });

  try {
    const district = await db
      .insertInto("districts")
      .values({
        city_id: cityId,
        name,
        slug,
        description: typeof body?.description === "string" ? body.description : null,
        sort_order: Number.isInteger(body?.sortOrder) ? body.sortOrder : 0,
        is_active: typeof body?.isActive === "boolean" ? body.isActive : true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await logAdminAction(auth.user.id, "create", "district", district.id, { name, slug, cityId });
    return NextResponse.json({ district }, { status: 201 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json({ error: "این Slug در این شهر قبلاً ثبت شده است" }, { status: 409 });
    }
    throw err;
  }
}
