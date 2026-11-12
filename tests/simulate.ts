import { pathToFileURL } from "node:url";
import { catalog } from "../content/catalog.js";
import { applyAction, freshGame, upgradePrice } from "../apps/api/engine.js";
export function simulate(association: string) {
  const g = freshGame(association, catalog, 0);
  const milestones: { role: number; clicks: number }[] = [];
  for (let n = 1; n <= 10000 && g.role < 6; n++) {
    const before = g.role;
    applyAction(g, catalog, { type: "click", count: 1 }, n * 250);
    if (g.role > before) milestones.push({ role: g.role, clicks: g.clicks });
    if (g.clickLevel < catalog.upgrade.maxLevel && g.implication >= upgradePrice(g, catalog) * 1000)
      applyAction(g, catalog, { type: "buy" }, n * 250);
  }
  return { association, role: g.role, clicks: g.clicks, milestones };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  for (const a of catalog.associations) console.log(JSON.stringify(simulate(a.id)));
