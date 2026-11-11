import { pathToFileURL } from "node:url";
import { catalog } from "../content/catalog.js";
import {
  applyAction,
  freshGame,
  advance,
  requirements,
  price,
  terms,
} from "../apps/api/engine.js";
export function simulate(association: string, sessions: number) {
  const g = freshGame(association, catalog, 0);
  let now = 0;
  for (let i = 0; i < 4; i++) {
    applyAction(g, catalog, { type: "click", count: 10 }, now);
    now += 1000;
  }
  applyAction(g, catalog, { type: "buy", id: "planning" }, now);
  applyAction(g, catalog, { type: "start", id: "affiche" }, now);
  applyAction(g, catalog, { type: "claim", id: g.runs[0].id }, now);
  applyAction(g, catalog, { type: "promote" }, now);
  const milestones = [{ role: 1, day: 0 }];
  for (let step = 0; step < 60 * sessions && g.role < 6; step++) {
    now += 86400000 / sessions;
    advance(g, catalog, now);
    for (const r of [...g.runs])
      if (r.endsAt <= now)
        applyAction(g, catalog, { type: "claim", id: r.id }, now);
    while (g.role < 6 && requirements(g, catalog).length === 0) {
      applyAction(g, catalog, { type: "promote" }, now);
      milestones.push({ role: g.role, day: now / 86400000 });
    }
    // Keep a reserve for projects; do not spend all earnings on escalating upgrades.
    for (const u of catalog.upgrades.filter((u) => u.role <= g.role)) {
      while (
        (g.upgrades[u.id] || 0) < 10 &&
        price(g.upgrades[u.id] || 0, u.cost) * 1000 < g.implication * 0.15
      )
        applyAction(g, catalog, { type: "buy", id: u.id }, now);
    }
    while (
      g.runs.filter((r) => r.endsAt > now).length < (g.role >= 3 ? 2 : 1)
    ) {
      const required = catalog.roles[g.role + 1]?.required || [];
      const candidates = catalog.projects.filter(
        (p) =>
          p.role <= g.role &&
          (!p.association || p.association === association) &&
          !(
            p.once &&
            (g.completed.includes(p.id) ||
              g.runs.some((r) => r.projectId === p.id))
          ) &&
          !g.runs.some((r) => r.projectId === p.id) &&
          terms(g, catalog, p).cost * 1000 <= g.implication,
      );
      candidates.sort((a, b) => {
        const priority = (p: typeof a) =>
          (p.tag && required.includes(p.tag) && !g.tags.includes(p.tag)
            ? 10000
            : 0) +
          (!g.completed.includes(p.id) ? 1000 : 0) +
          p.reputation / Math.max(1, Math.ceil(p.seconds / (86400 / sessions)));
        return priority(b) - priority(a);
      });
      if (!candidates.length) break;
      applyAction(g, catalog, { type: "start", id: candidates[0].id }, now);
    }
  }
  return {
    association,
    sessions,
    days: Math.round((now / 86400000) * 10) / 10,
    role: g.role,
    milestones,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  for (const a of catalog.associations)
    for (const sessions of [1, 3, 12])
      console.log(JSON.stringify(simulate(a.id, sessions)));
}
