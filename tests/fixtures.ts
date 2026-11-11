import EmbeddedPostgres from "embedded-postgres";
import { MongoMemoryServer } from "mongodb-memory-server";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { Store } from "../apps/api/store.js";
export async function freePort(): Promise<number> {
  const s = createServer();
  await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", resolve));
  const port = (s.address() as { port: number }).port;
  await new Promise<void>((resolve) => s.close(() => resolve()));
  return port;
}
export async function databases(speed = 1) {
  const directory = await mkdtemp(join(tmpdir(), "cliicker-test-"));
  const port = await freePort();
  const postgres = new EmbeddedPostgres({
    databaseDir: join(directory, "postgres"),
    user: "cliicker",
    password: "test_only",
    port,
    persistent: true,
    onLog: () => {},
    onError: () => {},
    postgresFlags: ["-h", "127.0.0.1", "-k", directory],
  });
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase("cliicker");
  let mongo: MongoMemoryServer;
  try {
    mongo = await MongoMemoryServer.create({
      binary: { version: "8.0.16" },
      instance: { ip: "127.0.0.1" },
    });
  } catch (e) {
    await postgres.stop();
    throw e;
  }
  const pgUrl = `postgresql://cliicker:test_only@127.0.0.1:${port}/cliicker`;
  const mongoUrl = mongo.getUri();
  const store = new Store(pgUrl, mongoUrl, speed);
  try {
    await store.initialise();
  } catch (e) {
    await store.close();
    await mongo.stop();
    await postgres.stop();
    throw e;
  }
  return {
    store,
    postgres,
    mongo,
    pgUrl,
    mongoUrl,
    directory,
    async close() {
      await store.close();
      await mongo.stop();
      await postgres.stop();
    },
  };
}
