import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const MAX_FIELD_LENGTH = 500;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_FIELD_LENGTH) : "";
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  if (!checkRateLimit(`listing-description:${auth.user.id}`, 5, 10 * 60_000) || !checkRateLimit(`listing-description-ip:${getClientIp(req)}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "دستیار هوشمند هنوز پیکربندی نشده است" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const details = {
    title: text(body?.title),
    category: text(body?.category),
    location: text(body?.location),
    area: text(body?.area),
    builtArea: text(body?.builtArea),
    bedrooms: text(body?.bedrooms),
    builtYear: text(body?.builtYear),
    price: text(body?.price),
    deposit: text(body?.deposit),
    monthlyRent: text(body?.monthlyRent),
  };
  if (!details.title || !details.category) {
    return NextResponse.json({ error: "برای تولید توضیحات، عنوان و دسته‌بندی را وارد کنید" }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch("https://api.gapgpt.app/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        max_tokens: 350,
        messages: [
          {
            role: "system",
            content: "You are an expert Persian real-estate copywriter. Write an engaging, polished advertisement that begins with an appealing opening, highlights the listing's provided strengths naturally, and ends with a short invitation to contact for details. Use only the supplied facts: never invent amenities, prices, addresses, availability, guarantees, or contact information. Avoid generic filler, emojis, headings, and bullet points. Return only 3 to 5 fluent Persian sentences.",
          },
          { role: "user", content: `اطلاعات آگهی:\n${JSON.stringify(details)}` },
        ],
      }),
    });
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "unknown";
    console.error("Listing description service request could not be sent", { errorType });
    return NextResponse.json({ error: "تنظیمات سرویس تولید توضیحات نامعتبر است" }, { status: 502 });
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const errorType = typeof result?.error?.type === "string" ? result.error.type : "unknown";
    console.error("Listing description service request failed", { status: response.status, errorType });
    const error = response.status === 401 || response.status === 403
      ? "تنظیمات سرویس تولید توضیحات معتبر نیست"
      : response.status === 404
        ? "مدل تولید توضیحات در دسترس نیست"
        : response.status === 429
          ? "سهمیهٔ سرویس تولید توضیحات به پایان رسیده است؛ چند دقیقهٔ دیگر دوباره تلاش کنید"
          : "تولید توضیحات در حال حاضر ممکن نیست";
    return NextResponse.json({ error }, { status: 502 });
  }

  const description = result?.choices?.[0]?.message?.content?.trim();
  if (!description) return NextResponse.json({ error: "توضیح قابل استفاده‌ای تولید نشد" }, { status: 502 });
  return NextResponse.json({ description });
}
