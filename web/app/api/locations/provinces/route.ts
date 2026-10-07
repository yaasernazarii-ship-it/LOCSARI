import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const provinces = await db
    .selectFrom("provinces")
    .select(["id", "name", "slug", "sort_order"])
    .where("is_active", "=", true)
    .orderBy("sort_order", "asc")
    .execute();
  return NextResponse.json({ provinces });
}
