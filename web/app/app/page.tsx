import type { Metadata } from "next";
import { Check, Download, PlusSquare, Share, Smartphone, Store } from "lucide-react";

export const metadata: Metadata = {
  title: "دریافت اپلیکیشن",
  description: "نسخهٔ اندروید و راهنمای نصب وب‌اپلیکیشن لوکیشن ساری روی آیفون.",
};

const androidDownloadUrl = "https://github.com/yaasernazarii-ship-it/LOCSARI/releases/download/1.0.0/locsarii.apk";

export default function AppDownloadPage() {
  return (
    <div className="app-download-page">
      <section className="app-download-hero">
        <div className="app-download-hero__icon"><Smartphone size={34} /></div>
        <p className="app-download-hero__eyebrow">همراه شما در بازار ملک ساری</p>
        <h1>لوکیشن ساری را روی دستگاه خود داشته باشید</h1>
        <p>نسخهٔ مناسب دستگاهتان را انتخاب کنید تا آگهی‌ها، مشاوران و فرصت‌های جدید را سریع‌تر دنبال کنید.</p>
      </section>

      <section className="app-download-options" aria-label="روش‌های دریافت اپلیکیشن">
        <article className="app-download-card app-download-card--featured">
          <div className="app-download-card__icon"><Download size={26} /></div>
          <div>
            <h2>اندروید</h2>
            <p>فایل APK رسمی را مستقیم دانلود و نصب کنید.</p>
          </div>
          <a
            className="app-download-button app-download-button--primary"
            href={androidDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download size={19} /> دانلود APK اندروید
          </a>
          <p className="app-download-card__note">برای نصب، در صورت نیاز اجازهٔ نصب از منابع ناشناس را در تنظیمات گوشی فعال کنید.</p>
        </article>

        <article className="app-download-card">
          <div className="app-download-card__icon"><Store size={26} /></div>
          <div>
            <h2>کافه‌بازار</h2>
            <p>نسخهٔ رسمی بازار پس از تأیید و انتشار در دسترس قرار می‌گیرد.</p>
          </div>
          <span className="app-download-button app-download-button--disabled" aria-disabled="true">به‌زودی در کافه‌بازار</span>
        </article>
      </section>

      <section className="app-download-ios">
        <div className="app-download-ios__header">
          <div className="app-download-card__icon"><PlusSquare size={26} /></div>
          <div>
            <h2>آیفون و آیپد</h2>
            <p>لوکیشن ساری را به‌صورت وب‌اپلیکیشن روی صفحهٔ اصلی Safari نصب کنید.</p>
          </div>
        </div>
        <ol className="app-download-ios__steps">
          <li><span>۱</span><div><strong>سایت را در Safari باز کنید</strong><p>برای نصب، از مرورگر Safari در آیفون یا آیپد استفاده کنید.</p></div></li>
          <li><span>۲</span><div><strong>دکمهٔ Share را بزنید</strong><p>در نوار پایین Safari، آیکن اشتراک‌گذاری <Share size={15} aria-label="اشتراک‌گذاری" /> را انتخاب کنید.</p></div></li>
          <li><span>۳</span><div><strong>گزینهٔ Add to Home Screen را انتخاب کنید</strong><p>«افزودن به صفحهٔ اصلی» را انتخاب و سپس روی Add بزنید.</p></div></li>
        </ol>
        <div className="app-download-ios__result"><Check size={18} /> آیکن لوکیشن ساری مانند یک اپلیکیشن روی صفحهٔ اصلی شما قرار می‌گیرد.</div>
      </section>
    </div>
  );
}
