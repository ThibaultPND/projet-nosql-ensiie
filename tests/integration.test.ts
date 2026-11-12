import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { databases } from "./fixtures.js";
import { buildApp } from "../apps/api/app.js";
import { Store } from "../apps/api/store.js";

test(
  "API et persistance réelle PostgreSQL/MongoDB",
  { timeout: 180000 },
  async (t) => {
    const db = await databases();
    const app = await buildApp(db.store, {
      replication: false,
      origin: "http://localhost:8080",
    });
    t.after(async () => {
      await app.close();
      await db.close();
    });
    const headers: Record<string, string> = { "x-cliicker": "1" };
    const session = await app.inject({
      method: "POST",
      url: "/api/session",
      headers,
    });
    assert.equal(session.statusCode, 200);
    headers.cookie = session.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const value = {
      nickname: "Test iiens",
      associationId: "arise",
      presentation: "Une présentation pour les deux bases.",
    };
    let response = await app.inject({
      method: "PUT",
      url: "/api/profile",
      headers: { ...headers, "idempotency-key": randomUUID() },
      payload: { ...value, nickname: "a" },
    });
    assert.equal(response.statusCode, 400);
    assert.equal(
      (await db.store.pool.query("SELECT count(*) FROM profile_submissions"))
        .rows[0].count,
      "0",
    );
    const key = randomUUID();
    const put = () =>
      app.inject({
        method: "PUT",
        url: "/api/profile",
        headers: { ...headers, "idempotency-key": key },
        payload: value,
      });
    response = await put();
    assert.equal(response.statusCode, 202, response.body);
    const id = response.json().submissionId;
    assert.equal((await put()).json().submissionId, id);
    await db.store.replicate();
    await db.store.replicate();
    const sql = (
      await db.store.pool.query(
        "SELECT * FROM profile_submissions WHERE submission_id=$1",
        [id],
      )
    ).rows[0];
    const mongo = await db.store.db
      .collection("student_profiles")
      .findOne({ submissionId: id });
    assert.equal(sql.nickname, mongo!.nickname);
    assert.equal(sql.presentation, mongo!.presentation);
    assert.equal(sql.association_id, mongo!.associationId);
    assert.equal(
      await db.store.db
        .collection("student_profiles")
        .countDocuments({ submissionId: id }),
      1,
    );
    assert.equal(
      (
        await app.inject({ url: `/api/profile/submissions/${id}`, headers })
      ).json().replicated,
      true,
    );
    const other = await app.inject({
      method: "POST",
      url: "/api/session",
      headers: { "x-cliicker": "1" },
    });
    const otherCookie = other.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    assert.equal(
      (
        await app.inject({
          url: `/api/profile/submissions/${id}`,
          headers: { cookie: otherCookie },
        })
      ).statusCode,
      404,
    );
    assert.deepEqual(
      (
        await app.inject({
          url: "/api/profile/history",
          headers: { cookie: otherCookie },
        })
      ).json(),
      [],
    );
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: "/api/profile",
          headers: {
            ...headers,
            origin: "http://evil.invalid",
            "idempotency-key": randomUUID(),
          },
          payload: value,
        })
      ).statusCode,
      403,
    );
    // Crash after Mongo acknowledgement, before PostgreSQL acknowledgement: replay is safe.
    await db.store.pool.query(
      "UPDATE outbox_events SET delivered_at=NULL WHERE submission_id=$1",
      [id],
    );
    await db.store.replicate();
    assert.equal(
      await db.store.db
        .collection("student_profiles")
        .countDocuments({ submissionId: id }),
      1,
    );
    // Unavailable Mongo connection: SQL commit remains durable, and a later worker catches up.
    const disconnected = new Store(db.pgUrl, "mongodb://127.0.0.1:1/cliicker");
    const player = sql.player_id;
    const second = await disconnected.saveProfile(
      player,
      {
        ...value,
        associationId: "arise",
        presentation: "Deuxième version conservée malgré une panne.",
      },
      randomUUID(),
    );
    await disconnected.replicate();
    assert.equal(
      (await disconnected.submissionStatus(player, second.submissionId))
        .replicated,
      false,
    );
    await disconnected.close();
    await db.store.replicate();
    assert.equal(
      (await db.store.submissionStatus(player, second.submissionId)).replicated,
      true,
    );
    const history = await db.store.history(player);
    assert.equal(history[0].revision, 2);
    // Late old event must not supersede revision 2.
    await db.store.pool.query(
      "UPDATE outbox_events SET delivered_at=NULL WHERE submission_id=$1",
      [id],
    );
    await db.store.replicate();
    assert.equal((await db.store.history(player))[0].revision, 2);
    // Only one concurrent purchase can spend the same balance.
    await db.store.pool.query(
      "UPDATE game_states SET state=jsonb_set(state,'{implication}','20000'::jsonb) WHERE player_id=$1",
      [player],
    );
    const purchases = await Promise.allSettled([
      db.store.snapshot(player, { type: "buy" }, randomUUID()),
      db.store.snapshot(player, { type: "buy" }, randomUUID()),
    ]);
    assert.equal(purchases.filter((p) => p.status === "fulfilled").length, 1);
    // Lost action response: replay returns current state without spending twice.
    const clickKey = randomUUID();
    const firstClick = await db.store.snapshot(player, { type: "click", count: 1 }, clickKey);
    const replay = await db.store.snapshot(player, { type: "click", count: 1 }, clickKey);
    assert.deepEqual(replay.game, firstClick.game);
    await assert.rejects(() => db.store.snapshot(player, { type: "buy" }, clickKey));
    // An existing player is converted once; original state stays archived intact.
    const oldPlayer = await db.store.createSession();
    await db.store.saveProfile(oldPlayer.id, { ...value, associationId: "arise" }, randomUUID());
    const legacy = { catalogVersion: "ensiie-1", associationId: "arise", role: 2,
      implication: 123456, clicks: 33, createdAt: 100, upgrades: { planning: 3, stand: 2 },
      runs: [{ id: "old-project" }], reputation: 150 };
    await db.store.pool.query("UPDATE game_states SET state=$2 WHERE player_id=$1", [oldPlayer.id, JSON.stringify(legacy)]);
    const migrated = await db.store.snapshot(oldPlayer.id);
    assert.equal(migrated.game.implication, 123456);
    assert.equal(migrated.game.role, 2);
    assert.equal(migrated.clickValue, 9);
    assert.deepEqual((await db.store.snapshot(oldPlayer.id)).game, migrated.game);
    const backup = await db.store.pool.query("SELECT state FROM game_state_backups WHERE player_id=$1", [oldPlayer.id]);
    assert.equal(backup.rowCount, 1);
    assert.deepEqual(backup.rows[0].state, legacy);
    // Restart MongoDB on its existing directory, then verify durable documents.
    await db.mongo.stop({ doCleanup: false });
    await db.mongo.start();
    assert.equal((await db.store.history(player))[0].revision, 2);
    // Reconnect/restart PostgreSQL with the same data directory.
    await db.postgres.stop();
    await db.postgres.start();
    const persisted = await db.store.profile(player);
    assert.equal(persisted.presentation, second.presentation);
    const latest = await app.inject({ url: "/api/game", headers });
    assert.equal(latest.statusCode, 200, latest.body);
    assert.equal(latest.json().game.clickLevel, 1);
  },
);
