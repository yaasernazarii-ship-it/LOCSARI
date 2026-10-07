// کش سادهٔ درون‌حافظه‌ای با TTL — برای داده‌های کم‌تغییر (Categories, Locations, Filter Metadata).
// مناسب یک پروسهٔ تک‌نمونه‌ای (systemd، بدون Redis)؛ مطابق بخش ۳۵ پرامپت فاز ۴.

const store = new Map<string, { value: unknown; expiresAt: number }>();

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;
  const value = await loader();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
