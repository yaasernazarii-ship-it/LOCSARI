// تبدیل لینک عمومی آپارات (مثلاً https://www.aparat.com/v/xxxxx) به لینک embed قابل‌نمایش در iframe

export function isValidAparatUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  try {
    const url = new URL(value.trim());
    return (url.protocol === "https:" || url.protocol === "http:") && /(^|\.)aparat\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export function toAparatEmbedUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim());
    if (!/(^|\.)aparat\.com$/i.test(url.hostname)) return null;

    if (url.pathname.includes("/embed")) return url.toString();

    // مسیرهای رایج: /v/HASH یا /video/video/video/videohash/HASH/vt/...
    const vMatch = url.pathname.match(/\/v\/([a-zA-Z0-9]+)/);
    const hash = vMatch?.[1] ?? url.pathname.match(/videohash\/([a-zA-Z0-9]+)/)?.[1];
    if (!hash) return null;

    return `https://www.aparat.com/video/video/embed/videohash/${hash}/vt/frame`;
  } catch {
    return null;
  }
}
