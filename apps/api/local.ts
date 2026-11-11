// Development only. Production uses the services declared in compose.yaml.
import { asyncExitHook } from "exit-hook";
import EmbeddedPostgres from "embedded-postgres";
import { MongoMemoryServer } from "mongodb-memory-server";
import { mkdir, access, open, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createServer } from "node:net";
import { Store } from "./store.js";
import { buildApp } from "./app.js";
const demo = process.argv.includes("--demo");
const root = resolve(".local-data", demo ? "demo" : "normal");
await mkdir(join(root, "mongo"), { recursive: true });
const lockPath = join(root, "launch.lock");
try {
  const lock = await open(lockPath, "wx");
  await lock.writeFile(String(process.pid));
  await lock.close();
} catch {
  throw new Error(
    `Une instance utilise peut-être ${root}. Vérifie le processus dans launch.lock avant de relancer.`,
  );
}
const freePort = async () => {
  const s = createServer();
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  const p = (s.address() as { port: number }).port;
  await new Promise<void>((r) => s.close(() => r()));
  return p;
};
let postgres: EmbeddedPostgres | undefined;
let mongo: MongoMemoryServer | undefined;
let store: Store | undefined;
let app: Awaited<ReturnType<typeof buildApp>> | undefined;
let closing = false;
async function stop() {
  if (closing) return;
  closing = true;
  await app?.close();
  await store?.close();
  await mongo?.stop({ doCleanup: false });
  await postgres?.stop();
  await unlink(lockPath);
}
try {
  const port = await freePort();
  // Unix sockets use a short temporary path; persistent data stays in the checkout.
  postgres = new EmbeddedPostgres({
    databaseDir: join(root, "postgres"),
    user: "cliicker",
    password: "local_cliicker_only",
    port,
    persistent: true,
    postgresFlags: ["-h", "127.0.0.1", "-k", "/tmp"],
    onLog: () => {},
    onError: () => {},
  });
  let initialized = true;
  try {
    await access(join(root, "postgres", "PG_VERSION"));
  } catch {
    initialized = false;
  }
  if (!initialized) await postgres.initialise();
  await postgres.start();
  if (!initialized) await postgres.createDatabase("cliicker");
  mongo = await MongoMemoryServer.create({
    binary: { version: "8.0.16" },
    instance: { ip: "127.0.0.1", dbPath: join(root, "mongo") },
  });
  store = new Store(
    `postgresql://cliicker:local_cliicker_only@127.0.0.1:${port}/cliicker`,
    mongo.getUri(),
    demo ? 3600 : 1,
  );
  await store.initialise();
  app = await buildApp(store, { staticFiles: true });
  const address = await app.listen({
    host: "127.0.0.1",
    port: Number(process.env.PORT || (demo ? 8081 : 8080)),
  });
  console.log(
    `Cliicker ${demo ? "(démo accélérée)" : ""} : ${address}\nDonnées persistantes : ${root}\nCtrl+C pour arrêter proprement.`,
  );
  asyncExitHook(stop, { wait: 15000 });
} catch (e) {
  await stop();
  throw e;
}
