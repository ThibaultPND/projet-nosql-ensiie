import { configuration } from "./config.js";
import { Store } from "./store.js";
import { buildApp } from "./app.js";
const c = configuration();
const store = new Store(c.pgUrl, c.mongoUrl, c.speed);
const app = await buildApp(store, {
  origin: process.env.APP_ORIGIN,
  secureCookie: process.env.COOKIE_SECURE === "true",
  logger: true,
  staticFiles: process.env.SERVE_STATIC === "true",
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, async () => {
    await app.close();
    await store.close();
    process.exit(0);
  });
await app.listen({
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 3000),
});
