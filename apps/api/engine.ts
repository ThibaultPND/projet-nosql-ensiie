import type { Action, Catalog, Game } from "../../packages/shared/model.js";
export class GameError extends Error { statusCode = 400; }
export function freshGame(associationId: string, catalog: Catalog, now: number): Game {
  return {
    catalogVersion: catalog.version, associationId, role: 0,
    implication: 0, totalEarned: 0, clickLevel: 0, legacyBonus: 0,
    createdAt: now, updatedAt: now, clicks: 0, clickTokens: 10, clickAt: now,
  };
}
export function clickValue(game: Game, catalog: Catalog) {
  return catalog.roles[game.role].clickValue + game.clickLevel * catalog.upgrade.bonus + game.legacyBonus;
}
export function upgradePrice(game: Game, catalog: Catalog) {
  return Math.ceil(catalog.upgrade.cost * catalog.upgrade.growth ** game.clickLevel);
}
// The original save is archived by Store in the same transaction as this conversion.
export function migrateGame(old: Game & { upgrades?: Record<string, number> }, catalog: Catalog, now: number): Game {
  if (old.catalogVersion === catalog.version) return old;
  if (old.catalogVersion !== "ensiie-1") throw new GameError("Version de sauvegarde inconnue.");
  return {
    ...freshGame(old.associationId, catalog, now),
    role: old.role, implication: old.implication, clicks: old.clicks,
    createdAt: old.createdAt,
    totalEarned: Math.max(old.implication, old.clicks * 1000, catalog.roles[old.role].threshold * 1000),
    legacyBonus: Object.values(old.upgrades || {}).reduce((sum, level) => sum + level, 0),
  };
}
export function applyAction(game: Game, catalog: Catalog, action: Action, now: number) {
  if (action.type === "click") {
    const tokens = Math.min(10, game.clickTokens + Math.max(0, now - game.clickAt) * 0.01);
    if (tokens < action.count) throw new GameError("Un peu moins vite : 10 clics par seconde maximum.");
    game.clickTokens = tokens - action.count;
    game.clickAt = Math.max(now, game.clickAt);
    // Resolve each click so batching never changes promotion rewards.
    for (let i = 0; i < action.count; i++) {
      const gain = clickValue(game, catalog) * 1000;
      game.implication = Math.min(1e14, game.implication + gain);
      game.totalEarned = Math.min(1e14, game.totalEarned + gain);
      game.clicks++;
      while (catalog.roles[game.role + 1] && game.totalEarned >= catalog.roles[game.role + 1].threshold * 1000)
        game.role++;
    }
  } else {
    if (game.clickLevel >= catalog.upgrade.maxLevel) throw new GameError("Ton clic est amélioré au maximum.");
    const cost = upgradePrice(game, catalog) * 1000;
    if (game.implication < cost) throw new GameError("Pas assez de points.");
    game.implication -= cost;
    game.clickLevel++;
  }
  game.updatedAt = Math.max(now, game.updatedAt);
}
