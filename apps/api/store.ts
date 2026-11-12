import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg, { type PoolClient } from "pg";
import { MongoClient } from "mongodb";
import type {
  Action,
  Catalog,
  Game,
  Profile,
  Submission,
} from "../../packages/shared/model.js";
import { catalog as initialCatalog } from "../../content/catalog.js";
import { validateCatalog } from "./catalog-validation.js";
import { applyAction, freshGame, GameError, clickValue, upgradePrice, migrateGame } from "./engine.js";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export class Store {
  pool: pg.Pool;
  mongo: MongoClient;
  speed: number;
  private catalogs = new Map<string, Catalog>();
  constructor(pgUrl: string, mongoUrl: string, speed = 1) {
    this.pool = new pg.Pool({
      connectionString: pgUrl,
      connectionTimeoutMillis: 3000,
      max: 8,
    });
    this.pool.on("error", () => {});
    this.mongo = new MongoClient(mongoUrl, {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000,
    });
    this.speed = speed;
  }
  get db() {
    return this.mongo.db("cliicker");
  }
  async initialise() {
    await this.pool.query(
      await readFile(
        new URL("../../db/migrations/001_initial.sql", import.meta.url),
        "utf8",
      ),
    );
    await this.mongo.connect();
    await this.db
      .collection("student_profiles")
      .createIndex({ submissionId: 1 }, { unique: true });
    await this.db
      .collection("student_profiles")
      .createIndex({ playerId: 1, revision: -1 }, { unique: true });
    await this.db
      .collection("catalogs")
      .createIndex({ version: 1 }, { unique: true });
    const content = validateCatalog(initialCatalog);
    const existing = await this.db
      .collection("catalogs")
      .findOne({ version: content.version });
    if (
      existing &&
      JSON.stringify(existing.content) !== JSON.stringify(content)
    )
      throw new Error(
        "Catalogue immuable : augmenter sa version avant de modifier son contenu.",
      );
    await this.db
      .collection("catalogs")
      .updateOne(
        { version: content.version },
        { $setOnInsert: { version: content.version, content } },
        { upsert: true },
      );
  }
  async catalog(version = initialCatalog.version) {
    if (this.catalogs.has(version)) return this.catalogs.get(version)!;
    const doc = await this.db.collection("catalogs").findOne({ version });
    if (!doc) throw new Error("Catalogue non initialisé.");
    const c = validateCatalog(doc.content);
    this.catalogs.set(version, c);
    return c;
  }
  async close() {
    await Promise.all([this.pool.end(), this.mongo.close()]);
  }
  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async authenticate(token?: string) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const r = await this.pool.query(
      "SELECT player_id FROM sessions WHERE token_hash=$1 AND expires_at > now()",
      [hash(token)],
    );
    return r.rows[0]?.player_id as string | undefined;
  }
  async createSession() {
    const id = randomUUID();
    const token = randomBytes(32).toString("hex");
    await this.transaction(async (c) => {
      await c.query("INSERT INTO players(id) VALUES($1)", [id]);
      await c.query(
        "INSERT INTO sessions VALUES($1,$2,now() + interval '365 days')",
        [hash(token), id],
      );
    });
    return { id, token };
  }
  async profile(player: string) {
    const r = await this.pool.query(
      'SELECT nickname, association_id AS "associationId", presentation, revision FROM player_profiles WHERE player_id=$1',
      [player],
    );
    return r.rows[0] || null;
  }
  async previous(
    c: PoolClient,
    player: string,
    key: string,
    fingerprint: string,
  ) {
    const old = await c.query(
      "SELECT fingerprint, response FROM processed_actions WHERE player_id=$1 AND request_id=$2",
      [player, key],
    );
    if (old.rows[0] && old.rows[0].fingerprint !== fingerprint)
      throw new GameError(
        "Cette clé de requête a déjà servi pour une autre action.",
      );
    return old.rows[0]?.response;
  }
  async saveProfile(player: string, profile: Profile, key: string) {
    const fingerprint = hash(JSON.stringify({ profile }));
    return this.transaction(async (c) => {
      await c.query("SELECT id FROM players WHERE id=$1 FOR UPDATE", [player]);
      const previous = await this.previous(c, player, key, fingerprint);
      if (previous) return previous as Submission;
      const old = await c.query(
        "SELECT * FROM player_profiles WHERE player_id=$1",
        [player],
      );
      if (old.rows[0] && old.rows[0].association_id !== profile.associationId)
        throw new GameError(
          "Le changement d’association n’est pas encore disponible.",
        );
      if (!old.rows[0]) {
        const catalog = await this.catalog();
        await c.query("INSERT INTO game_states VALUES($1,$2)", [
          player,
          JSON.stringify(freshGame(profile.associationId, catalog, Date.now())),
        ]);
      }
      const submission: Submission = {
        ...profile,
        submissionId: randomUUID(),
        playerId: player,
        revision: (old.rows[0]?.revision || 0) + 1,
        createdAt: new Date().toISOString(),
      };
      await c.query(
        "INSERT INTO player_profiles VALUES($1,$2,$3,$4,$5) ON CONFLICT(player_id) DO UPDATE SET nickname=$2,presentation=$4,revision=$5",
        [
          player,
          profile.nickname,
          profile.associationId,
          profile.presentation,
          submission.revision,
        ],
      );
      await c.query(
        "INSERT INTO profile_submissions VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          submission.submissionId,
          player,
          profile.nickname,
          profile.associationId,
          profile.presentation,
          submission.revision,
          submission.createdAt,
        ],
      );
      await c.query(
        "INSERT INTO outbox_events(submission_id,payload) VALUES($1,$2)",
        [submission.submissionId, JSON.stringify(submission)],
      );
      await c.query("INSERT INTO processed_actions VALUES($1,$2,$3,$4)", [
        player,
        key,
        fingerprint,
        JSON.stringify(submission),
      ]);
      return submission;
    });
  }
  async replicate() {
    // Keep the row locked until MongoDB has acknowledged; retries use the same unique ID.
    return this.transaction(async (c) => {
      const rows = await c.query(
        "SELECT submission_id,payload FROM outbox_events WHERE delivered_at IS NULL ORDER BY submission_id FOR UPDATE SKIP LOCKED LIMIT 20",
      );
      for (const row of rows.rows) {
        try {
          await this.db
            .collection("student_profiles")
            .updateOne(
              { submissionId: row.submission_id },
              { $setOnInsert: row.payload },
              { upsert: true },
            );
          await c.query(
            "UPDATE outbox_events SET delivered_at=now(),attempts=attempts+1 WHERE submission_id=$1",
            [row.submission_id],
          );
        } catch {
          await c.query(
            "UPDATE outbox_events SET attempts=attempts+1 WHERE submission_id=$1",
            [row.submission_id],
          );
          break;
        }
      }
      return rows.rowCount;
    });
  }
  async submissionStatus(player: string, id: string) {
    const result = await this.pool.query(
      'SELECT s.submission_id AS "submissionId", (o.delivered_at IS NOT NULL) AS replicated FROM profile_submissions s JOIN outbox_events o USING(submission_id) WHERE s.player_id=$1 AND s.submission_id=$2',
      [player, id],
    );
    return result.rows[0];
  }
  async history(player: string) {
    return this.db
      .collection("student_profiles")
      .find({ playerId: player }, { projection: { _id: 0, playerId: 0 } })
      .sort({ revision: -1 })
      .limit(20)
      .toArray();
  }
  async snapshot(player: string, action?: Action, key?: string) {
    return this.transaction(async (c) => {
      await c.query("SELECT id FROM players WHERE id=$1 FOR UPDATE", [player]);
      const r = await c.query(
        "SELECT state FROM game_states WHERE player_id=$1",
        [player],
      );
      if (!r.rows[0]) throw new GameError("Crée ta fiche avant de jouer.");
      const saved = r.rows[0].state as Game;
      const catalog = await this.catalog();
      const now = Date.now();
      if (saved.catalogVersion !== catalog.version) {
        await c.query(
          "INSERT INTO game_state_backups(player_id,catalog_version,state) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [player, saved.catalogVersion, JSON.stringify(saved)],
        );
      }
      const game = migrateGame(saved, catalog, now);
      if (action && key) {
        const fingerprint = hash(JSON.stringify({ action }));
        if (!(await this.previous(c, player, key, fingerprint))) {
          applyAction(game, catalog, action, now);
          await c.query("INSERT INTO processed_actions VALUES($1,$2,$3,$4)", [
            player,
            key,
            fingerprint,
            JSON.stringify({ done: true }),
          ]);
        }
      }
      await c.query("UPDATE game_states SET state=$2 WHERE player_id=$1", [
        player,
        JSON.stringify(game),
      ]);
      return {
        game,
        catalog,
        serverTime: now,
        clickValue: clickValue(game, catalog),
        upgradePrice: upgradePrice(game, catalog),
      };
    });
  }
}
