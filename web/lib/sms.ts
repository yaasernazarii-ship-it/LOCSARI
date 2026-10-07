// فاز ۱.۲ — کلاینت رسمی SMS.ir برای ارسال پیامک الگو (Pattern/Verify)
// مطابق مستندات رسمی: https://sms.ir/rest-api/  →  POST https://api.sms.ir/v1/send/verify
// احراز هویت با هدر x-api-key. ارسال واقعی فقط زمانی رخ می‌دهد که SMSIR_API_KEY در environment ست شده باشد.

const SMSIR_VERIFY_URL = "https://api.sms.ir/v1/send/verify";

// Pattern تأییدشده برای این پروژه (کد تأیید OTP). با SMSIR_OTP_TEMPLATE_ID در env قابل override است.
const DEFAULT_TEMPLATE_ID = 350003;
// نام پارامتر پیش‌فرض قالب‌های «کد تأیید» در پنل SMS.ir. اگر قالب واقعی نام دیگری دارد
// (مثلاً OTP)، با SMSIR_OTP_PARAM_NAME در env مقداردهی شود.
const DEFAULT_PARAM_NAME = "otp";

export class SmsSendError extends Error {}

export function isSmsConfigured(): boolean {
  return Boolean(process.env.SMSIR_API_KEY);
}

interface SmsIrVerifyResponse {
  status: number;
  message?: string;
  data?: { messageId?: number; cost?: number };
}

/** کد OTP را از طریق قالب (Pattern) تأییدشدهٔ SMS.ir ارسال می‌کند. در صورت خطا SmsSendError پرتاب می‌شود. */
export async function sendOtpSms(phone: string, code: string): Promise<void> {
  const apiKey = process.env.SMSIR_API_KEY;
  if (!apiKey) throw new SmsSendError("SMSIR_API_KEY تنظیم نشده است");

  const templateId = Number(process.env.SMSIR_OTP_TEMPLATE_ID || DEFAULT_TEMPLATE_ID);
  const paramName = process.env.SMSIR_OTP_PARAM_NAME || DEFAULT_PARAM_NAME;

  let res: Response;
  try {
    res = await fetch(SMSIR_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/plain",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        mobile: phone,
        templateId,
        parameters: [{ name: paramName, value: code }],
      }),
    });
  } catch {
    throw new SmsSendError("اتصال به سرویس پیامک برقرار نشد");
  }

  const data = (await res.json().catch(() => null)) as SmsIrVerifyResponse | null;
  if (!res.ok || !data || data.status !== 1) {
    throw new SmsSendError(data?.message || `خطای ارسال پیامک (HTTP ${res.status})`);
  }
}
