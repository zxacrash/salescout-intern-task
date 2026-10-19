import express, { type ErrorRequestHandler } from "express";
import { calculatePrice } from "../src/pricing";
import type { PriceResult } from "../src/types";
import { validateProducts } from "./validate";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "5mb" }));

  app.post("/reprice", (req, res) => {
    const validation = validateProducts(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const results: PriceResult[] = validation.products.map(calculatePrice);
    res.json(results);
  });

  // Невалидный JSON в теле запроса -> 400, а не 500.
  const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const status = typeof err?.status === "number" ? err.status : 500;
    res.status(status).json({ error: status === 400 ? "Некорректный JSON" : "Внутренняя ошибка сервера" });
  };
  app.use(errorHandler);

  return app;
}
