import { z } from "zod";
import type { Catalog } from "../../packages/shared/model.js";
const text = z.string().min(1);
const n = z.number().int().nonnegative();
const schema = z.object({
  version: text,
  associations: z
    .array(
      z.object({
        id: text,
        name: text,
        icon: text,
        description: text,
        bonus: text,
      }),
    )
    .length(3),
  roles: z
    .array(
      z.object({
        name: text,
        reputation: n,
        distinct: n,
        required: z.array(text),
      }),
    )
    .length(7),
  upgrades: z
    .array(
      z.object({
        id: text,
        name: text,
        description: text,
        role: n.max(6),
        cost: n.positive(),
        rate: n.positive(),
      }),
    )
    .min(1),
  projects: z
    .array(
      z.object({
        id: text,
        name: text,
        description: text,
        role: n.max(6),
        cost: n,
        seconds: n,
        reputation: n,
        association: text.optional(),
        once: z.boolean().optional(),
        tag: text.optional(),
      }),
    )
    .min(1),
  members: z.array(
    z.object({
      id: text,
      name: text,
      description: text,
      cost: n,
      effect: z.enum(["time", "cost", "reputation"]),
    }),
  ),
  events: z
    .array(
      z.object({
        id: text,
        title: text,
        text,
        choices: z
          .array(z.object({ text, reputation: n, implication: n }))
          .length(2),
      }),
    )
    .min(6),
});
export function validateCatalog(input: unknown): Catalog {
  const c = schema.parse(input);
  for (const entries of [
    c.associations,
    c.upgrades,
    c.projects,
    c.members,
    c.events,
  ])
    if (new Set(entries.map((e) => e.id)).size !== entries.length)
      throw new Error("Identifiants du catalogue dupliqués.");
  for (const p of c.projects)
    if (p.association && !c.associations.some((a) => a.id === p.association))
      throw new Error("Association inconnue.");
  for (const r of c.roles)
    for (const tag of r.required)
      if (!c.projects.some((p) => p.tag === tag))
        throw new Error("Objectif de promotion introuvable.");
  return c;
}
