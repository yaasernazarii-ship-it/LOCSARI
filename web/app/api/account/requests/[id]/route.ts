import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId, isValidRequestStatus } from "@/lib/validation";

async function loadRequest(id: number) {
  return db.selectFrom("advertisement_inquiries").selectAll().where("id", "=", id).executeTakeFirst();
}

// GET /api/account/requests/:id — فقط مالک آگهی (owner_user_id) یا خودِ درخواست‌دهنده (user_id) — در غیر این صورت 404
// عمداً 404 برگردانده می‌شود نه 403 تا وجود/عدم‌وجود شناسه برای کاربر غیرمرتبط قابل تشخیص نباشد (IDOR).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const row = await loadRequest(id);
  if (!row || (row.owner_user_id !== auth.user.id && row.user_id !== auth.user.id)) {
    return NextResponse.json({ error: "درخواست یافت نشد" }, { status: 404 });
  }

  const advertisement = await db
    .selectFrom("advertisements")
    .select(["id", "title", "slug", "status"])
    .where("id", "=", row.advertisement_id)
    .executeTakeFirst();

  return NextResponse.json({
    request: { ...row, role: row.owner_user_id === auth.user.id ? "received" : "sent" },
    advertisement,
  });
}

// PATCH /api/account/requests/:id { status } — فقط مالک آگهی (owner_user_id) می‌تواند وضعیت را تغییر دهد
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  if (!checkRateLimit(`request-update:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const row = await loadRequest(id);
  // برای کاربری که نه مالک است و نه درخواست‌دهنده، اصلاً وجود رکورد فاش نمی‌شود
  if (!row || (row.owner_user_id !== auth.user.id && row.user_id !== auth.user.id)) {
    return NextResponse.json({ error: "درخواست یافت نشد" }, { status: 404 });
  }
  // فقط مالک آگهی مجاز به تغییر وضعیت است؛ درخواست‌دهنده حتی اگر رکورد را ببیند نمی‌تواند ویرایش کند
  if (row.owner_user_id !== auth.user.id) {
    return NextResponse.json({ error: "دسترسی مجاز نیست" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !isValidRequestStatus(body.status)) {
    return NextResponse.json({ error: "status نامعتبر است" }, { status: 400 });
  }

  const updated = await db
    .updateTable("advertisement_inquiries")
    .set({ status: body.status, updated_at: new Date().toISOString() })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "advertisement_inquiry", id, { status: body.status });

  return NextResponse.json({ request: updated });
}
