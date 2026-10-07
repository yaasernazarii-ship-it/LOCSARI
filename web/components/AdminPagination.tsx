import Link from "next/link";

// صفحه‌بندی مشترک صفحات لیست ادمین (فاز ۷.۱) — کاملاً سرور-رندر و بدون JS (لینک‌های Next.js).
// برای جلوگیری از تکرار، بین همهٔ صفحات لیست (آگهی/کاربر/آژانس/مشاور/درخواست) استفاده می‌شود.

export default function AdminPagination({
  basePath,
  searchParams,
  page,
  totalPages,
}: {
  basePath: string;
  searchParams: Record<string, string | undefined>;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  function pageHref(p: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="pagination">
      {page > 1 ? <Link href={pageHref(page - 1)}>قبلی</Link> : <span style={{ opacity: 0.4 }}>قبلی</span>}
      <span>
        صفحهٔ {page.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}
      </span>
      {page < totalPages ? <Link href={pageHref(page + 1)}>بعدی</Link> : <span style={{ opacity: 0.4 }}>بعدی</span>}
    </div>
  );
}
