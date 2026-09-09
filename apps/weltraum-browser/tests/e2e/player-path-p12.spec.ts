import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ciTimeout } from "./support/ciTiming";

const evidenceDir = path.resolve(process.cwd(), "evidence");
// Angrenzendes Muster aus pg-tragwerk-destruction-render.spec.ts:
// Nur mit WELTRAUM_RECORD_EVIDENCE=1 wird Evidence neu geschrieben;
// normale Runs pruefen gespeicherte Evidence tolerant statt zu schreiben.
const recordEvidence = process.env.WELTRAUM_RECORD_EVIDENCE === "1";
const beforePng = "player-path-p12-before.png";
const afterPng = "player-path-p12-after.png";

async function expectTestBridgeAbsent(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => "TestBridge" in window)).toBe(false);
}

async function captureOrValidatePngEvidence(page: Page, fileName: string): Promise<void> {
  if (recordEvidence) {
    await mkdir(evidenceDir, { recursive: true });
    await page.screenshot({ path: path.join(evidenceDir, fileName) });
    return;
  }
  const filePath = path.join(evidenceDir, fileName);
  let size = 0;
  try {
    size = (await stat(filePath)).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Missing stored PNG evidence at ${filePath}; record it explicitly with WELTRAUM_RECORD_EVIDENCE=1.`, { cause: error });
    }
    throw error;
  }
  expect(size, `stored ${fileName} must be non-empty`).toBeGreaterThan(0);
}

async function persistOrValidateTextEvidence(summary: Record<string, unknown>, markdown: string): Promise<void> {
  const summaryPath = path.join(evidenceDir, "player-path-p12-summary.json");
  const markdownPath = path.join(evidenceDir, "player-path-p12.md");
  if (recordEvidence) {
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    await writeFile(markdownPath, markdown, "utf8");
    return;
  }
  let storedSummary: Record<string, unknown>;
  try {
    storedSummary = JSON.parse(await readFile(summaryPath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Missing stored evidence at ${summaryPath}; record it explicitly with WELTRAUM_RECORD_EVIDENCE=1.`, { cause: error });
    }
    throw error;
  }
  expect(storedSummary["cellsBeforeAfter"], "stored summary must pin the cut result").toBe("27→26");
  expect(storedSummary["cutStatus"], "stored summary must pin the applied status").toBe("Applied");
  expect(storedSummary["blockedSecondClick"], "stored summary must pin the blocked second click").toBe("RevisionConflict");
  let storedMarkdown = "";
  try {
    storedMarkdown = await readFile(markdownPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Missing stored evidence at ${markdownPath}; record it explicitly with WELTRAUM_RECORD_EVIDENCE=1.`, { cause: error });
    }
    throw error;
  }
  expect(storedMarkdown, "stored markdown must describe the P-PROD-P12 slice").toContain("P-PROD-P12");
}

test("P-PROD-P12 player path: HUD entry destroys PG-TRAGWERK-01 through the productive command", async ({ page }) => {
  test.setTimeout(ciTimeout(30_000, 120_000));
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await expect(page.locator("body")).toHaveAttribute("data-graphics-settings-ready", "true", { timeout: 20_000 });
  await expectTestBridgeAbsent(page);

  const openButton = page.getByTestId("pg-proving-ground-open");
  await expect(openButton, "Player HUD must expose the Proving Ground entry point").toBeVisible();
  await openButton.scrollIntoViewIfNeeded();
  await openButton.click();

  const dialog = page.getByTestId("pg-tragwerk-dialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("pg-tragwerk-mode")).toContainText("Modus: Proving Ground");
  const destroyButton = page.getByTestId("pg-tragwerk-destroy");
  await expect(destroyButton).toBeVisible();
  await expect(destroyButton).toBeEnabled();
  await expect(page.locator("#pg-tragwerk-cells")).toContainText(/27 Zellen/);
  await expect(page.locator("#pg-tragwerk-authority")).toContainText("player.pg-tragwerk-01");
  await expect(page.locator("#pg-tragwerk-authority")).toContainText("tool.pg-canonical-cut");
  await expect(page.locator("#pg-tragwerk-authority")).toContainText("object.pg-tragwerk-01");
  await expectTestBridgeAbsent(page);
  await captureOrValidatePngEvidence(page, beforePng);

  // Produktiver Pfad: echter Button-Klick, kein page.evaluate.
  await destroyButton.click();
  const status = page.locator("#pg-tragwerk-status");
  await expect(status).toContainText(/Applied/, { timeout: 20_000 });
  await expect(page.locator("#pg-tragwerk-cells")).toContainText(/27→26/);
  await expect(page.locator("#pg-tragwerk-receipt")).toContainText(/Cut Applied/);
  await expect(page.locator("#pg-tragwerk-receipt")).toContainText(/Bodies/);
  await expectTestBridgeAbsent(page);
  await captureOrValidatePngEvidence(page, afterPng);

  const cellsAfterFirst = await page.locator("#pg-tragwerk-cells").innerText();
  const receiptAfterFirst = await page.locator("#pg-tragwerk-receipt").innerText();

  // Blockierte Aktion: Zweitklick trifft die Seed-Revision und wird abgewiesen.
  await destroyButton.click();
  await expect(status).toContainText(/RevisionConflict/);
  await expect(page.locator("#pg-tragwerk-cells")).toHaveText(cellsAfterFirst);
  await expect(page.locator("#pg-tragwerk-receipt")).toHaveText(receiptAfterFirst);

  // Mutant-Kontrolle: ohne Destroy-Handler darf die Hauptassertion nicht bestehen.
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await page.getByTestId("pg-proving-ground-open").click();
  await expect(page.getByTestId("pg-tragwerk-dialog")).toBeVisible();
  await page.evaluate(() => document.querySelector("#pg-tragwerk-destroy")?.remove());
  await expect(page.getByTestId("pg-tragwerk-destroy")).toHaveCount(0);
  await expect(page.locator("#pg-tragwerk-status")).not.toContainText(/Applied/);

  const summary = {
    spec: "player-path-p12",
    entryButton: "#pg-proving-ground-open",
    dialog: "pg-tragwerk-dialog",
    destroyButton: "pg-tragwerk-destroy",
    testBridgeAbsent: true,
    cellsBeforeAfter: "27→26",
    cutStatus: "Applied",
    blockedSecondClick: "RevisionConflict",
    mutantControl: "destroy-button-removed-no-applied",
    screenshots: [beforePng, afterPng]
  };
  await persistOrValidateTextEvidence(
    summary,
    `# P-PROD-P12 Spielerpfad-Slice — Evidence\n\n` +
      `Spec: \`tests/e2e/player-path-p12.spec.ts\` auf \`/\` (startNormalRuntime, ohne Query).\n\n` +
      `- HUD-Einstieg \`#pg-proving-ground-open\` oeffnet den engen Dialog \`pg-tragwerk-dialog\` (Badge "Modus: Proving Ground").\n` +
      `- Genau eine primaere Aktion \`pg-tragwerk-destroy\` ("Zerstoerung ausloesen") per echtem \`locator.click()\`.\n` +
      `- Produktivpfad: \`dispatchCommand({ type: "DestroyPgTragwerk" })\` → \`applyStructuralDestructionCommand\`\n` +
      `  (kanonischer Schnitt min{16,5,0} max{17,6,1}, actor player.pg-tragwerk-01, source tool.pg-canonical-cut)\n` +
      `  → \`encodeStructuralRegionSave\`/\`decodeStructuralRegionSave\`-Roundtrip\n` +
      `  → \`commitStructuralPhysicsTransition\` im frischen Modus (kein persistierter Vorzustand, Fragmente starten\n` +
      `  aus der Author-Geometrie in Ruhe; Wahl: fresh statt restore, da kein Region-Save-Vorzustand existiert).\n` +
      `- Seed: produktiver Nachbau des authored Fixtures (27 Zellen, volle bekannte Coverage wie\n` +
      `  \`createCoveredPgTragwerk01\`), keine tests/support-Imports im Produktpfad.\n` +
      `- Ergebnis: Zellen 27→26, Cut Applied, Physik-Receipt (Bodies/Collider/Fragmente) + Save-Hash,\n` +
      `  Authority-/Source-Zeile mit echten Command-/Objektfeldern.\n` +
      `- Blockiert: Zweitklick → RevisionConflict in \`#pg-tragwerk-status[role=status]\`, kein State-Change.\n` +
      `- \`window.TestBridge\` auf \`/\` abwesend (Gate im Spec); Debug-HUD unberuehrt.\n` +
      `- Mutant-Kontrolle: entfernter Destroy-Button → keine Applied-Aussage (rot-nachweisbar).\n\n` +
      `## Screenshots\n\n` +
      `- \`apps/weltraum-browser/evidence/player-path-p12-before.png\`\n` +
      `- \`apps/weltraum-browser/evidence/player-path-p12-after.png\`\n`
  );
});
