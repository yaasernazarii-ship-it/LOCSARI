import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";

// GET /api/admin/settings/cip-video — دریافت لینک ویدیوی CIP
export async function GET() {
  const auth = await requirePermission("cip.manage");
  if (auth.response) return auth.response;

  const row = await db.selectFrom("cip_page_settings").selectAll().where("id", "=", 1).executeTakeFirst();
  return NextResponse.json({ videoUrl: row?.video_url ?? null });
}
