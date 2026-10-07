"use client";

// صفحهٔ عمومی جستجوی املاک (بخش ۳۶ تا ۳۹ پرامپت فاز ۴) — فرم فیلتر وابسته + نتایج + صفحه‌بندی.
// URL همیشه بازتاب‌دهندهٔ فیلترهای فعلی است (قابل اشتراک‌گذاری/بوکمارک، هم‌راستا با Structured Query Object).

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchSort, SearchResultItem } from "@/lib/search/types";
import { SORT_LABELS, RENT_BASED_TRANSACTION_TYPES } from "@/lib/labels";
import { TransactionType } from "@/lib/validation";
import AdCard from "@/components/AdCard";

interface Option {
  id: number;
  name: string;
  slug: string;
  parent_id?: number | null;
  district_id?: number | null;
  market_zone_id?: number | null;
}
interface FieldOption {
  id: number;
  value: string;
  label_fa: string;
}
interface CategoryField {
  id: number;
  key: string;
  label_fa: string;
  field_type: string;
  options: FieldOption[];
}

interface FiltersMeta {
  categories: Option[];
  neighborhoods: Option[];
  fields: CategoryField[];
}

interface FormState {
  q: string;
  categoryId: string;
  subcategoryId: string;
  transactionType: string;
  districtId: string;
  marketZoneId: string;
  neighborhoodId: string;
  minPrice: string;
  maxPrice: string;
  minDeposit: string;
  maxDeposit: string;
  minMonthlyRent: string;
  maxMonthlyRent: string;
  minArea: string;
  maxArea: string;
  bedrooms: string;
  agencyId: string;
  consultantId: string;
  sort: string;
  attrs: Record<string, string>;
}

const NUMERIC_KEYS = [
  "categoryId",
  "subcategoryId",
  "districtId",
  "marketZoneId",
  "neighborhoodId",
  "minPrice",
  "maxPrice",
  "minDeposit",
  "maxDeposit",
  "minMonthlyRent",
  "maxMonthlyRent",
  "minArea",
  "maxArea",
  "bedrooms",
  "agencyId",
  "consultantId",
] as const;

const KNOWN_KEYS = new Set<string>(["q", "sort", "page", "limit", "transactionType", ...NUMERIC_KEYS]);

function emptyForm(): FormState {
  return {
    q: "",
    categoryId: "",
    subcategoryId: "",
    transactionType: "",
    districtId: "",
    marketZoneId: "",
    neighborhoodId: "",
    minPrice: "",
    maxPrice: "",
    minDeposit: "",
    maxDeposit: "",
    minMonthlyRent: "",
    maxMonthlyRent: "",
    minArea: "",
    maxArea: "",
    bedrooms: "",
    agencyId: "",
    consultantId: "",
    sort: "newest",
    attrs: {},
  };
}

function formFromSearchParams(params: URLSearchParams): { form: FormState; page: number } {
  const form = emptyForm();
  for (const key of Object.keys(form) as (keyof FormState)[]) {
    if (key === "attrs") continue;
    const v = params.get(key);
    if (v !== null) (form as any)[key] = v;
  }
  const attrs: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (!KNOWN_KEYS.has(key) && value) attrs[key] = value;
  }
  form.attrs = attrs;
  const page = Number(params.get("page"));
  return { form, page: page > 0 ? page : 1 };
}

function buildQueryString(form: FormState, page: number): string {
  const p = new URLSearchParams();
  if (form.q.trim()) p.set("q", form.q.trim());
  if (form.categoryId) p.set("categoryId", form.categoryId);
  if (form.subcategoryId) p.set("subcategoryId", form.subcategoryId);
  if (form.transactionType) p.set("transactionType", form.transactionType);
  if (form.districtId) p.set("districtId", form.districtId);
  if (form.marketZoneId) p.set("marketZoneId", form.marketZoneId);
  if (form.neighborhoodId) p.set("neighborhoodId", form.neighborhoodId);
  if (form.minPrice) p.set("minPrice", form.minPrice);
  if (form.maxPrice) p.set("maxPrice", form.maxPrice);
  if (form.minDeposit) p.set("minDeposit", form.minDeposit);
  if (form.maxDeposit) p.set("maxDeposit", form.maxDeposit);
  if (form.minMonthlyRent) p.set("minMonthlyRent", form.minMonthlyRent);
  if (form.maxMonthlyRent) p.set("maxMonthlyRent", form.maxMonthlyRent);
  if (form.minArea) p.set("minArea", form.minArea);
  if (form.maxArea) p.set("maxArea", form.maxArea);
  if (form.bedrooms) p.set("bedrooms", form.bedrooms);
  if (form.agencyId) p.set("agencyId", form.agencyId);
  if (form.consultantId) p.set("consultantId", form.consultantId);
  if (form.sort && form.sort !== "newest") p.set("sort", form.sort);
  for (const [key, value] of Object.entries(form.attrs)) {
    if (value) p.set(key, value);
  }
  if (page > 1) p.set("page", String(page));
  return p.toString();
}

export default function AmlakSearchPage() {
  return (
    <Suspense fallback={<div className="search-page__loading">در حال بارگذاری…</div>}>
      <AmlakSearchInner />
    </Suspense>
  );
}

function AmlakSearchInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = useMemo(() => formFromSearchParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [form, setForm] = useState<FormState>(initial.form);
  const [page, setPage] = useState(initial.page);
  const [meta, setMeta] = useState<FiltersMeta | null>(null);
  const [items, setItems] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const skipNextUrlSync = useRef(true);

  // ---- وضعیت ورود + لیست علاقه‌مندی‌ها (برای نمایش قلب پرشده روی کارت‌ها) ----
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setIsLoggedIn(true);
          fetch("/api/favorites")
            .then((r) => (r.ok ? r.json() : null))
            .then((favData) => {
              if (favData?.favorites) {
                setFavoriteIds(new Set(favData.favorites.map((f: { advertisementId: number }) => f.advertisementId)));
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  // ---- فراداده‌ی فیلترها؛ وابسته به دسته/منطقه/محدودهٔ عرفی انتخاب‌شده (بخش ۳۹: Filter Dependency) ----
  useEffect(() => {
    const p = new URLSearchParams();
    if (form.categoryId) p.set("categoryId", form.categoryId);
    fetch(`/api/search/filters?${p.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setMeta(data))
      .catch(() => {});
  }, [form.categoryId]);

  // ---- اجرای جستجو (debounce برای فیلد متنی، بلافاصله برای بقیه) + هم‌گام‌سازی URL ----
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      const qs = buildQueryString(form, page);
      fetch(`/api/search?${qs}`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "خطا در جستجو");
          setItems(data.items);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));

      if (skipNextUrlSync.current) {
        skipNextUrlSync.current = false;
      } else {
        router.replace(`/amlak${qs ? `?${qs}` : ""}`, { scroll: false });
      }
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, page]);

  function updateForm(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  function updateAttr(key: string, value: string) {
    setForm((f) => {
      const attrs = { ...f.attrs };
      if (value) attrs[key] = value;
      else delete attrs[key];
      return { ...f, attrs };
    });
    setPage(1);
  }

  function resetFilters() {
    setForm(emptyForm());
    setPage(1);
  }

  const topCategories = meta?.categories.filter((c) => !c.parent_id) ?? [];
  const subcategories = form.categoryId ? meta?.categories.filter((c) => c.parent_id === Number(form.categoryId)) ?? [] : [];
  const neighborhoods = meta?.neighborhoods ?? [];
  const fields = form.categoryId ? meta?.fields ?? [] : [];

  const transactionType = form.transactionType as TransactionType | "";
  const showPriceFields = !transactionType || !RENT_BASED_TRANSACTION_TYPES.includes(transactionType);
  const showRentFields = !transactionType || RENT_BASED_TRANSACTION_TYPES.includes(transactionType);

  return (
    <div className="search-page">
      <aside className="search-filters">
        <h2>جستجوی ملک</h2>

        <div className="form-group">
          <label>جستجو در عنوان و توضیحات</label>
          <input
            type="text"
            value={form.q}
            onChange={(e) => updateForm({ q: e.target.value })}
            placeholder="مثلاً آپارتمان دو خواب در پل سنگی"
          />
        </div>

        <div className="form-group">
          <label>دسته‌بندی</label>
          <select
            value={form.categoryId}
            onChange={(e) => updateForm({ categoryId: e.target.value, subcategoryId: "" })}
          >
            <option value="">همهٔ دسته‌بندی‌ها</option>
            {topCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {subcategories.length > 0 && (
          <div className="form-group">
            <label>زیردسته</label>
            <select value={form.subcategoryId} onChange={(e) => updateForm({ subcategoryId: e.target.value })}>
              <option value="">همهٔ زیردسته‌ها</option>
              {subcategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label>موقعیت ملک</label>
          <select value={form.neighborhoodId} onChange={(e) => updateForm({ neighborhoodId: e.target.value })}>
            <option value="">همهٔ موقعیت‌ها</option>
            {neighborhoods.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>

        {showPriceFields && (
          <div className="form-group form-group--range">
            <label>محدودهٔ قیمت (تومان)</label>
            <div className="range-inputs">
              <input type="number" min={0} placeholder="از" value={form.minPrice} onChange={(e) => updateForm({ minPrice: e.target.value })} />
              <input type="number" min={0} placeholder="تا" value={form.maxPrice} onChange={(e) => updateForm({ maxPrice: e.target.value })} />
            </div>
          </div>
        )}

        {showRentFields && (
          <>
            <div className="form-group form-group--range">
              <label>محدودهٔ رهن (تومان)</label>
              <div className="range-inputs">
                <input type="number" min={0} placeholder="از" value={form.minDeposit} onChange={(e) => updateForm({ minDeposit: e.target.value })} />
                <input type="number" min={0} placeholder="تا" value={form.maxDeposit} onChange={(e) => updateForm({ maxDeposit: e.target.value })} />
              </div>
            </div>
            <div className="form-group form-group--range">
              <label>محدودهٔ اجارهٔ ماهانه (تومان)</label>
              <div className="range-inputs">
                <input
                  type="number"
                  min={0}
                  placeholder="از"
                  value={form.minMonthlyRent}
                  onChange={(e) => updateForm({ minMonthlyRent: e.target.value })}
                />
                <input
                  type="number"
                  min={0}
                  placeholder="تا"
                  value={form.maxMonthlyRent}
                  onChange={(e) => updateForm({ maxMonthlyRent: e.target.value })}
                />
              </div>
            </div>
          </>
        )}

        <div className="form-group form-group--range">
          <label>متراژ (متر مربع)</label>
          <div className="range-inputs">
            <input type="number" min={1} placeholder="از" value={form.minArea} onChange={(e) => updateForm({ minArea: e.target.value })} />
            <input type="number" min={1} placeholder="تا" value={form.maxArea} onChange={(e) => updateForm({ maxArea: e.target.value })} />
          </div>
        </div>

        <div className="form-group">
          <label>تعداد اتاق خواب</label>
          <input type="number" min={0} value={form.bedrooms} onChange={(e) => updateForm({ bedrooms: e.target.value })} />
        </div>

        {fields.length > 0 && (
          <>
            <hr className="filters-divider" />
            {fields.map((field) => (
              <div className="form-group" key={field.key}>
                <label>{field.label_fa}</label>
                {field.field_type === "boolean" ? (
                  <select value={form.attrs[field.key] ?? ""} onChange={(e) => updateAttr(field.key, e.target.value)}>
                    <option value="">فرقی نمی‌کند</option>
                    <option value="true">دارد</option>
                    <option value="false">ندارد</option>
                  </select>
                ) : field.field_type === "select" ? (
                  <select value={form.attrs[field.key] ?? ""} onChange={(e) => updateAttr(field.key, e.target.value)}>
                    <option value="">همه</option>
                    {field.options.map((o) => (
                      <option key={o.id} value={o.value}>
                        {o.label_fa}
                      </option>
                    ))}
                  </select>
                ) : field.field_type === "number" ? (
                  <input type="number" value={form.attrs[field.key] ?? ""} onChange={(e) => updateAttr(field.key, e.target.value)} />
                ) : (
                  <input type="text" value={form.attrs[field.key] ?? ""} onChange={(e) => updateAttr(field.key, e.target.value)} />
                )}
              </div>
            ))}
          </>
        )}

        {(form.agencyId || form.consultantId) && (
          <div className="form-group">
            <p className="search-filter-note">
              فقط آگهی‌های {form.agencyId ? "این آژانس" : "این مشاور"} نمایش داده می‌شود.
            </p>
            <button type="button" className="btn-secondary" onClick={() => updateForm({ agencyId: "", consultantId: "" })}>
              حذف این فیلتر
            </button>
          </div>
        )}

        <button type="button" className="btn-secondary" onClick={resetFilters}>
          حذف همهٔ فیلترها
        </button>
      </aside>

      <main className="search-results">
        <div className="search-results__toolbar">
          <span>{loading ? "در حال جستجو…" : `${total.toLocaleString("fa-IR")} آگهی یافت شد`}</span>
          <select value={form.sort} onChange={(e) => updateForm({ sort: e.target.value as SearchSort })}>
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {error && <div className="error-box">{error}</div>}

        {!loading && !error && items.length === 0 && <p className="search-empty">آگهی‌ای مطابق فیلترهای شما یافت نشد.</p>}

        <div className="result-grid">
          {items.map((item) => (
            <AdCard key={item.id} item={item} isLoggedIn={isLoggedIn} favorited={favoriteIds.has(item.id)} />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              قبلی
            </button>
            <span>
              صفحهٔ {page.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}
            </span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              بعدی
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
