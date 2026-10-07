// راهبرد حریم‌خصوصی مختصات روی نقشه (بخش ۲۲ پرامپت فاز ۴) — بر اساس properties.location_precision

interface CoordInput {
  precision: string;
  latitude: number | null;
  longitude: number | null;
  neighborhoodLat: number | null;
  neighborhoodLng: number | null;
}

/** مختصات دقیق را به گام ۰.۰۱ درجه (~۱ کیلومتر) رند می‌کند تا موقعیت تقریبی و نه دقیق نمایش داده شود */
function approximate(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * مختصات نمایشی روی نقشهٔ عمومی را بر اساس سطح دقتِ ثبت‌شده برمی‌گرداند:
 * - exact             → مختصات واقعی ملک
 * - approximate       → مختصات رندشده (~۱ کیلومتر خطا) تا موقعیت دقیق لو نرود
 * - neighborhood_only  → فقط مرکز محله (در صورت وجود)، هرگز مختصات خود ملک
 */
export function publicMapCoords(input: CoordInput): { lat: number | null; lng: number | null } {
  if (input.precision === "exact" && input.latitude !== null && input.longitude !== null) {
    return { lat: input.latitude, lng: input.longitude };
  }
  if (input.precision === "approximate" && input.latitude !== null && input.longitude !== null) {
    return { lat: approximate(input.latitude), lng: approximate(input.longitude) };
  }
  if (input.neighborhoodLat !== null && input.neighborhoodLng !== null) {
    return { lat: input.neighborhoodLat, lng: input.neighborhoodLng };
  }
  return { lat: null, lng: null };
}
