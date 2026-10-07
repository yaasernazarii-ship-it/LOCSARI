// ذخیره‌سازی و اعتبارسنجی فیلدهای پویای ملک (بخش ۴ پرامپت فاز ۳)
// فیلدها از category_fields/category_field_options (فاز ۲) می‌آیند؛ هیچ فیلدی اینجا Hard-code نیست.

import { Kysely, Transaction } from "kysely";
import { Database, db } from "./db";

export type DbOrTx = Kysely<Database> | Transaction<Database>;

export interface AttributeInput {
  fieldId: number;
  value: unknown; // معنای دقیق بسته به field_type فیلد تفسیر می‌شود
}

interface CategoryFieldRow {
  id: number;
  category_id: number;
  key: string;
  label_fa: string;
  field_type: string;
  is_required: boolean;
  is_active: boolean;
}

/** بارگذاری فیلدهای فعال یک دسته‌بندی به‌همراه گزینه‌های select/multi_select */
export async function loadActiveCategoryFields(
  categoryId: number,
  dbOrTx: DbOrTx = db
): Promise<Map<number, CategoryFieldRow & { optionIds: Set<number> }>> {
  const fields = await dbOrTx
    .selectFrom("category_fields")
    .select(["id", "category_id", "key", "label_fa", "field_type", "is_required", "is_active"])
    .where("category_id", "=", categoryId)
    .where("is_active", "=", true)
    .execute();

  const fieldIds = fields.map((f) => f.id);
  const options = fieldIds.length
    ? await dbOrTx
        .selectFrom("category_field_options")
        .select(["id", "field_id"])
        .where("field_id", "in", fieldIds)
        .where("is_active", "=", true)
        .execute()
    : [];

  const map = new Map<number, CategoryFieldRow & { optionIds: Set<number> }>();
  for (const f of fields) {
    map.set(f.id, { ...f, optionIds: new Set() });
  }
  for (const o of options) {
    map.get(o.field_id)?.optionIds.add(o.id);
  }
  return map;
}

export type AttributeValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * اعتبارسنجی و ذخیرهٔ کامل فیلدهای پویا برای یک Property.
 * قوانین: فیلد باید متعلق به همان categoryId و فعال باشد؛ مقدار باید مطابق field_type باشد؛
 * همهٔ فیلدهای is_required باید مقدار داشته باشند. در صورت خطا هیچ ردیفی نوشته نمی‌شود
 * (کل عملیات باید داخل یک Transaction فراخوانی شود).
 */
export async function validateAndSaveAttributes(
  tx: DbOrTx,
  propertyId: number,
  categoryId: number,
  attributes: AttributeInput[]
): Promise<AttributeValidationResult> {
  const fields = await loadActiveCategoryFields(categoryId, tx);

  const providedFieldIds = new Set<number>();

  for (const attr of attributes) {
    if (!Number.isInteger(attr.fieldId)) return { ok: false, error: "fieldId نامعتبر است" };
    const field = fields.get(attr.fieldId);
    if (!field) return { ok: false, error: `فیلد ${attr.fieldId} متعلق به این دسته‌بندی نیست یا فعال نیست` };
    providedFieldIds.add(field.id);

    const validated = validateFieldValue(field, attr.value);
    if (!validated.ok) return { ok: false, error: `${field.label_fa}: ${validated.error}` };

    // پاک‌سازی مقدار قبلی برای این فیلد (چه تک‌مقداری چه چندمقداری) — سپس درج مقدار جدید
    await tx.deleteFrom("property_attributes").where("property_id", "=", propertyId).where("field_id", "=", field.id).execute();
    await tx
      .deleteFrom("property_attribute_options")
      .where("property_id", "=", propertyId)
      .where("field_id", "=", field.id)
      .execute();

    if (field.field_type === "multi_select") {
      const optionIds = validated.optionIds!;
      if (optionIds.length > 0) {
        await tx
          .insertInto("property_attribute_options")
          .values(optionIds.map((optionId) => ({ property_id: propertyId, field_id: field.id, option_id: optionId })))
          .execute();
      }
    } else {
      await tx
        .insertInto("property_attributes")
        .values({
          property_id: propertyId,
          field_id: field.id,
          value_text: validated.valueText ?? null,
          value_number: validated.valueNumber ?? null,
          value_boolean: validated.valueBoolean ?? null,
          value_date: validated.valueDate ?? null,
          option_id: validated.optionId ?? null,
        })
        .execute();
    }
  }

  // بررسی فیلدهای اجباری فعال دسته‌بندی که مقدار برایشان ارسال نشده
  for (const field of fields.values()) {
    if (field.is_required && !providedFieldIds.has(field.id)) {
      return { ok: false, error: `فیلد اجباری «${field.label_fa}» ارسال نشده است` };
    }
  }

  return { ok: true };
}

interface ValidatedValue {
  ok: true;
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDate?: string;
  optionId?: number;
  optionIds?: number[];
}
type ValidateResult = ValidatedValue | { ok: false; error: string };

function validateFieldValue(field: CategoryFieldRow & { optionIds: Set<number> }, value: unknown): ValidateResult {
  switch (field.field_type) {
    case "text": {
      if (typeof value !== "string" || value.trim().length === 0 || value.length > 500)
        return { ok: false, error: "مقدار متنی نامعتبر است" };
      return { ok: true, valueText: value.trim() };
    }
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) return { ok: false, error: "مقدار عددی نامعتبر است" };
      return { ok: true, valueNumber: value };
    }
    case "boolean": {
      if (typeof value !== "boolean") return { ok: false, error: "مقدار باید true/false باشد" };
      return { ok: true, valueBoolean: value };
    }
    case "date": {
      if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return { ok: false, error: "تاریخ نامعتبر است" };
      return { ok: true, valueDate: value.slice(0, 10) };
    }
    case "select": {
      const optionId = Number(value);
      if (!Number.isInteger(optionId) || !field.optionIds.has(optionId))
        return { ok: false, error: "گزینهٔ انتخابی معتبر نیست" };
      return { ok: true, optionId };
    }
    case "multi_select": {
      if (!Array.isArray(value)) return { ok: false, error: "مقدار باید آرایه‌ای از گزینه‌ها باشد" };
      const optionIds = value.map((v) => Number(v));
      for (const id of optionIds) {
        if (!Number.isInteger(id) || !field.optionIds.has(id)) return { ok: false, error: "یکی از گزینه‌های انتخابی معتبر نیست" };
      }
      return { ok: true, optionIds };
    }
    default:
      return { ok: false, error: "نوع فیلد پشتیبانی نمی‌شود" };
  }
}

export interface ResolvedAttribute {
  fieldId: number;
  key: string;
  labelFa: string;
  fieldType: string;
  value: unknown;
}

/** خواندن مقادیر فیلدهای پویای یک Property برای نمایش (Response API) */
export async function getPropertyAttributes(propertyId: number, dbOrTx: DbOrTx = db): Promise<ResolvedAttribute[]> {
  const single = await dbOrTx
    .selectFrom("property_attributes as pa")
    .innerJoin("category_fields as cf", "cf.id", "pa.field_id")
    .leftJoin("category_field_options as opt", "opt.id", "pa.option_id")
    .select([
      "cf.id as fieldId",
      "cf.key as key",
      "cf.label_fa as labelFa",
      "cf.field_type as fieldType",
      "pa.value_text as valueText",
      "pa.value_number as valueNumber",
      "pa.value_boolean as valueBoolean",
      "pa.value_date as valueDate",
      "pa.option_id as optionId",
      "opt.value as optionValue",
      "opt.label_fa as optionLabelFa",
    ])
    .where("pa.property_id", "=", propertyId)
    .execute();

  const multi = await dbOrTx
    .selectFrom("property_attribute_options as pao")
    .innerJoin("category_fields as cf", "cf.id", "pao.field_id")
    .innerJoin("category_field_options as opt", "opt.id", "pao.option_id")
    .select(["cf.id as fieldId", "cf.key as key", "cf.label_fa as labelFa", "cf.field_type as fieldType", "opt.id as optionId", "opt.value as optionValue", "opt.label_fa as optionLabelFa"])
    .where("pao.property_id", "=", propertyId)
    .execute();

  const result: ResolvedAttribute[] = [];

  for (const row of single) {
    let value: unknown = null;
    switch (row.fieldType) {
      case "text":
        value = row.valueText;
        break;
      case "number":
        value = row.valueNumber !== null ? Number(row.valueNumber) : null;
        break;
      case "boolean":
        value = row.valueBoolean;
        break;
      case "date":
        value = row.valueDate;
        break;
      case "select":
        value = row.optionId ? { id: row.optionId, value: row.optionValue, labelFa: row.optionLabelFa } : null;
        break;
    }
    result.push({ fieldId: row.fieldId, key: row.key, labelFa: row.labelFa, fieldType: row.fieldType, value });
  }

  const multiByField = new Map<number, { fieldId: number; key: string; labelFa: string; fieldType: string; options: unknown[] }>();
  for (const row of multi) {
    if (!multiByField.has(row.fieldId)) {
      multiByField.set(row.fieldId, { fieldId: row.fieldId, key: row.key, labelFa: row.labelFa, fieldType: row.fieldType, options: [] });
    }
    multiByField.get(row.fieldId)!.options.push({ id: row.optionId, value: row.optionValue, labelFa: row.optionLabelFa });
  }
  for (const entry of multiByField.values()) {
    result.push({ fieldId: entry.fieldId, key: entry.key, labelFa: entry.labelFa, fieldType: entry.fieldType, value: entry.options });
  }

  return result;
}
