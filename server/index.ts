import { createApp } from "./app";

const port = Number(process.env.PORT ?? 3001);

createApp().listen(port, () => {
  console.log(`API запущен: http://localhost:${port}  (POST /reprice)`);
});
