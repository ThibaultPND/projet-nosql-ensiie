import Fastify from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import serveStatic from "@fastify/static";
import { resolve } from "node:path";
import { z } from "zod";
import { actionSchema, profileSchema } from "../../packages/shared/model.js";
import { GameError } from "./engine.js";
import { Store } from "./store.js";
export async function buildApp(
  store: Store,
  options: {
    origin?: string;
    secureCookie?: boolean;
    staticFiles?: boolean;
    replication?: boolean;
    logger?: boolean;
  } = {},
) {
  const cookieName = store.speed === 1 ? "cliicker_session" : "cliicker_demo";
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 8192 });
  await app.register(cookie);
  await app.register(rateLimit, { max: 600, timeWindow: "1 minute" });
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "same-origin");
    if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
      if (req.headers["x-cliicker"] !== "1")
        return reply.code(403).send({ error: "Requête non autorisée." });
      if (
        req.headers.origin &&
        options.origin &&
        req.headers.origin !== options.origin
      )
        return reply.code(403).send({ error: "Origine non autorisée." });
    }
  });
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof z.ZodError)
      return reply
        .code(400)
        .send({
          error:
            "Champs invalides : vérifie le pseudo (2–32 caractères), la présentation (10–500) et les valeurs envoyées.",
        });
    if (error instanceof GameError)
      return reply.code(400).send({ error: error.message });
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status < 500)
      return reply
        .code(status)
        .send({
          error:
            status === 429
              ? "Trop de requêtes, réessaie dans un instant."
              : "Requête invalide.",
        });
    req.log.error({ err: error }, "Erreur de service");
    return reply
      .code(503)
      .send({
        error:
          "Un service est indisponible. Ta sauvegarde reste conservée ; réessaie dans un instant.",
      });
  });
  const player = async (
    req: { cookies: Record<string, string | undefined> },
    reply: { code: (n: number) => any },
  ) => {
    const id = await store.authenticate(req.cookies[cookieName]);
    if (!id) {
      reply.code(401);
      const e = new Error("Session expirée.");
      Object.assign(e, { statusCode: 401 });
      throw e;
    }
    return id;
  };
  const key = (headers: Record<string, unknown>) =>
    z.string().uuid().parse(headers["idempotency-key"]);
  app.get("/api/health", async () => {
    await Promise.all([
      store.pool.query("SELECT 1"),
      store.db.command({ ping: 1 }),
    ]);
    return { ok: true };
  });
  app.post(
    "/api/session",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req, reply) => {
      let id = await store.authenticate(req.cookies[cookieName]);
      if (!id) {
        const session = await store.createSession();
        id = session.id;
        reply.setCookie(cookieName, session.token, {
          path: "/",
          httpOnly: true,
          sameSite: "strict",
          secure: options.secureCookie ?? false,
          maxAge: 31536000,
        });
      }
      reply.header("Cache-Control", "no-store");
      return { profile: await store.profile(id) };
    },
  );
  app.addHook("onSend", async (req, reply) => {
    if (req.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
  });
  app.put("/api/profile", async (req, reply) => {
    const id = await player(req, reply);
    const submission = await store.saveProfile(
      id,
      profileSchema.parse(req.body),
      key(req.headers),
    );
    reply.code(202);
    return {
      submissionId: submission.submissionId,
      profile: submission,
      replicated: (await store.submissionStatus(id, submission.submissionId))
        .replicated,
    };
  });
  app.get("/api/profile/submissions/:id", async (req, reply) => {
    const id = await player(req, reply);
    const submissionId = z
      .string()
      .uuid()
      .parse((req.params as { id: string }).id);
    const status = await store.submissionStatus(id, submissionId);
    return status || reply.code(404).send({ error: "Soumission introuvable." });
  });
  app.get("/api/profile/history", async (req, reply) =>
    store.history(await player(req, reply)),
  );
  app.get("/api/game", async (req, reply) =>
    store.snapshot(await player(req, reply)),
  );
  app.post("/api/actions", async (req, reply) =>
    store.snapshot(
      await player(req, reply),
      actionSchema.parse(req.body),
      key(req.headers),
    ),
  );
  if (options.staticFiles) {
    await app.register(serveStatic, { root: resolve("dist/web") });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<unknown> | undefined;
  let stopped = false;
  const tick = () => {
    running = store
      .replicate()
      .catch((error) =>
        app.log.error({ err: error }, "Réplication indisponible"),
      )
      .finally(() => {
        if (!stopped) timer = setTimeout(tick, 2000);
      });
  };
  if (options.replication !== false) tick();
  app.addHook("onClose", async () => {
    stopped = true;
    clearTimeout(timer);
    await running;
  });
  return app;
}
