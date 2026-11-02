import { SignJWT, jwtVerify } from "jose";

// بلیت کوتاه‌عمر «قرارداد CIP تأیید شد» — بعد از بررسی موفق کد پیامک صادر می‌شود و برای
// ساخت سفارش پرداخت همان کاربر معتبر است. متن قرارداد پیش از این مرحله به مشتری نشان داده می‌شود.
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");
const TICKET_TTL = "15m";
const TICKET_TYPE = "cip_contract_acceptance";

export async function signCipContractTicket(userId: number): Promise<string> {
  return new SignJWT({ typ: TICKET_TYPE, sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TICKET_TTL)
    .sign(JWT_SECRET);
}

export async function verifyCipContractTicket(token: unknown, userId: number): Promise<boolean> {
  if (typeof token !== "string" || !token) return false;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.typ === TICKET_TYPE && payload.sub === String(userId);
  } catch {
    return false;
  }
}
