import type { ReactNode } from "react";
import { Phone, MapPin } from "lucide-react";
import { FaTelegram, FaInstagram, FaWhatsapp, FaCommentDots } from "react-icons/fa6";
import { db } from "@/lib/db";
import { getSiteContent } from "@/lib/siteContent";

export const metadata = {
  title: "تماس با ما | لوکیشن ساری",
  description: "راه‌های ارتباطی با تیم لوکیشن ساری؛ آدرس، شماره تماس و شبکه‌های اجتماعی برای مشاوره خرید، فروش، رهن یا اجاره ملک در ساری.",
};

function normalizePhoneHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

export default async function ContactPage() {
  const [contact, content] = await Promise.all([
    db.selectFrom("site_contact_info").selectAll().where("id", "=", 1).executeTakeFirst(),
    getSiteContent(),
  ]);

  const cards: { key: string; icon: ReactNode; label: string; value: string; href: string }[] = [];

  const phones = (contact?.phones ?? []).filter((p): p is string => !!p);
  phones.forEach((phone, i) => {
    const label = phones.length > 1 ? `تماس تلفنی (${(i + 1).toLocaleString("fa-IR")})` : "تماس تلفنی";
    cards.push({ key: `phone${i}`, icon: <Phone size={20} />, label, value: phone, href: normalizePhoneHref(phone) });
  });
  if (contact?.telegram_url) {
    cards.push({ key: "telegram", icon: <FaTelegram size={20} />, label: "تلگرام", value: "ورود به کانال/آیدی تلگرام", href: contact.telegram_url });
  }
  if (contact?.instagram_url) {
    cards.push({ key: "instagram", icon: <FaInstagram size={20} />, label: "اینستاگرام", value: "ورود به صفحهٔ اینستاگرام", href: contact.instagram_url });
  }
  if (contact?.eitaa_url) {
    cards.push({ key: "eitaa", icon: <FaCommentDots size={20} />, label: "ایتا", value: "ورود به آیدی ایتا", href: contact.eitaa_url });
  }
  if (contact?.whatsapp_url) {
    cards.push({ key: "whatsapp", icon: <FaWhatsapp size={20} />, label: "واتس‌اپ", value: "ارسال پیام در واتس‌اپ", href: contact.whatsapp_url });
  }

  return (
    <div className="static-page">
      <h1>تماس با ما</h1>
      <div className="static-page__body">
        <p>{content["contact.intro"]}</p>
        {content["contact.intro.image"] && <img src={content["contact.intro.image"]} alt="تماس با ما" />}
      </div>

      {contact?.address && (
        <div className="contact-info-card" style={{ marginBottom: 14 }}>
          <span className="contact-info-card__icon">
            <MapPin size={20} />
          </span>
          <span>
            <span className="contact-info-card__label" style={{ display: "block" }}>
              آدرس
            </span>
            <span className="contact-info-card__value">{contact.address}</span>
          </span>
        </div>
      )}

      {cards.length > 0 ? (
        <div className="contact-info-grid">
          {cards.map((c) => (
            <a key={c.key} className="contact-info-card" href={c.href} target={c.href.startsWith("tel:") ? undefined : "_blank"} rel={c.href.startsWith("tel:") ? undefined : "noopener noreferrer"}>
              <span className="contact-info-card__icon">{c.icon}</span>
              <span>
                <span className="contact-info-card__label" style={{ display: "block" }}>
                  {c.label}
                </span>
                <span className="contact-info-card__value">{c.value}</span>
              </span>
            </a>
          ))}
        </div>
      ) : (
        !contact?.address && <p className="search-empty">اطلاعات تماس هنوز ثبت نشده است.</p>
      )}
    </div>
  );
}
