import { z } from "zod";
import type { Catalog } from "../../packages/shared/model.js";
const schema = z.object({
  version: z.string().min(1),
  associations: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })).length(3),
  roles: z.array(z.object({
    name: z.string().min(1), threshold: z.number().int().nonnegative(),
    clickValue: z.number().int().positive(),
  })).length(7),
  upgrade: z.object({
    cost: z.number().int().positive(), growth: z.number().min(1.01),
    bonus: z.number().int().positive(), maxLevel: z.number().int().min(1).max(50),
  }),
});
export function validateCatalog(input: unknown): Catalog {
  const c = schema.parse(input);
  if (new Set(c.associations.map(a => a.id)).size !== 3)
    throw new Error("Associations dupliquées.");
  if (c.roles[0].threshold !== 0 || c.roles.some((r, i) => i > 0 &&
    (r.threshold <= c.roles[i - 1].threshold || r.clickValue <= c.roles[i - 1].clickValue)))
    throw new Error("Les échelons doivent progresser.");
  return c;
}
