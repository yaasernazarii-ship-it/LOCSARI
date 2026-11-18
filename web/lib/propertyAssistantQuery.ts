// نیازسنجی هوشمند — تبدیل جملهٔ کوتاه فارسی به فیلتر ساختاریافته.
//
// اصل طراحی: این ماژول کاملاً مستقل از مسیر قبلی است و هیچ تابع موجودی را تغییر نمی‌دهد.
// Route Handler آن را داخل try/catch صدا می‌زند و در صورت هر خطایی به رفتار قبلی برمی‌گردد؛
// بنابراین حتی اگر پارسر جدید روی ورودی عجیبی شکست بخورد، کاربر همان نتیجهٔ امروز را می‌بیند.

import { sql } from "kysely";
import { db } from "@/lib/db";
import { cached } from "@/lib/cache";
import { runSearch } from "@/lib/search/query";
import type { SearchFilters, SearchResultItem } from "@/lib/search/types";

export type AssistantIntent = {
  dealTypes: string[]; // slugهای دقیق transaction_type که در دیتابیس استفاده می‌شوند
  categorySlugs: string[]; // دسته‌بندی‌های نامزد، به ترتیب اولویت
  neighborhoodId: number | null;
  neighborhoodName: string | null;
  minPrice: number | null; // تومان
  maxPrice: number | null;
  minDeposit: number | null;
  maxDeposit: number | null;
  minRent: number | null;
  maxRent: number | null;
  minArea: number | null;
  maxArea: number | null;
  bedrooms: number | null;
  attrs: Record<string, boolean>; // field key -> مقدار (true/false)
  keyword: string | null; // کلیدواژهٔ نوع ملک برای جست‌وجوی متنی (مثلاً «مغازه»)
  freeText: string | null;
  fullMortgage: boolean;
  summary: string;
};

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[٬،,]/g, "")
    .replace(/٫/g, ".");
}

/** نرمال‌سازی متنی: یکسان‌سازی ی/ک، حذف نیم‌فاصله و فاصله‌های اضافی. */
function normalize(value: string): string {
  return toLatinDigits(value)
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌‏‎ـ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** نسخهٔ فشرده برای تطبیق نام محله/کلمه کلیدی (بدون فاصله). */
function compact(value: string): string {
  return normalize(value).replace(/[\s\-_]/g, "").replace(/^(محله|شهرک|بلوار|خیابان|میدان|کوی|منطقه|پارک)/, "");
}

// ---------------------------------------------------------------------------
// مقیاس مبلغ
// ---------------------------------------------------------------------------

/**
 * آگهی‌های موجود بخشی «تومان کامل» و بخشی «میلیون تومان» ذخیره شده‌اند.
 * به‌جای فرض ثابت، مقیاس غالب از دادهٔ واقعی خوانده می‌شود تا فیلتر قیمت
 * به‌جای صفر نتیجه دادن، با داده هم‌خوان بماند. در صورت شکست، مقیاس ۱ (تومان) در نظر گرفته می‌شود.
 */
async function storedAmountDivisor(): Promise<number> {
  try {
    return await cached("assistant:amount-divisor", 10 * 60_000, async () => {
      const row = await sql<{ median: string | null }>`
        select percentile_cont(0.5) within group (order by price)::text as median
        from advertisements
        where status = 'published' and price is not null and price > 0
      `.execute(db);
      const median = Number(row.rows[0]?.median ?? 0);
      if (!Number.isFinite(median) || median <= 0) return 1;
      return median < 100_000 ? 1_000_000 : 1;
    });
  } catch {
    return 1;
  }
}

// ---------------------------------------------------------------------------
// استخراج مبلغ / متراژ / خواب
// ---------------------------------------------------------------------------

const UNIT_MULTIPLIER: Record<string, number> = {
  "میلیارد": 1_000_000_000,
  "میلیون": 1_000_000,
  "هزار": 1_000,
};

type AmountMatch = { value: number; start: number; end: number };

/** همهٔ مبالغ یک متن را با واحدشان استخراج می‌کند. عدد بدون واحد و کوچک نامعتبر است. */
function extractAmounts(text: string): AmountMatch[] {
  const matches: AmountMatch[] = [];
  const regex = /(\d+(?:[./]\d+)?)\s*(میلیارد|میلیون|هزار|تومان|تومن)?/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const raw = Number(match[1].replace("/", "."));
    if (!Number.isFinite(raw) || raw <= 0) continue;
    const unit = match[2];
    let value: number;
    if (unit && UNIT_MULTIPLIER[unit]) value = Math.round(raw * UNIT_MULTIPLIER[unit]);
    else if (!unit && raw >= 1_000_000) value = raw; // عدد بزرگ بدون واحد = تومان
    else continue; // عدد کوچک بدون واحد (مثل «۲ خواب») مبلغ نیست
    matches.push({ value, start: match.index, end: match.index + match[0].length });
  }
  return matches;
}

function contextBefore(text: string, index: number, length = 24): string {
  return text.slice(Math.max(0, index - length), index);
}

/** آیا متن مبلغ مشخصی (میلیارد/میلیون/عدد بزرگ) دارد؟ */
function amountsDeclared(text: string): boolean {
  return extractAmounts(text).length > 0;
}

type Range = { min: number | null; max: number | null };

/** تعیین کف/سقف از روی مبالغ و کلمات پیرامونشان («تا»، «بین … تا …»، «حداقل»…). */
function inferRange(text: string, amounts: AmountMatch[]): Range {
  if (amounts.length === 0) return { min: null, max: null };
  if (amounts.length >= 2) {
    const [first, second] = amounts;
    const between = /بین|از|مابین/.test(contextBefore(text, first.start, 16)) || /تا|الی|-/.test(text.slice(first.end, second.start + 4));
    if (between && first.value <= second.value) return { min: first.value, max: second.value };
  }
  const first = amounts[0];
  const before = contextBefore(text, first.start);
  if (/تا|حداکثر|کمتر از|زیر|پایین‌تر/.test(before)) return { min: null, max: first.value };
  if (/حداقل|بالای|بیشتر از|از\s*$/.test(before)) return { min: first.value, max: null };
  // «۴ میلیارد» تنها، در عرف بازار به‌معنی سقف بودجه است.
  return { min: null, max: first.value };
}

function extractArea(text: string): Range {
  const between = text.match(/بین\s*(\d+)\s*متر\s*(?:تا|الی|-)\s*(\d+)\s*متر/);
  if (between) {
    const a = Number(between[1]);
    const b = Number(between[2]);
    if (a > 0 && b > 0) return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const labeled = text.match(/(?:متراژ|مساحت|زیربنا)\s*(?:حدود)?\s*(\d+)/);
  if (labeled) {
    const value = Number(labeled[1]);
    if (Number.isFinite(value) && value > 0) return { min: value, max: value };
  }
  const exact = text.match(/(\d+)\s*متر(?:\s*مربع|\s*متری)?/);
  if (!exact) return { min: null, max: null };
  const value = Number(exact[1]);
  if (!Number.isFinite(value) || value <= 0) return { min: null, max: null };
  const before = contextBefore(text, exact.index ?? 0);
  if (/تا|حداکثر|زیر|کمتر از/.test(before)) return { min: null, max: value };
  if (/از|حداقل|بالای|بیشتر از/.test(before)) return { min: value, max: null };
  return { min: value, max: value };
}

function extractBedrooms(text: string): number | null {
  const words: Record<string, number> = { یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6 };
  const numeric = text.match(/(\d+)\s*(?:خوابه|خواب|اتاق)/);
  if (numeric) {
    const value = Number(numeric[1]);
    return value > 0 && value <= 10 ? value : null;
  }
  const word = text.match(/(یک|دو|سه|چهار|پنج|شش)\s*(?:خوابه|خواب|اتاق)/);
  return word ? words[word[1]] : null;
}

// ---------------------------------------------------------------------------
// واژگان
// ---------------------------------------------------------------------------

const SALE_PATTERN = /خرید|فروش|قیمت|بودجه|نقدی|آزاد/;
const RENT_PATTERN = /رهن|اجاره|ودیعه|ماهانه|کرایه|پول پیش|پیش پرداخت|وصل/;
const SHORT_TERM_PATTERN = /کوتاه ?مدت|روزانه|شبانه|شبی|اقامت|سوئیت/;
const PRESALE_PATTERN = /پیش ?فروش|مشارکت در ساخت|ساخت مشارکتی/;
const FULL_MORTGAGE_PATTERN = /رهن کامل|فول رهن|رهن بدون اجاره/;

type KindRule = { kind: string; pattern: RegExp; slugFragment: string };

// ترتیب مهم است: خاص‌تر اول.
const KIND_RULES: KindRule[] = [
  { kind: "suite", pattern: /سوئیت|اقامتگاه|کلبه|شبی|شبانه|روزانه/, slugFragment: "ejare-kutahmoddat" },
  { kind: "presale", pattern: /پیش ?فروش|مشارکت/, slugFragment: "pishforosh" },
  { kind: "commercial", pattern: /مغازه|تجاری|اداری|صنعتی|دفتر|انبار|سوله|کارگاه|ویترین|بازار/, slugFragment: "edari-tejari-sanati" },
  { kind: "land", pattern: /زمین|باغ|باغچه|قطعه/, slugFragment: "zamin-bagh" },
  { kind: "villa", pattern: /ویلا|ویلایی|خانه ?ویلایی/, slugFragment: "vila" },
  { kind: "apartment", pattern: /آپارتمان|اپارتمان|خانه|منزل|واحد|مسکونی|برج/, slugFragment: "khane-apartman" },
];

// ویژگی‌های بولین → کلید فیلد در category_fields
const BOOLEAN_FEATURES: { key: string; pattern: RegExp }[] = [
  { key: "estakhr", pattern: /استخر/ },
  { key: "jacuzzi", pattern: /جکوزی/ },
  { key: "parking", pattern: /پارکینگ|پارک ماشین|پارک\b/ },
  { key: "asansor", pattern: /آسانسور|اسانسور/ },
  { key: "anbari", pattern: /انباری|انبار خانه/ },
  { key: "balkon", pattern: /بالکن|تراس/ },
  { key: "lobby", pattern: /لابی/ },
  { key: "negahbani", pattern: /نگهبان|سرایدار/ },
  { key: "hayat", pattern: /حیاط/ },
  { key: "furnished", pattern: /مبله|اثاثیه/ },
  { key: "ab", pattern: /(^|\s)آب(\s|$)/ },
  { key: "bargh", pattern: /برق/ },
  { key: "gaz", pattern: /گاز/ },
  { key: "divarkeshi", pattern: /دیوارکشی|دیوار کشی/ },
  { key: "bar_khiaban", pattern: /بر خیابان|برخیابان|بر زمین/ },
];

const DEAL_SLUG_PREFIX: Record<string, string> = {
  sale: "kharid-forosh-",
  mortgage_rent: "rahn-ejare-",
  short_term_rent: "ejare-kutahmoddat-",
  pre_sale: "pishforosh-",
  partnership: "pishforosh-",
};

// زیرنوع‌های مشخص که با فیلتر دسته‌بندی تنها قابل تفکیک نیستند و باید در متن آگهی هم جست‌وجو شوند.
const SUBTYPE_KEYWORDS: { pattern: RegExp; keyword: string }[] = [
  { pattern: /مغازه|ویترین/, keyword: "مغازه" },
  { pattern: /دفتر/, keyword: "دفتر" },
  { pattern: /انبار/, keyword: "انبار" },
  { pattern: /سوله|کارگاه|صنعتی/, keyword: "سوله" },
  { pattern: /سوئیت/, keyword: "سوئیت" },
  { pattern: /کلبه/, keyword: "کلبه" },
  { pattern: /باغ/, keyword: "باغ" },
];

// ---------------------------------------------------------------------------
// پارس اصلی
// ---------------------------------------------------------------------------

type CategoryRow = { id: number; slug: string; name: string };

async function loadCategories(): Promise<CategoryRow[]> {
  return cached("assistant:categories", 5 * 60_000, async () => {
    return db.selectFrom("categories").select(["id", "slug", "name"]).where("is_active", "=", true).execute() as Promise<CategoryRow[]>;
  });
}

async function loadNeighborhoods(): Promise<{ id: number; name: string }[]> {
  return cached("assistant:neighborhoods", 5 * 60_000, async () => {
    return db.selectFrom("neighborhoods").select(["id", "name"]).where("is_active", "=", true).execute();
  });
}

async function loadBooleanFieldKeys(): Promise<Set<string>> {
  return cached("assistant:boolean-fields", 10 * 60_000, async () => {
    const rows = await db.selectFrom("category_fields").select(["key"]).where("field_type", "=", "boolean").where("is_active", "=", true).execute();
    return new Set(rows.map((r) => r.key));
  });
}

export async function parseAssistantQuery(queryText: string): Promise<AssistantIntent> {
  const text = normalize(queryText);
  const [categories, neighborhoods, booleanKeys] = await Promise.all([loadCategories(), loadNeighborhoods(), loadBooleanFieldKeys()]);

  // --- نوع معامله ---
  const dealTypes: string[] = [];
  if (SHORT_TERM_PATTERN.test(text)) dealTypes.push("short_term_rent");
  else if (PRESALE_PATTERN.test(text) && !RENT_PATTERN.test(text)) dealTypes.push("pre_sale", "partnership");
  else if (FULL_MORTGAGE_PATTERN.test(text)) dealTypes.push("mortgage_rent");
  else if (RENT_PATTERN.test(text) && !SALE_PATTERN.test(text)) dealTypes.push("mortgage_rent", "rent");
  else if (SALE_PATTERN.test(text) && !RENT_PATTERN.test(text)) dealTypes.push("sale");
  // «آپارتمان دو خوابه تا ۴ میلیارد»: مبلغ ذکرشده بدون نشانهٔ اجاره، در عرف بازار یعنی خرید.
  else if (amountsDeclared(text) && !FULL_MORTGAGE_PATTERN.test(text)) dealTypes.push("sale");

  // --- دسته‌بندی نامزد ---
  const kindRule = KIND_RULES.find((rule) => rule.pattern.test(text));
  let categorySlugs: string[] = [];
  if (kindRule) {
    if (dealTypes.length > 0) {
      for (const dealType of dealTypes) {
        const prefix = DEAL_SLUG_PREFIX[dealType];
        if (!prefix) continue;
        const candidate = categories.find((c) => c.slug.startsWith(prefix) && c.slug.includes(kindRule.slugFragment));
        if (candidate) categorySlugs.push(candidate.slug);
      }
    }
    if (categorySlugs.length === 0) {
      // نوع معامله مشخص نیست: همهٔ دسته‌های این نوع ملک، هم خرید و هم اجاره.
      categorySlugs = categories
        .filter((c) => c.slug.includes(kindRule.slugFragment) && !categorySlugs.includes(c.slug))
        .map((c) => c.slug);
    }
  } else if (dealTypes.length > 0) {
    categorySlugs = categories.filter((c) => DEAL_SLUG_PREFIX[dealTypes[0]] && c.slug.startsWith(DEAL_SLUG_PREFIX[dealTypes[0]])).map((c) => c.slug);
  }
  categorySlugs = [...new Set(categorySlugs)].slice(0, 3);

  // --- محله (تطبیق مقاوم) ---
  const compactText = compact(text);
  let neighborhood: { id: number; name: string } | null = null;
  for (const item of neighborhoods) {
    const name = compact(item.name);
    if (name.length < 3) continue;
    if (compactText.includes(name) || (name.includes(compactText) && compactText.length >= 3)) {
      neighborhood = item;
      break;
    }
  }

  // --- مبالغ ---
  const amounts = extractAmounts(text);
  const fullMortgage = FULL_MORTGAGE_PATTERN.test(text);
  const isRent = dealTypes.some((t) => t === "mortgage_rent" || t === "rent" || t === "short_term_rent");
  let priceRange: Range = { min: null, max: null };
  let depositRange: Range = { min: null, max: null };
  let rentRange: Range = { min: null, max: null };

  if (amounts.length > 0) {
    if (isRent) {
      const depositAmounts = amounts.filter((a) => /ودیعه|رهن|پیش/.test(contextBefore(text, a.start, 20)));
      const rentAmounts = amounts.filter((a) => /اجاره|ماهانه|کرایه/.test(contextBefore(text, a.start, 20)));
      if (depositAmounts.length > 0) depositRange = inferRange(text, depositAmounts);
      if (rentAmounts.length > 0) rentRange = inferRange(text, rentAmounts);
      // مبلغی که برچسب رهن/اجاره ندارد: اگر رهن کامل باشد ودیعه، وگرنه برای هر دو محدودیت سقف اعمال می‌شود.
      if (depositAmounts.length === 0 && rentAmounts.length === 0) {
        const only = inferRange(text, amounts);
        if (fullMortgage) depositRange = only;
        else {
          depositRange = { min: null, max: only.max };
          rentRange = { min: null, max: only.max };
        }
      } else if (fullMortgage) {
        rentRange = { min: null, max: null };
      }
    } else {
      priceRange = inferRange(text, amounts);
    }
  }

  // «رهن کامل» با فیلتر SQL سقفِ صفر قابل بیان نیست (آگهی‌های بدون اجاره NULL دارند)؛
  // در جست‌وجو اعمال نمی‌شود و بعد از واکشی در runOnce فیلتر می‌گردد.
  if (fullMortgage) rentRange = { min: null, max: null };

  // --- متراژ و خواب ---
  const area = extractArea(text);
  const bedrooms = extractBedrooms(text);

  // --- ویژگی‌ها (با پشتیبانی از «بدون») ---
  const attrs: Record<string, boolean> = {};
  const featureWords: string[] = [];
  for (const feature of BOOLEAN_FEATURES) {
    if (!booleanKeys.has(feature.key)) continue;
    const match = feature.pattern.exec(text);
    if (!match) continue;
    const negated = /بدون|ندارد|نباید/.test(contextBefore(text, match.index, 12));
    attrs[feature.key] = !negated;
    if (!negated) featureWords.push(match[0].trim());
  }

  // --- متن آزاد: فقط وقتی هیچ محدودیت ساختاریافته‌ای پیدا نشد ---
  // ترتیب: متن کامل → زیرنوع (مثلاً مغازه) → ویژگی‌های ذکرشده (مثلاً استخر)، تا عبارت‌هایی که
  // فیلد ساختاریافته ندارند در عنوان/توضیحات آگهی هم جست‌وجو شوند.
  const hasStructured = categorySlugs.length > 0 || dealTypes.length > 0 || neighborhood !== null || amounts.length > 0 || area.min !== null || area.max !== null || bedrooms !== null;
  const freeText = hasStructured ? null : (text.length > 0 ? text.slice(0, 120) : null);
  const keyword = freeText
    ? null
    : (SUBTYPE_KEYWORDS.find((item) => item.pattern.test(text))?.keyword ?? (featureWords.length > 0 ? featureWords.join(" ") : null));

  return {
    dealTypes,
    categorySlugs,
    neighborhoodId: neighborhood?.id ?? null,
    neighborhoodName: neighborhood?.name ?? null,
    minPrice: priceRange.min,
    maxPrice: priceRange.max,
    minDeposit: depositRange.min,
    maxDeposit: depositRange.max,
    minRent: rentRange.min,
    maxRent: rentRange.max,
    minArea: area.min,
    maxArea: area.max,
    bedrooms,
    attrs,
    keyword,
    freeText,
    fullMortgage,
    summary: buildSummary({ dealTypes, categorySlugs, neighborhoodName: neighborhood?.name ?? null, priceRange, depositRange, rentRange, area, bedrooms, attrs, fullMortgage, isRent }),
  };
}

function toman(value: number): string {
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(value) + " تومان";
}

function buildSummary(intent: {
  dealTypes: string[];
  categorySlugs: string[];
  neighborhoodName: string | null;
  priceRange: Range;
  depositRange: Range;
  rentRange: Range;
  area: Range;
  bedrooms: number | null;
  attrs: Record<string, boolean>;
  fullMortgage: boolean;
  isRent: boolean;
}): string {
  const parts: string[] = [];
  const dealLabel: Record<string, string> = {
    sale: "خرید",
    mortgage_rent: "رهن و اجاره",
    rent: "اجاره",
    short_term_rent: "اجارهٔ کوتاه‌مدت",
    pre_sale: "پیش‌فروش",
    partnership: "مشارکت در ساخت",
  };
  const kindLabel: Record<string, string> = {
    "ejare-kutahmoddat": "ویلا و سوئیت",
    "vila": "ویلا",
    "khane-apartman": "خانه و آپارتمان",
    "zamin-bagh": "زمین و باغ",
    "edari-tejari-sanati": "ملک اداری/تجاری",
    "pishforosh": "پیش‌فروش و مشارکت",
  };
  const deal = intent.dealTypes.map((t) => dealLabel[t]).filter(Boolean)[0];
  if (deal) parts.push(deal);
  if (intent.categorySlugs[0]) {
    // ترتیب کلیدها عمداً از خاص‌تر به عام‌تر است (مثلاً ejare-kutahmoddat-vila-suite نباید «ویلا» برچسب بخورد).
    const key = Object.keys(kindLabel).find((k) => intent.categorySlugs[0].includes(k));
    if (key) parts.push(kindLabel[key]);
  }
  if (intent.bedrooms) parts.push(`${intent.bedrooms.toLocaleString("fa-IR")} خواب`);
  if (intent.neighborhoodName) parts.push(`محلهٔ ${intent.neighborhoodName}`);
  if (intent.area.min !== null && intent.area.max === intent.area.min) parts.push(`${intent.area.min.toLocaleString("fa-IR")} متر`);
  else if (intent.area.min !== null && intent.area.max !== null) parts.push(`${intent.area.min.toLocaleString("fa-IR")} تا ${intent.area.max.toLocaleString("fa-IR")} متر`);
  else if (intent.area.max !== null) parts.push(`حداکثر ${intent.area.max.toLocaleString("fa-IR")} متر`);
  else if (intent.area.min !== null) parts.push(`حداقل ${intent.area.min.toLocaleString("fa-IR")} متر`);
  if (!intent.isRent && intent.priceRange.max !== null) parts.push(`تا ${toman(intent.priceRange.max)}`);
  if (intent.isRent) {
    if (intent.fullMortgage) parts.push("رهن کامل");
    if (intent.depositRange.max !== null) parts.push(`ودیعه تا ${toman(intent.depositRange.max)}`);
    if (intent.rentRange.max !== null && intent.rentRange.max > 0) parts.push(`اجاره تا ${toman(intent.rentRange.max)}`);
  }
  const featureLabel: Record<string, string> = { estakhr: "استخر", parking: "پارکینگ", asansor: "آسانسور", anbari: "انباری", balkon: "بالکن", lobby: "لابی", negahbani: "نگهبانی", hayat: "حیاط", jacuzzi: "جکوزی", furnished: "مبله" };
  for (const [key, value] of Object.entries(intent.attrs)) {
    if (!featureLabel[key]) continue;
    parts.push(value ? `با ${featureLabel[key]}` : `بدون ${featureLabel[key]}`);
  }
  return parts.join("، ");
}

// ---------------------------------------------------------------------------
// جست‌وجو
// ---------------------------------------------------------------------------

export type AssistantResult = {
  id: number;
  slug: string;
  title: string;
  primary_image: string | null;
  transaction_type: string;
  price: string | null;
  deposit: string | null;
  monthly_rent: string | null;
  area: number | null;
};

function baseFilters(): SearchFilters {
  return {
    q: null, categoryId: null, subcategoryId: null, transactionType: null,
    districtId: null, marketZoneId: null, neighborhoodId: null,
    minPrice: null, maxPrice: null, minDeposit: null, maxDeposit: null,
    minMonthlyRent: null, maxMonthlyRent: null,
    minArea: null, maxArea: null, bedrooms: null,
    builtYear: null, floor: null, totalFloors: null,
    agencyId: null, consultantId: null, attrs: {},
    bbox: null, sort: "newest", page: 1, limit: 12,
  };
}

function resolveCategoryIds(slugs: string[], categories: CategoryRow[]): number[] {
  return slugs.map((slug) => categories.find((c) => c.slug === slug)?.id).filter((id): id is number => typeof id === "number");
}

async function fieldKeysForCategories(categoryIds: number[]): Promise<Map<number, Set<string>>> {
  const map = new Map<number, Set<string>>();
  if (categoryIds.length === 0) return map;
  const rows = await db
    .selectFrom("category_fields")
    .select(["category_id", "key"])
    .where("category_id", "in", categoryIds)
    .where("field_type", "=", "boolean")
    .where("is_active", "=", true)
    .execute();
  for (const row of rows) {
    if (!map.has(row.category_id)) map.set(row.category_id, new Set());
    map.get(row.category_id)!.add(row.key);
  }
  return map;
}

/**
 * یک اجرای جست‌وجو در سطح سخت‌گیری مشخص.
 * 0 = دقیق، 1 = بازترکردن عددی (قیمت/متراژ)، 2 = نرم‌ترین حالت (حذف محله/ویژگی/کلیدواژه).
 * هیچ پارامتری از این تابع تغییر نمی‌کند که روی سایر بخش‌های سایت اثر بگذارد؛ فقط فیلترهای همین درخواست.
 */
async function runOnce(intent: AssistantIntent, categoryId: number | null, attrs: Record<string, string>, level: 0 | 1 | 2): Promise<SearchResultItem[]> {
  const divisor = await storedAmountDivisor();
  const convert = (value: number | null) => (value === null ? null : Math.round(value / divisor));
  const widen = (value: number | null, ratio: number) => (value === null ? null : Math.round(value * ratio));
  const filters = baseFilters();
  filters.categoryId = categoryId;
  filters.transactionType = intent.dealTypes.length === 1 ? intent.dealTypes[0] : null;
  filters.minPrice = convert(intent.minPrice);
  filters.maxPrice = convert(intent.maxPrice);
  filters.minDeposit = convert(intent.minDeposit);
  filters.maxDeposit = convert(intent.maxDeposit);
  filters.minMonthlyRent = convert(intent.minRent);
  filters.maxMonthlyRent = convert(intent.maxRent);

  if (level === 0) {
    filters.neighborhoodId = intent.neighborhoodId;
    filters.minArea = intent.minArea;
    filters.maxArea = intent.maxArea;
    filters.bedrooms = intent.bedrooms;
    filters.attrs = attrs;
    filters.q = intent.freeText ?? intent.keyword;
  } else if (level === 1) {
    filters.neighborhoodId = intent.neighborhoodId;
    filters.minArea = intent.minArea === null ? null : Math.max(0, Math.floor(intent.minArea * 0.8));
    filters.maxArea = intent.maxArea === null ? null : Math.ceil(intent.maxArea * 1.2);
    filters.bedrooms = null;
    filters.maxPrice = widen(intent.maxPrice, 1.25);
    filters.maxDeposit = widen(intent.maxDeposit, 1.25);
    filters.maxMonthlyRent = widen(intent.maxRent, 1.25);
    filters.attrs = attrs;
    filters.q = intent.freeText ?? intent.keyword;
  } else {
    filters.neighborhoodId = null;
    filters.minArea = null;
    filters.maxArea = null;
    filters.bedrooms = null;
    filters.minPrice = null;
    filters.maxPrice = widen(intent.maxPrice, 1.5);
    filters.maxDeposit = widen(intent.maxDeposit, 1.5);
    filters.maxMonthlyRent = widen(intent.maxRent, 1.5);
    filters.attrs = {};
    filters.q = intent.freeText ?? null;
  }

  const outcome = await runSearch(filters);
  if (!outcome.ok) return [];
  // «رهن کامل» = بدون اجارهٔ ماهانه. چون این شرط با NULL نیاز به OR دارد و موتور جست‌وجو آن را پشتیبانی
  // نمی‌کند، بعد از واکشی اعمال می‌شود؛ در نرم‌ترین سطح کنار گذاشته می‌شود تا نتیجه خالی نماند.
  if (intent.fullMortgage && level < 2) {
    const strict = outcome.data.items.filter((item) => item.monthlyRent === null || item.monthlyRent === 0);
    if (strict.length > 0) return strict;
  }
  return outcome.data.items;
}

function dedupe(items: SearchResultItem[]): SearchResultItem[] {
  const seen = new Set<number>();
  const out: SearchResultItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/**
 * اجرای جست‌وجوی نیازسنجی. هیچ خطایی به بیرون پرتاب نمی‌شود؛ خروجی همیشه آرایه است.
 * ابتدا جست‌وجوی دقیق، و اگر نتیجه‌ای نبود یک بار با فیلترهای نرم‌تر.
 */
export async function searchAssistant(intent: AssistantIntent): Promise<{ items: AssistantResult[]; relaxed: boolean }> {
  try {
    const categories = await loadCategories();
    const categoryIds = resolveCategoryIds(intent.categorySlugs, categories);
    const fieldMap = await fieldKeysForCategories(categoryIds);

    const attrsFor = (categoryId: number | null) => {
      if (categoryId === null) return {};
      const allowed = fieldMap.get(categoryId);
      if (!allowed) return {};
      const chosen: Record<string, string> = {};
      for (const [key, value] of Object.entries(intent.attrs)) {
        if (allowed.has(key)) chosen[key] = String(value);
      }
      return chosen;
    };

    // سه سطح تلاش: دقیق → بازترکردن عددی → نرم‌ترین حالت. اولین سطحی که نتیجه بدهد برگردانده می‌شود.
    const targets: (number | null)[] = categoryIds.length > 0 ? categoryIds : [null];
    const mapItem = (item: SearchResultItem): AssistantResult => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      primary_image: item.primaryImage,
      transaction_type: item.transactionType,
      price: item.price === null ? null : String(item.price),
      deposit: item.deposit === null ? null : String(item.deposit),
      monthly_rent: item.monthlyRent === null ? null : String(item.monthlyRent),
      area: item.area,
    });

    for (const level of [0, 1, 2] as const) {
      const collected: SearchResultItem[] = [];
      for (const categoryId of targets.slice(0, 2)) {
        collected.push(...(await runOnce(intent, categoryId, attrsFor(categoryId), level)));
      }
      const items = dedupe(collected).map(mapItem).slice(0, 12);
      if (items.length > 0) return { items, relaxed: level > 0 };
    }
    return { items: [], relaxed: false };
  } catch (error) {
    console.error("assistant search failed", error);
    return { items: [], relaxed: false };
  }
}
