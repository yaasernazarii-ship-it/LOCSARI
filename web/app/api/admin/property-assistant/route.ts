import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission("content.edit");
  if (auth.response) return auth.response;
  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const body = await req.json().catch(() => null) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return NextResponse.json({ error: "نام دستیار را وارد کنید" }, { status: 400 });

  const settings = await db
    .insertInto("property_assistant_settings")
    .values({ id: 1, name, updated_at: new Date().toISOString() })
    .onConflict((oc) => oc.column("id").doUpdateSet({ name, updated_at: new Date().toISOString() }))
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "property_assistant_settings", 1, { name });
  return NextResponse.json({ settings });
}
