const ZIBAL_API = "https://gateway.zibal.ir/v1";

interface ZibalResponse {
  result: number;
  message?: string;
  trackId?: number;
  refNumber?: string;
  cardNumber?: string;
}

function merchantId(hostname?: string): string {
  const merchant = hostname?.toLowerCase().endsWith(".com")
    ? process.env.ZIBAL_MERCHANT_COM?.trim()
    : process.env.ZIBAL_MERCHANT?.trim();
  if (!merchant) throw new Error("درگاه پرداخت این دامنه هنوز پیکربندی نشده است");
  return merchant;
}

function apiToken(hostname?: string): string | undefined {
  return (hostname?.toLowerCase().endsWith(".com") ? process.env.ZIBAL_API_TOKEN_COM : process.env.ZIBAL_API_TOKEN)?.trim() || undefined;
}

async function callZibal(path: "request" | "verify", body: Record<string, unknown>, hostname?: string): Promise<ZibalResponse> {
  const token = apiToken(hostname);
  const response = await fetch(`${ZIBAL_API}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await response.json().catch(() => null)) as ZibalResponse | null;
  if (!response.ok || !data) throw new Error("ارتباط با درگاه پرداخت ناموفق بود");
  return data;
}

export async function createZibalPayment(amountRial: number, callbackUrl: string, description: string) {
  const callbackHostname = new URL(callbackUrl).hostname;
  const result = await callZibal(
    "request",
    {
      merchant: merchantId(callbackHostname),
      amount: amountRial,
      callbackUrl,
      description,
    },
    callbackHostname
  );
  if (result.result !== 100 || !result.trackId) throw new Error(result.message || "ایجاد درخواست پرداخت ناموفق بود");
  return { authority: String(result.trackId), redirectUrl: `https://gateway.zibal.ir/start/${result.trackId}` };
}

export async function verifyZibalPayment(authority: string, amountRial: number, hostname?: string) {
  const result = await callZibal("verify", {
    merchant: merchantId(hostname),
    trackId: Number(authority),
    amount: amountRial,
  }, hostname);
  return {
    success: result.result === 100 || result.result === 201,
    result,
    refId: result.refNumber ?? null,
    cardPan: result.cardNumber ?? null,
  };
}
