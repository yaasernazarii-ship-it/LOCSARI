"use client";

// فرم ثبت/ویرایش ملک و آگهی (بخش «Advertisement Form» فاز ۵) — بر پایهٔ contract دقیق APIهای فاز ۳:
// properties POST/PATCH، advertisements POST/PATCH، properties/:id/media، categories/:id/fields.
// حالت create: ویزارد سه‌مرحله‌ای (ملک -> تصاویر -> آگهی). حالت edit: همهٔ بخش‌ها در یک صفحه.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TRANSACTION_TYPE_LABELS, RENT_BASED_TRANSACTION_TYPES, ADVERTISEMENT_STATUS_LABELS } from "@/lib/labels";
import { TransactionType } from "@/lib/validation";
import LocationPicker from "@/components/LocationPicker";

const CATEGORY_TRANSACTION_TYPES: Record<string, TransactionType> = {
  "kharid-forosh-vila": "sale",
  "rahn-ejare-khane-apartman": "rent",
  "kharid-forosh-khane-apartman": "sale",
  "ejare-kutahmoddat-vila-suite": "short_term_rent",
  "rahn-ejare-edari-tejari-sanati": "rent",
  "kharid-forosh-edari-tejari-sanati": "sale",
  "zamin-bagh": "sale",
  "pishforosh-mosharekat-sakht": "pre_sale",
  "saeer-amlak": "sale",
};
const MAX_PROPERTY_IMAGES = 20;
const CURRENT_PERSIAN_YEAR = Number(
  new Intl.DateTimeFormat("en-US-u-ca-persian", { year: "numeric" }).formatToParts(new Date()).find((part) => part.type === "year")?.value
);

function normalizePersian(value: string): string {
  return value.replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[إأآ]/g, "ا").replace(/ة/g, "ه").toLocaleLowerCase("fa-IR");
}

function formatPersianInteger(value: number): string {
  return String(Math.trunc(value)).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

const PERSIAN_ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const PERSIAN_TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const PERSIAN_TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const PERSIAN_HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const PERSIAN_SCALES = ["", "هزار", "میلیون", "میلیارد", "تریلیون"];
function threeDigitWords(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (hundreds) parts.push(PERSIAN_HUNDREDS[hundreds]);
  if (rest >= 10 && rest < 20) parts.push(PERSIAN_TEENS[rest - 10]);
  else {
    if (rest >= 20) parts.push(PERSIAN_TENS[Math.floor(rest / 10)]);
    if (rest % 10) parts.push(PERSIAN_ONES[rest % 10]);
  }
  return parts.join(" و ");
}
function measurementInWords(raw: string): string {
  const value = numOrNull(raw);
  if (value === null || value < 0) return "";
  const [integer, fraction] = value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "").split(".");
  let n = Number(integer);
  const parts: string[] = [];
  let scale = 0;
  while (n > 0) {
    const group = n % 1000;
    if (group) parts.unshift(`${threeDigitWords(group)}${PERSIAN_SCALES[scale] ? ` ${PERSIAN_SCALES[scale]}` : ""}`);
    n = Math.floor(n / 1000);
    scale++;
  }
  const result = parts.join(" و ") || "صفر";
  return fraction ? `${result} ممیز ${threeDigitWords(Number(fraction))}` : result;
}

function tomanInWords(raw: string): string {
  const value = numOrNull(raw);
  if (value === null || value < 0) return "";
  const [integer, fraction] = value.toFixed(2).replace(/0+$/, "").replace(/\\.$/, "").split(".");
  let n = Number(integer);
  const parts: string[] = [];
  let scale = 0;
  while (n > 0) {
    const group = n % 1000;
    if (group) parts.unshift(`${threeDigitWords(group)}${PERSIAN_SCALES[scale] ? ` ${PERSIAN_SCALES[scale]}` : ""}`);
    n = Math.floor(n / 1000);
    scale++;
  }
  const result = parts.join(" و ") || "صفر";
  return fraction ? `${result} تومان و ${threeDigitWords(Number(fraction))} صدم تومان` : `${result} تومان`;
}
const LOCATION_PRECISIONS = [
  { value: "approximate", label: "تقریبی (پیش‌فرض)" },
  { value: "exact", label: "دقیق" },
  { value: "neighborhood_only", label: "فقط سطح محله" },
];

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
}
interface SimpleLocation {
  id: number;
  name: string;
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
  is_required: boolean;
  options: FieldOption[];
}
interface MediaItem {
  id: number;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  mimeType: string;
}

function isVideoMime(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

interface BaseForm {
  categoryId: string;
  subcategoryId: string;
  neighborhoodId: string;
  title: string;
  description: string;
  area: string;
  builtArea: string;
  bedrooms: string;
  builtYear: string;
  floor: string;
  locationPrecision: string;
  latitude: number | null;
  longitude: number | null;
}

interface AdInfoForm {
  transactionType: string;
  price: string;
  deposit: string;
  monthlyRent: string;
  durationDays: string;
  adType: "free" | "vip" | "cip";
  vipVideoUrl: string;
}

function emptyBaseForm(): BaseForm {
  return {
    categoryId: "",
    subcategoryId: "",
    neighborhoodId: "",
    title: "",
    description: "",
    area: "",
    builtArea: "",
    bedrooms: "",
    builtYear: "",
    floor: "",
    locationPrecision: "approximate",
    latitude: null,
    longitude: null,
  };
}

function emptyAdForm(): AdInfoForm {
  return { transactionType: "", price: "", deposit: "", monthlyRent: "", durationDays: "30", adType: "free", vipVideoUrl: "" };
}

function isDuplicateBaseField(field: CategoryField): boolean {
  return field.key === "sale_sakht" || field.key === "built_year";
}

function formatPriceWithSlashes(value: string): string {
  const digits = value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/\D/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, "/");
}

function priceDisplayValue(value: unknown): string {
  return value === null || value === undefined ? "" : formatPriceWithSlashes(String(Math.trunc(Number(value))));
}

function priceOrNull(value: string): number | null {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

function numOrNull(s: string): number | null {
  const normalized = s.trim().replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  if (!normalized) return null;

  const separators = [...normalized.matchAll(/[./٫،٬]/g)];
  const lastSeparator = separators.at(-1);
  const decimalIndex =
    lastSeparator && normalized.length - lastSeparator.index! - 1 <= 2 ? lastSeparator.index! : -1;
  const integerPart = normalized.slice(0, decimalIndex === -1 ? normalized.length : decimalIndex).replace(/[./٫،٬]/g, "");
  const fractionPart = decimalIndex === -1 ? "" : normalized.slice(decimalIndex + 1);
  if (!/^\d+$/.test(integerPart) || (fractionPart && !/^\d{1,2}$/.test(fractionPart))) return null;

  const value = Number(fractionPart ? `${integerPart}.${fractionPart}` : integerPart);
  return Number.isFinite(value) ? value : null;
}

type AttrValue = string | string[];
type Props = ({ mode: "create" } | { mode: "edit"; advertisementId: number }) & { adminMode?: boolean; cipPlanId?: number };

export default function PropertyAdForm(props: Props) {
  const router = useRouter();

  // ---- داده‌های مرجع ----
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<SimpleLocation[]>([]);
  const [cityId, setCityId] = useState<number | null>(null);
  const [fields, setFields] = useState<CategoryField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);

  // ---- state فرم ----
  const [base, setBase] = useState<BaseForm>(emptyBaseForm());
  const [attrs, setAttrs] = useState<Record<number, AttrValue>>({});
  const [adForm, setAdForm] = useState<AdInfoForm>(emptyAdForm());
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [advertisementId, setAdvertisementId] = useState<number | null>(props.mode === "edit" ? props.advertisementId : null);
  const [adStatus, setAdStatus] = useState<string | null>(null);

  const [loading, setLoading] = useState(props.mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [suggestedDescription, setSuggestedDescription] = useState("");

  // ---- انتساب مشاور (فاز ۶، بخش ۱۵) — چک‌باکس فقط برای مشاورِ approved+active نمایش داده می‌شود ----
  const [isApprovedConsultant, setIsApprovedConsultant] = useState(false);
  const [attributeAsConsultant, setAttributeAsConsultant] = useState(false);

  useEffect(() => {
    fetch("/api/account/consultant")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.consultant?.verification_status === "approved" && d.consultant.is_active) {
          setIsApprovedConsultant(true);
          setAttributeAsConsultant(true);
        }
      })
      .catch(() => {});
  }, []);

  // ---- نوع آگهی (رایگان/VIP) — کاربر عادی فقط با اشتراک VIP فعال می‌تواند VIP انتخاب کند؛ ادمین بدون محدودیت ----
  const [hasActiveVipSubscription, setHasActiveVipSubscription] = useState(false);
  useEffect(() => {
    if (props.adminMode) return;
    fetch("/api/account/vip-subscriptions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setHasActiveVipSubscription(Boolean(d?.activeSubscriptionId)))
      .catch(() => {});
  }, [props.adminMode]);
  const canChooseVip = props.adminMode || hasActiveVipSubscription;
  const canChooseCip = Boolean(props.cipPlanId);

  useEffect(() => {
    if (props.mode === "create" && props.cipPlanId) {
      setAdForm((form) => ({ ...form, adType: "cip" }));
    }
  }, [props.mode, props.cipPlanId]);
  useEffect(() => {
    fetch("/api/categories?all=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => {});
    fetch("/api/locations/cities", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const sari = (d.cities ?? []).find((c: { slug: string }) => c.slug === "sari");
        if (!sari) return;
        setCityId(sari.id);
        fetch(`/api/locations/neighborhoods?cityId=${sari.id}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((dd) => setNeighborhoods(dd.neighborhoods ?? []))
          .catch(() => {});
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (locationQuery || !base.neighborhoodId) return;
    const selectedNeighborhood = neighborhoods.find((neighborhood) => neighborhood.id === Number(base.neighborhoodId));
    if (selectedNeighborhood) setLocationQuery(selectedNeighborhood.name);
  }, [base.neighborhoodId, locationQuery, neighborhoods]);

  // ---- فیلدهای اختصاصی دستهٔ انتخاب‌شده ----
  useEffect(() => {
    if (!base.categoryId) {
      setFields([]);
      return;
    }
    setFieldsLoading(true);
    fetch(`/api/categories/${base.categoryId}/fields`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setFields(d.fields ?? []))
      .catch(() => setFields([]))
      .finally(() => setFieldsLoading(false));
  }, [base.categoryId]);

  // ---- حالت ویرایش: بارگذاری آگهی + ملک + ویژگی‌ها + رسانه ----
  useEffect(() => {
    if (props.mode !== "edit") return;
    const adId = props.advertisementId;
    (async () => {
      try {
        const adRes = await fetch(`/api/advertisements/${adId}`);
        const adData = await adRes.json();
        if (!adRes.ok) throw new Error(adData.error || "آگهی یافت نشد");
        const ad = adData.advertisement;
        setAdStatus(ad.status);
        setAdvertisementId(ad.id);
        setAdForm({
          transactionType: ad.transaction_type,
          price: priceDisplayValue(ad.price),
          deposit: priceDisplayValue(ad.deposit),
          monthlyRent: priceDisplayValue(ad.monthly_rent),
          durationDays: "",
          adType: ad.is_vip ? "vip" : "free",
          vipVideoUrl: ad.vip_video_url ?? "",
        });

        const propRes = await fetch(`/api/properties/${ad.property_id}`);
        const propData = await propRes.json();
        if (!propRes.ok) throw new Error(propData.error || "ملک یافت نشد");
        const p = propData.property;
        setPropertyId(p.id);
        setBase({
          categoryId: String(p.category_id),
          subcategoryId: p.subcategory_id ? String(p.subcategory_id) : "",
          neighborhoodId: p.neighborhood_id ? String(p.neighborhood_id) : "",
          title: ad.title,
          description: ad.description ?? "",
          area: p.area ?? "",
          builtArea: p.built_area ?? "",
          bedrooms: p.bedrooms !== null ? String(p.bedrooms) : "",
          builtYear: p.built_year !== null ? String(Math.trunc(Number(p.built_year))) : "",
          floor: p.floor !== null ? String(p.floor) : "",
          locationPrecision: p.location_precision ?? "approximate",
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
        });
        setMedia(
          (propData.media ?? []).map(
            (m: { id: number; url: string; alt_text: string | null; is_primary: boolean; mime_type: string }) => ({
              id: m.id,
              url: m.url,
              altText: m.alt_text,
              isPrimary: m.is_primary,
              mimeType: m.mime_type,
            })
          )
        );

        const initialAttrs: Record<number, AttrValue> = {};
        for (const a of propData.attributes ?? []) {
          if (a.fieldType === "select") initialAttrs[a.fieldId] = a.value ? String(a.value.id) : "";
          else if (a.fieldType === "multi_select")
            initialAttrs[a.fieldId] = Array.isArray(a.value) ? a.value.map((v: { id: number }) => String(v.id)) : [];
          else if (a.fieldType === "boolean") initialAttrs[a.fieldId] = a.value === true ? "true" : a.value === false ? "false" : "";
          else initialAttrs[a.fieldId] = a.value !== null && a.value !== undefined ? String(a.value) : "";
        }
        setAttrs(initialAttrs);
      } catch (e) {
        setError(e instanceof Error ? e.message : "خطا در بارگذاری اطلاعات");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode === "edit" ? props.advertisementId : null]);

  function updateBase(patch: Partial<BaseForm>) {
    setBase((b) => ({ ...b, ...patch }));
  }

  async function generateDescription() {
    setError("");
    setSuggestedDescription("");
    setGeneratingDescription(true);
    try {
      const neighborhood = neighborhoods.find((item) => item.id === Number(base.neighborhoodId));
      const response = await fetch("/api/ai/listing-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: base.title,
          description: base.description,
          category: selectedCategory?.name ?? "",
          location: neighborhood?.name ?? "",
          area: base.area,
          builtArea: base.builtArea,
          bedrooms: base.bedrooms,
          builtYear: base.builtYear,
          price: adForm.price,
          deposit: adForm.deposit,
          monthlyRent: adForm.monthlyRent,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "تولید توضیحات ناموفق بود");
      if (!data?.description) throw new Error("توضیح قابل استفاده‌ای تولید نشد");
      setSuggestedDescription(data.description);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تولید توضیحات ناموفق بود");
    } finally {
      setGeneratingDescription(false);
    }
  }

  function updateAttr(fieldId: number, value: AttrValue) {
    setAttrs((a) => ({ ...a, [fieldId]: value }));
  }
  function toggleMultiOption(fieldId: number, optionId: string) {
    setAttrs((a) => {
      const current = Array.isArray(a[fieldId]) ? (a[fieldId] as string[]) : [];
      const next = current.includes(optionId) ? current.filter((v) => v !== optionId) : [...current, optionId];
      return { ...a, [fieldId]: next };
    });
  }

  function buildAttributesPayload(): { fieldId: number; value: unknown }[] | null {
    const payload: { fieldId: number; value: unknown }[] = [];
    for (const f of fields.filter((field) => !isDuplicateBaseField(field))) {
      const raw = attrs[f.id];
      const isEmpty = raw === undefined || raw === "" || (Array.isArray(raw) && raw.length === 0);
      if (isEmpty) {
        if (f.is_required) {
          setError(`فیلد «${f.label_fa}» الزامی است`);
          return null;
        }
        continue;
      }
      let value: unknown;
      switch (f.field_type) {
        case "number":
          value = Number(raw);
          break;
        case "boolean":
          value = raw === "true";
          break;
        case "select":
          value = Number(raw);
          break;
        case "multi_select":
          value = (raw as string[]).map(Number);
          break;
        default:
          value = raw;
      }
      payload.push({ fieldId: f.id, value });
    }
    return payload;
  }

  function buildPropertyPayload(): Record<string, unknown> {
    return {
      categoryId: Number(base.categoryId),
      subcategoryId: base.subcategoryId ? Number(base.subcategoryId) : null,
      cityId,
      districtId: null,
      marketZoneId: null,
      neighborhoodId: base.neighborhoodId ? Number(base.neighborhoodId) : null,
      title: base.title.trim(),
      description: base.description.trim() || null,
      area: numOrNull(base.area),
      builtArea: numOrNull(base.builtArea),
      bedrooms: numOrNull(base.bedrooms),
      builtYear: numOrNull(base.builtYear),
      floor: numOrNull(base.floor),
      locationPrecision: base.locationPrecision,
      latitude: base.latitude,
      longitude: base.longitude,
    };
  }

  async function submitStep1() {
    setError("");
    if (!base.categoryId) return setError("دسته‌بندی را انتخاب کنید");
    if (!cityId) return setError("خطا در بارگذاری اطلاعات شهر؛ صفحه را رفرش کنید");
    if (!base.title.trim()) return setError("عنوان الزامی است");
    const attributes = buildAttributesPayload();
    if (attributes === null) return;
    setSaving(true);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildPropertyPayload(), attributes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ثبت ملک");
      setPropertyId(data.property.id);
      return data.property.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ثبت ملک");
    } finally {
      setSaving(false);
    }
  }

  async function uploadFilesDirect(files: FileList | File[], targetPropertyId = propertyId): Promise<boolean> {
    if (files.length === 0) return true;
    const imageCount = media.filter((m) => !isVideoMime(m.mimeType)).length;
    if (imageCount + files.length > MAX_PROPERTY_IMAGES) {
      setError(`حداکثر ${MAX_PROPERTY_IMAGES} عکس برای هر ملک مجاز است.`);
      return false;
    }
    if (!targetPropertyId) {
      setSelectedFiles((current) => [...current, ...Array.from(files)]);
      return true;
    }
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/properties/${targetPropertyId}/media`, { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "خطا در آپلود رسانه");
        setMedia((m) => [
          ...m,
          {
            id: data.media.id,
            url: data.media.url,
            altText: data.media.alt_text,
            isPrimary: data.media.is_primary,
            mimeType: data.media.mime_type,
          },
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در آپلود رسانه");
      return false;
    } finally {
      setUploading(false);
    }
    return true;
  }

  async function deleteMedia(mediaId: number) {
    if (!propertyId) return;
    const res = await fetch(`/api/properties/${propertyId}/media/${mediaId}`, { method: "DELETE" });
    if (res.ok) setMedia((m) => m.filter((x) => x.id !== mediaId));
  }

  async function setPrimaryMedia(mediaId: number) {
    if (!propertyId) return;
    const res = await fetch(`/api/properties/${propertyId}/media/${mediaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrimary: true }),
    });
    if (res.ok) setMedia((m) => m.map((x) => ({ ...x, isPrimary: x.id === mediaId })));
  }

  async function submitStep3() {
    setError("");
    if (adForm.adType === "cip" && !props.cipPlanId) {
      setError("برای ثبت آگهی CIP ابتدا یک پلن CIP انتخاب کنید.");
      return;
    }
    let resolvedPropertyId = propertyId;
    if (!resolvedPropertyId) {
      const createdPropertyId = await submitStep1();
      if (!createdPropertyId) return;
      resolvedPropertyId = createdPropertyId;
    }
    if (selectedFiles.length > 0 && !(await uploadFilesDirect(selectedFiles, resolvedPropertyId))) return;
    if (!categoryTransactionType) return setError("نوع معامله برای دسته‌بندی انتخاب‌شده مشخص نیست");
    const transactionType = categoryTransactionType;
    setSaving(true);
    try {
      const isRent = RENT_BASED_TRANSACTION_TYPES.includes(transactionType);
      const body: Record<string, unknown> = {
        propertyId: resolvedPropertyId,
        title: base.title.trim(),
        description: base.description.trim() || null,
        transactionType,
      };
      if (isApprovedConsultant && attributeAsConsultant) body.attributeAsConsultant = true;
      if (isRent) {
        body.deposit = priceOrNull(adForm.deposit) ?? 0;
        body.monthlyRent = priceOrNull(adForm.monthlyRent) ?? 0;
      } else {
        body.price = priceOrNull(adForm.price);
      }
      const res = await fetch("/api/advertisements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ثبت آگهی");
      setAdvertisementId(data.advertisement.id);
      setAdStatus(data.advertisement.status);
      setSelectedFiles([]);
      if (adForm.adType === "vip") {
        const vipError = await applyVipSelection(data.advertisement.id, true);
        if (vipError) setNotice(`آگهی ثبت شد، اما فعال‌سازی VIP ناموفق بود: ${vipError}`);
      }
      const submitRes = await fetch(`/api/advertisements/${data.advertisement.id}/submit`, { method: "POST" });
      const submitData = await submitRes.json();
      if (!submitRes.ok) throw new Error(submitData.error || "خطا در ارسال آگهی برای بررسی");
      setAdStatus(submitData.advertisement.status);
      if (props.cipPlanId) {
        router.push(`/account/cip?plan=${props.cipPlanId}&advertisement=${data.advertisement.id}`);
        return;
      }
      setNotice("آگهی برای بررسی ارسال شد.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ثبت آگهی");
    } finally {
      setSaving(false);
    }
  }

  /** فعال/غیرفعال‌سازی VIP روی آگهی؛ در صورت خطا پیام آن را برمی‌گرداند (رشتهٔ خالی یعنی موفق). */
  async function applyVipSelection(adId: number, enable: boolean): Promise<string> {
    try {
      const body: Record<string, unknown> = { enable };
      if (props.adminMode && enable) body.videoUrl = adForm.vipVideoUrl.trim() || null;
      const res = await fetch(`/api/account/advertisements/${adId}/vip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) return data.error || "خطا در تنظیم VIP";
      return "";
    } catch (e) {
      return e instanceof Error ? e.message : "خطا در تنظیم VIP";
    }
  }

  async function saveEdits() {
    setError("");
    setNotice("");
    if (!propertyId || !advertisementId) return;
    const attributes = buildAttributesPayload();
    if (attributes === null) return;
    if (!categoryTransactionType) return setError("نوع معامله برای دسته‌بندی انتخاب‌شده مشخص نیست");
    const transactionType = categoryTransactionType;
    setSaving(true);
    try {
      const propRes = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildPropertyPayload(), attributes }),
      });
      const propData = await propRes.json();
      if (!propRes.ok) throw new Error(propData.error || "خطا در ذخیرهٔ اطلاعات ملک");

      const isRent = RENT_BASED_TRANSACTION_TYPES.includes(transactionType);
      const adBody: Record<string, unknown> = {
        title: base.title.trim(),
        description: base.description.trim() || null,
        transactionType,
      };
      if (isRent) {
        adBody.deposit = priceOrNull(adForm.deposit) ?? 0;
        adBody.monthlyRent = priceOrNull(adForm.monthlyRent) ?? 0;
        adBody.price = null;
      } else {
        adBody.price = priceOrNull(adForm.price);
        adBody.deposit = null;
        adBody.monthlyRent = null;
      }

      const adRes = await fetch(`/api/advertisements/${advertisementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adBody),
      });
      const adData = await adRes.json();
      if (!adRes.ok) {
        setNotice("اطلاعات ملک ذخیره شد.");
        setError(adData.error || "خطا در ذخیرهٔ اطلاعات آگهی");
        return;
      }
      setAdStatus(adData.advertisement.status);

      const vipError = await applyVipSelection(advertisementId, adForm.adType === "vip");
      if (vipError) {
        setNotice("تغییرات ملک/آگهی ذخیره شد.");
        setError(`خطا در تنظیم VIP: ${vipError}`);
      } else {
        setNotice("تغییرات با موفقیت ذخیره شد.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ذخیرهٔ تغییرات");
    } finally {
      setSaving(false);
    }
  }

  async function doSubmitForReview() {
    if (!advertisementId) return;
    setError("");
    setNotice("");
    const res = await fetch(`/api/advertisements/${advertisementId}/submit`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "خطا در ارسال برای بررسی");
      return;
    }
    setAdStatus(data.advertisement.status);
    setNotice("آگهی برای بررسی ارسال شد.");
  }

  async function doArchive() {
    if (!advertisementId) return;
    setError("");
    setNotice("");
    const res = await fetch(`/api/advertisements/${advertisementId}/archive`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "خطا در آرشیو");
      return;
    }
    setAdStatus(data.advertisement.status);
    setNotice("آگهی آرشیو شد.");
  }

  function renderAttributeInput(f: CategoryField) {
    const value = attrs[f.id];
    switch (f.field_type) {
      case "text":
        return <input type="text" value={(value as string) ?? ""} onChange={(e) => updateAttr(f.id, e.target.value)} />;
      case "number":
        return <input type="number" value={(value as string) ?? ""} onChange={(e) => updateAttr(f.id, e.target.value)} />;
      case "date":
        return <input type="date" value={(value as string) ?? ""} onChange={(e) => updateAttr(f.id, e.target.value)} />;
      case "boolean":
        return (
          <select value={(value as string) ?? ""} onChange={(e) => updateAttr(f.id, e.target.value)}>
            <option value="">نامشخص</option>
            <option value="true">دارد</option>
            <option value="false">ندارد</option>
          </select>
        );
      case "select":
        return (
          <select value={(value as string) ?? ""} onChange={(e) => updateAttr(f.id, e.target.value)}>
            <option value="">انتخاب کنید</option>
            {f.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label_fa}
              </option>
            ))}
          </select>
        );
      case "multi_select": {
        const selected = Array.isArray(value) ? value : [];
        return (
          <div className="checkbox-group">
            {f.options.map((o) => (
              <label key={o.id} className="checkbox-group__item">
                <input type="checkbox" checked={selected.includes(String(o.id))} onChange={() => toggleMultiOption(f.id, String(o.id))} />
                {o.label_fa}
              </label>
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  }

  const topCategories = categories.filter((c) => !c.parent_id);
  const subcategories = base.categoryId ? categories.filter((c) => c.parent_id === Number(base.categoryId)) : [];
  const selectedCategory = categories.find((c) => c.id === Number(base.categoryId));
  const filteredNeighborhoods = neighborhoods.filter((n) => normalizePersian(n.name).includes(normalizePersian(locationQuery)));
  const categoryTransactionType = selectedCategory ? CATEGORY_TRANSACTION_TYPES[selectedCategory.slug] : undefined;

  function renderPropertySection() {
    return (
      <div className="form-section">
        <h2>اطلاعات ملک</h2>
        <div className="form-grid">
          <div className="form-group">
            <label>دسته‌بندی *</label>
            <select
              value={base.categoryId}
              onChange={(e) => {
                updateBase({ categoryId: e.target.value, subcategoryId: "" });
                setAttrs({});
              }}
            >
              <option value="">انتخاب کنید</option>
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
              <select value={base.subcategoryId} onChange={(e) => updateBase({ subcategoryId: e.target.value })}>
                <option value="">بدون زیردسته</option>
                {subcategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label htmlFor="property-neighborhood">موقعیت ملک</label>
            <input
              id="property-neighborhood"
              value={locationQuery}
              onFocus={() => setIsLocationPickerOpen(true)}
              onChange={(e) => {
                setLocationQuery(e.target.value);
                updateBase({ neighborhoodId: "" });
                setIsLocationPickerOpen(true);
              }}
              placeholder="جست‌وجو یا انتخاب منطقه؛ مثلاً امیرمازندرانی"
              role="combobox"
              aria-expanded={isLocationPickerOpen}
              aria-controls="property-neighborhood-options"
              aria-autocomplete="list"
            />
            {isLocationPickerOpen && (
              <div id="property-neighborhood-options" className="location-search-results" role="listbox">
                {filteredNeighborhoods.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    role="option"
                    aria-selected={Number(base.neighborhoodId) === n.id}
                    className={Number(base.neighborhoodId) === n.id ? "location-search-results__item location-search-results__item--selected" : "location-search-results__item"}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      updateBase({ neighborhoodId: String(n.id) });
                      setLocationQuery(n.name);
                      setIsLocationPickerOpen(false);
                    }}
                  >
                    {n.name}
                  </button>
                ))}
                {filteredNeighborhoods.length === 0 && <p className="location-search-results__empty">منطقه‌ای با این نام یافت نشد.</p>}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label>عنوان آگهی *</label>
          <input type="text" value={base.title} onChange={(e) => updateBase({ title: e.target.value })} maxLength={200} />
        </div>
        <div className="form-group">
          <label>توضیحات</label>
          <textarea rows={4} value={base.description} onChange={(e) => updateBase({ description: e.target.value })} />
          <button
            type="button"
            className="btn-secondary ai-description-button"
            disabled={generatingDescription || !base.title || !base.categoryId}
            onClick={generateDescription}
          >
            {generatingDescription ? "در حال تولید…" : "تولید توضیحات با دستیار هوشمند"}
          </button>
          {suggestedDescription && (
            <div className="ai-description-suggestion">
              <strong>پیشنهاد دستیار هوشمند</strong>
              <p>{suggestedDescription}</p>
              <button type="button" className="btn-primary" onClick={() => updateBase({ description: suggestedDescription })}>
                جایگزینی در توضیحات
              </button>
            </div>
          )}
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>متراژ (متر مربع)</label>
            <input type="number" min={0} value={base.area} onChange={(e) => updateBase({ area: e.target.value })} />
            {measurementInWords(base.area) && <small className="number-in-words">{measurementInWords(base.area)} متر مربع</small>}
          </div>
          <div className="form-group">
            <label>زیربنا (متر مربع)</label>
            <input type="number" min={0} value={base.builtArea} onChange={(e) => updateBase({ builtArea: e.target.value })} />
            {measurementInWords(base.builtArea) && <small className="number-in-words">{measurementInWords(base.builtArea)} متر مربع</small>}
          </div>
          <div className="form-group">
            <label>تعداد اتاق خواب</label>
            <select value={base.bedrooms} onChange={(e) => updateBase({ bedrooms: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {Array.from({ length: 5 }, (_, index) => index + 1).map((bedrooms) => (
                <option key={bedrooms} value={bedrooms}>{bedrooms.toLocaleString("fa-IR")}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>سال ساخت</label>
            <select value={base.builtYear} onChange={(e) => updateBase({ builtYear: e.target.value })}>
              <option value="">انتخاب نشده</option>
              <option value="1369">قبل از ۱۳۷۰</option>
              {Array.from({ length: Math.trunc(CURRENT_PERSIAN_YEAR) - 1369 }, (_, i) => Math.trunc(CURRENT_PERSIAN_YEAR) - i).map((year) => (
                <option key={year} value={year}>{formatPersianInteger(year)}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>طبقه</label>
            <input type="number" min={-2} max={30} value={base.floor} onChange={(e) => updateBase({ floor: e.target.value })} />
          </div>
          <div className="form-group">
            <label>دقت مکان روی نقشه</label>
            <select value={base.locationPrecision} onChange={(e) => updateBase({ locationPrecision: e.target.value })}>
              {LOCATION_PRECISIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <LocationPicker
          latitude={base.latitude}
          longitude={base.longitude}
          onChange={(lat, lng) =>
            updateBase({ latitude: lat, longitude: lng, locationPrecision: lat !== null ? "exact" : base.locationPrecision })
          }
        />

        {fieldsLoading && <p>در حال بارگذاری ویژگی‌های دسته‌بندی…</p>}
        {fields.filter((field) => !isDuplicateBaseField(field)).length > 0 && (
          <>
            <hr className="filters-divider" />
            <h3>ویژگی‌های اختصاصی دسته‌بندی</h3>
            <div className="form-grid">
              {fields.filter((field) => !isDuplicateBaseField(field)).map((f) => (
                <div className="form-group" key={f.id}>
                  <label>
                    {f.label_fa}
                    {f.is_required ? " *" : ""}
                  </label>
                  {renderAttributeInput(f)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  function renderMediaSection() {
    return (
      <div className="form-section">
        <h2>تصاویر ملک</h2>
        <p className="form-hint">
          تصویر: jpg، png، webp (حداکثر ۱۰ مگابایت) — از صفر تا حداکثر ۲۰ عکس. افزودن ویدیو فقط برای آگهی‌های VIP و از طریق پنل مدیریت (لینک
          آپارات) انجام می‌شود.
        </p>
        {media.length > 0 && (
          <div className="media-grid">
            {media.map((m) => (
              <div key={m.id} className={`media-item${m.isPrimary ? " media-item--primary" : ""}`}>
                {isVideoMime(m.mimeType) ? (
                  <video src={m.url} controls muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <img src={m.url} alt={m.altText ?? ""} />
                )}
                {m.isPrimary && <span className="media-item__badge">اصلی</span>}
                <div className="media-item__actions">
                  {!m.isPrimary && !isVideoMime(m.mimeType) && (
                    <button type="button" onClick={() => setPrimaryMedia(m.id)}>
                      تصویر اصلی
                    </button>
                  )}
                  <button type="button" className="media-item__delete" onClick={() => deleteMedia(m.id)}>
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {selectedFiles.length > 0 && (
          <div className="media-grid">
            {selectedFiles.map((f, i) => (
              <div key={i} className="media-item">
                <img src={URL.createObjectURL(f)} alt="" />
                <div className="media-item__actions">
                  <button type="button" className="media-item__delete" onClick={() => setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="form-group">
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) uploadFilesDirect(e.target.files);
              e.target.value = "";
            }}
          />
          {uploading && <p className="form-hint">در حال آپلود…</p>}
        </div>
      </div>
    );
  }

  function renderAdInfoSection() {
    const transactionType = categoryTransactionType ?? (adForm.transactionType as TransactionType);
    const isRent = RENT_BASED_TRANSACTION_TYPES.includes(transactionType);
    return (
      <div className="form-section">
        <h2>اطلاعات آگهی</h2>
        {isApprovedConsultant && (
          <div className="form-group form-group--checkbox">
            <label>
              <input
                type="checkbox"
                checked={attributeAsConsultant}
                onChange={(e) => setAttributeAsConsultant(e.target.checked)}
              />
              ثبت به عنوان مشاور املاک
            </label>
          </div>
        )}

        <div className="form-group">
          <label>نوع آگهی</label>
          <div className="checkbox-group">
            <label className="checkbox-group__item">
              <input
                type="radio"
                name="adType"
                checked={adForm.adType === "free"}
                onChange={() => setAdForm((f) => ({ ...f, adType: "free" }))}
              />
              رایگان
            </label>
            <label className="checkbox-group__item">
              <input
                type="radio"
                name="adType"
                checked={adForm.adType === "vip"}
                disabled={!canChooseVip}
                onChange={() => setAdForm((f) => ({ ...f, adType: "vip" }))}
              />
              VIP
            </label>
            <label className="checkbox-group__item">
              <input
                type="radio"
                name="adType"
                checked={adForm.adType === "cip"}
                disabled={!canChooseCip}
                onChange={() => setAdForm((f) => ({ ...f, adType: "cip" }))}
              />
              CIP
            </label>
          </div>
          {!canChooseVip && (
            <small>
              برای ثبت آگهی VIP ابتدا باید یک اشتراک VIP فعال تهیه کنید.{" "}
              <a href="/account/vip" target="_blank" rel="noreferrer">
                مشاهدهٔ پلن‌های VIP
              </a>
            </small>
          )}
          {!canChooseCip && <small>برای ثبت آگهی CIP ابتدا یک پلن CIP انتخاب و خریداری کنید.</small>}
          {props.adminMode && adForm.adType === "vip" && (
            <div style={{ marginTop: 8 }}>
              <label>لینک ویدیوی آپارات (اختیاری)</label>
              <input
                type="text"
                dir="ltr"
                value={adForm.vipVideoUrl}
                onChange={(e) => setAdForm((f) => ({ ...f, vipVideoUrl: e.target.value }))}
                placeholder="https://www.aparat.com/v/xxxxx"
              />
              <small>این ویدیو فقط در صفحهٔ همین آگهی نمایش داده می‌شود (مخصوص آگهی‌های VIP).</small>
            </div>
          )}
        </div>

        <p className="form-hint">
          نوع معامله از دسته‌بندی انتخاب‌شده تعیین می‌شود: {categoryTransactionType ? TRANSACTION_TYPE_LABELS[categoryTransactionType] : "دسته‌بندی را انتخاب کنید"}
        </p>
        {isRent ? (
            <div className="form-grid">
              <div className="form-group">
                <label>مبلغ رهن (تومان)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9/]*"
                  dir="ltr"
                  placeholder="مثال: ۱/۲۵۰/۰۰۰"
                  value={adForm.deposit}
                  onChange={(e) => setAdForm((f) => ({ ...f, deposit: formatPriceWithSlashes(e.target.value) }))}
                />
                {tomanInWords(adForm.deposit) && <small>{tomanInWords(adForm.deposit)}</small>}
              </div>
              <div className="form-group">
                <label>اجارهٔ ماهانه (تومان)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9/]*"
                  dir="ltr"
                  placeholder="مثال: ۱/۲۵۰/۰۰۰"
                  value={adForm.monthlyRent}
                  onChange={(e) => setAdForm((f) => ({ ...f, monthlyRent: formatPriceWithSlashes(e.target.value) }))}
                />
                {tomanInWords(adForm.monthlyRent) && <small>{tomanInWords(adForm.monthlyRent)}</small>}
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label>قیمت (تومان) *</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9/]*"
                dir="ltr"
                placeholder="مثال: ۱/۲۵۰/۰۰۰"
                value={adForm.price}
                onChange={(e) => setAdForm((f) => ({ ...f, price: formatPriceWithSlashes(e.target.value) }))}
              />
              {tomanInWords(adForm.price) && <small>{tomanInWords(adForm.price)}</small>}
            </div>
          )}
        <p className="form-hint">مدت انتشار هر آگهی ۳۰ روز است.</p>
      </div>
    );
  }

  if (loading) return <p>در حال بارگذاری…</p>;

  return (
    <div className="account-form">
      {props.mode === "edit" && adStatus && (
        <p className="status-line">
          وضعیت فعلی:{" "}
          <span className={`status-badge status-badge--${adStatus}`}>{ADVERTISEMENT_STATUS_LABELS[adStatus] ?? adStatus}</span>
        </p>
      )}

      {error && <div className="error-box">{error}</div>}
      {notice && <div className="success-box">{notice}</div>}

      {props.mode === "create" ? (
        <>
          {renderPropertySection()}
          {renderMediaSection()}
          {renderAdInfoSection()}
          <div className="form-actions">
            <button type="button" className="btn-primary" onClick={submitStep3} disabled={saving || uploading || adStatus === "pending_review"}>
              {saving ? "در حال ثبت…" : adStatus === "pending_review" ? "آگهی برای بررسی ارسال شد" : "ثبت و ارسال برای بررسی"}
            </button>
            {adStatus === "pending_review" && (
              <>
                {props.adminMode && advertisementId && (
                  <button type="button" className="btn-primary" onClick={() => router.push(`/admin/advertisements/${advertisementId}`)}>
                    رفتن به صفحهٔ آگهی برای انتشار
                  </button>
                )}
                <button type="button" className="btn-secondary" onClick={() => router.push(props.adminMode ? "/admin/advertisements" : "/account/advertisements")}>
                  {props.adminMode ? "بازگشت به لیست آگهی‌ها" : "رفتن به آگهی‌های من"}
                </button>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          {renderPropertySection()}
          {renderMediaSection()}
          {renderAdInfoSection()}
          <div className="form-actions">
            <button type="button" className="btn-primary" onClick={saveEdits} disabled={saving}>
              {saving ? "در حال ذخیره…" : "ذخیرهٔ تغییرات"}
            </button>
            {adStatus && ["draft", "rejected", "expired"].includes(adStatus) && (
              <button type="button" className="btn-secondary" onClick={doSubmitForReview}>
                ارسال برای بررسی
              </button>
            )}
            {adStatus && adStatus !== "archived" && (
              <button type="button" className="btn-danger" onClick={doArchive}>
                آرشیو کردن
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
