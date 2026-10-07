import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { logAdminAction } from "@/lib/audit";
import { getUserRoleKeys } from "@/lib/rbac";

// مدیریت ماتریس نقش × مجوز — فقط مدیر کل (super_admin) مجاز است، و نقش super_admin
// همیشه همهٔ مجوزها را دارد (قابل ویرایش از این مسیر نیست) تا امکان قفل‌شدن کامل پنل پیش نیاید.

async function requireSuperAdmin() {
  const auth = await requirePermission("user.manage");
  if (auth.response) return { ...auth, forbidden: null as NextResponse | null };
  const roles = await getUserRoleKeys(auth.user.id);
  if (!roles.includes("super_admin")) {
    return { user: null, response: null, forbidden: NextResponse.json({ error: "فقط مدیر کل می‌تواند ماتریس دسترسی‌ها را ویرایش کند" }, { status: 403 }) };
  }
  return { ...auth, forbidden: null as NextResponse | null };
}

// POST /api/admin/permissions — اعطای یک مجوز به یک نقش. body: { roleKey, permissionKey }
export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;
  if (auth.forbidden) return auth.forbidden;

  const body = await req.json().catch(() => null);
  const roleKey = (body as { roleKey?: unknown } | null)?.roleKey;
  const permissionKey = (body as { permissionKey?: unknown } | null)?.permissionKey;
  if (typeof roleKey !== "string" || typeof permissionKey !== "string" || !roleKey || !permissionKey) {
    return NextResponse.json({ error: "roleKey و permissionKey الزامی است" }, { status: 400 });
  }
  if (roleKey === "super_admin") {
    return NextResponse.json({ error: "نقش مدیر کل همیشه همهٔ مجوزها را دارد و قابل ویرایش نیست" }, { status: 400 });
  }

  const role = await db.selectFrom("roles").select(["id", "key"]).where("key", "=", roleKey).executeTakeFirst();
  const permission = await db.selectFrom("permissions").select(["id", "key"]).where("key", "=", permissionKey).executeTakeFirst();
  if (!role || !permission) return NextResponse.json({ error: "نقش یا مجوز نامعتبر است" }, { status: 400 });

  await db.insertInto("role_permissions").values({ role_id: role.id, permission_id: permission.id }).onConflict((oc) => oc.doNothing()).execute();
  await logAdminAction(auth.user!.id, "update", "role_permission", role.id, { event: "grant", role: role.key, permission: permission.key });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/permissions?role=KEY&permission=KEY — سلب یک مجوز از یک نقش
export async function DELETE(req: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;
  if (auth.forbidden) return auth.forbidden;

  const roleKey = req.nextUrl.searchParams.get("role");
  const permissionKey = req.nextUrl.searchParams.get("permission");
  if (!roleKey || !permissionKey) return NextResponse.json({ error: "role و permission الزامی است" }, { status: 400 });
  if (roleKey === "super_admin") {
    return NextResponse.json({ error: "نقش مدیر کل همیشه همهٔ مجوزها را دارد و قابل ویرایش نیست" }, { status: 400 });
  }

  const role = await db.selectFrom("roles").select(["id", "key"]).where("key", "=", roleKey).executeTakeFirst();
  const permission = await db.selectFrom("permissions").select(["id", "key"]).where("key", "=", permissionKey).executeTakeFirst();
  if (!role || !permission) return NextResponse.json({ error: "نقش یا مجوز نامعتبر است" }, { status: 400 });

  await db.deleteFrom("role_permissions").where("role_id", "=", role.id).where("permission_id", "=", permission.id).execute();
  await logAdminAction(auth.user!.id, "update", "role_permission", role.id, { event: "revoke", role: role.key, permission: permission.key });
  return NextResponse.json({ ok: true });
}
