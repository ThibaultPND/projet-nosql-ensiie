import { configuration } from "./config.js";
import { Store } from "./store.js";
const c = configuration();
const store = new Store(c.pgUrl, c.mongoUrl);
try {
  await store.initialise();
  console.log("Schéma PostgreSQL et catalogue MongoDB initialisés.");
} finally {
  await store.close();
}
