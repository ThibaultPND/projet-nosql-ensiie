import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import { databases } from "./fixtures.js";
import { buildApp } from "../apps/api/app.js";
const db = await databases(3600);
const app = await buildApp(db.store, { staticFiles: true });
const address = await app.listen({ host: "127.0.0.1", port: 0 });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(address);
  await page.getByRole("heading", { name: "Tout commence par toi." }).waitFor();
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/welcome.png", fullPage: true });
  await page.getByLabel("Ton pseudo").fill("Camille");
  await page.getByRole("radio", { name: /Bakaclub/ }).check();
  await page
    .getByLabel("Pourquoi tu rejoins cette asso ?")
    .fill("Je veux partager ma passion et organiser des projets ensemble.");
  await page
    .getByRole("button", { name: "Entrer dans la vie associative" })
    .click();
  await page.getByRole("heading", { name: /Salut, Camille/ }).waitFor();
  await page
    .getByText("Fiche enregistrée dans les deux bases.", { exact: false })
    .waitFor();
  // Enter key/clicks, real requests and batching.
  const click = page.getByRole("button", { name: /S’impliquer/ });
  for (let i = 0; i < 4; i++) {
    for (let n = 0; n < 10; n++) await click.click();
    await page.waitForTimeout(1150);
  }
  await page
    .locator(".upgrade")
    .filter({ hasText: "Planning partagé" })
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "Les projets", exact: true }).click();
  await page
    .locator(".project")
    .filter({ hasText: "La première affiche" })
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "Récupérer", exact: true }).click();
  await page.getByRole("button", { name: "Mon campus", exact: true }).click();
  await page.getByRole("button", { name: /Passer au rôle suivant/ }).click();
  await page.getByText("Membre d’asso ·", { exact: false }).waitFor();
  await page.screenshot({ path: "test-results/campus.png", fullPage: true });
  await page.getByRole("button", { name: "Ma fiche", exact: true }).click();
  await page.getByRole("button", { name: "Modifier ma présentation" }).click();
  await page
    .getByLabel("Pourquoi tu rejoins cette asso ?")
    .fill("Deuxième version : le stand est prêt, direction le bureau !");
  await page.getByRole("button", { name: "Enregistrer ma fiche" }).click();
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Actualiser l’historique" }).click();
  await page.getByText("VERSION 2", { exact: false }).waitFor();
  assert.equal(
    await db.store.db.collection("student_profiles").countDocuments(),
    2,
  );
  await page.reload();
  await page.getByRole("heading", { name: /Salut, Camille/ }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Pas de débordement mobile",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Navigateur : création, double persistance, clics, achat, projet, promotion, édition, historique, rechargement et mobile OK.",
  );
} finally {
  await browser.close();
  await app.close();
  await db.close();
}
