import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, isValidSlug } from "@/lib/validation";

export async function GET() {
  const auth = await requirePermission("location.view");
  if (auth.response) return auth.response;

  const provinces = await db.selectFrom("provinces").selectAll().orderBy("sort_order", "asc").execute();
  return NextResponse.json({ provinces });
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

  if (!isNonEmptyString(name, 100)) return NextResponse.json({ error: "نام نامعتبر است" }, { status: 400 });
  if (!isValidSlug(slug)) return NextResponse.json({ error: "Slug نامعتبر است" }, { status: 400 });

  try {
    const province = await db
      .insertInto("provinces")
      .values({
        name,
        slug,
        sort_order: Number.isInteger(body?.sortOrder) ? body.sortOrder : 0,
        is_active: typeof body?.isActive === "boolean" ? body.isActive : true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await logAdminAction(auth.user.id, "create", "province", province.id, { name, slug });
    return NextResponse.json({ province }, { status: 201 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json({ error: "Slug تکراری است" }, { status: 409 });
    }
    throw err;
  }
}
