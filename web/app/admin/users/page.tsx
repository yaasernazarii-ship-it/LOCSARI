import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import AdminPagination from "@/components/AdminPagination";

const PAGE_SIZE = 20;

type SP = Record<string, string | undefined>;

export default async function AdminUsersPage({ searchParams }: { searchParams: SP }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin-login");
  const allowed = await userHasPermission(user.id, "user.manage");
  if (!allowed) {
    return (
      <div className="admin-denied">
        <h1>عدم دسترسی</h1>
        <p>مجوز مدیریت کاربران را ندارید.</p>
      </div>
    );
  }

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const q = searchParams.q?.trim() || undefined;
  const status = searchParams.status === "active" || searchParams.status === "suspended" ? searchParams.status : undefined;
  const roleKey = searchParams.role?.trim() || undefined;

  function buildQuery() {
    let query = db.selectFrom("users");
    if (status) query = query.where("status", "=", status);
    if (q) {
      query = query.where((eb) => eb.or([eb("name", "ilike", `%${q}%`), eb("phone", "ilike", `%${q}%`)]));
    }
    if (roleKey) {
      query = query.where((eb) =>
        eb.exists(
          eb
            .selectFrom("user_roles")
            .innerJoin("roles", "roles.id", "user_roles.role_id")
            .select("user_roles.user_id")
            .whereRef("user_roles.user_id", "=", "users.id")
            .where("roles.key", "=", roleKey)
        )
      );
    }
    return query;
  }

  const [{ count }, rows, roles] = await Promise.all([
    buildQuery()
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow(),
    buildQuery()
      .select(["id", "name", "phone", "status", "created_at"])
      .orderBy("created_at", "desc")
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .execute(),
    db.selectFrom("roles").select(["key", "title_fa"]).execute(),
  ]);

  const userIds = rows.map((r) => r.id);
  const roleRows = userIds.length
    ? await db
        .selectFrom("user_roles")
        .innerJoin("roles", "roles.id", "user_roles.role_id")
        .select(["user_roles.user_id", "roles.title_fa"])
        .where("user_roles.user_id", "in", userIds)
        .execute()
    : [];
  const rolesByUser = new Map<number, string[]>();
  for (const r of roleRows) {
    if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, []);
    rolesByUser.get(r.user_id)!.push(r.title_fa);
  }

  const totalPages = Math.max(1, Math.ceil(Number(count) / PAGE_SIZE));

  return (
    <>
      <div className="admin-page-header">
        <h1>کاربران</h1>
        <p>{Number(count).toLocaleString("fa-IR")} کاربر مطابق فیلترهای فعلی.</p>
      </div>

      <div className="admin-filters">
        <form method="get">
          <div>
            <label htmlFor="q">جستجو (نام/موبایل)</label>
            <input type="text" id="q" name="q" defaultValue={q ?? ""} />
          </div>
          <div>
            <label htmlFor="status">وضعیت</label>
            <select id="status" name="status" defaultValue={status ?? ""}>
              <option value="">همه</option>
              <option value="active">فعال</option>
              <option value="suspended">تعلیق‌شده</option>
            </select>
          </div>
          <div>
            <label htmlFor="role">نقش</label>
            <select id="role" name="role" defaultValue={roleKey ?? ""}>
              <option value="">همه</option>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.title_fa}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-filters__submit">
            <button type="submit" className="btn-primary" style={{ width: "auto", padding: "9px 20px" }}>
              اعمال فیلتر
            </button>
          </div>
        </form>
      </div>

      <div className="admin-table-wrap">
        {rows.length === 0 ? (
          <p className="admin-table-empty">هیچ کاربری مطابق فیلترها یافت نشد.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>شناسه</th>
                <th>نام</th>
                <th>موبایل</th>
                <th>وضعیت</th>
                <th>نقش‌ها</th>
                <th>تاریخ عضویت</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>
                    <Link href={`/admin/users/${u.id}`}>{u.name}</Link>
                  </td>
                  <td>{u.phone}</td>
                  <td>
                    <span className={`status-badge status-badge--${u.status === "active" ? "approved" : "suspended"}`}>
                      {u.status === "active" ? "فعال" : "تعلیق‌شده"}
                    </span>
                  </td>
                  <td>{(rolesByUser.get(u.id) ?? []).join("، ") || "—"}</td>
                  <td>{new Date(u.created_at).toLocaleDateString("fa-IR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AdminPagination basePath="/admin/users" searchParams={searchParams} page={page} totalPages={totalPages} />
    </>
  );
}
