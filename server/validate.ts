import type { Product } from "../src/types";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Возвращает текст ошибки или null, если товар корректен. */
function validateProduct(value: unknown, index: number): string | null {
  const where = `products[${index}]`;
  if (!isRecord(value)) return `${where}: ожидается объект`;
  if (typeof value.sku !== "string" || value.sku === "") return `${where}.sku: ожидается непустая строка`;

  for (const field of ["myPrice", "minPrice", "maxPrice", "step"] as const) {
    const n = value[field];
    if (!isFiniteNumber(n) || n < 0) return `${where}.${field}: ожидается неотрицательное число`;
  }
  if ((value.minPrice as number) > (value.maxPrice as number)) {
    return `${where}: minPrice не может быть больше maxPrice`;
  }

  if (!Array.isArray(value.competitors)) return `${where}.competitors: ожидается массив`;
  for (const [i, competitor] of value.competitors.entries()) {
    if (!isRecord(competitor)) return `${where}.competitors[${i}]: ожидается объект`;
    if (!isFiniteNumber(competitor.price) || competitor.price < 0) {
      return `${where}.competitors[${i}].price: ожидается неотрицательное число`;
    }
    if (typeof competitor.inStock !== "boolean") {
      return `${where}.competitors[${i}].inStock: ожидается boolean`;
    }
  }
  return null;
}

export type ValidationResult = { ok: true; products: Product[] } | { ok: false; error: string };

export function validateProducts(body: unknown): ValidationResult {
  if (!Array.isArray(body)) return { ok: false, error: "Тело запроса должно быть массивом товаров" };
  for (const [index, item] of body.entries()) {
    const error = validateProduct(item, index);
    if (error) return { ok: false, error };
  }
  return { ok: true, products: body as Product[] };
}
