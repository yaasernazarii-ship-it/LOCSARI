import { headers } from "next/headers";
import { getSiteContent } from "@/lib/siteContent";

const ENAMAD_IR = { id: "7599219", code: "rLdDrwvT5XB2CBylz4goyoQOO79wP9N5" };
const ENAMAD_COM = { id: "7769219", code: "D4CxlRSpXlgbMP6E6ZLJ6QR4z6OPWR4c" };

export default async function Footer() {
  const [content, requestHeaders] = await Promise.all([getSiteContent(), headers()]);
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const enamad = host.toLowerCase().split(":")[0].endsWith("locationsari.com") ? ENAMAD_COM : ENAMAD_IR;
  const trustSealUrl = `https://trustseal.enamad.ir/?id=${enamad.id}&Code=${enamad.code}`;
  const logoUrl = `https://trustseal.enamad.ir/logo.aspx?id=${enamad.id}&Code=${enamad.code}`;

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <a
          className="site-footer__enamad"
          href={trustSealUrl}
          referrerPolicy="origin"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            alt="نماد اعتماد الکترونیکی"
            referrerPolicy="origin"
            src={logoUrl}
          />
        </a>
        <span className="site-footer__copyright">
          © {new Date().toLocaleDateString("fa-IR", { year: "numeric" })} لوکیشن ساری — {content["footer.description"]} ·{" "}
          <a href="https://www.bardashtt.com/" target="_blank" rel="noopener noreferrer">
            طراحی و توسعه با خانه برداشت
          </a>
        </span>
      </div>
    </footer>
  );
}
