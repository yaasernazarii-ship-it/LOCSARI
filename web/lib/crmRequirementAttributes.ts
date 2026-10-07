// ذخیره‌سازی و اعتبارسنجی فیلدهای پویای «نیازمندی مشتری» (بخش ۱۲ پرامپت فاز ۷.۲)
// دقیقاً هم‌ساختار propertyAttributes.ts (فاز ۳): همان category_fields/category_field_options بازاستفاده می‌شود؛
// هیچ فیلد جدیدی Hard-code نشده و هیچ جدول موازی‌ای برای تعریفِ فیلدها ساخته نشده است.

import { loadActiveCategoryFields, AttributeInput, DbOrTx, AttributeValidationResult, ResolvedAttribute } from "./propertyAttributes";
import { db } from "./db";

export type { AttributeInput, DbOrTx, AttributeValidationResult, ResolvedAttribute };

/**
 * اعتبارسنجی و ذخیرهٔ کامل فیلدهای پویا برای یک Customer Requirement.
 * قوانین دقیقاً مشابه validateAndSaveAttributes ملک (فاز ۳): فیلد باید متعلق به همان categoryId و فعال باشد؛
 * مقدار باید مطابق field_type باشد؛ همهٔ فیلدهای is_required باید مقدار داشته باشند.
 */
export async function validateAndSaveRequirementAttributes(
  tx: DbOrTx,
  requirementId: number,
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

    const validated = validateRequirementFieldValue(field, attr.value);
    if (!validated.ok) return { ok: false, error: `${field.label_fa}: ${validated.error}` };

    await tx.deleteFrom("requirement_attributes").where("requirement_id", "=", requirementId).where("field_id", "=", field.id).execute();
    await tx
      .deleteFrom("requirement_attribute_options")
      .where("requirement_id", "=", requirementId)
      .where("field_id", "=", field.id)
      .execute();

    if (field.field_type === "multi_select") {
      const optionIds = validated.optionIds!;
      if (optionIds.length > 0) {
        await tx
          .insertInto("requirement_attribute_options")
          .values(optionIds.map((optionId) => ({ requirement_id: requirementId, field_id: field.id, option_id: optionId })))
          .execute();
      }
    } else {
      await tx
        .insertInto("requirement_attributes")
        .values({
          requirement_id: requirementId,
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

  for (const field of fields.values()) {
    if (field.is_required && !providedFieldIds.has(field.id)) {
      return { ok: false, error: `فیلد اجباری «${field.label_fa}» ارسال نشده است` };
    }
  }

  return { ok: true };
}

type ValidatedValue = {
  ok: true;
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDate?: string;
  optionId?: number;
  optionIds?: number[];
};
type ValidateResult = ValidatedValue | { ok: false; error: string };

function validateRequirementFieldValue(
  field: { field_type: string; optionIds: Set<number> },
  value: unknown
): ValidateResult {
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

/** خواندن مقادیر فیلدهای پویای یک Requirement برای نمایش (Response API آیندهٔ فاز ۷.۳) */
export async function getRequirementAttributes(requirementId: number, dbOrTx: DbOrTx = db): Promise<ResolvedAttribute[]> {
  const single = await dbOrTx
    .selectFrom("requirement_attributes as ra")
    .innerJoin("category_fields as cf", "cf.id", "ra.field_id")
    .leftJoin("category_field_options as opt", "opt.id", "ra.option_id")
    .select([
      "cf.id as fieldId",
      "cf.key as key",
      "cf.label_fa as labelFa",
      "cf.field_type as fieldType",
      "ra.value_text as valueText",
      "ra.value_number as valueNumber",
      "ra.value_boolean as valueBoolean",
      "ra.value_date as valueDate",
      "ra.option_id as optionId",
      "opt.value as optionValue",
      "opt.label_fa as optionLabelFa",
    ])
    .where("ra.requirement_id", "=", requirementId)
    .execute();

  const multi = await dbOrTx
    .selectFrom("requirement_attribute_options as rao")
    .innerJoin("category_fields as cf", "cf.id", "rao.field_id")
    .innerJoin("category_field_options as opt", "opt.id", "rao.option_id")
    .select(["cf.id as fieldId", "cf.key as key", "cf.label_fa as labelFa", "cf.field_type as fieldType", "opt.id as optionId", "opt.value as optionValue", "opt.label_fa as optionLabelFa"])
    .where("rao.requirement_id", "=", requirementId)
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
