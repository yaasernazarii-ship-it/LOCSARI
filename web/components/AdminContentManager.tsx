"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AdminContentRowActions from "@/components/AdminContentRowActions";
import SiteContentBlocksForm from "@/components/SiteContentBlocksForm";

type Page = {
  id: number;
  title: string;
  slug: string;
  is_published: boolean;
  sort_order: number;
  updated_at: string;
};

type Props = { pages: Page[]; canCreate: boolean; canEdit: boolean; canDelete: boolean };

export default function AdminContentManager({ pages, canCreate, canEdit, canDelete }: Props) {
  const [tab, setTab] = useState<"pages" | "home">("pages");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const filtered = useMemo(
    () => pages.filter((item) => `${item.title} ${item.slug}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),
    [pages, query]
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <>
      <div className="content-tabs" role="tablist" aria-label="بخش‌های محتوا">
        <button type="button" role="tab" aria-selected={tab === "pages"} className={tab === "pages" ? "content-tabs__tab content-tabs__tab--active" : "content-tabs__tab"} onClick={() => setTab("pages")}>صفحات سایت</button>
        <button type="button" role="tab" aria-selected={tab === "home"} className={tab === "home" ? "content-tabs__tab content-tabs__tab--active" : "content-tabs__tab"} onClick={() => setTab("home")}>متن‌ها و بنرهای صفحه اصلی</button>
      </div>

      {tab === "pages" ? (
        <>
          <div className="admin-page-header admin-page-header--row">
            <div><h2>صفحات سایت</h2><p>صفحات درباره ما، تماس با ما، قوانین و سایر صفحات عمومی سایت.</p></div>
            {canCreate && <Link href="/admin/content/new" className="btn-primary admin-header-btn">+ صفحهٔ جدید</Link>}
          </div>
          <div className="admin-table-toolbar">
            <input aria-label="جست‌وجوی صفحات" placeholder="جست‌وجو در عنوان یا آدرس صفحه..." value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
            <span>{filtered.length.toLocaleString("fa-IR")} صفحه</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>عنوان</th><th>آدرس</th><th>وضعیت</th><th>ترتیب</th><th>آخرین به‌روزرسانی</th>{(canEdit || canDelete) && <th>عملیات</th>}</tr></thead>
              <tbody>
                {visible.map((item) => <tr key={item.id}>
                  <td>{item.title}</td>
                  <td dir="ltr" style={{ textAlign: "left" }}><span>/p/{item.slug}</span> <a href={`/p/${item.slug}`} target="_blank" rel="noreferrer" className="content-preview-link" aria-label={`مشاهدهٔ ${item.title}`}>↗</a></td>
                  <td><span className={`status-badge status-badge--${item.is_published ? "approved" : "draft"}`}>{item.is_published ? "منتشرشده" : "پیش‌نویس"}</span></td>
                  <td>{item.sort_order.toLocaleString("fa-IR")}</td>
                  <td>{new Date(item.updated_at).toLocaleString("fa-IR")}</td>
                  {(canEdit || canDelete) && <td><AdminContentRowActions pageId={item.id} canEdit={canEdit} canDelete={canDelete} /></td>}
                </tr>)}
                {visible.length === 0 && <tr><td colSpan={canEdit || canDelete ? 6 : 5} className="search-empty">صفحه‌ای مطابق جست‌وجو پیدا نشد.</td></tr>}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && <div className="admin-pagination"><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}>قبلی</button><span>صفحهٔ {currentPage.toLocaleString("fa-IR")} از {pageCount.toLocaleString("fa-IR")}</span><button type="button" disabled={currentPage === pageCount} onClick={() => setPage((value) => value + 1)}>بعدی</button></div>}
        </>
      ) : (
        <>
          <div className="admin-page-header"><h2>متن‌ها و بنرهای صفحه اصلی</h2><p>تیترها، متن‌های هدر و فوتر، دعوت به اقدام و معرفی پلن‌ها را ویرایش کنید.</p></div>
          {canEdit ? <SiteContentBlocksForm /> : <div className="admin-denied"><p>مجوز ویرایش محتوا را ندارید.</p></div>}
        </>
      )}
    </>
  );
}
