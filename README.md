# SaleScout — мини-версия прайс-бота

Решение тестового задания для стажёра (web-разработчик).
Бот берёт цены конкурентов и выставляет цену так, чтобы быть дешевле лучшего конкурента **в наличии**, но не выходя за `[minPrice, maxPrice]`.

## Запуск

Нужен Node.js 20+.

```bash
npm install
npm run dev
```

Команда поднимает сразу две части:

| Часть | Адрес |
| --- | --- |
| API (Express) | http://localhost:3001 |
| Веб-страница (React + Vite) | http://localhost:5173 |

Откройте http://localhost:5173 — страница сама запросит `POST /reprice` и покажет таблицу «было / стало».
В dev-режиме Vite проксирует `/reprice` на порт 3001, поэтому дополнительных настроек не нужно.

Запускать части по отдельности:

```bash
npm run dev:server   # только API
npm run dev:web      # только фронтенд
```

### Продакшен-сборка фронтенда

```bash
npm run build        # проверка типов + сборка в dist/
npm run preview      # локальный просмотр собранной версии
```

## Тесты и проверка типов

```bash
npm test             # vitest: 38 тестов (calculatePrice + API)
npm run typecheck    # tsc --noEmit
```

## Структура проекта

```
src/pricing.ts        calculatePrice — чистая функция расчёта цены
src/pricing.test.ts   тесты calculatePrice
src/types.ts          общие типы (Product, PriceResult, Reason)
server/app.ts         Express-приложение с POST /reprice
server/validate.ts    проверка тела запроса
server/index.ts       запуск сервера (порт 3001, меняется через PORT)
server/app.test.ts    тесты API (supertest)
web/                  React-страница (Vite)
data/                 пример входных данных и ожидаемый результат
```

## API

`POST /reprice`, `Content-Type: application/json`, тело — массив товаров (`Product[]`).

```bash
curl -X POST http://localhost:3001/reprice \
  -H "Content-Type: application/json" \
  -d @data/products.json
```

Ответ `200` — массив `PriceResult[]` в том же порядке:

```json
[{ "sku": "IPH15-128-BLK", "oldPrice": 389990, "newPrice": 384980, "reason": "UNDERCUT" }]
```

Ответ `400` с телом `{ "error": "..." }`, если тело — не массив, невалидный JSON или в товаре неверные поля
(не число, отрицательное значение, `minPrice > maxPrice`, у конкурента нет `price`/`inStock`).

## Правила расчёта цены

1. Учитываются только конкуренты с `inStock: true`.
2. Таких конкурентов нет → `newPrice = maxPrice`, причина `NO_COMPETITORS`.
3. `best` — минимальная цена среди них.
4. `candidate = floor(best - step)`.
5. `candidate < minPrice` → `minPrice`, `AT_MIN`; `candidate > maxPrice` → `maxPrice`, `AT_MAX`; иначе `candidate`, `UNDERCUT`.

`myPrice` на расчёт не влияет — он возвращается только как `oldPrice`.

## Решения и допущения

- **Ошибки float.** В JS `2.3 - 0.3 = 1.9999999999999998`, и обычный `Math.floor` дал бы `1` вместо `2`.
  Перед округлением разность приводится к 9 знакам после запятой (`roundNoise` в `src/pricing.ts`), поэтому результат совпадает с обычной арифметикой.
- **Чистая функция.** `calculatePrice` не делает I/O и не меняет входные данные; вся валидация — в `server/validate.ts`.
- **Фронтенд** отправляет в API товары из `data/products.json`; кнопка «Пересчитать» повторяет запрос. Показаны состояния загрузки и ошибки.
