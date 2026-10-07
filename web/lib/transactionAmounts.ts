// اعتبارسنجی مبالغ بر اساس نوع معامله (بخش ۱۲ و ۱۳ پرامپت فاز ۳)
// فروش/پیش‌فروش/مشارکت: فقط price. رهن‌واجاره/رهن‌کامل/کوتاه‌مدت: deposit + monthlyRent (بدون price).

import { TransactionType, isValidTomanAmount } from "./validation";

const PRICE_BASED: TransactionType[] = ["sale", "pre_sale", "partnership"];
const RENT_BASED: TransactionType[] = ["rent", "mortgage_rent", "short_term_rent"];

export interface TransactionAmountsInput {
  price?: number | null;
  deposit?: number | null;
  monthlyRent?: number | null;
}

export type TransactionAmountsResult =
  | { ok: true; price: number | null; deposit: number | null; monthlyRent: number | null }
  | { ok: false; error: string };

export function validateTransactionAmounts(type: TransactionType, input: TransactionAmountsInput): TransactionAmountsResult {
  if (PRICE_BASED.includes(type)) {
    if (input.price === undefined || input.price === null || !isValidTomanAmount(input.price) || input.price <= 0)
      return { ok: false, error: "برای این نوع معامله، price اجباری و باید عدد مثبت با حداکثر دو رقم اعشار (تومان) باشد" };
    if ((input.deposit ?? null) !== null || (input.monthlyRent ?? null) !== null)
      return { ok: false, error: "برای این نوع معامله، deposit/monthlyRent نباید ارسال شود" };
    return { ok: true, price: input.price, deposit: null, monthlyRent: null };
  }

  if (RENT_BASED.includes(type)) {
    const deposit = input.deposit ?? 0;
    const monthlyRent = input.monthlyRent ?? 0;
    if (!isValidTomanAmount(deposit) || !isValidTomanAmount(monthlyRent))
      return { ok: false, error: "deposit و monthlyRent باید عدد غیرمنفی با حداکثر دو رقم اعشار (تومان) باشند" };
    if (deposit === 0 && monthlyRent === 0) return { ok: false, error: "حداقل یکی از deposit یا monthlyRent باید بزرگ‌تر از صفر باشد" };
    if ((input.price ?? null) !== null) return { ok: false, error: "برای این نوع معامله، price نباید ارسال شود" };
    return { ok: true, price: null, deposit, monthlyRent };
  }

  return { ok: false, error: "transactionType نامعتبر است" };
}
