import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const auth = await requirePermission("content.view");
  if (auth.response) return auth.response;

  const requestedDays = Number(req.nextUrl.searchParams.get("days") ?? 7);
  const days = Number.isInteger(requestedDays) ? Math.min(Math.max(requestedDays, 1), 30) : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const logs = await db
    .selectFrom("scraper_import_logs")
    .select(["id", "source_id", "source_url", "status", "advertisement_id", "property_id", "error_message", "created_at"])
    .where("created_at", ">=", new Date(since))
    .orderBy("created_at", "desc")
    .limit(5000)
    .execute();

  const summary = { total: logs.length, created: 0, updated: 0, duplicate: 0, failed: 0 };
  const daily: Record<string, typeof summary> = {};
  for (const log of logs) {
    if (log.status in summary) summary[log.status as keyof typeof summary] += 1;
    const day = new Date(log.created_at).toISOString().slice(0, 10);
    const daySummary = (daily[day] ??= { total: 0, created: 0, updated: 0, duplicate: 0, failed: 0 });
    daySummary.total += 1;
    if (log.status in daySummary) daySummary[log.status as keyof typeof daySummary] += 1;
  }

  return NextResponse.json({ days, summary, daily, recent: logs.slice(0, 100) });
}
