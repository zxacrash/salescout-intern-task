import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { calculatePrice } from "./pricing";
import type { Competitor, PriceResult, Product } from "./types";

/** Собирает товар с разумными значениями по умолчанию — в тесте указываем только важное. */
function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    sku: "TEST-1",
    name: "Тестовый товар",
    myPrice: 1000,
    minPrice: 500,
    maxPrice: 1500,
    step: 10,
    competitors: [],
    ...overrides,
  };
}

const inStock = (price: number, seller = "S"): Competitor => ({ seller, price, inStock: true });
const outOfStock = (price: number, seller = "S"): Competitor => ({ seller, price, inStock: false });

describe("calculatePrice", () => {
  describe("UNDERCUT", () => {
    it("становится дешевле лучшего конкурента на step", () => {
      const result = calculatePrice(makeProduct({ step: 10, competitors: [inStock(1000)] }));
      expect(result).toMatchObject({ newPrice: 990, reason: "UNDERCUT" });
    });

    it("берёт минимальную цену среди нескольких конкурентов", () => {
      const result = calculatePrice(
        makeProduct({ step: 10, competitors: [inStock(1200), inStock(900), inStock(1100)] }),
      );
      expect(result).toMatchObject({ newPrice: 890, reason: "UNDERCUT" });
    });

    it("одинаковые минимальные цены — это просто best", () => {
      const result = calculatePrice(
        makeProduct({ step: 10, competitors: [inStock(900, "A"), inStock(900, "B"), inStock(950, "C")] }),
      );
      expect(result).toMatchObject({ newPrice: 890, reason: "UNDERCUT" });
    });

    it("step = 0 — цена совпадает с лучшей ценой конкурента", () => {
      const result = calculatePrice(makeProduct({ step: 0, competitors: [inStock(900)] }));
      expect(result).toMatchObject({ newPrice: 900, reason: "UNDERCUT" });
    });
  });

  describe("округление вниз", () => {
    it("дробный step: 349999.9 - 0.5 -> 349999", () => {
      const result = calculatePrice(
        makeProduct({ minPrice: 330000, maxPrice: 380000, step: 0.5, competitors: [inStock(349999.9)] }),
      );
      expect(result).toMatchObject({ newPrice: 349999, reason: "UNDERCUT" });
    });

    it("дробная цена конкурента при step = 0 округляется вниз", () => {
      const result = calculatePrice(makeProduct({ step: 0, competitors: [inStock(900.99)] }));
      expect(result.newPrice).toBe(900);
    });

    it("не страдает от ошибок float: 2.3 - 0.3 = 2, а не 1", () => {
      const result = calculatePrice(
        makeProduct({ minPrice: 0, maxPrice: 100, step: 0.3, competitors: [inStock(2.3)] }),
      );
      expect(result).toMatchObject({ newPrice: 2, reason: "UNDERCUT" });
    });

    it("не страдает от ошибок float: 8.2 - 0.2 = 8, а не 7", () => {
      const result = calculatePrice(
        makeProduct({ minPrice: 0, maxPrice: 100, step: 0.2, competitors: [inStock(8.2)] }),
      );
      expect(result.newPrice).toBe(8);
    });

    it("результат всегда целое число", () => {
      const result = calculatePrice(makeProduct({ step: 0.7, competitors: [inStock(1234.56)] }));
      expect(Number.isInteger(result.newPrice)).toBe(true);
    });
  });

  describe("AT_MIN", () => {
    it("кандидат ниже minPrice -> minPrice", () => {
      const result = calculatePrice(
        makeProduct({ minPrice: 180000, maxPrice: 210000, step: 100, competitors: [inStock(175000)] }),
      );
      expect(result).toMatchObject({ newPrice: 180000, reason: "AT_MIN" });
    });

    it("кандидат ровно равен minPrice -> UNDERCUT (граница включительно)", () => {
      const result = calculatePrice(makeProduct({ minPrice: 990, step: 10, competitors: [inStock(1000)] }));
      expect(result).toMatchObject({ newPrice: 990, reason: "UNDERCUT" });
    });

    it("кандидат на 1 тенге ниже minPrice -> AT_MIN", () => {
      const result = calculatePrice(makeProduct({ minPrice: 991, step: 10, competitors: [inStock(1000)] }));
      expect(result).toMatchObject({ newPrice: 991, reason: "AT_MIN" });
    });
  });

  describe("AT_MAX", () => {
    it("кандидат выше maxPrice -> maxPrice", () => {
      const result = calculatePrice(
        makeProduct({ minPrice: 100000, maxPrice: 125000, step: 1, competitors: [inStock(150000)] }),
      );
      expect(result).toMatchObject({ newPrice: 125000, reason: "AT_MAX" });
    });

    it("кандидат ровно равен maxPrice -> UNDERCUT (граница включительно)", () => {
      const result = calculatePrice(makeProduct({ maxPrice: 1490, step: 10, competitors: [inStock(1500)] }));
      expect(result).toMatchObject({ newPrice: 1490, reason: "UNDERCUT" });
    });

    it("кандидат на 1 тенге выше maxPrice -> AT_MAX", () => {
      const result = calculatePrice(makeProduct({ maxPrice: 1489, step: 10, competitors: [inStock(1500)] }));
      expect(result).toMatchObject({ newPrice: 1489, reason: "AT_MAX" });
    });
  });

  describe("NO_COMPETITORS", () => {
    it("пустой список конкурентов -> maxPrice", () => {
      const result = calculatePrice(makeProduct({ maxPrice: 99990, competitors: [] }));
      expect(result).toMatchObject({ newPrice: 99990, reason: "NO_COMPETITORS" });
    });

    it("все конкуренты не в наличии -> maxPrice", () => {
      const result = calculatePrice(
        makeProduct({ maxPrice: 1500, competitors: [outOfStock(100), outOfStock(200)] }),
      );
      expect(result).toMatchObject({ newPrice: 1500, reason: "NO_COMPETITORS" });
    });
  });

  describe("конкуренты не в наличии", () => {
    it("игнорируются полностью, даже если их цена самая низкая", () => {
      const result = calculatePrice(
        makeProduct({ step: 10, competitors: [outOfStock(600), inStock(1000), outOfStock(700)] }),
      );
      expect(result).toMatchObject({ newPrice: 990, reason: "UNDERCUT" });
    });
  });

  describe("minPrice === maxPrice", () => {
    it("конкурент дешевле -> AT_MIN", () => {
      const result = calculatePrice(
        makeProduct({ minPrice: 1000, maxPrice: 1000, competitors: [inStock(800)] }),
      );
      expect(result).toMatchObject({ newPrice: 1000, reason: "AT_MIN" });
    });

    it("конкурент дороже -> AT_MAX", () => {
      const result = calculatePrice(
        makeProduct({ minPrice: 1000, maxPrice: 1000, competitors: [inStock(1200)] }),
      );
      expect(result).toMatchObject({ newPrice: 1000, reason: "AT_MAX" });
    });
  });

  describe("служебные поля", () => {
    it("myPrice не влияет на расчёт, а возвращается как oldPrice", () => {
      const base = { step: 10, competitors: [inStock(1000)] };
      const cheap = calculatePrice(makeProduct({ ...base, myPrice: 1 }));
      const expensive = calculatePrice(makeProduct({ ...base, myPrice: 999999 }));
      expect(cheap.newPrice).toBe(expensive.newPrice);
      expect(cheap.oldPrice).toBe(1);
      expect(expensive.oldPrice).toBe(999999);
    });

    it("sku переносится в результат", () => {
      expect(calculatePrice(makeProduct({ sku: "ABC-123" })).sku).toBe("ABC-123");
    });

    it("не мутирует входные данные", () => {
      const product = makeProduct({ step: 10, competitors: [inStock(1000), outOfStock(500)] });
      const snapshot = structuredClone(product);
      calculatePrice(product);
      expect(product).toEqual(snapshot);
    });
  });

  describe("примеры из задания (data/products.json -> data/expected.json)", () => {
    const products = JSON.parse(
      readFileSync(new URL("../data/products.json", import.meta.url), "utf8"),
    ) as Product[];
    const expected = JSON.parse(
      readFileSync(new URL("../data/expected.json", import.meta.url), "utf8"),
    ) as PriceResult[];

    it("совпадает с expected.json целиком", () => {
      expect(products.map(calculatePrice)).toEqual(expected);
    });

    it.each(expected.map((e, i) => [e.sku, products[i]!, e] as const))("%s", (_sku, product, result) => {
      expect(calculatePrice(product)).toEqual(result);
    });
  });
});
