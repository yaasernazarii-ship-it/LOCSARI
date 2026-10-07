import { db } from "./db";

/**
 * منطق تعیین دسترسی (Authorization سمت سرور، طبق الزام پروژه):
 * ۱. اگر روی خود کاربر مجوز با effect='deny' ثبت شده باشد → رد قطعی (بالاترین اولویت)
 * ۲. اگر روی خود کاربر مجوز با effect='allow' ثبت شده باشد → قبول
 * ۳. اگر یکی از نقش‌های کاربر آن مجوز را داشته باشد → قبول
 * ۴. در غیر این صورت → رد
 * این تابع همیشه مستقیماً از دیتابیس می‌خواند؛ به ادعای داخل JWT اعتماد نمی‌شود.
 */
export async function userHasPermission(userId: number, permissionKey: string): Promise<boolean> {
  const override = await db
    .selectFrom("user_permissions")
    .innerJoin("permissions", "permissions.id", "user_permissions.permission_id")
    .select(["user_permissions.effect"])
    .where("user_permissions.user_id", "=", userId)
    .where("permissions.key", "=", permissionKey)
    .executeTakeFirst();

  if (override) {
    return override.effect === "allow";
  }

  const viaRole = await db
    .selectFrom("user_roles")
    .innerJoin("role_permissions", "role_permissions.role_id", "user_roles.role_id")
    .innerJoin("permissions", "permissions.id", "role_permissions.permission_id")
    .select(["permissions.id"])
    .where("user_roles.user_id", "=", userId)
    .where("permissions.key", "=", permissionKey)
    .executeTakeFirst();

  return Boolean(viaRole);
}

export async function getUserRoleKeys(userId: number): Promise<string[]> {
  const rows = await db
    .selectFrom("user_roles")
    .innerJoin("roles", "roles.id", "user_roles.role_id")
    .select(["roles.key"])
    .where("user_roles.user_id", "=", userId)
    .execute();
  return rows.map((r) => r.key);
}

export async function assignDefaultRole(userId: number, roleKey = "user"): Promise<void> {
  const role = await db.selectFrom("roles").select("id").where("key", "=", roleKey).executeTakeFirst();
  if (!role) throw new Error(`نقش «${roleKey}» در دیتابیس یافت نشد`);
  await db
    .insertInto("user_roles")
    .values({ user_id: userId, role_id: role.id })
    .onConflict((oc) => oc.doNothing())
    .execute();
}
