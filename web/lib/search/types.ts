// انواع مشترک موتور جستجو (فاز ۴)

export const SEARCH_SORTS = ["newest", "oldest", "price_asc", "price_desc", "area_asc", "area_desc", "relevance"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export interface SearchFilters {
  q: string | null;
  categoryId: number | null;
  subcategoryId: number | null;
  transactionType: string | null;
  districtId: number | null;
  marketZoneId: number | null;
  neighborhoodId: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  minDeposit: number | null;
  maxDeposit: number | null;
  minMonthlyRent: number | null;
  maxMonthlyRent: number | null;
  minArea: number | null;
  maxArea: number | null;
  bedrooms: number | null;
  builtYear: number | null;
  floor: number | null;
  totalFloors: number | null;
  // فیلتر «آگهی‌دهنده» (فاز ۶، بخش ۱۷)
  agencyId: number | null;
  consultantId: number | null;
  // فیلترهای ویژگی پویا: fieldKey -> value خام رشته‌ای (اعتبارسنجی/تبدیل نوع در lib/search/filters.ts)
  attrs: Record<string, string>;
  // Bounding Box نقشه (بخش ۲۴)
  bbox: { north: number; south: number; east: number; west: number } | null;
  sort: SearchSort;
  page: number;
  limit: number;
}

/**
 * Structured Query Object قابل‌سریال‌سازی — همان چیزی که در آینده Saved Search (بخش ۳۷)
 * می‌تواند مستقیماً ذخیره و دوباره به SearchFilters تبدیل شود (بدون منطق اضافه در این فاز).
 */
export type SearchQueryObject = Omit<SearchFilters, "page" | "limit">;

export interface SearchResultItem {
  id: number;
  slug: string;
  title: string;
  category: { id: number; name: string; slug: string };
  transactionType: string;
  price: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  area: number | null;
  bedrooms: number | null;
  location: {
    district: string | null;
    marketZone: string | null;
    neighborhood: string | null;
    lat: number | null;
    lng: number | null;
  };
  primaryImage: string | null;
  publishedAt: string | null;
  isVip: boolean;
  publisher: {
    consultantName: string | null;
    consultantSlug: string | null;
    agencyName: string | null;
    agencySlug: string | null;
  };
}

export interface SearchResponse {
  items: SearchResultItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}
