// تبدیل تاریخ شمسی (جلالی) به میلادی، برای پردازش ورودی‌های تاریخ کاربر در سمت سرور.
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
}

function div(a: number, b: number): number {
  return Math.floor(a / b);
}

function mod(a: number, b: number): number {
  return a - div(a, b) * b;
}

function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  const y = jy + 1595;
  let days =
    -355668 +
    365 * y +
    div(y, 33) * 8 +
    div(mod(y, 33) + 3, 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * div(days, 146097);
  days = mod(days, 146097);
  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days = mod(days, 36524);
    if (days >= 365) days++;
  }
  gy += 4 * div(days, 1461);
  days = mod(days, 1461);
  if (days > 365) {
    gy += div(days - 1, 365);
    days = mod(days - 1, 365);
  }
  let gd = days + 1;
  const isLeapG = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const monthDays = [0, 31, isLeapG ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 0; gm < 13; gm++) {
    const v = monthDays[gm];
    if (gd <= v) break;
    gd -= v;
  }
  return { gy, gm, gd };
}

/**
 * یک رشتهٔ تاریخ شمسی به فرمت «۱۴۰۵/۰۶/۱۳» یا «1405-06-13» (با ارقام فارسی یا انگلیسی)
 * را می‌گیرد و به یک شیء Date میلادی (UTC، ساعت ۰۰:۰۰) تبدیل می‌کند.
 * در صورت نامعتبر بودن ورودی، null برمی‌گرداند.
 */
export function parseJalaliDateString(input: string): Date | null {
  if (!input) return null;
  const normalized = toLatinDigits(input.trim()).replace(/[.\-]/g, "/");
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  const date = new Date(Date.UTC(gy, gm - 1, gd));
  return Number.isNaN(date.getTime()) ? null : date;
}
