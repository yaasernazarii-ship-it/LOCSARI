"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {

  return (
    <html lang="fa" dir="rtl">
      <body>
        <main className="auth-page">
          <h1>مشکلی پیش آمد</h1>
          <p>بارگذاری این صفحه کامل نشد. لطفاً دوباره تلاش کنید.</p>
          <button type="button" className="btn-primary" onClick={reset}>تلاش دوباره</button>
        </main>
      </body>
    </html>
  );
}
