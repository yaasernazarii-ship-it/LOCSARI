import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/agencies — فهرست عمومی آژانس‌های approved+active (برای انتخاب در فرم اپلای مشاور و فیلترها)
export async function GET() {
  const agencies = await db
    .selectFrom("agencies")
    .select(["id", "name", "slug"])
    .where("verification_status", "=", "approved")
    .where("is_active", "=", true)
    .orderBy("name", "asc")
    .execute();

  return NextResponse.json({ agencies });
}
