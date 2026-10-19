import type { PriceResult, Product } from "../../src/types";

export async function reprice(products: Product[]): Promise<PriceResult[]> {
  const response = await fetch("/reprice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(products),
  });

  if (!response.ok) {
    let details = "";
    try {
      const body = (await response.json()) as { error?: string };
      details = body.error ?? "";
    } catch {
      // тело ответа не JSON — показываем только статус
    }
    throw new Error(`Сервер ответил ${response.status}${details ? `: ${details}` : ""}`);
  }
  return (await response.json()) as PriceResult[];
}
