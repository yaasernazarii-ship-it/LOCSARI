"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

type HeaderUser = { name: string } | null;

export default function HeaderMobileMenu({ user }: { user: HeaderUser }) {
  function closeMenu() {
    const toggle = document.getElementById("header-menu-toggle") as HTMLInputElement | null;
    if (toggle) toggle.checked = false;
  }

  return (
    <>
      <input type="checkbox" id="header-menu-toggle" className="header-menu-toggle" />
      <label htmlFor="header-menu-toggle" className="header-menu-btn" aria-label="باز کردن منو">
        <Menu size={22} />
      </label>

      <nav className="site-header__nav">
        <Link href="/amlak" onClick={closeMenu}>آگهی‌های املاک</Link>
        <Link href="/vip" onClick={closeMenu}>آگهی‌های VIP</Link>
        <Link href="/cip" onClick={closeMenu}>آگهی‌های CIP</Link>
        <Link href="/account/advertisements/new" onClick={closeMenu}>ثبت آگهی</Link>
        <Link href="/p/about" onClick={closeMenu}>درباره ما</Link>
        <Link href="/contact" onClick={closeMenu}>تماس با ما</Link>

        {user ? (
          <span className="site-header__account">
            <Link href="/account/favorites" onClick={closeMenu}>علاقه‌مندی‌ها</Link>
            <Link href="/account" onClick={closeMenu}>حساب من ({user.name})</Link>
            <LogoutButton />
          </span>
        ) : (
          <span className="site-header__account">
            <Link href="/login" onClick={closeMenu}>ورود / ثبت‌نام</Link>
          </span>
        )}
      </nav>
    </>
  );
}
