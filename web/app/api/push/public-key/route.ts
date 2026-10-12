import { NextResponse } from "next/server";

export async function GET() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  return NextResponse.json({ enabled: Boolean(publicKey), publicKey: publicKey ?? null });
}
