import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission, isPropertyReviewer } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, isValidAdvertisementStatus, isValidTransactionType, parseId } from "@/lib/validation";
import { validateTransactionAmounts } from "@/lib/transactionAmounts";
import { syncExpiredStatus } from "@/lib/advertisementWorkflow";
import { computeDuplicateFingerprint, findDuplicateCandidates, flagDuplicates } from "@/lib/duplicateDetection";

// GET /api/advertisements
//   بدون پارامتر یا status=published -> فقط آگهی‌های منتشرشده و منقضی‌نشده (عمومی، بدون نیاز به ورود) — بخش ۲۴
//   ?mine=1                          -> آگهی‌های خود کاربر با هر وضعیتی (نیازمند ورود)
//   ?status=<غیر از published>       -> فقط برای بازبین مرکزی (صف بررسی Admin) — بخش ۲۳
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mine = searchParams.get("mine") === "1";
  const statusParam = searchParams.get("status");

  if (mine) {
    const auth = await requirePermission("advertisement.view");
    if (auth.response) return auth.response;

    const rows = await db
      .selectFrom("advertisements")
      .innerJoin("properties", "properties.id", "advertisements.property_id")
      .innerJoin("categories", "categories.id", "properties.category_id")
      .leftJoin("property_media", (join) =>
        join.onRef("property_media.property_id", "=", "properties.id").on("property_media.is_primary", "=", true)
      )
      .selectAll("advertisements")
      .select(["categories.name as category_name", "categories.slug as category_slug", "property_media.url as primary_image"])
      .where("advertisements.created_by_user_id", "=", auth.user.id)
      .orderBy("advertisements.created_at", "desc")
      .execute();

    const advertisements = await Promise.all(
      rows.map(async (row) => {
        await syncExpiredStatus(db, row);
        const status =
          row.status === "published" && row.expires_at && new Date(row.expires_at) < new Date() ? "expired" : row.status;
        return {
          ...row,
          status,
          category: { name: row.category_name, slug: row.category_slug },
          primaryImage: row.primary_image ?? null,
        };
      })
    );
    return NextResponse.json({ advertisements });
  }

  if (statusParam && statusParam !== "published") {
    if (!isValidAdvertisementStatus(statusParam)) return NextResponse.json({ error: "status نامعتبر است" }, { status: 400 });
    const auth = await requireAuth();
    if (auth.response) return auth.response;
    const reviewer = await isPropertyReviewer(auth.user.id);
    if (!reviewer) return NextResponse.json({ error: "دسترسی مجاز نیست" }, { status: 403 });

    const rows = await db.selectFrom("advertisements").selectAll().where("status", "=", statusParam).orderBy("created_at", "desc").execute();
    return NextResponse.json({ advertisements: rows });
  }

  // ---- حالت عمومی: فقط منتشرشده و منقضی‌نشده ----
  const rows = await db.selectFrom("advertisements").selectAll().where("status", "=", "published").orderBy("published_at", "desc").execute();
  const active = [];
  for (const row of rows) {
    const expired = await syncExpiredStatus(db, row);
    if (!expired) active.push(row);
  }
  return NextResponse.json({ advertisements: active });
}

// POST /api/advertisements — ایجاد آگهی جدید برای یک Property موجود (بخش ۵، ۸ و ۱۴ پرامپت)
export async function POST(req: NextRequest) {
  const auth = await requirePermission("advertisement.create");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`advertisement-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const propertyId = parseId(String(body.propertyId ?? ""));
  if (!propertyId) return NextResponse.json({ error: "propertyId نامعتبر است" }, { status: 400 });

  const property = await db
    .selectFrom("properties")
    .selectAll()
    .where("id", "=", propertyId)
    .where("is_active", "=", true)
    .executeTakeFirst();
  if (!property) return NextResponse.json({ error: "ملک یافت نشد" }, { status: 400 });

  const reviewer = await isPropertyReviewer(auth.user.id);
  if (!reviewer && property.created_by_user_id !== auth.user.id) {
    return NextResponse.json({ error: "فقط مالک ملک می‌تواند برای آن آگهی ثبت کند" }, { status: 403 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!isNonEmptyString(title, 200)) return NextResponse.json({ error: "title نامعتبر است" }, { status: 400 });
  const description = typeof body.description === "string" ? body.description : null;

  if (!isValidTransactionType(body.transactionType)) return NextResponse.json({ error: "transactionType نامعتبر است" }, { status: 400 });

  const amounts = validateTransactionAmounts(body.transactionType, {
    price: body.price ?? null,
    deposit: body.deposit ?? null,
    monthlyRent: body.monthlyRent ?? null,
  });
  if (!amounts.ok) return NextResponse.json({ error: amounts.error }, { status: 400 });

  const expiresAt = null;

  const category = await db.selectFrom("categories").select("slug").where("id", "=", property.category_id).executeTakeFirstOrThrow();

  // انتساب مشاور/آژانس (بخش ۱۵) — هرگز از ورودی کاربر مستقیم گرفته نمی‌شود؛ فقط از پروفایل تأییدشدهٔ خودِ کاربر
  // در دیتابیس مشتق می‌شود. اگر کاربر مشاورِ approved+active باشد و attributeAsConsultant=true ارسال شده باشد،
  // consultant_id ست می‌شود؛ اگر آن مشاور عضو فعال آژانسی هم باشد، agency_id هم به‌صورت خودکار همراهش می‌آید.
  let consultantId: number | null = null;
  let agencyId: number | null = null;
  if (body.attributeAsConsultant === true) {
    const consultant = await db
      .selectFrom("consultants")
      .select(["id", "agency_id", "verification_status", "is_active"])
      .where("user_id", "=", auth.user.id)
      .executeTakeFirst();
    if (!consultant || consultant.verification_status !== "approved" || !consultant.is_active) {
      return NextResponse.json({ error: "پروفایل مشاورِ تأییدشده و فعال یافت نشد" }, { status: 403 });
    }
    consultantId = consultant.id;
    agencyId = consultant.agency_id ?? null;
  }

  const created = await db.transaction().execute(async (trx) => {
    const ad = await trx
      .insertInto("advertisements")
      .values({
        property_id: propertyId,
        created_by_user_id: auth.user.id,
        consultant_id: consultantId,
        agency_id: agencyId,
        title,
        description,
        slug: "temp", // بعد از دریافت id جایگزین می‌شود
        transaction_type: body.transactionType,
        price: amounts.price,
        deposit: amounts.deposit,
        monthly_rent: amounts.monthlyRent,
        expires_at: expiresAt,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const slug = `${category.slug}-${propertyId}-${ad.id}`;
    const finalAd = await trx
      .updateTable("advertisements")
      .set({ slug })
      .where("id", "=", ad.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    await trx
      .insertInto("advertisement_status_history")
      .values({ advertisement_id: ad.id, from_status: null, to_status: "draft", changed_by: auth.user.id, reason: "created" })
      .execute();

    // تشخیص آگهی/ملک تکراری (بخش ۱۶) — فقط علامت‌گذاری، هرگز قطعی نیست
    if (!property.duplicate_fingerprint) {
      const fingerprint = computeDuplicateFingerprint({
        categoryId: property.category_id,
        neighborhoodId: property.neighborhood_id,
        area: property.area ? Number(property.area) : null,
        bedrooms: property.bedrooms,
        builtYear: property.built_year,
      });
      await trx.updateTable("properties").set({ duplicate_fingerprint: fingerprint }).where("id", "=", propertyId).execute();
    }
    const candidates = await findDuplicateCandidates(
      trx,
      {
        propertyId,
        categoryId: property.category_id,
        neighborhoodId: property.neighborhood_id,
        cityId: property.city_id,
        area: property.area ? Number(property.area) : null,
        bedrooms: property.bedrooms,
        builtYear: property.built_year,
      },
      amounts.price
    );
    const flagged = await flagDuplicates(trx, propertyId, ad.id, candidates);

    return { ad: flagged ? { ...finalAd, is_potential_duplicate: true } : finalAd, flagged };
  });

  await logAdminAction(auth.user.id, "create", "advertisement", created.ad.id, {
    propertyId,
    transactionType: body.transactionType,
    potentialDuplicate: created.flagged,
  });

  return NextResponse.json({ advertisement: created.ad, isPotentialDuplicate: created.flagged }, { status: 201 });
}
