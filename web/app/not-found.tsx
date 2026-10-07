import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-page">
      <h1>صفحه پیدا نشد</h1>
      <p>آدرس واردشده وجود ندارد یا این محتوا دیگر در دسترس نیست.</p>
      <Link href="/" className="btn-primary">بازگشت به صفحهٔ اصلی</Link>
    </main>
  );
}
