import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { parseId } from "@/lib/validation";
import { getPropertyAttributes } from "@/lib/propertyAttributes";
import { ADVERTISEMENT_STATUS_LABELS, TRANSACTION_TYPE_LABELS, formatPriceLine } from "@/lib/labels";
import AdminAdvertisementActions from "@/components/AdminAdvertisementActions";

export default async function AdminAdvertisementDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "advertisement.approve");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مشاهدهٔ جزئیات آگهی را ندارید.</p>
      </div>
    );
  }

  const id = parseId(params.id);
  if (!id) notFound();

  const ad = await db
    .selectFrom("advertisements")
    .innerJoin("properties", "properties.id", "advertisements.property_id")
    .innerJoin("categories", "categories.id", "properties.category_id")
    .innerJoin("cities", "cities.id", "properties.city_id")
    .leftJoin("districts", "districts.id", "properties.district_id")
    .leftJoin("market_zones", "market_zones.id", "properties.market_zone_id")
    .leftJoin("neighborhoods", "neighborhoods.id", "properties.neighborhood_id")
    .innerJoin("users", "users.id", "advertisements.created_by_user_id")
    .leftJoin("consultants", "consultants.id", "advertisements.consultant_id")
    .leftJoin("agencies", "agencies.id", "advertisements.agency_id")
    .select([
      "advertisements.id",
      "advertisements.title",
      "advertisements.description",
      "advertisements.slug",
      "advertisements.transaction_type",
      "advertisements.price",
      "advertisements.deposit",
      "advertisements.monthly_rent",
      "advertisements.status",
      "advertisements.rejection_reason",
      "advertisements.is_potential_duplicate",
      "advertisements.published_at",
      "advertisements.expires_at",
      "advertisements.created_at",
      "properties.id as property_id",
      "properties.area",
      "properties.built_area",
      "properties.land_area",
      "properties.bedrooms",
      "properties.built_year",
      "properties.floor",
      "properties.total_floors",
      "properties.total_units",
      "properties.latitude",
      "properties.longitude",
      "properties.location_precision",
      "properties.description as property_description",
      "categories.name as category_name",
      "cities.name as city_name",
      "districts.name as district_name",
      "market_zones.name as market_zone_name",
      "neighborhoods.name as neighborhood_name",
      "users.id as owner_id",
      "users.name as owner_name",
      "users.phone as owner_phone",
      "advertisements.source_contact_phone",
      "consultants.id as consultant_id",
      "consultants.display_name as consultant_name",
      "consultants.slug as consultant_slug",
      "agencies.id as agency_id",
      "agencies.name as agency_name",
      "agencies.slug as agency_slug",
    ])
    .where("advertisements.id", "=", id)
    .executeTakeFirst();

  if (!ad) notFound();

  const [media, attributes, history, duplicates] = await Promise.all([
    db.selectFrom("property_media").selectAll().where("property_id", "=", ad.property_id).orderBy("sort_order", "asc").execute(),
    getPropertyAttributes(ad.property_id),
    db
      .selectFrom("advertisement_status_history")
      .leftJoin("users", "users.id", "advertisement_status_history.changed_by")
      .select([
        "advertisement_status_history.id",
        "advertisement_status_history.from_status",
        "advertisement_status_history.to_status",
        "advertisement_status_history.reason",
        "advertisement_status_history.created_at",
        "users.name as changed_by_name",
      ])
      .where("advertisement_id", "=", id)
      .orderBy("advertisement_status_history.created_at", "asc")
      .execute(),
    db
      .selectFrom("property_duplicate_matches")
      .innerJoin("advertisements as matched_ad", "matched_ad.property_id", "property_duplicate_matches.matched_property_id")
      .select([
        "property_duplicate_matches.id",
        "property_duplicate_matches.score",
        "property_duplicate_matches.reason",
        "property_duplicate_matches.status",
        "matched_ad.id as matched_ad_id",
        "matched_ad.title as matched_ad_title",
      ])
      .where("property_duplicate_matches.property_id", "=", ad.property_id)
      .execute(),
  ]);

  const canAct = await Promise.all([
    userHasPermission(user.id, "advertisement.publish"),
    userHasPermission(user.id, "advertisement.reject"),
    userHasPermission(user.id, "advertisement.archive"),
    userHasPermission(user.id, "advertisement.edit"),
    userHasPermission(user.id, "advertisement.delete"),
  ]);
  const [canPublish, canReject, canArchive, canEdit, canDelete] = canAct;

  const facts: { label: string; value: string | number | null }[] = [
    { label: "متراژ", value: ad.area !== null ? `${Number(ad.area).toLocaleString("fa-IR")} متر مربع` : null },
    { label: "زیربنا", value: ad.built_area !== null ? `${Number(ad.built_area).toLocaleString("fa-IR")} متر مربع` : null },
    { label: "متراژ زمین", value: ad.land_area !== null ? `${Number(ad.land_area).toLocaleString("fa-IR")} متر مربع` : null },
    { label: "تعداد اتاق", value: ad.bedrooms },
    { label: "سال ساخت", value: ad.built_year !== null ? Math.trunc(Number(ad.built_year)) : null },
    { label: "طبقه", value: ad.floor },
    { label: "تعداد طبقات", value: ad.total_floors },
    { label: "تعداد واحد", value: ad.total_units },
  ];

  return (
    <>
      <div className="admin-page-header">
        <h1>{ad.title}</h1>
        <p>
          شناسهٔ آگهی: {ad.id} · شناسهٔ ملک: {ad.property_id} · Slug: {ad.slug}
        </p>
      </div>

      <div className="admin-actions-bar">
        <span className={`status-badge status-badge--${ad.status}`}>{ADVERTISEMENT_STATUS_LABELS[ad.status] ?? ad.status}</span>
        {ad.is_potential_duplicate && <span className="status-badge status-badge--pending_review">مشکوک به تکراری</span>}
        <AdminAdvertisementActions
          advertisementId={ad.id}
          status={ad.status}
          canPublish={canPublish}
          canReject={canReject}
          canArchive={canArchive}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      </div>

      {ad.rejection_reason && (
        <p style={{ color: "#991b1b", marginBottom: 16 }}>دلیل رد قبلی: {ad.rejection_reason}</p>
      )}

      <div className="admin-detail-grid">
        <div>
          <section className="form-section">
            <h2>اطلاعات آگهی</h2>
            <div className="detail-facts">
              <div className="detail-fact">
                <span className="detail-fact__label">دسته‌بندی</span>
                <span className="detail-fact__value">{ad.category_name}</span>
              </div>
              <div className="detail-fact">
                <span className="detail-fact__label">نوع معامله</span>
                <span className="detail-fact__value">
                  {TRANSACTION_TYPE_LABELS[ad.transaction_type as keyof typeof TRANSACTION_TYPE_LABELS] ?? ad.transaction_type}
                </span>
              </div>
              <div className="detail-fact">
                <span className="detail-fact__label">قیمت</span>
                <span className="detail-fact__value">
                  {formatPriceLine({
                    transactionType: ad.transaction_type,
                    price: ad.price !== null ? Number(ad.price) : null,
                    deposit: ad.deposit !== null ? Number(ad.deposit) : null,
                    monthlyRent: ad.monthly_rent !== null ? Number(ad.monthly_rent) : null,
                  })}
                </span>
              </div>
              <div className="detail-fact">
                <span className="detail-fact__label">موقعیت</span>
                <span className="detail-fact__value">
                  {[ad.city_name, ad.neighborhood_name].filter(Boolean).join(" / ")}
                </span>
              </div>
              <div className="detail-fact">
                <span className="detail-fact__label">تاریخ ثبت</span>
                <span className="detail-fact__value">{new Date(ad.created_at).toLocaleString("fa-IR")}</span>
              </div>
              {ad.published_at && (
                <div className="detail-fact">
                  <span className="detail-fact__label">تاریخ انتشار</span>
                  <span className="detail-fact__value">{new Date(ad.published_at).toLocaleString("fa-IR")}</span>
                </div>
              )}
              {ad.expires_at && (
                <div className="detail-fact">
                  <span className="detail-fact__label">تاریخ انقضا</span>
                  <span className="detail-fact__value">{new Date(ad.expires_at).toLocaleString("fa-IR")}</span>
                </div>
              )}
            </div>
          </section>

          {ad.description && (
            <section className="form-section">
              <h2>توضیحات آگهی</h2>
              <p>{ad.description}</p>
            </section>
          )}

          <section className="form-section">
            <h2>مشخصات ملک</h2>
            <div className="detail-facts">
              {facts
                .filter((f) => f.value !== null && f.value !== undefined)
                .map((f) => (
                  <div key={f.label} className="detail-fact">
                    <span className="detail-fact__label">{f.label}</span>
                    <span className="detail-fact__value">{f.value}</span>
                  </div>
                ))}
            </div>
          </section>

          {attributes.length > 0 && (
            <section className="form-section">
              <h2>ویژگی‌های اختصاصی دسته‌بندی</h2>
              <div className="detail-facts">
                {attributes.map((a) => (
                  <div key={a.fieldId} className="detail-fact">
                    <span className="detail-fact__label">{a.labelFa}</span>
                    <span className="detail-fact__value">
                      {a.fieldType === "boolean"
                        ? a.value
                          ? "دارد"
                          : "ندارد"
                        : Array.isArray(a.value)
                          ? (a.value as { labelFa: string }[]).map((v) => v.labelFa).join("، ")
                          : typeof a.value === "object" && a.value !== null
                            ? (a.value as { labelFa: string }).labelFa
                            : String(a.value ?? "-")}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {media.length > 0 && (
            <section className="form-section">
              <h2>گالری تصاویر و ویدیو</h2>
              <div className="media-grid">
                {media.map((m) => (
                  <div key={m.id} className={`media-item${m.is_primary ? " media-item--primary" : ""}`}>
                    {m.mime_type?.startsWith("video/") ? (
                      <video src={m.url} controls muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <img src={m.url} alt={m.alt_text ?? ad.title} />
                    )}
                    {m.is_primary && <span className="media-item__badge">اصلی</span>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {duplicates.length > 0 && (
            <section className="form-section">
              <h2>هشدار تکراری بودن</h2>
              <ul className="admin-history-list">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    شباهت با آگهی <Link href={`/admin/advertisements/${d.matched_ad_id}`}>{d.matched_ad_title}</Link> — امتیاز:{" "}
                    {d.score.toLocaleString("fa-IR")} — دلیل: {d.reason ?? "—"} — وضعیت بررسی: {d.status}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="form-section">
            <h2>تاریخچهٔ وضعیت</h2>
            {history.length === 0 ? (
              <p className="search-empty">تاریخچه‌ای ثبت نشده است.</p>
            ) : (
              <ul className="admin-history-list">
                {history.map((h) => (
                  <li key={h.id}>
                    {h.from_status ? `${ADVERTISEMENT_STATUS_LABELS[h.from_status] ?? h.from_status} ← ` : ""}
                    {ADVERTISEMENT_STATUS_LABELS[h.to_status] ?? h.to_status} توسط {h.changed_by_name ?? "سیستم"}
                    {h.reason ? ` (${h.reason})` : ""} — {new Date(h.created_at).toLocaleString("fa-IR")}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div>
          <section className="form-section">
            <h2>مالک آگهی</h2>
            <p>{ad.owner_name}</p>
            <p style={{ color: "#666" }}>{ad.source_contact_phone ?? ad.owner_phone}</p>
            {ad.source_contact_phone && <small style={{ color: "#666" }}>شمارهٔ تماس اعلام‌شده در آگهی منبع</small>}
            <Link href={`/admin/users/${ad.owner_id}`}>مشاهدهٔ کاربر</Link>
          </section>

          {ad.consultant_id && (
            <section className="form-section">
              <h2>مشاور</h2>
              <p>{ad.consultant_name}</p>
              <Link href={`/moshaver/${ad.consultant_slug}`}>مشاهدهٔ پروفایل عمومی</Link>
            </section>
          )}

          {ad.agency_id && (
            <section className="form-section">
              <h2>آژانس</h2>
              <p>{ad.agency_name}</p>
              <Link href={`/agency/${ad.agency_slug}`}>مشاهدهٔ پروفایل عمومی</Link>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
