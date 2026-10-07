"use client";

interface Props {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number | null, longitude: number | null, label?: string) => void;
}

export default function LocationPicker(_props: Props) {
  return (
    <div className="form-group">
      <label>موقعیت مکانی دقیق روی نقشه</label>
      <p className="form-hint">سرویس نقشه موقتاً در دسترس نیست و پس از پیکربندی مجدد فعال می‌شود.</p>
    </div>
  );
}
