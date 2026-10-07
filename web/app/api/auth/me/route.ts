import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getUserRoleKeys } from "@/lib/rbac";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "وارد نشده‌اید" }, { status: 401 });
  const roles = await getUserRoleKeys(user.id);
  return NextResponse.json({ user: { ...user, roles } });
}
