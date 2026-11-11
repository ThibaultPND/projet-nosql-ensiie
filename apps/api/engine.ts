import { randomUUID } from "node:crypto";
import type {
  Action,
  Catalog,
  Game,
  Project,
} from "../../packages/shared/model.js";
export class GameError extends Error {
  statusCode = 400;
}
function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new GameError(message);
}
export function freshGame(
  associationId: string,
  catalog: Catalog,
  now: number,
): Game {
  return {
    catalogVersion: catalog.version,
    associationId,
    role: 0,
    implication: 0,
    reputation: 0,
    updatedAt: now,
    createdAt: now,
    remainder: 0,
    clicks: 0,
    clickTokens: 10,
    clickAt: now,
    upgrades: {},
    runs: [],
    completed: [],
    tags: [],
    members: [],
    journal: [],
    event: null,
    eventAt: now,
    eventDay: 0,
    eventCount: 0,
    recentEvents: [],
  };
}
export function rate(game: Game, catalog: Catalog) {
  return Math.round(
    catalog.upgrades.reduce(
      (sum, u) => sum + (game.upgrades[u.id] || 0) * u.rate,
      0,
    ) * (game.associationId === "arise" ? 1.1 : 1),
  );
}
export function price(level: number, cost: number) {
  return Math.ceil(cost * 1.15 ** level);
}
export function advance(game: Game, catalog: Catalog, now: number, speed = 1) {
  const elapsed = Math.min(Math.max(0, now - game.updatedAt), 86400000);
  const raw = elapsed * rate(game, catalog) * speed + game.remainder;
  const gain = Math.floor(raw / 1000);
  game.remainder = raw % 1000;
  game.implication = Math.min(1e14, game.implication + gain);
  game.updatedAt = Math.max(now, game.updatedAt);
  const day = Math.floor((now - game.createdAt) / 86400000);
  if (day !== game.eventDay) {
    game.eventDay = day;
    game.eventCount = 0;
  }
  if (
    game.role >= 1 &&
    !game.event &&
    game.eventCount < 2 &&
    now - game.eventAt >= 14400000 / speed
  ) {
    const options = catalog.events.filter(
      (e) => !game.recentEvents.includes(e.id),
    );
    const event = options[Math.floor(Math.random() * options.length)];
    if (event) {
      game.event = { id: randomUUID(), definitionId: event.id };
      game.eventCount++;
    }
  }
  return gain;
}
export function requirements(game: Game, catalog: Catalog): string[] {
  const next = catalog.roles[game.role + 1];
  if (!next) return [];
  const missing: string[] = [];
  if (game.reputation < next.reputation)
    missing.push(`${next.reputation - game.reputation} réputation à gagner`);
  if (game.completed.length < next.distinct)
    missing.push(
      `${next.distinct - game.completed.length} projet(s) distinct(s) à terminer`,
    );
  for (const tag of next.required)
    if (!game.tags.includes(tag))
      missing.push(catalog.projects.find((p) => p.tag === tag)?.name || tag);
  return missing;
}
export function terms(
  game: Game,
  catalog: Catalog,
  p: Project,
  memberId?: string,
  speed = 1,
) {
  const member = catalog.members.find((m) => m.id === memberId);
  return {
    cost: Math.ceil(p.cost * (member?.effect === "cost" ? 0.9 : 1)),
    seconds: Math.ceil(
      (p.seconds *
        (1 -
          (game.associationId === "lebarc" ? 0.1 : 0) -
          (member?.effect === "time" ? 0.1 : 0))) /
        speed,
    ),
    reputation: Math.round(
      p.reputation *
        (1 +
          (game.associationId === "bakaclub" ? 0.1 : 0) +
          (member?.effect === "reputation" ? 0.1 : 0)),
    ),
  };
}
export function applyAction(
  game: Game,
  catalog: Catalog,
  action: Action,
  now: number,
  speed = 1,
) {
  advance(game, catalog, now, speed);
  const spend = (points: number) => {
    requireThat(game.implication >= points * 1000, "Pas assez d’implication.");
    game.implication -= points * 1000;
  };
  const note = (text: string) => {
    game.journal.unshift({ at: now, text });
    game.journal = game.journal.slice(0, 30);
  };
  switch (action.type) {
    case "click": {
      const tokens = Math.min(
        10,
        game.clickTokens + Math.max(0, now - game.clickAt) * 0.01,
      );
      requireThat(
        tokens >= action.count,
        "Un peu moins vite : 10 clics par seconde maximum.",
      );
      game.clickTokens = tokens - action.count;
      game.clickAt = now;
      game.implication += action.count * 1000;
      game.clicks += action.count;
      break;
    }
    case "buy": {
      const u = catalog.upgrades.find((u) => u.id === action.id);
      requireThat(u && game.role >= u.role, "Amélioration indisponible.");
      const level = game.upgrades[u.id] || 0;
      requireThat(level < 50, "Niveau maximum atteint.");
      spend(price(level, u.cost));
      game.upgrades[u.id] = level + 1;
      note(`${u.name} passe au niveau ${level + 1}.`);
      break;
    }
    case "start": {
      const p = catalog.projects.find((p) => p.id === action.id);
      requireThat(
        p &&
          game.role >= p.role &&
          (!p.association || p.association === game.associationId),
        "Projet indisponible.",
      );
      requireThat(
        !(
          p.once &&
          (game.completed.includes(p.id) ||
            game.runs.some((r) => r.projectId === p.id))
        ),
        "Ce projet unique est déjà lancé ou terminé.",
      );
      requireThat(
        game.runs.length < 20,
        "Récupère tes projets terminés avant d’en lancer d’autres.",
      );
      requireThat(
        game.runs.filter((r) => r.endsAt > now).length <
          (game.role >= 3 ? 2 : 1),
        "Ton équipe est déjà occupée.",
      );
      if (action.member) {
        requireThat(
          game.members.includes(action.member),
          "Équipier non recruté.",
        );
        requireThat(
          !game.runs.some((r) => r.member === action.member && r.endsAt > now),
          "Cet équipier est occupé.",
        );
      }
      const t = terms(game, catalog, p, action.member, speed);
      spend(t.cost);
      game.runs.push({
        id: randomUUID(),
        projectId: p.id,
        name: p.name,
        startedAt: now,
        endsAt: now + t.seconds * 1000,
        reputation: t.reputation,
        member: action.member,
        tag: p.tag,
      });
      note(`En route : ${p.name}.`);
      break;
    }
    case "claim": {
      const r = game.runs.find((r) => r.id === action.id);
      requireThat(r, "Projet déjà récupéré ou introuvable.");
      requireThat(now >= r.endsAt, "Le projet est encore en cours.");
      game.reputation += r.reputation;
      if (!game.completed.includes(r.projectId))
        game.completed.push(r.projectId);
      if (r.tag && !game.tags.includes(r.tag)) game.tags.push(r.tag);
      game.runs = game.runs.filter((run) => run.id !== r.id);
      note(`${r.name} : +${r.reputation} réputation. Bien joué !`);
      break;
    }
    case "promote": {
      requireThat(
        game.role < catalog.roles.length - 1,
        "Tu es déjà prez du BdE !",
      );
      requireThat(
        requirements(game, catalog).length === 0,
        "Il reste des objectifs avant la promotion.",
      );
      game.role++;
      note(
        `Nouveau rôle : ${catalog.roles[game.role].name}. On compte sur toi !`,
      );
      break;
    }
    case "recruit": {
      const m = catalog.members.find((m) => m.id === action.id);
      requireThat(
        m && game.role >= 2 && !game.members.includes(m.id),
        "Recrutement indisponible.",
      );
      spend(m.cost);
      game.members.push(m.id);
      note(`${m.name} rejoint ton équipe.`);
      break;
    }
    case "event": {
      requireThat(
        game.event?.id === action.id,
        "Cet événement a déjà été résolu.",
      );
      const e = catalog.events.find((e) => e.id === game.event!.definitionId)!;
      const choice = e.choices[action.choice];
      game.reputation += choice.reputation * (game.role + 1);
      game.implication += choice.implication * (game.role + 1) * 1000;
      game.recentEvents = [...game.recentEvents, e.id].slice(-5);
      game.event = null;
      game.eventAt = now;
      note(`${e.title} — ${choice.text}.`);
      break;
    }
  }
}
