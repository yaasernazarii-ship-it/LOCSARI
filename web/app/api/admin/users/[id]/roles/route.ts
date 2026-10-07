import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { logAdminAction } from "@/lib/audit";
import { parseId } from "@/lib/validation";
import { getUserRoleKeys } from "@/lib/rbac";

type Params = { params: { id: string } };

// نقش‌های حساس: فقط مدیر کل (super_admin) می‌تواند این‌ها را به کسی بدهد یا از کسی بگیرد
const SENSITIVE_ROLES = ["super_admin", "system_admin"];

// POST /api/admin/users/[id]/roles — اختصاص یک نقش به کاربر
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requirePermission("user.manage");
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسهٔ نامعتبر است" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const roleKey = (body as { roleKey?: unknown } | null)?.roleKey;
  if (typeof roleKey !== "string" || !roleKey) {
    return NextResponse.json({ error: "roleKey الزامی است" }, { status: 400 });
  }

  const targetUser = await db.selectFrom("users").select(["id"]).where("id", "=", id).executeTakeFirst();
  if (!targetUser) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });

  const role = await db.selectFrom("roles").select(["id", "key"]).where("key", "=", roleKey).executeTakeFirst();
  if (!role) return NextResponse.json({ error: "نقش نامعتبر است" }, { status: 400 });

  if (SENSITIVE_ROLES.includes(role.key)) {
    const actorRoles = await getUserRoleKeys(auth.user.id);
    if (!actorRoles.includes("super_admin")) {
      return NextResponse.json({ error: "فقط مدیر کل می‌تواند نقش مدیر کل/مدیر سیستم را اختصاص دهد" }, { status: 403 });
    }
  }

  await db.insertInto("user_roles").values({ user_id: id, role_id: role.id }).onConflict((oc) => oc.doNothing()).execute();
  await logAdminAction(auth.user.id, "update", "user_role", id, { event: "assign_role", role: role.key });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/users/[id]/roles?role=KEY — حذف یک نقش از کاربر
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requirePermission("user.manage");
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسهٔ نامعتبر است" }, { status: 400 });

  const roleKey = req.nextUrl.searchParams.get("role");
  if (!roleKey) return NextResponse.json({ error: "role الزامی است" }, { status: 400 });

  const role = await db.selectFrom("roles").select(["id", "key"]).where("key", "=", roleKey).executeTakeFirst();
  if (!role) return NextResponse.json({ error: "نقش نامعتبر است" }, { status: 400 });

  if (SENSITIVE_ROLES.includes(role.key)) {
    const actorRoles = await getUserRoleKeys(auth.user.id);
    if (!actorRoles.includes("super_admin")) {
      return NextResponse.json({ error: "فقط مدیر کل می‌تواند نقش مدیر کل/مدیر سیستم را حذف کند" }, { status: 403 });
    }
    if (id === auth.user.id && role.key === "super_admin") {
      return NextResponse.json({ error: "نمی‌توانید نقش مدیر کل را از حساب خودتان حذف کنید" }, { status: 400 });
    }
  }

  await db.deleteFrom("user_roles").where("user_id", "=", id).where("role_id", "=", role.id).execute();
  await logAdminAction(auth.user.id, "update", "user_role", id, { event: "remove_role", role: role.key });
  return NextResponse.json({ ok: true });
}
