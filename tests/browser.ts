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
  await page.getByRole("heading", { name: "De l’élève au prez du BdE." }).waitFor();
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/welcome.png", fullPage: true });
  await page.getByLabel("Ton pseudo").fill("Camille");
  await page.getByLabel("Ton association").selectOption("bakaclub");
  await page.getByLabel("Quelques mots sur toi").fill("Je veux partager ma passion avec mon association.");
  await page.getByRole("button", { name: "Commencer à jouer" }).click();
  await page.getByRole("heading", { name: "Simple élève", exact: true }).waitFor();
  const click = page.getByRole("button", { name: /^Cliquer/ });
  async function clicks(count: number) {
    for (let i = 0; i < count; i++) {
      await click.click();
      if ((i + 1) % 10 === 0) await page.waitForTimeout(1150);
    }
    await page.getByText("Partie sauvegardée", { exact: true }).waitFor();
  }
  await clicks(20);
  assert.equal(await page.getByTestId("points").textContent(), "20");
  await page.getByRole("button", { name: "Améliorer · 20 points" }).click();
  await page.getByRole("button", { name: "Cliquer +2 points par clic", exact: true }).waitFor();
  assert.equal(await page.getByTestId("points").textContent(), "0");
  await clicks(20);
  await page.getByRole("heading", { name: "Membre d’asso", exact: true }).waitFor();
  await page.getByRole("button", { name: "Cliquer +3 points par clic", exact: true }).waitFor();
  const balance = await page.getByTestId("points").textContent();
  await page.screenshot({ path: "test-results/game.png", fullPage: true });
  await page.getByRole("button", { name: "Ma fiche", exact: true }).click();
  await page.getByLabel("Quelques mots sur toi").fill("Deuxième version : je progresse tranquillement dans mon asso.");
  await page.getByRole("button", { name: "Enregistrer ma fiche" }).click();
  await page.getByRole("heading", { name: "Membre d’asso", exact: true }).waitFor();
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Ma fiche", exact: true }).click();
  await page.getByText("Historique de ma fiche", { exact: true }).click();
  await page.getByText("Version 2 · Camille", { exact: true }).waitFor();
  assert.equal(await db.store.db.collection("student_profiles").countDocuments(), 2);
  await page.reload();
  await page.getByRole("heading", { name: "Membre d’asso", exact: true }).waitFor();
  assert.equal(await page.getByTestId("points").textContent(), balance);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await click.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  // Lost response after a successful server write: retry must preserve the key.
  await page.waitForTimeout(1800);
  const before = (await db.store.pool.query("SELECT state FROM game_states"))
    .rows[0].state.clicks;
  const replayKeys: string[] = [];
  let loseResponse = true;
  await page.route("**/api/actions", async (route) => {
    replayKeys.push(route.request().headers()["idempotency-key"]);
    const response = await route.fetch();
    if (loseResponse) {
      loseResponse = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Réponse perdue pendant le test." }),
      });
    } else await route.fulfill({ response });
  });
  await page.getByRole("button", { name: /^Cliquer/ }).click();
  await page
    .getByRole("button", { name: "Réessayer la même action" })
    .waitFor();
  await page.getByRole("button", { name: "Réessayer la même action" }).click();
  await page
    .getByRole("button", { name: "Réessayer la même action" })
    .waitFor({ state: "detached" });
  await page.waitForTimeout(1000);
  const after = (await db.store.pool.query("SELECT state FROM game_states"))
    .rows[0].state.clicks;
  assert.equal(after, before + 1);
  assert.equal(replayKeys.length, 2);
  assert.equal(replayKeys[0], replayKeys[1]);
  await page.unroute("**/api/actions");
  await page.setViewportSize({ width: 320, height: 740 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Pas de débordement à 320px",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Navigateur : création, double persistance, clics, bonus, promotion automatique, édition, historique, rechargement et mobile OK.",
  );
} finally {
  await browser.close();
  await app.close();
  await db.close();
}
