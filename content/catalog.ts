import type { Catalog } from "../packages/shared/model.js";
export const catalog: Catalog = {
  version: "ensiie-simple-2",
  associations: [
    { id: "lebarc", name: "LeBar(c)" },
    { id: "bakaclub", name: "Bakaclub" },
    { id: "arise", name: "ARISE" },
  ],
  roles: [
    { name: "Simple élève", threshold: 0, clickValue: 1 },
    { name: "Membre d’asso", threshold: 50, clickValue: 2 },
    { name: "Bureau d’asso", threshold: 250, clickValue: 4 },
    { name: "Prez d’asso", threshold: 1000, clickValue: 8 },
    { name: "Membre du BdE", threshold: 3500, clickValue: 16 },
    { name: "Bureau du BdE", threshold: 10000, clickValue: 32 },
    { name: "Prez du BdE", threshold: 25000, clickValue: 64 },
  ],
  upgrade: { cost: 20, growth: 1.35, bonus: 1, maxLevel: 50 },
};
