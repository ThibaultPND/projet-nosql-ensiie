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
  await page.screenshot({
    path: "test-results/welcome.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByLabel("Ton pseudo").fill("Camille");
  await page.getByRole("radio", { name: /Bakaclub/ }).check();
  await page
    .getByLabel("Pourquoi tu rejoins cette asso ?")
    .fill("Je veux partager ma passion et organiser des projets ensemble.");
  await page
    .getByRole("button", { name: "Entrer dans la vie associative" })
    .click();
  await page.getByRole("heading", { name: /Salut, Camille/ }).waitFor();
  await page.getByText("Ta fiche est enregistrée.", { exact: false }).waitFor();
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
  await page.getByRole("dialog", { name: "Promotion obtenue" }).waitFor();
  await page.getByRole("button", { name: "C’est parti !" }).click();
  await page.getByText("Membre d’asso", { exact: false }).waitFor();
  await page.screenshot({
    path: "test-results/campus.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Mon parcours", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Mon parcours jusqu’au BdE" })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Les projets", exact: true }).click();
  await page.getByRole("button", { name: "Tous", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Rechercher un projet" })
    .fill("grand débat");
  assert.equal(await page.locator(".project").count(), 1);
  assert.equal(await page.locator(".project button").isDisabled(), true);
  await page
    .getByRole("textbox", { name: "Rechercher un projet" })
    .fill("aucun-projet-xyz");
  await page
    .getByRole("heading", { name: "Aucun projet dans cette sélection." })
    .waitFor();
  await page
    .getByRole("button", { name: "Voir tous les projets", exact: true })
    .click();
  assert.ok((await page.locator(".project").count()) > 5);
  await page.screenshot({
    path: "test-results/projects.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Mon équipe", exact: true }).click();
  assert.equal(await page.locator(".team-card").count(), 3);
  await page.screenshot({
    path: "test-results/team.png",
    fullPage: true,
    animations: "disabled",
  });
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
  await page.screenshot({
    path: "test-results/mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Pas de débordement mobile",
  );
  await page.getByRole("button", { name: "Les projets", exact: true }).click();
  await page.getByRole("button", { name: "Tous", exact: true }).click();
  await page.screenshot({
    path: "test-results/mobile-projects.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Mon campus", exact: true }).click();
  await page.getByRole("button", { name: /S’impliquer/ }).focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(".click-particles span").count(), 0);
  assert.equal(
    await page
      .locator(".steam")
      .evaluate((e) => getComputedStyle(e).animationName),
    "none",
  );
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
  await page.getByRole("button", { name: /S’impliquer/ }).click();
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
    "Navigateur : création, double persistance, clics, achat, projet, promotion, édition, historique, rechargement et mobile OK.",
  );
} finally {
  await browser.close();
  await app.close();
  await db.close();
}
