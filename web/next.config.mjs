// Node 18 (نسخهٔ فعلی سرور) به‌طور پیش‌فرض global File را ندارد (از Node 20 اضافه شده)؛
// Next.js هنگام پردازش multipart/form-data (آپلود تصویر ملک) به آن نیاز دارد.
// این Polyfill سبک، بدون تغییر نسخهٔ Node روی سرور، مشکل «File is not defined» را رفع می‌کند.
if (typeof globalThis.File === "undefined") {
  const { File } = await import("node:buffer");
  globalThis.File = File;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    cpus: 1,
  },
};

export default nextConfig;
