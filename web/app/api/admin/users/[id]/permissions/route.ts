import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { logAdminAction } from "@/lib/audit";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string } };

// POST /api/admin/users/[id]/permissions — افزودن/به‌روزرسانی override اختصاصی (allow/deny) روی یک کاربر
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requirePermission("user.manage");
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسهٔ نامعتبر است" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const permissionKey = (body as { permissionKey?: unknown } | null)?.permissionKey;
  const effect = (body as { effect?: unknown } | null)?.effect;
  if (typeof permissionKey !== "string" || !permissionKey) {
    return NextResponse.json({ error: "permissionKey الزامی است" }, { status: 400 });
  }
  if (effect !== "allow" && effect !== "deny") {
    return NextResponse.json({ error: "effect باید allow یا deny باشد" }, { status: 400 });
  }

  const targetUser = await db.selectFrom("users").select(["id"]).where("id", "=", id).executeTakeFirst();
  if (!targetUser) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });

  const permission = await db.selectFrom("permissions").select(["id", "key"]).where("key", "=", permissionKey).executeTakeFirst();
  if (!permission) return NextResponse.json({ error: "مجوز نامعتبر است" }, { status: 400 });

  await db
    .insertInto("user_permissions")
    .values({ user_id: id, permission_id: permission.id, effect })
    .onConflict((oc) => oc.columns(["user_id", "permission_id"]).doUpdateSet({ effect }))
    .execute();

  await logAdminAction(auth.user.id, "update", "user_permission_override", id, { event: "set_override", permission: permission.key, effect });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/users/[id]/permissions?permission=KEY — حذف override اختصاصی
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requirePermission("user.manage");
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسهٔ نامعتبر است" }, { status: 400 });

  const permissionKey = req.nextUrl.searchParams.get("permission");
  if (!permissionKey) return NextResponse.json({ error: "permission الزامی است" }, { status: 400 });

  const permission = await db.selectFrom("permissions").select(["id", "key"]).where("key", "=", permissionKey).executeTakeFirst();
  if (!permission) return NextResponse.json({ error: "مجوز نامعتبر است" }, { status: 400 });

  await db.deleteFrom("user_permissions").where("user_id", "=", id).where("permission_id", "=", permission.id).execute();
  await logAdminAction(auth.user.id, "update", "user_permission_override", id, { event: "remove_override", permission: permission.key });
  return NextResponse.json({ ok: true });
}
