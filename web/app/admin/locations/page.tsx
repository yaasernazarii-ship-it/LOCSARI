import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import AdminLocationEntityManager from "@/components/AdminLocationEntityManager";

export default async function AdminLocationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "location.view");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مشاهدهٔ موقعیت‌های ملک را ندارید.</p>
      </div>
    );
  }

  const canManageNeighborhoods = await userHasPermission(user.id, "neighborhood.create");
  const [provinces, cities, neighborhoods] = await Promise.all([
    db.selectFrom("provinces").select(["id", "name", "is_active"]).orderBy("sort_order", "asc").execute(),
    db.selectFrom("cities").select(["id", "province_id", "name", "is_active"]).orderBy("sort_order", "asc").execute(),
    db.selectFrom("neighborhoods").select(["id", "city_id", "name", "slug", "is_active"]).orderBy("sort_order", "asc").execute(),
  ]);

  const citiesByProvince = new Map<number, typeof cities>();
  for (const c of cities) citiesByProvince.set(c.province_id, [...(citiesByProvince.get(c.province_id) ?? []), c]);

  const neighborhoodsByCity = new Map<number, typeof neighborhoods>();
  for (const n of neighborhoods) neighborhoodsByCity.set(n.city_id, [...(neighborhoodsByCity.get(n.city_id) ?? []), n]);

  function StatusDot({ active }: { active: boolean }) {
    return (
      <span className={`status-badge status-badge--${active ? "approved" : "suspended"}`} style={{ marginRight: 8 }}>
        {active ? "فعال" : "غیرفعال"}
      </span>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1>موقعیت ملک</h1>
        <p>
          {provinces.length.toLocaleString("fa-IR")} استان · {cities.length.toLocaleString("fa-IR")} شهر · {neighborhoods.length.toLocaleString("fa-IR")} موقعیت ملک
        </p>
      </div>

      <div className="admin-tree">
        {provinces.map((p) => (
          <details key={p.id} open>
            <summary>
              {p.name} <StatusDot active={p.is_active} />
            </summary>
            <ul>
              {(citiesByProvince.get(p.id) ?? []).map((c) => {
                const cityNeighborhoods = neighborhoodsByCity.get(c.id) ?? [];
                return (
                  <li key={c.id}>
                    <details open>
                      <summary>
                        {c.name} <StatusDot active={c.is_active} />
                      </summary>
                      {canManageNeighborhoods ? (
                        <AdminLocationEntityManager cityId={c.id} items={cityNeighborhoods} />
                      ) : (
                        <>
                          <h3>موقعیت‌های ملک</h3>
                          <ul>
                            {cityNeighborhoods.map((n) => (
                              <li key={n.id}>
                                {n.name} <StatusDot active={n.is_active} />
                              </li>
                            ))}
                            {cityNeighborhoods.length === 0 && <li style={{ color: "#999" }}>—</li>}
                          </ul>
                        </>
                      )}
                    </details>
                  </li>
                );
              })}
              {(citiesByProvince.get(p.id) ?? []).length === 0 && <li style={{ color: "#999" }}>شهری ثبت نشده است.</li>}
            </ul>
          </details>
        ))}
        {provinces.length === 0 && <p className="search-empty">استانی ثبت نشده است.</p>}
      </div>
    </>
  );
}
