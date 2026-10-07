"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Media = { id: number; url: string; altText: string | null; isPrimary: boolean };

export default function AdvertisementGallery({ media, title }: { media: Media[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const activeMedia = media[activeIndex];

  function previous() {
    setActiveIndex((index) => (index - 1 + media.length) % media.length);
  }

  function next() {
    setActiveIndex((index) => (index + 1) % media.length);
  }

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowRight") previous();
      if (event.key === "ArrowLeft") next();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, media.length]);

  if (!activeMedia) return null;

  return (
    <>
      <div className="detail-gallery">
        <button type="button" className="detail-gallery__hero-button" onClick={() => setOpen(true)} aria-label="نمایش بزرگ تصویر">
          <img src={activeMedia.url} alt={activeMedia.altText || title} className="detail-gallery__hero" />
          <span className="detail-gallery__watermark"><img src="/icon-192-v2.png" alt="" />لوکیشن ساری</span>
        </button>
        {media.length > 1 && (
          <div className="detail-gallery__thumbs">
            {media.map((item, index) => (
              <button
                type="button"
                key={item.id}
                className={index === activeIndex ? "detail-gallery__thumb detail-gallery__thumb--active" : "detail-gallery__thumb"}
                onClick={() => setActiveIndex(index)}
                aria-label={`نمایش تصویر ${index + 1}`}
              >
                <img src={item.url} alt={item.altText || title} />
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="نمایش تصویر">
          <button type="button" className="image-lightbox__backdrop" onClick={() => setOpen(false)} aria-label="بستن نمایش تصویر" />
          <div className="image-lightbox__content">
            <button type="button" className="image-lightbox__close" onClick={() => setOpen(false)} aria-label="بستن"><X size={24} /></button>
            {media.length > 1 && <button type="button" className="image-lightbox__nav image-lightbox__nav--next" onClick={next} aria-label="تصویر بعدی"><ChevronRight size={30} /></button>}
            <img src={activeMedia.url} alt={activeMedia.altText || title} />
            <span className="image-lightbox__watermark"><img src="/icon-192-v2.png" alt="" />لوکیشن ساری</span>
            {media.length > 1 && <button type="button" className="image-lightbox__nav image-lightbox__nav--previous" onClick={previous} aria-label="تصویر قبلی"><ChevronLeft size={30} /></button>}
          </div>
        </div>
      )}
    </>
  );
}
