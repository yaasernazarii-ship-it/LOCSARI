import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getSiteContent } from "@/lib/siteContent";
import HeaderMobileMenu from "@/components/HeaderMobileMenu";

export default async function Header() {
  const [user, content] = await Promise.all([getCurrentUser(), getSiteContent()]);

  return (
    <header className="site-header">
      <div className="site-header__bar">
        <Link href="/amlak" className="site-header__logo">
          <img src="/icon-192-v2.png" alt="" width={30} height={30} className="site-header__logo-mark" />
          <strong>{content["header.site_name"]}</strong>
        </Link>

        <HeaderMobileMenu user={user} />
      </div>
    </header>
  );
}
