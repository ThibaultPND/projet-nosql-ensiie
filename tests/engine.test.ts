import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../content/catalog.js";
import { applyAction, freshGame, clickValue, upgradePrice, migrateGame } from "../apps/api/engine.js";
import { validateCatalog } from "../apps/api/catalog-validation.js";
import { actionSchema } from "../packages/shared/model.js";
test("catalogue : sept échelons croissants, mêmes règles pour chaque asso", () => {
  validateCatalog(catalog);
  assert.deepEqual(catalog.associations.map(a => a.name), ["LeBar(c)", "Bakaclub", "ARISE"]);
  assert.throws(() => validateCatalog({ ...catalog, roles: [...catalog.roles].reverse() }));
});
test("un achat renforce les clics sans enlever la progression", () => {
  const g = freshGame("arise", catalog, 0);
  applyAction(g, catalog, { type: "click", count: 10 }, 0);
  applyAction(g, catalog, { type: "click", count: 10 }, 1000);
  assert.equal(g.implication, 20000);
  applyAction(g, catalog, { type: "buy" }, 1000);
  assert.equal(g.implication, 0);
  assert.equal(g.totalEarned, 20000);
  assert.equal(clickValue(g, catalog), 2);
  assert.equal(upgradePrice(g, catalog), 27);
  applyAction(g, catalog, { type: "click", count: 1 }, 86400000);
  assert.equal(g.implication, 2000, "aucun revenu passif ou hors ligne");
});
test("la promotion est automatique et les lots donnent les mêmes gains que les clics isolés", () => {
  const batch = freshGame("lebarc", catalog, 0);
  batch.totalEarned = 48000;
  const single = structuredClone(batch);
  applyAction(batch, catalog, { type: "click", count: 10 }, 1000);
  for (let i = 0; i < 10; i++) applyAction(single, catalog, { type: "click", count: 1 }, 1000);
  assert.deepEqual(batch, single);
  assert.equal(batch.role, 1);
  assert.equal(batch.implication, 18000);
  assert.equal(clickValue(batch, catalog), 2);
});
test("refuse les dépenses impossibles, les anciens projets et les clics excessifs", () => {
  const g = freshGame("lebarc", catalog, 0);
  assert.throws(() => applyAction(g, catalog, { type: "buy" }, 0));
  applyAction(g, catalog, { type: "click", count: 10 }, 0);
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, catalog, { type: "click", count: 1 }, 0));
  assert.deepEqual(g, before);
  assert.equal(actionSchema.safeParse({ type: "start", id: "affiche" }).success, false);
  assert.equal(actionSchema.safeParse({ type: "click", count: 11 }).success, false);
  g.clickLevel = catalog.upgrade.maxLevel;
  g.implication = 1e14;
  assert.throws(() => applyAction(g, catalog, { type: "buy" }, 0));
});
test("conversion sans perte du solde, du rôle et des achats existants, une seule fois", () => {
  const old = { ...freshGame("arise", catalog, 0), catalogVersion: "ensiie-1", role: 2,
    implication: 123456, clicks: 40, upgrades: { planning: 3, stand: 2 } };
  const g = migrateGame(old, catalog, 10000);
  assert.equal(g.role, 2);
  assert.equal(g.implication, 123456);
  assert.equal(g.legacyBonus, 5);
  assert.equal(g.totalEarned, 250000);
  assert.equal(clickValue(g, catalog), 9);
  assert.deepEqual(migrateGame(g, catalog, 20000), g);
  assert.equal(old.catalogVersion, "ensiie-1");
});
test("tous les échelons sont accessibles avec les seuls clics et bonus", async () => {
  const { simulate } = await import("./simulate.js");
  for (const a of catalog.associations) {
    const result = simulate(a.id);
    assert.equal(result.role, 6);
    assert.equal(result.milestones.length, 6);
    assert.ok(result.clicks > 300 && result.clicks < 2000, JSON.stringify(result));
  }
  const g = freshGame("arise", catalog, 0);
  g.role = 6;
  g.totalEarned = 25000000;
  applyAction(g, catalog, { type: "click", count: 1 }, 0);
  assert.equal(g.role, 6);
  assert.equal(g.implication, 64000);
});
