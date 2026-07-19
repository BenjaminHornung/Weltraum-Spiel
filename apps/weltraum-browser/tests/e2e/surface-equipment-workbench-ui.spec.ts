import { expect, test as base, type Locator, type Page, type TestInfo } from "@playwright/test";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prototypeOrigin = "http://127.0.0.1:5224";
const prototypeUrl = `${prototypeOrigin}/prototypes/surface-equipment-workbench-v1/`;
const authorityBanner = "UI PROTOTYPE · MOCK BUILDER DATA · NO GAMEPLAY AUTHORITY";
const browserAppDirectory = fileURLToPath(new URL("../..", import.meta.url));
const evidenceDirectory = path.join(browserAppDirectory, "evidence");
const evidencePrefix = "surface-equipment-workbench-ui-v1-";
const healthEvidencePath = path.join(evidenceDirectory, `${evidencePrefix}health.json`);

const fixtureIds = [
  ["survey-scanner", "Survey Scanner"],
  ["mining-cutter", "Mining Cutter"],
  ["repair-tool", "Repair Tool"],
  ["emp-breacher", "EMP Breacher"],
  ["ballistic-sidearm", "Ballistic Sidearm"],
  ["laser-cutter", "Laser Cutter"],
] as const;

const moduleRoles = [
  "Frame",
  "Tool Head",
  "Delivery Assembly",
  "Power Pack",
  "Thermal Sink",
  "Feed System",
  "Magazine",
  "Optic/Scanner",
  "Control",
  "Safety",
  "Legal Transponder",
  "Grip/Stock",
  "Utility",
] as const;

interface OwnedViteProcess {
  readonly child: ChildProcess;
  readonly output: string[];
}

interface BrowserHealth {
  readonly consoleErrors: string[];
  readonly uncaughtPageErrors: string[];
  readonly failedRequestsOrResponses: string[];
  readonly missingAssetOrResource404s: string[];
  readonly ignoredIntentionalShutdownFailures: string[];
}

interface BrowserHealthReport {
  readonly test: string;
  readonly consoleErrors: readonly string[];
  readonly uncaughtPageErrors: readonly string[];
  readonly failedRequestsOrResponses: readonly string[];
  readonly missingAssetOrResource404s: readonly string[];
  readonly ignoredIntentionalShutdownFailures: readonly string[];
}

let ownedVite: OwnedViteProcess | null = null;
let ownedViteShutdownStarted = false;
const healthReports: BrowserHealthReport[] = [];

const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function appendProcessOutput(target: string[], chunk: unknown): void {
  target.push(String(chunk));
  const joined = target.join("");
  if (joined.length > 16_384) target.splice(0, target.length, joined.slice(-16_384));
}

function launchOwnedVite(): OwnedViteProcess {
  const output: string[] = [];
  const command = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", "npm run dev -- --host 127.0.0.1 --port 5224 --strictPort"]
    : ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5224", "--strictPort"];
  const child = spawn(command, args, {
    cwd: browserAppDirectory,
    detached: process.platform !== "win32",
    env: { ...process.env, NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout?.on("data", (chunk) => appendProcessOutput(output, chunk));
  child.stderr?.on("data", (chunk) => appendProcessOutput(output, chunk));
  child.on("error", (error) => appendProcessOutput(output, `\nspawn error: ${error.message}`));
  return { child, output };
}

async function waitForOwnedViteReady(server: OwnedViteProcess): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.child.exitCode !== null || server.child.signalCode !== null) {
      throw new Error(
        `Owned Vite exited before readiness with code ${server.child.exitCode} and signal ${server.child.signalCode}.\n${server.output.join("")}`,
      );
    }
    try {
      const response = await fetch(prototypeUrl, { signal: AbortSignal.timeout(1_000) });
      const body = await response.text();
      if (response.ok && response.url === prototypeUrl && body.includes(authorityBanner)) return;
    } catch {
      // Connection refusal is expected while the owned Vite process is starting.
    }
    await delay(100);
  }
  throw new Error(`Owned Vite did not serve the exact prototype route within 20 seconds.\n${server.output.join("")}`);
}

async function waitForProcessExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      child.off("exit", onExit);
      resolve(false);
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    child.once("exit", onExit);
  });
}

async function stopOwnedVite(server: OwnedViteProcess): Promise<void> {
  ownedViteShutdownStarted = true;
  const pid = server.child.pid;
  if (!pid || server.child.exitCode !== null || server.child.signalCode !== null) return;

  if (process.platform === "win32") {
    const result = spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (!(await waitForProcessExit(server.child, 5_000))) {
      throw new Error(`Failed to stop owned Windows Vite process tree ${pid}: ${result.stderr || result.stdout}`);
    }
    return;
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
  if (await waitForProcessExit(server.child, 5_000)) return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
  if (!(await waitForProcessExit(server.child, 2_000))) {
    throw new Error(`Failed to stop owned Vite process group ${pid}.`);
  }
}

function collectBrowserHealth(page: Page): BrowserHealth {
  const health: BrowserHealth = {
    consoleErrors: [],
    uncaughtPageErrors: [],
    failedRequestsOrResponses: [],
    missingAssetOrResource404s: [],
    ignoredIntentionalShutdownFailures: [],
  };
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location();
    health.consoleErrors.push(`${message.text()}${location.url ? ` @ ${location.url}:${location.lineNumber}:${location.columnNumber}` : ""}`);
  });
  page.on("pageerror", (error) => health.uncaughtPageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const entry = `${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown failure"}`;
    if (ownedViteShutdownStarted && request.url().startsWith(prototypeOrigin)) {
      health.ignoredIntentionalShutdownFailures.push(entry);
      return;
    }
    health.failedRequestsOrResponses.push(entry);
  });
  page.on("response", (response) => {
    if (response.status() === 404) {
      health.missingAssetOrResource404s.push(`${response.request().resourceType()} ${response.url()}`);
    } else if (response.status() >= 400) {
      health.failedRequestsOrResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  return health;
}

function recordAndAssertBrowserHealth(testInfo: TestInfo, health: BrowserHealth): void {
  const report: BrowserHealthReport = {
    test: testInfo.title,
    consoleErrors: [...health.consoleErrors],
    uncaughtPageErrors: [...health.uncaughtPageErrors],
    failedRequestsOrResponses: [...health.failedRequestsOrResponses],
    missingAssetOrResource404s: [...health.missingAssetOrResource404s],
    ignoredIntentionalShutdownFailures: [...health.ignoredIntentionalShutdownFailures],
  };
  healthReports.push(report);
  expect({
    consoleErrors: report.consoleErrors,
    uncaughtPageErrors: report.uncaughtPageErrors,
    failedRequestsOrResponses: report.failedRequestsOrResponses,
    missingAssetOrResource404s: report.missingAssetOrResource404s,
  }, "Browser health must be 0/0/0/0").toEqual({
    consoleErrors: [],
    uncaughtPageErrors: [],
    failedRequestsOrResponses: [],
    missingAssetOrResource404s: [],
  });
}

const test = base.extend<{ browserHealth: BrowserHealth }>({
  browserHealth: [async ({ page }, use, testInfo) => {
    const health = collectBrowserHealth(page);
    await use(health);
    recordAndAssertBrowserHealth(testInfo, health);
  }, { auto: true }],
});

async function openPrototype(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1_440, height: 960 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  const response = await page.goto(prototypeUrl, { waitUntil: "networkidle" });
  expect(response?.status()).toBe(200);
  expect(page.url()).toBe(prototypeUrl);
  await expect(page.getByTestId("authority-banner")).toHaveText(authorityBanner);
  await expect(page.getByTestId("surface-equipment-workbench")).toBeVisible();
}

async function selectFixture(page: Page, id: string, name: string): Promise<void> {
  const selector = page.getByTestId(`fixture-selector-${id}`);
  await selector.click();
  await expect(selector).toHaveAttribute("aria-current", "true");
  await expect(selector).toBeFocused();
  await expect(page.locator("#assembly-heading")).toHaveText(`${name} Assembly`);
  await expect(page.locator("#inspection-build-name")).toHaveText(name);
}

function slotButton(page: Page, slotId: string) {
  return page.getByTestId(`assembly-slot-${slotId}`).locator(".slot-select");
}

async function dragWithDataTransfer(page: Page, source: Locator, target: Locator): Promise<void> {
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  try {
    await source.dispatchEvent("dragstart", { dataTransfer });
    await target.dispatchEvent("dragenter", { dataTransfer });
    await target.dispatchEvent("dragover", { dataTransfer });
    await target.dispatchEvent("drop", { dataTransfer });
    await source.dispatchEvent("dragend", { dataTransfer });
  } finally {
    await dataTransfer.dispose();
  }
}

async function captureEvidence(page: Page, name: string): Promise<void> {
  await page.evaluate(async () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await page.screenshot({
    path: path.join(evidenceDirectory, `${evidencePrefix}${name}.png`),
    animations: "disabled",
  });
}

test.describe("surface equipment workbench UI prototype", () => {
  test.describe.configure({ mode: "serial", timeout: 60_000 });

  test.beforeAll(async () => {
    await mkdir(evidenceDirectory, { recursive: true });
    ownedViteShutdownStarted = false;
    ownedVite = launchOwnedVite();
    try {
      await waitForOwnedViteReady(ownedVite);
    } catch (error) {
      await stopOwnedVite(ownedVite);
      ownedVite = null;
      throw error;
    }
  });

  test.beforeEach(async ({ page }) => {
    await openPrototype(page);
  });

  test.afterAll(async () => {
    const sortedReports = [...healthReports].sort((left, right) => left.test.localeCompare(right.test));
    const totals = sortedReports.reduce((sum, report) => ({
      consoleErrors: sum.consoleErrors + report.consoleErrors.length,
      uncaughtPageErrors: sum.uncaughtPageErrors + report.uncaughtPageErrors.length,
      failedRequestsOrResponses: sum.failedRequestsOrResponses + report.failedRequestsOrResponses.length,
      missingAssetOrResource404s: sum.missingAssetOrResource404s + report.missingAssetOrResource404s.length,
    }), { consoleErrors: 0, uncaughtPageErrors: 0, failedRequestsOrResponses: 0, missingAssetOrResource404s: 0 });
    try {
      expect(sortedReports, "All six independent acceptance tests must report browser health").toHaveLength(6);
      expect(totals, "Aggregate browser health must be 0/0/0/0").toEqual({
        consoleErrors: 0,
        uncaughtPageErrors: 0,
        failedRequestsOrResponses: 0,
        missingAssetOrResource404s: 0,
      });
      await writeFile(healthEvidencePath, `${JSON.stringify({
        route: prototypeUrl,
        ownedServerCommand: "npm run dev -- --host 127.0.0.1 --port 5224 --strictPort",
        filtering: "Only request failures emitted after shutdown starts for the owned 127.0.0.1:5224 process are ignored.",
        totals,
        tests: sortedReports,
      }, null, 2)}\n`, "utf8");
    } finally {
      if (ownedVite) await stopOwnedVite(ownedVite);
      ownedVite = null;
    }
  });

  test("shows the exact authority, six fixtures, thirteen roles, and all desktop panes", async ({ page }) => {
    const fixtures = page.getByTestId("fixture-selectors").locator("[data-fixture-id]");
    await expect(fixtures).toHaveCount(6);
    for (const [id, name] of fixtureIds) {
      await expect(page.getByTestId(`fixture-selector-${id}`)).toContainText(name);
    }

    for (const role of moduleRoles) {
      const roleEntry = page.getByTestId("module-palette").locator(`[data-role="${role}"]`).first();
      await roleEntry.scrollIntoViewIfNeeded();
      await expect(roleEntry).toBeVisible();
      await expect(roleEntry).toContainText(role);
    }

    await expect(page.getByTestId("library-pane")).toBeVisible();
    await expect(page.getByTestId("assembly-pane")).toBeVisible();
    await expect(page.getByTestId("inspection-pane")).toBeVisible();
    await expect(page.getByTestId("pane-control-assembly")).toBeHidden();

    await page.evaluate(() => {
      const api = (window as any).surfaceEquipmentWorkbenchPrototype;
      const originalInput = api.snapshotInput;
      const originalCatalog = originalInput.readCatalogSnapshot();
      const replacementDrafts = originalInput.readInitialDrafts();
      replacementDrafts["survey-scanner"] = {
        ...replacementDrafts["survey-scanner"],
        control: "scanner-control-basic",
      };
      const fixtures = originalCatalog.fixtures.map((fixture: any) => ({
        ...fixture,
        name: fixture.id === "survey-scanner"
          ? "Provider Survey Scanner"
          : fixture.id === "laser-cutter"
            ? "Provider Laser Cutter"
            : fixture.name,
      }));
      const modules = originalCatalog.modules.map((module: any) => ({
        ...module,
        name: module.id === "scanner-control-basic" ? "Provider Isolated Controller" : module.name,
        fixtures: module.id === "scanner-control-suit" ? [] : module.fixtures,
      }));
      let catalogReads = 0;
      let draftReads = 0;
      (window as any).surfaceEquipmentSnapshotReadCounts = () => ({ catalogReads, draftReads });
      api.replaceSnapshotInput({
        readCatalogSnapshot: () => {
          catalogReads += 1;
          return { fixtures, modules };
        },
        readInitialDrafts: () => {
          draftReads += 1;
          return replacementDrafts;
        },
      });
    });

    await expect.poll(() => page.evaluate(() => (window as any).surfaceEquipmentSnapshotReadCounts())).toEqual({
      catalogReads: 1,
      draftReads: 1,
    });
    await expect(page.getByTestId("fixture-selector-survey-scanner")).toContainText("Provider Survey Scanner");
    await expect(page.locator("#assembly-heading")).toHaveText("Provider Survey Scanner Assembly");
    await expect(page.locator("#inspection-build-name")).toHaveText("Provider Survey Scanner");
    await expect(page.getByTestId("assembly-slot-control")).toContainText("Provider Isolated Controller");

    await page.getByTestId("compare-button").click();
    await expect(page.getByTestId("compare-panel")).toContainText("Provider Survey Scanner");
    await expect(page.getByTestId("compare-panel")).toContainText("Provider Laser Cutter");
    await page.getByTestId("compare-button").click();

    await page.getByTestId("compatibility-filter").selectOption("compatible");
    await expect(page.getByTestId("module-select-scanner-control-suit")).toHaveCount(0);
    const providerModule = page.getByTestId("module-select-scanner-control-basic");
    await providerModule.click();
    await expect(providerModule).toBeFocused();
    await expect(page.getByTestId("action-feedback")).toContainText("Selected Provider Isolated Controller");
  });

  test("covers invalid mutation, diagnostic focus, install, replace, remove, and drag/drop install", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await expect(page.getByTestId("readiness-state")).toHaveText("Blocked");
    await page.getByTestId("pane-control-inspection").click();
    const scannerDiagnostic = page.getByTestId("diagnostic-scanner-suit-interface");
    await expect(scannerDiagnostic).toContainText("Survey Scanner has no Suit Interface");
    await expect(scannerDiagnostic.getByTestId("suggested-fix")).toHaveText(
      "Suggested Fix: Install the Suit-linked Scan Controller in the Control slot.",
    );
    await scannerDiagnostic.click();
    await expect(page.getByTestId("pane-control-assembly")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("assembly-pane")).toBeVisible();
    await expect(slotButton(page, "control")).toBeFocused();
    await expect(page.getByTestId("action-feedback")).toBeVisible();
    await expect(page.getByTestId("action-feedback")).toHaveAttribute("aria-live", "polite");
    await expect(page.getByTestId("action-feedback")).toContainText("Focused Control Bus");

    await dragWithDataTransfer(page, slotButton(page, "utility"), slotButton(page, "control"));
    await expect(page.getByTestId("action-feedback")).toContainText("Move rejected");
    await expect(page.getByTestId("history-state")).toHaveText("0 undo · 0 redo");
    await expect(page.getByTestId("assembly-slot-control")).toContainText("EMPTY");

    await page.getByTestId("pane-control-library").click();
    await page.getByTestId("module-action-scanner-control-basic").click();
    await expect(page.getByTestId("pane-control-assembly")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("assembly-pane")).toBeVisible();
    await expect(page.getByTestId("assembly-slot-control")).toContainText("Isolated Scan Controller");
    await expect(slotButton(page, "control")).toBeFocused();
    await expect(page.getByTestId("action-feedback")).toBeVisible();
    await expect(page.getByTestId("action-feedback")).toContainText("Installed Isolated Scan Controller");

    await page.getByTestId("pane-control-library").click();
    await page.getByTestId("module-select-scanner-control-suit").click();
    await expect(page.getByTestId("module-select-scanner-control-suit")).toBeFocused();
    await expect(page.getByTestId("module-action-scanner-control-suit")).toHaveText("Replace");
    await page.getByTestId("module-action-scanner-control-suit").click();
    await expect(page.getByTestId("pane-control-assembly")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("assembly-slot-control")).toContainText("Suit-linked Scan Controller");
    await expect(page.getByTestId("readiness-state")).toHaveText("Ready");
    await expect(slotButton(page, "control")).toBeFocused();
    await expect(page.getByTestId("action-feedback")).toBeVisible();
    await expect(page.getByTestId("action-feedback")).toContainText("Replaced Isolated Scan Controller");

    await page.setViewportSize({ width: 1_440, height: 960 });
    await page.getByTestId("remove-control").click();
    await expect(page.getByTestId("assembly-slot-control")).toContainText("EMPTY");
    await expect(page.getByTestId("readiness-state")).toHaveText("Blocked");

    await dragWithDataTransfer(
      page,
      page.getByTestId("module-select-scanner-control-suit"),
      slotButton(page, "control"),
    );
    await expect(page.getByTestId("assembly-slot-control")).toContainText("Suit-linked Scan Controller");
    await expect(page.getByTestId("capability-list")).toContainText("Suit Interface");
    await expect(page.getByTestId("readiness-state")).toHaveText("Ready");
    await expect(slotButton(page, "control")).toBeFocused();
    await captureEvidence(page, "scanner");
  });

  test("covers Mining Cutter thermal, Scanner interface, EMP restriction, Repair consumable, and drag/drop move", async ({ page }) => {
    await selectFixture(page, "mining-cutter", "Mining Cutter");
    await expect(page.getByTestId("readiness-state")).toHaveText("Limited");
    const thermalDiagnostic = page.getByTestId("diagnostic-mining-thermal-budget");
    await expect(thermalDiagnostic).toContainText("Cutter heat 92 HU exceeds the displayed 50 HU dissipation budget.");
    await expect(thermalDiagnostic.getByTestId("suggested-fix")).toContainText("High-load Thermal Sink");
    await captureEvidence(page, "cutter");
    await slotButton(page, "thermal").click();
    await page.getByTestId("module-action-mining-sink-heavy").click();
    await expect(page.getByTestId("readiness-state")).toHaveText("Ready");

    await selectFixture(page, "emp-breacher", "EMP Breacher");
    await expect(page.getByTestId("readiness-state")).toHaveText("Limited");
    await expect(page.getByTestId("capability-list")).toContainText("Restricted (mock)");
    await expect(page.getByTestId("diagnostic-emp-restricted-transponder")).toContainText("Restricted");
    await expect(page.getByTestId("diagnostic-emp-restricted-transponder").getByTestId("suggested-fix")).toContainText(
      "Restricted Tool Transponder",
    );

    await selectFixture(page, "repair-tool", "Repair Tool");
    await expect(page.getByTestId("readiness-state")).toHaveText("Blocked");
    await expect(page.getByTestId("diagnostic-repair-missing-consumable")).toContainText("missing its Consumable");
    await dragWithDataTransfer(page, slotButton(page, "utility-a"), slotButton(page, "utility-b"));
    await expect(page.getByTestId("assembly-slot-utility-a")).toContainText("EMPTY");
    await expect(page.getByTestId("assembly-slot-utility-b")).toContainText("Inspection Lamp");
    await expect(page.getByTestId("action-feedback")).toContainText("Moved Inspection Lamp");
    await page.getByTestId("module-action-repair-consumable").click();
    await expect(page.getByTestId("assembly-slot-feed")).toContainText("Sealant Feed Cartridge");
    await expect(page.getByTestId("readiness-state")).toHaveText("Ready");
  });

  test("blocks Sidearm safety and magazine, reaches ready, and preserves branching undo/redo", async ({ page }) => {
    await selectFixture(page, "ballistic-sidearm", "Ballistic Sidearm");
    await expect(page.getByTestId("readiness-state")).toHaveText("Blocked");
    await expect(page.getByTestId("diagnostic-sidearm-missing-safety")).toContainText("missing its Safety interlock");
    await expect(page.getByTestId("diagnostic-sidearm-missing-magazine")).toContainText("missing its Magazine");
    await captureEvidence(page, "sidearm-blocked");

    await page.getByTestId("module-action-sidearm-safety").click();
    await expect(page.getByTestId("diagnostic-sidearm-missing-safety")).toHaveCount(0);
    await expect(page.getByTestId("diagnostic-sidearm-missing-magazine")).toBeVisible();
    await expect(page.getByTestId("readiness-state")).toHaveText("Blocked");
    await page.getByTestId("module-action-sidearm-magazine").click();
    await expect(page.getByTestId("readiness-state")).toHaveText("Ready");
    await expect(page.getByTestId("diagnostic-clear")).toContainText("Ready");
    await expect(page.getByTestId("history-state")).toHaveText("2 undo · 0 redo");
    await captureEvidence(page, "sidearm-ready");

    await page.keyboard.press("Control+KeyZ");
    await expect(page.getByTestId("diagnostic-sidearm-missing-magazine")).toBeVisible();
    await page.keyboard.press("Control+KeyY");
    await expect(page.getByTestId("readiness-state")).toHaveText("Ready");
    await page.keyboard.press("Control+KeyZ");
    await page.keyboard.press("Control+Shift+KeyZ");
    await expect(page.getByTestId("readiness-state")).toHaveText("Ready");

    await page.keyboard.press("Control+KeyZ");
    await page.getByTestId("remove-optic").click();
    await expect(page.getByTestId("redo-button")).toBeDisabled();
    await expect(page.getByTestId("history-state")).toHaveText("2 undo · 0 redo");
    await page.keyboard.press("Control+KeyY");
    await expect(page.getByTestId("action-feedback")).toContainText("Redo unavailable");
    await expect(page.getByTestId("assembly-slot-optic")).toContainText("EMPTY");
  });

  test("covers Compare Two Builds, native keyboard activation, Delete, and editable suppression", async ({ page }) => {
    const laserFixture = page.getByTestId("fixture-selector-laser-cutter");
    await laserFixture.focus();
    await page.keyboard.press("Enter");
    await expect(laserFixture).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("readiness-state")).toHaveText("Ready");

    const compareButton = page.getByTestId("compare-button");
    await compareButton.focus();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("compare-panel")).toBeVisible();
    await expect(page.getByTestId("compare-panel")).toContainText("Laser Cutter");
    await expect(page.getByTestId("compare-panel")).toContainText("Survey Scanner");
    for (const label of ["Mass", "Continuous Power", "Pulse Energy", "Heat", "Dissipation", "Capabilities", "Suit Interfaces", "Legal Class", "Readiness", "Module differences"]) {
      await expect(page.getByTestId("compare-panel")).toContainText(label);
    }

    const scannerFixture = page.getByTestId("fixture-selector-survey-scanner");
    await scannerFixture.click();
    await expect(scannerFixture).toBeFocused();
    await expect(page.getByTestId("compare-fixture-select")).toHaveValue("mining-cutter");
    await expect(page.getByTestId("compare-panel")).toContainText("Survey Scanner");
    await expect(page.getByTestId("compare-panel")).toContainText("Mining Cutter");

    await page.getByTestId("compare-fixture-select").focus();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("compare-panel")).toBeHidden();
    await expect(compareButton).toBeFocused();

    await laserFixture.click();
    await expect(laserFixture).toBeFocused();
    await slotButton(page, "utility").click();
    await expect(slotButton(page, "utility")).toBeFocused();
    await page.keyboard.press("Delete");
    await expect(page.getByTestId("assembly-slot-utility")).toContainText("EMPTY");
    await page.keyboard.press("Control+KeyZ");
    await expect(page.getByTestId("assembly-slot-utility")).toContainText("Cut Line Projector");

    const search = page.getByTestId("module-search");
    await search.focus();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("category-filter")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(search).toBeFocused();
    await search.fill("typing must not mutate the build");
    const historyBeforeEditableShortcuts = await page.getByTestId("history-state").textContent();
    await page.keyboard.press("Control+KeyZ");
    await page.keyboard.press("Control+KeyY");
    await page.keyboard.press("Delete");
    await expect(page.getByTestId("history-state")).toHaveText(historyBeforeEditableShortcuts ?? "");
    await expect(page.getByTestId("assembly-slot-utility")).toContainText("Cut Line Projector");
  });

  test("keeps explicit mobile panes at 390x844 and captures responsive evidence", async ({ page }) => {
    await page.setViewportSize({ width: 840, height: 900 });
    await expect(page.getByTestId("pane-control-library")).toBeVisible();
    await expect(page.getByTestId("pane-control-assembly")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("assembly-pane")).toBeVisible();
    await expect(page.getByTestId("library-pane")).toBeHidden();
    await expect(page.getByTestId("inspection-pane")).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("authority-banner")).toHaveText(authorityBanner);
    await expect(page.getByTestId("pane-control-library")).toBeVisible();
    await expect(page.getByTestId("pane-control-assembly")).toBeVisible();
    await expect(page.getByTestId("pane-control-inspection")).toBeVisible();
    await expect(page.getByTestId("pane-control-assembly")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("pane-control-library")).toHaveAttribute("tabindex", "-1");
    await expect(page.getByTestId("pane-control-assembly")).toHaveAttribute("tabindex", "0");
    await expect(page.getByTestId("pane-control-inspection")).toHaveAttribute("tabindex", "-1");
    await expect(page.getByTestId("assembly-pane")).toBeVisible();
    await expect(page.getByTestId("library-pane")).toBeHidden();
    await expect(page.getByTestId("inspection-pane")).toBeHidden();

    await page.getByTestId("pane-control-assembly").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("pane-control-inspection")).toBeFocused();
    await expect(page.getByTestId("pane-control-inspection")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("inspection-pane")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("pane-control-library")).toBeFocused();
    await expect(page.getByTestId("pane-control-library")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("library-pane")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("pane-control-inspection")).toBeFocused();
    await expect(page.getByTestId("pane-control-inspection")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(page.getByTestId("pane-control-library")).toBeFocused();
    await expect(page.getByTestId("pane-control-library")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(page.getByTestId("pane-control-inspection")).toBeFocused();
    await expect(page.getByTestId("pane-control-inspection")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("pane-control-library")).toHaveAttribute("tabindex", "-1");
    await expect(page.getByTestId("pane-control-assembly")).toHaveAttribute("tabindex", "-1");
    await expect(page.getByTestId("pane-control-inspection")).toHaveAttribute("tabindex", "0");

    await page.getByTestId("pane-control-library").click();
    await expect(page.getByTestId("library-pane")).toBeVisible();
    await expect(page.locator("#library-heading")).toBeFocused();
    await page.getByTestId("pane-control-inspection").click();
    await expect(page.getByTestId("inspection-pane")).toBeVisible();
    await expect(page.locator("#inspection-heading")).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await captureEvidence(page, "responsive");

    await page.getByTestId("pane-control-assembly").click();
    await expect(page.getByTestId("assembly-pane")).toBeVisible();
    await expect(page.locator("#assembly-heading")).toBeFocused();
  });
});
