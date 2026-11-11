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
  z
    .object({
      type: z.literal("click"),
      count: z.number().int().min(1).max(10),
    })
    .strict(),
  z.object({ type: z.literal("buy"), id: z.string().max(60) }).strict(),
  z
    .object({
      type: z.literal("start"),
      id: z.string().max(60),
      member: z.string().max(40).optional(),
    })
    .strict(),
  z.object({ type: z.literal("claim"), id: z.string().uuid() }).strict(),
  z.object({ type: z.literal("promote") }).strict(),
  z.object({ type: z.literal("recruit"), id: z.string().max(40) }).strict(),
  z
    .object({
      type: z.literal("event"),
      id: z.string().uuid(),
      choice: z.number().int().min(0).max(1),
    })
    .strict(),
]);
export type Action = z.infer<typeof actionSchema>;
export type Project = {
  id: string;
  name: string;
  description: string;
  role: number;
  cost: number;
  seconds: number;
  reputation: number;
  association?: string;
  once?: boolean;
  tag?: string;
};
export type Upgrade = {
  id: string;
  name: string;
  description: string;
  role: number;
  cost: number;
  rate: number;
};
export type Catalog = {
  version: string;
  associations: {
    id: string;
    name: string;
    icon: string;
    description: string;
    bonus: string;
  }[];
  roles: {
    name: string;
    reputation: number;
    distinct: number;
    required: string[];
  }[];
  upgrades: Upgrade[];
  projects: Project[];
  members: {
    id: string;
    name: string;
    description: string;
    cost: number;
    effect: "time" | "cost" | "reputation";
  }[];
  events: {
    id: string;
    title: string;
    text: string;
    choices: { text: string; reputation: number; implication: number }[];
  }[];
};
export type Run = {
  id: string;
  projectId: string;
  name: string;
  startedAt: number;
  endsAt: number;
  reputation: number;
  member?: string;
  tag?: string;
};
export type Game = {
  catalogVersion: string;
  associationId: string;
  role: number;
  implication: number;
  reputation: number;
  updatedAt: number;
  createdAt: number;
  remainder: number;
  clicks: number;
  clickTokens: number;
  clickAt: number;
  upgrades: Record<string, number>;
  runs: Run[];
  completed: string[];
  tags: string[];
  members: string[];
  journal: { at: number; text: string }[];
  event: { id: string; definitionId: string } | null;
  eventAt: number;
  eventDay: number;
  eventCount: number;
  recentEvents: string[];
};
export type Snapshot = {
  game: Game;
  catalog: Catalog;
  rate: number;
  serverTime: number;
  offlineGain: number;
  requirements: string[];
  demo: boolean;
};
