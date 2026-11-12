import { z } from "zod";
export const associationIds = ["lebarc", "bakaclub", "arise"] as const;
export const profileSchema = z
  .object({
    nickname: z.string().trim().min(2).max(32),
    associationId: z.enum(associationIds),
    presentation: z.string().trim().min(10).max(500),
  })
  .strict();
export type Profile = z.infer<typeof profileSchema>;
export type Submission = Profile & {
  submissionId: string;
  playerId: string;
  revision: number;
  createdAt: string;
};
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), count: z.number().int().min(1).max(10) }).strict(),
  z.object({ type: z.literal("buy") }).strict(),
]);
export type Action = z.infer<typeof actionSchema>;
export type Catalog = {
  version: string;
  associations: { id: string; name: string }[];
  roles: { name: string; threshold: number; clickValue: number }[];
  upgrade: { cost: number; growth: number; bonus: number; maxLevel: number };
};
export type Game = {
  catalogVersion: string;
  associationId: string;
  role: number;
  // Points remain stored in thousandths for compatibility with existing saves.
  implication: number;
  totalEarned: number;
  clickLevel: number;
  legacyBonus: number;
  createdAt: number;
  updatedAt: number;
  clicks: number;
  clickTokens: number;
  clickAt: number;
};
export type Snapshot = {
  game: Game;
  catalog: Catalog;
  clickValue: number;
  upgradePrice: number;
  serverTime: number;
};
