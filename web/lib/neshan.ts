// کلاینت وب‌سرویس‌های نقشهٔ نشان (Neshan Maps Platform) — فقط سمت سرور.
// کلید API («وب‌سرویس»، با پیشوند service.) هرگز نباید به کلاینت/مرورگر ارسال شود؛
// تمام فراخوانی‌ها از طریق مسیرهای API این پروژه پروکسی می‌شوند تا کلید مخفی بماند.
//
// نکته: روی کلید سرویس فعلی، وب‌سرویس «Search» (v1/v3) فعال نیست («Api Key services not match»).
// به‌جای آن از ترکیب Geocoding (متن آدرس -> مختصات) + Reverse Geocoding (مختصات -> آدرس خوانا)
// استفاده می‌شود که هر دو روی این کلید تست و تأیید شده‌اند.

const GEOCODING_URL = "https://api.neshan.org/v5/geocoding";
const REVERSE_URL = "https://api.neshan.org/v5/reverse";
const STATIC_MAP_URL = "https://api.neshan.org/v5/static";

export function isNeshanConfigured(): boolean {
  return Boolean(process.env.NESHAN_API_KEY);
}

function apiKeyOrThrow(): string {
  const apiKey = process.env.NESHAN_API_KEY;
  if (!apiKey) throw new Error("NESHAN_API_KEY تنظیم نشده است");
  return apiKey;
}

interface GeocodingResult {
  location: { x: number; y: number };
  score: number;
}

/** متن آزاد آدرس را به فهرست مختصات کاندید تبدیل می‌کند (بدون متن آدرس). */
async function neshanGeocode(address: string): Promise<{ latitude: number; longitude: number }[]> {
  const apiKey = apiKeyOrThrow();
  const url = `${GEOCODING_URL}?address=${encodeURIComponent(address)}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { "Api-Key": apiKey } });
  } catch {
    throw new Error("اتصال به سرویس نقشه برقرار نشد");
  }
  if (!res.ok) throw new Error(`خطای سرویس آدرس‌یابی نقشه (HTTP ${res.status})`);

  const data = (await res.json().catch(() => null)) as GeocodingResult[] | null;
  if (!Array.isArray(data)) return [];
  return data.map((r) => ({ latitude: r.location.y, longitude: r.location.x }));
}

interface ReverseResult {
  status: string;
  formatted_address?: string;
  city?: string;
  state?: string;
}

/** مختصات را به آدرس خوانا (formatted_address) تبدیل می‌کند. */
async function neshanReverseGeocode(lat: number, lng: number): Promise<string | null> {
  const apiKey = apiKeyOrThrow();
  const url = `${REVERSE_URL}?lat=${lat}&lng=${lng}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { "Api-Key": apiKey } });
  } catch {
    throw new Error("اتصال به سرویس نقشه برقرار نشد");
  }
  if (!res.ok) return null;

  const data = (await res.json().catch(() => null)) as ReverseResult | null;
  if (!data || data.status !== "OK") return null;
  return data.formatted_address ?? null;
}

export interface NeshanLocationSuggestion {
  address: string;
  latitude: number;
  longitude: number;
}

/** نزدیک‌ترین را از هم فاصله می‌گیرد تا چند پیشنهاد تقریباً یکسان به کاربر نشان داده نشود. */
function dedupeClose(points: { latitude: number; longitude: number }[], minDistanceDeg = 0.0015) {
  const kept: { latitude: number; longitude: number }[] = [];
  for (const p of points) {
    const tooClose = kept.some((k) => Math.abs(k.latitude - p.latitude) < minDistanceDeg && Math.abs(k.longitude - p.longitude) < minDistanceDeg);
    if (!tooClose) kept.push(p);
  }
  return kept;
}

/** جستجوی آدرس با متن آزاد: آدرس را geocode می‌کند و چند کاندید برتر را reverse-geocode می‌کند تا برچسب خوانا داشته باشند. */
export async function neshanSearchAddress(term: string): Promise<NeshanLocationSuggestion[]> {
  const candidates = dedupeClose(await neshanGeocode(term)).slice(0, 4);
  const results: NeshanLocationSuggestion[] = [];
  for (const c of candidates) {
    const address = await neshanReverseGeocode(c.latitude, c.longitude);
    if (address) results.push({ address, latitude: c.latitude, longitude: c.longitude });
  }
  return results;
}

/** تصویر نقشهٔ استاتیک را از سرویس نشان می‌گیرد و بافر + نوع محتوا را برمی‌گرداند (برای پروکسی به کلاینت). */
export async function neshanStaticMap(
  lat: number,
  lng: number,
  opts: { width?: number; height?: number; zoom?: number } = {}
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const apiKey = apiKeyOrThrow();

  const width = Math.min(Math.max(opts.width ?? 600, 200), 2048);
  const height = Math.min(Math.max(opts.height ?? 300, 200), 2048);
  const zoom = Math.min(Math.max(opts.zoom ?? 15, 5), 19);

  const params = new URLSearchParams({
    style: "light",
    width: String(width),
    height: String(height),
    zoom: String(zoom),
    latitude: String(lat),
    longitude: String(lng),
    marker: "red",
  });

  let res: Response;
  try {
    res = await fetch(`${STATIC_MAP_URL}?${params.toString()}`, { headers: { "Api-Key": apiKey } });
  } catch {
    throw new Error("اتصال به سرویس نقشه برقرار نشد");
  }
  if (!res.ok) throw new Error(`خطای سرویس نقشهٔ استاتیک (HTTP ${res.status})`);

  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "image/png";
  return { buffer, contentType };
}
