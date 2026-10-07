// نگاشت آیکون‌های مرتبط با ماهیت دسته‌بندی‌های ملک و مناطق جغرافیایی — برای یکدست و معنادار شدن آیکون‌ها
// در صفحهٔ اصلی، صفحهٔ مناطق و هر جای دیگری که این نوع داده نمایش داده می‌شود.

import { House, Building2, Store, Trees, HardHat, BedDouble, LayoutGrid, Landmark, MapPin, Map, type LucideIcon } from "lucide-react";

/** بر اساس slug/نام دسته‌بندی، آیکون مناسب ماهیت آن را برمی‌گرداند (ویلا، آپارتمان، اداری/تجاری، زمین، پیش‌فروش، ...). */
export function getCategoryIcon(slug: string, name?: string): LucideIcon {
  const s = `${slug} ${name ?? ""}`.toLowerCase();

  if (s.includes("kutahmoddat") || s.includes("suite") || s.includes("سوئیت") || s.includes("کوتاه‌مدت")) return BedDouble;
  if (s.includes("vila") || s.includes("ویلا")) return House;
  if (s.includes("apartman") || s.includes("khane") || s.includes("آپارتمان") || s.includes("خانه")) return Building2;
  if (
    s.includes("edari") ||
    s.includes("tejari") ||
    s.includes("sanati") ||
    s.includes("اداری") ||
    s.includes("تجاری") ||
    s.includes("صنعتی") ||
    s.includes("مغازه")
  )
    return Store;
  if (s.includes("zamin") || s.includes("bagh") || s.includes("زمین") || s.includes("باغ")) return Trees;
  if (s.includes("pishforosh") || s.includes("sakht") || s.includes("پیش‌فروش") || s.includes("ساخت")) return HardHat;

  return LayoutGrid;
}

/** آیکون‌های ثابت برای انواع منطقهٔ جغرافیایی — هرکدام متناسب با ماهیت خودشان. */
export const DistrictIcon = Landmark; // منطقهٔ شهرداری
export const MarketZoneIcon = Store; // ناحیهٔ بازار ملک
export const NeighborhoodIcon = MapPin; // محله
export const AllRegionsIcon = Map; // لینک «مشاهدهٔ همهٔ مناطق»
