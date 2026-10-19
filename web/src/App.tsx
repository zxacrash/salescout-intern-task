import { useCallback, useEffect, useState } from "react";
import productsData from "../../data/products.json";
import type { PriceResult, Product, Reason } from "../../src/types";
import { reprice } from "./api";

const products = productsData as Product[];

const REASON_LABELS: Record<Reason, string> = {
  UNDERCUT: "Ниже конкурента",
  AT_MIN: "Достигнут минимум",
  AT_MAX: "Достигнут максимум",
  NO_COMPETITORS: "Нет конкурентов",
};

const priceFormat = new Intl.NumberFormat("ru-RU");
const formatPrice = (value: number) => `${priceFormat.format(value)} ₸`;

function formatDelta(delta: number): string {
  if (delta === 0) return "без изменений";
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${priceFormat.format(Math.abs(delta))} ₸`;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; results: PriceResult[] };

export function App() {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const results = await reprice(products);
      setState({ status: "ready", results });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка";
      setState({ status: "error", message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>Пересчёт цен</h1>
          <p className="lead">
            Новая цена по каждому товару: на шаг ниже лучшего конкурента в наличии, но в пределах вашего диапазона.
          </p>
        </div>
        <button type="button" className="button" onClick={() => void load()} disabled={state.status === "loading"}>
          {state.status === "loading" ? "Считаем…" : "Пересчитать"}
        </button>
      </header>

      {state.status === "error" && (
        <div className="notice" role="alert">
          <strong>Не удалось получить цены.</strong> {state.message}. Проверьте, что сервер запущен
          (<code>npm run dev</code>), и нажмите «Пересчитать».
        </div>
      )}

      {state.status === "loading" && <p className="status">Запрашиваем расчёт у сервера…</p>}

      {state.status === "ready" && <ResultsTable results={state.results} />}
    </main>
  );
}

function ResultsTable({ results }: { results: PriceResult[] }) {
  if (results.length === 0) {
    return <p className="status">Товаров нет — отправьте хотя бы один товар в POST /reprice.</p>;
  }

  const namesBySku = new Map(products.map((product) => [product.sku, product.name]));
  const changed = results.filter((result) => result.newPrice !== result.oldPrice).length;

  return (
    <>
      <p className="summary">
        Изменится цена у <strong>{changed}</strong> из {results.length} товаров.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">SKU</th>
              <th scope="col">Название</th>
              <th scope="col" className="num">Было</th>
              <th scope="col" className="num">Стало</th>
              <th scope="col">Причина</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => {
              const delta = result.newPrice - result.oldPrice;
              const direction = delta > 0 ? "up" : delta < 0 ? "down" : "same";
              return (
                <tr key={result.sku}>
                  <td className="sku">{result.sku}</td>
                  <td>{namesBySku.get(result.sku) ?? "—"}</td>
                  <td className="num old">{formatPrice(result.oldPrice)}</td>
                  <td className="num">
                    <span className="new-price">{formatPrice(result.newPrice)}</span>
                    <span className={`delta ${direction}`}>{formatDelta(delta)}</span>
                  </td>
                  <td>
                    <span className={`reason reason-${result.reason}`}>{REASON_LABELS[result.reason]}</span>
                    <span className="reason-code">{result.reason}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
