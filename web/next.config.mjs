// Node 18 (نسخهٔ فعلی سرور) به‌طور پیش‌فرض global File را ندارد (از Node 20 اضافه شده)؛
// Next.js هنگام پردازش multipart/form-data (آپلود تصویر ملک) به آن نیاز دارد.
// این Polyfill سبک، بدون تغییر نسخهٔ Node روی سرور، مشکل «File is not defined» را رفع می‌کند.
if (typeof globalThis.File === "undefined") {
  const { File } = await import("node:buffer");
  globalThis.File = File;
}

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' https://cdn.jsdelivr.net; connect-src 'self' https:; frame-src 'self' https://www.aparat.com; media-src 'self' blob: https:",
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    cpus: 1,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
