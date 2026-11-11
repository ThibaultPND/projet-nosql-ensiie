import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../content/catalog.js";
import {
  advance,
  applyAction,
  freshGame,
  rate,
  requirements,
} from "../apps/api/engine.js";
import { validateCatalog } from "../apps/api/catalog-validation.js";
test("catalogue cohérent et associations imposées", () => {
  validateCatalog(catalog);
  assert.deepEqual(
    catalog.associations.map((a) => a.name),
    ["LeBar(c)", "Bakaclub", "ARISE"],
  );
});
test("les gains passifs sont plafonnés à 24 h et ne sont pas rétroactifs", () => {
  const g = freshGame("arise", catalog, 0);
  g.implication = 20000;
  applyAction(g, catalog, { type: "buy", id: "planning" }, 10000);
  assert.equal(g.implication, 0);
  assert.equal(rate(g, catalog), 220);
  advance(g, catalog, 10000 + 172800000);
  assert.equal(g.implication, 86400 * 220);
  const old = g.implication;
  advance(g, catalog, 10000 + 172800000);
  assert.equal(g.implication, old);
});
test("refuse achats, promotions et clics abusifs", () => {
  const g = freshGame("lebarc", catalog, 0);
  assert.throws(() =>
    applyAction(g, catalog, { type: "buy", id: "planning" }, 0),
  );
  assert.throws(() => applyAction(g, catalog, { type: "promote" }, 0));
  applyAction(g, catalog, { type: "click", count: 10 }, 0);
  assert.throws(() => applyAction(g, catalog, { type: "click", count: 1 }, 0));
});
test("projets sans expiration, récompense unique, bonus figé", () => {
  const g = freshGame("bakaclub", catalog, 0);
  g.implication = 10000;
  applyAction(g, catalog, { type: "start", id: "affiche" }, 0);
  const id = g.runs[0].id;
  g.associationId = "arise";
  applyAction(g, catalog, { type: "claim", id }, 86400000 * 5);
  assert.equal(g.reputation, 11);
  assert.throws(() =>
    applyAction(g, catalog, { type: "claim", id }, 86400000 * 5),
  );
  assert.deepEqual(requirements(g, catalog), []);
  applyAction(g, catalog, { type: "promote" }, 86400000 * 5);
  assert.equal(g.role, 1);
});
test("équipier libéré à la fin et deux emplacements au rôle prez", () => {
  const g = freshGame("lebarc", catalog, 0);
  g.role = 3;
  g.implication = 1e8;
  g.members = ["tableur"];
  applyAction(
    g,
    catalog,
    { type: "start", id: "atelier", member: "tableur" },
    0,
  );
  const end = g.runs[0].endsAt;
  assert.throws(() =>
    applyAction(
      g,
      catalog,
      { type: "start", id: "stand", member: "tableur" },
      0,
    ),
  );
  applyAction(
    g,
    catalog,
    { type: "start", id: "stand", member: "tableur" },
    end,
  );
  assert.equal(g.runs.length, 2);
});
test("un événement enregistré ne se relance pas par actualisation", () => {
  const g = freshGame("arise", catalog, 0);
  g.role = 1;
  advance(g, catalog, 14400000);
  const id = g.event!.id;
  advance(g, catalog, 14401000);
  assert.equal(g.event!.id, id);
  applyAction(g, catalog, { type: "event", id, choice: 0 }, 14401000);
  assert.throws(() =>
    applyAction(g, catalog, { type: "event", id, choice: 0 }, 14401000),
  );
});

test("les trois associations peuvent atteindre le BdE sur plusieurs jours", async () => {
  const { simulate } = await import("./simulate.js");
  for (const a of catalog.associations) {
    const result = simulate(a.id, 3);
    assert.equal(result.role, 6, JSON.stringify(result));
    assert.ok(result.days >= 3 && result.days <= 20, JSON.stringify(result));
  }
});
