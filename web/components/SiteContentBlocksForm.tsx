"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/lib/adminToast";

type Block = { content_key: string; page_key: string; section_key: string; label_fa: string; value: string };

const PAGE_TITLES: Record<string, string> = {
  header: "هدر",
  footer: "فوتر",
  home: "صفحهٔ اصلی",
  vip: "صفحهٔ آگهی‌های VIP",
  contact: "صفحهٔ تماس با ما",
  cip: "صفحهٔ آگهی‌های CIP",
};

const SECTION_TITLES: Record<string, string> = {
  header: "هدر",
  footer: "فوتر",
  hero: "بخش آغازین",
  latest_ads: "جدیدترین آگهی‌ها",
  cta: "دعوت به اقدام",
  intro: "معرفی",
  list: "فهرست",
};

export default function SiteContentBlocksForm({ pageKeys }: { pageKeys?: string[] } = {}) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/content/blocks")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "خطا در بارگذاری محتوا");
        const filtered = pageKeys ? data.blocks.filter((b: Block) => pageKeys.includes(b.page_key)) : data.blocks;
        setBlocks(filtered);
        setValues(Object.fromEntries(filtered.map((block: Block) => [block.content_key, block.value])));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "خطا در بارگذاری محتوا"))
      .finally(() => setLoading(false));
  }, [pageKeys]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/content/blocks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ذخیره‌سازی");
      showToast("محتوای سایت ذخیره شد", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ذخیره‌سازی");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="search-empty">در حال بارگذاری...</p>;
  const groups = blocks.reduce<Record<string, Block[]>>((acc, block) => {
    (acc[block.page_key] ??= []).push(block);
    return acc;
  }, {});
  const groupedSections = (groupKey: string, pageBlocks: Block[]) => {
    const sections = pageBlocks.reduce<Record<string, Block[]>>((acc, block) => {
      (acc[block.section_key] ??= []).push(block);
      return acc;
    }, {});
    return Object.entries(sections).map(([sectionKey, sectionBlocks]) => [
      sectionKey,
      [...sectionBlocks,
        { content_key: `${groupKey}.${sectionKey}.image`, page_key: groupKey, section_key: sectionKey, label_fa: "تصویر یا بنر بخش", value: values[`${groupKey}.${sectionKey}.image`] ?? "" },
        { content_key: `${groupKey}.${sectionKey}.button_url`, page_key: groupKey, section_key: sectionKey, label_fa: "لینک دکمهٔ بخش", value: values[`${groupKey}.${sectionKey}.button_url`] ?? "" },
      ],
    ] as [string, Block[]]);
  };

  return (
    <>
      {error && <p className="my-ad__error">{error}</p>}
      {Object.entries(groups).map(([groupKey, pageBlocks]) => (
        <section key={groupKey} className="form-section fade-in">
          {Object.keys(groups).length > 1 && <h2>{PAGE_TITLES[groupKey] ?? groupKey}</h2>}
          {groupedSections(groupKey, pageBlocks).map(([sectionKey, sectionBlocks]) => (
            <div key={sectionKey} className="form-section" style={{ margin: "0 0 16px", padding: 0, border: 0 }}>
              <h3>{SECTION_TITLES[sectionKey] ?? sectionKey}</h3>
              {sectionBlocks.map((block) => (
                <div className="form-group" key={block.content_key}>
                  <label>{block.label_fa}</label>
                  {block.content_key.endsWith(".image") || block.content_key.endsWith(".button_url") ? (
                    <input type="url" dir="ltr" placeholder={block.content_key.endsWith(".image") ? "https://..." : "https://..."} value={values[block.content_key] ?? ""} onChange={(e) => setValues((current) => ({ ...current, [block.content_key]: e.target.value }))} />
                  ) : block.value.length > 120 ? (
                    <textarea rows={4} value={values[block.content_key] ?? ""} onChange={(e) => setValues((current) => ({ ...current, [block.content_key]: e.target.value }))} />
                  ) : (
                    <input type="text" value={values[block.content_key] ?? ""} onChange={(e) => setValues((current) => ({ ...current, [block.content_key]: e.target.value }))} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}
      {blocks.length === 0 && <p className="search-empty">بخشی برای این صفحه تعریف نشده است.</p>}
      <div className="admin-actions-bar">
        <button className="btn-primary" type="button" onClick={save} disabled={saving}>{saving ? "در حال ذخیره..." : "ذخیرهٔ تغییرات"}</button>
      </div>
    </>
  );
}
