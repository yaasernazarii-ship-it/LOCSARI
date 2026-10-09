import Link from "next/link";
import { sql } from "kysely";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { ADVERTISEMENT_STATUSES } from "@/lib/validation";
import { ADVERTISEMENT_STATUS_LABELS, TRANSACTION_TYPE_LABELS, formatPriceLine } from "@/lib/labels";
import AdminPagination from "@/components/AdminPagination";
import AdminAdvertisementBulkTable, { type BulkAdRow } from "@/components/AdminAdvertisementBulkTable";
import { parseJalaliDateString } from "@/lib/jalali";

const PAGE_SIZE = 20;

type SP = Record<string, string | undefined>;

export default async function AdminAdvertisementsPage({ searchParams }: { searchParams: SP }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "advertisement.approve");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مشاهدهٔ آگهی‌ها را ندارید.</p>
      </div>
    );
  }

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const status = searchParams.status && ADVERTISEMENT_STATUSES.includes(searchParams.status as never) ? searchParams.status : undefined;
  const transactionType = searchParams.transactionType || undefined;
  const categoryId = searchParams.categoryId ? Number(searchParams.categoryId) : undefined;
  const cityId = searchParams.cityId ? Number(searchParams.cityId) : undefined;
  const districtId = searchParams.districtId ? Number(searchParams.districtId) : undefined;
  const marketZoneId = searchParams.marketZoneId ? Number(searchParams.marketZoneId) : undefined;
  const neighborhoodId = searchParams.neighborhoodId ? Number(searchParams.neighborhoodId) : undefined;
  const dateFrom = searchParams.dateFrom || undefined;
  const dateTo = searchParams.dateTo || undefined;
  const q = searchParams.q?.trim() || undefined;
  const ownerQ = searchParams.owner?.trim() || undefined;
  const sort = searchParams.sort === "oldest" ? "oldest" : "newest";

  function buildQuery() {
    let query = db
      .selectFrom("advertisements")
      .innerJoin("properties", "properties.id", "advertisements.property_id")
      .innerJoin("categories", "categories.id", "properties.category_id")
      .innerJoin("cities", "cities.id", "properties.city_id")
      .innerJoin("users", "users.id", "advertisements.created_by_user_id")
      .leftJoin("consultants", "consultants.id", "advertisements.consultant_id")
      .leftJoin("agencies", "agencies.id", "advertisements.agency_id");

    if (status) query = query.where("advertisements.status", "=", status);
    if (transactionType) query = query.where("advertisements.transaction_type", "=", transactionType);
    if (categoryId) query = query.where("properties.category_id", "=", categoryId);
    if (cityId) query = query.where("properties.city_id", "=", cityId);
    if (districtId) query = query.where("properties.district_id", "=", districtId);
    if (marketZoneId) query = query.where("properties.market_zone_id", "=", marketZoneId);
    if (neighborhoodId) query = query.where("properties.neighborhood_id", "=", neighborhoodId);
    if (dateFrom) {
      const gDateFrom = parseJalaliDateString(dateFrom);
      if (gDateFrom) query = query.where("advertisements.created_at", ">=", gDateFrom);
    }
    if (dateTo) {
      const gDateTo = parseJalaliDateString(dateTo);
      if (gDateTo) {
        gDateTo.setUTCHours(23, 59, 59, 999);
        query = query.where("advertisements.created_at", "<=", gDateTo);
      }
    }
    if (ownerQ) {
      query = query.where((eb) => eb.or([eb("users.name", "ilike", `%${ownerQ}%`), eb("users.phone", "ilike", `%${ownerQ}%`), eb("advertisements.source_contact_phone", "ilike", `%${ownerQ}%`)]));
    }
    if (q) {
      const numericId = /^\d+$/.test(q) ? Number(q) : null;
      query = query.where((eb) =>
        eb.or([
          eb("advertisements.title", "ilike", `%${q}%`),
          eb("advertisements.slug", "ilike", `%${q}%`),
          eb("advertisements.public_code", "ilike", `%${q}%`),
          ...(numericId ? [eb("advertisements.id", "=", numericId)] : []),
        ])
      );
    }
    return query;
  }

  const [canCreate, canEditRow, canDeleteRow, canPublishBulk, canRejectBulk, canArchiveBulk, { count }, rows, categories, cities] = await Promise.all([
    (async () => {
      const [canCreateAd, canCreateProperty] = await Promise.all([
        userHasPermission(user.id, "advertisement.create"),
        userHasPermission(user.id, "property.create"),
      ]);
      return canCreateAd && canCreateProperty;
    })(),
    userHasPermission(user.id, "advertisement.edit"),
    userHasPermission(user.id, "advertisement.delete"),
    userHasPermission(user.id, "advertisement.publish"),
    userHasPermission(user.id, "advertisement.reject"),
    userHasPermission(user.id, "advertisement.archive"),
    buildQuery()
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow(),
    buildQuery()
      .select([
        "advertisements.id",
        "advertisements.public_code",
        "advertisements.title",
        "advertisements.slug",
        "advertisements.transaction_type",
        "advertisements.price",
        "advertisements.deposit",
        "advertisements.monthly_rent",
        "advertisements.status",
        "advertisements.created_at",
        "advertisements.published_at",
        "categories.name as category_name",
        "cities.name as city_name",
        "users.name as owner_name",
        sql<string>`case when advertisements.source_id is not null then coalesce(nullif(advertisements.source_contact_phone, ''), '—') else users.phone end`.as("owner_phone"),
        "consultants.display_name as consultant_name",
        "agencies.name as agency_name",
        sql<"user" | "consultant" | "agency">`case when advertisements.agency_id is not null then 'agency' when advertisements.consultant_id is not null then 'consultant' else 'user' end`.as("owner_account_type"),
        sql<"free" | "vip" | "cip">`case when exists (select 1 from cip_requests where cip_requests.advertisement_id = advertisements.id and cip_requests.status <> 'cancelled') then 'cip' when advertisements.is_vip then 'vip' else 'free' end`.as("advertisement_type"),
      ])
      .orderBy("advertisements.created_at", sort === "oldest" ? "asc" : "desc")
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .execute(),
    db.selectFrom("categories").select(["id", "name"]).orderBy("sort_order", "asc").execute(),
    db.selectFrom("cities").select(["id", "name"]).orderBy("sort_order", "asc").execute(),
  ]);

  const totalPages = Math.max(1, Math.ceil(Number(count) / PAGE_SIZE));

  const bulkRows: BulkAdRow[] = rows.map((ad) => ({
    id: ad.id,
    publicCode: ad.public_code,
    advertisementType: ad.advertisement_type,
    title: ad.title,
    categoryName: ad.category_name,
    cityName: ad.city_name,
    transactionTypeLabel: TRANSACTION_TYPE_LABELS[ad.transaction_type as keyof typeof TRANSACTION_TYPE_LABELS] ?? ad.transaction_type,
    priceLine: formatPriceLine({
      transactionType: ad.transaction_type,
      price: ad.price !== null ? Number(ad.price) : null,
      deposit: ad.deposit !== null ? Number(ad.deposit) : null,
      monthlyRent: ad.monthly_rent !== null ? Number(ad.monthly_rent) : null,
    }),
    status: ad.status,
    statusLabel: ADVERTISEMENT_STATUS_LABELS[ad.status] ?? ad.status,
    ownerName: ad.owner_name,
    ownerAccountType: ad.owner_account_type,
    ownerPhone: ad.owner_phone,
    consultantOrAgency: ad.consultant_name ?? ad.agency_name ?? "—",
    createdAtLabel: new Date(ad.created_at).toLocaleDateString("fa-IR"),
    publishedAtLabel: ad.published_at ? new Date(ad.published_at).toLocaleDateString("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric" }) : "—",
  }));

  return (
    <>
      <div className="admin-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h1>آگهی‌ها</h1>
          <p>{Number(count).toLocaleString("fa-IR")} آگهی مطابق فیلترهای فعلی.</p>
        </div>
        {canCreate && (
          <Link href="/admin/advertisements/new" className="btn-primary" style={{ width: "auto", padding: "9px 20px", flexShrink: 0 }}>
            + ثبت آگهی جدید
          </Link>
        )}
      </div>

      <div className="admin-filters">
        <form method="get">
          <div>
            <label htmlFor="q">جستجو (عنوان/Slug/شناسه آگهی)</label>
            <input type="text" id="q" name="q" defaultValue={q ?? ""} />
          </div>
          <div>
            <label htmlFor="owner">مالک (نام/موبایل)</label>
            <input type="text" id="owner" name="owner" defaultValue={ownerQ ?? ""} />
          </div>
          <div>
            <label htmlFor="status">وضعیت</label>
            <select id="status" name="status" defaultValue={status ?? ""}>
              <option value="">همه</option>
              {ADVERTISEMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ADVERTISEMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="transactionType">نوع معامله</label>
            <select id="transactionType" name="transactionType" defaultValue={transactionType ?? ""}>
              <option value="">همه</option>
              {Object.entries(TRANSACTION_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="categoryId">دسته‌بندی</label>
            <select id="categoryId" name="categoryId" defaultValue={categoryId ? String(categoryId) : ""}>
              <option value="">همه</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cityId">شهر</label>
            <select id="cityId" name="cityId" defaultValue={cityId ? String(cityId) : ""}>
              <option value="">همه</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dateFrom">از تاریخ (شمسی)</label>
            <input
              type="text"
              id="dateFrom"
              name="dateFrom"
              dir="ltr"
              placeholder="۱۴۰۵/۰۱/۰۱"
              defaultValue={dateFrom ?? ""}
            />
          </div>
          <div>
            <label htmlFor="dateTo">تا تاریخ (شمسی)</label>
            <input
              type="text"
              id="dateTo"
              name="dateTo"
              dir="ltr"
              placeholder="۱۴۰۵/۱۲/۲۹"
              defaultValue={dateTo ?? ""}
            />
          </div>
          <div>
            <label htmlFor="sort">مرتب‌سازی</label>
            <select id="sort" name="sort" defaultValue={sort}>
              <option value="newest">جدیدترین</option>
              <option value="oldest">قدیمی‌ترین</option>
            </select>
          </div>
          <div className="admin-filters__submit">
            <button type="submit" className="btn-primary" style={{ width: "auto", padding: "9px 20px" }}>
              اعمال فیلتر
            </button>
          </div>
        </form>
      </div>

      <AdminAdvertisementBulkTable
        rows={bulkRows}
        canPublish={canPublishBulk}
        canReject={canRejectBulk}
        canArchive={canArchiveBulk}
        canEdit={canEditRow}
        canDelete={canDeleteRow}
      />

      <AdminPagination basePath="/admin/advertisements" searchParams={searchParams} page={page} totalPages={totalPages} />
    </>
  );
}
