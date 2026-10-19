import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const repoRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: "web",
  plugins: [react()],
  server: {
    port: 5173,
    // Разрешаем импортировать data/products.json, который лежит выше папки web/.
    fs: { allow: [repoRoot] },
    // В dev-режиме запросы к /reprice уходят на Express-сервер.
    proxy: { "/reprice": "http://localhost:3001" },
  },
  build: { outDir: "../dist", emptyOutDir: true },
});
