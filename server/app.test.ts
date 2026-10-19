import { readFileSync } from "node:fs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { PriceResult, Product } from "../src/types";
import { createApp } from "./app";

const app = createApp();
const products = JSON.parse(
  readFileSync(new URL("../data/products.json", import.meta.url), "utf8"),
) as Product[];
const expected = JSON.parse(
  readFileSync(new URL("../data/expected.json", import.meta.url), "utf8"),
) as PriceResult[];

describe("POST /reprice", () => {
  it("200 и результаты в том же порядке", async () => {
    const response = await request(app).post("/reprice").send(products);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expected);
  });

  it("пустой массив -> 200 и пустой массив", async () => {
    const response = await request(app).post("/reprice").send([]);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("не массив -> 400", async () => {
    const response = await request(app).post("/reprice").send({ sku: "x" });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });

  it("строка вместо массива -> 400", async () => {
    const response = await request(app).post("/reprice").set("Content-Type", "application/json").send('"hello"');
    expect(response.status).toBe(400);
  });

  it("невалидный JSON -> 400", async () => {
    const response = await request(app).post("/reprice").set("Content-Type", "application/json").send("{oops");
    expect(response.status).toBe(400);
  });

  it("пустое тело -> 400", async () => {
    const response = await request(app).post("/reprice");
    expect(response.status).toBe(400);
  });

  it("товар с неверными полями -> 400 с понятным текстом ошибки", async () => {
    const response = await request(app)
      .post("/reprice")
      .send([{ ...products[0], minPrice: 500000, maxPrice: 1000 }]);
    expect(response.status).toBe(400);
    expect(response.body.error).toContain("minPrice");
  });

  it("конкурент без inStock -> 400", async () => {
    const response = await request(app)
      .post("/reprice")
      .send([{ ...products[0], competitors: [{ seller: "A", price: 100 }] }]);
    expect(response.status).toBe(400);
  });
});
