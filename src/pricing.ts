import type { PriceResult, Product } from "./types";

/**
 * Убирает «шум» чисел с плавающей точкой (например, 2.3 - 0.3 = 1.9999999999999998)
 * перед округлением вниз, чтобы floor вёл себя как в обычной арифметике.
 */
function roundNoise(value: number): number {
  return Number(value.toFixed(9));
}

/**
 * Чистая функция: рассчитывает новую цену для одного товара.
 * Правила — см. README, раздел «Правила расчёта цены».
 */
export function calculatePrice(product: Product): PriceResult {
  const { sku, myPrice, minPrice, maxPrice, step, competitors } = product;

  // 1. Учитываем только конкурентов, у которых товар есть в наличии.
  const inStockPrices = competitors
    .filter((competitor) => competitor.inStock)
    .map((competitor) => competitor.price);

  // 2. Нет подходящих конкурентов — ставим максимальную цену.
  if (inStockPrices.length === 0) {
    return { sku, oldPrice: myPrice, newPrice: maxPrice, reason: "NO_COMPETITORS" };
  }

  // 3. Самая низкая цена среди конкурентов в наличии.
  const best = Math.min(...inStockPrices);

  // 4. Хотим быть дешевле на `step`, округляя вниз до целого тенге.
  const candidate = Math.floor(roundNoise(best - step));

  // 5. Не выходим за границы [minPrice, maxPrice] (границы включительно).
  if (candidate < minPrice) {
    return { sku, oldPrice: myPrice, newPrice: minPrice, reason: "AT_MIN" };
  }
  if (candidate > maxPrice) {
    return { sku, oldPrice: myPrice, newPrice: maxPrice, reason: "AT_MAX" };
  }
  return { sku, oldPrice: myPrice, newPrice: candidate, reason: "UNDERCUT" };
}
