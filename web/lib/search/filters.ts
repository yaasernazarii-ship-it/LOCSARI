// جستجو روی ویژگی‌های پویای دسته‌بندی (بخش ۱۳ پرامپت فاز ۴) — روی property_attributes / property_attribute_options
// بازاستفاده از فیلدهای فاز ۲ (category_fields) بدون هیچ Hard-code. همه مقادیر Parameterized (sql tag) هستند.

import { sql, RawBuilder } from "kysely";
import { db } from "../db";

export type AttributeResolveResult = { ok: true; conditions: RawBuilder<boolean>[] } | { ok: false; error: string };

/**
 * برای هر (key, rawValue) در attrs، فیلد فعال متعلق به categoryId را می‌یابد، نوع مقدار را با field_type
 * تطبیق می‌دهد و یک شرط EXISTS پارامتری‌شده تولید می‌کند که روی Query اصلی اعمال می‌شود.
 */
export async function resolveAttributeFilters(categoryId: number, attrs: Record<string, string>): Promise<AttributeResolveResult> {
  const keys = Object.keys(attrs);
  if (keys.length === 0) return { ok: true, conditions: [] };

  const fields = await db
    .selectFrom("category_fields")
    .selectAll()
    .where("category_id", "=", categoryId)
    .where("is_active", "=", true)
    .where("key", "in", keys)
    .execute();

  const fieldByKey = new Map(fields.map((f) => [f.key, f]));
  const conditions: RawBuilder<boolean>[] = [];

  for (const key of keys) {
    const field = fieldByKey.get(key);
    if (!field) return { ok: false, error: `فیلد ویژگی نامعتبر است یا متعلق به این دسته‌بندی نیست: ${key}` };
    const raw = attrs[key];
    const fieldId = field.id;

    if (field.field_type === "boolean") {
      if (raw !== "true" && raw !== "false") return { ok: false, error: `مقدار ${key} باید true یا false باشد` };
      const boolValue = raw === "true";
      conditions.push(
        sql<boolean>`exists (select 1 from property_attributes pa where pa.property_id = properties.id and pa.field_id = ${fieldId} and pa.value_boolean = ${boolValue})`
      );
    } else if (field.field_type === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) return { ok: false, error: `مقدار ${key} باید عدد باشد` };
      conditions.push(
        sql<boolean>`exists (select 1 from property_attributes pa where pa.property_id = properties.id and pa.field_id = ${fieldId} and pa.value_number = ${n})`
      );
    } else if (field.field_type === "date") {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return { ok: false, error: `مقدار ${key} باید تاریخ معتبر باشد` };
      const dateStr = d.toISOString().slice(0, 10);
      conditions.push(
        sql<boolean>`exists (select 1 from property_attributes pa where pa.property_id = properties.id and pa.field_id = ${fieldId} and pa.value_date = ${dateStr})`
      );
    } else if (field.field_type === "text") {
      if (!raw.trim()) return { ok: false, error: `مقدار ${key} نامعتبر است` };
      conditions.push(
        sql<boolean>`exists (select 1 from property_attributes pa where pa.property_id = properties.id and pa.field_id = ${fieldId} and pa.value_text = ${raw})`
      );
    } else if (field.field_type === "select" || field.field_type === "multi_select") {
      const values = raw
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length === 0) return { ok: false, error: `مقدار ${key} نامعتبر است` };
      if (field.field_type === "select" && values.length > 1) return { ok: false, error: `${key} فقط یک مقدار می‌پذیرد` };

      const options = await db
        .selectFrom("category_field_options")
        .select(["id", "value"])
        .where("field_id", "=", fieldId)
        .where("is_active", "=", true)
        .where("value", "in", values)
        .execute();
      if (options.length !== values.length) return { ok: false, error: `مقدار ${key} نامعتبر است` };
      const optionIds = options.map((o) => o.id);

      conditions.push(
        sql<boolean>`exists (select 1 from property_attribute_options pao where pao.property_id = properties.id and pao.field_id = ${fieldId} and pao.option_id in (${sql.join(optionIds)}))`
      );
    }
  }

  return { ok: true, conditions };
}
