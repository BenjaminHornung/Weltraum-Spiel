import { expect, test, type Page } from "@playwright/test";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type BrowserHealth = {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  httpErrors: string[];
  missingAssets: string[];
};

const route = "/prototypes/outpost-operations-console-v1/";
const authorityNotice = "OUTPOST OPERATIONS PROTOTYPE · MOCK SERVICE DATA · NO GAMEPLAY AUTHORITY";
const specDirectory = path.dirname(fileURLToPath(import.meta.url));
const browserApplicationRoot = path.resolve(specDirectory, "../..");
const evidenceDirectory = path.join(browserApplicationRoot, "evidence");
const prefix = "outpost-operations-console-ui-v1-";
const screenshotPaths = Object.freeze({
  overview: path.join(evidenceDirectory, `${prefix}overview-1920x1080.png`),
  padConflict: path.join(evidenceDirectory, `${prefix}pad-conflict-1920x1080.png`),
  cargoBlocked: path.join(evidenceDirectory, `${prefix}cargo-blocked-1920x1080.png`),
  missionBoard: path.join(evidenceDirectory, `${prefix}mission-board-1920x1080.png`),
  droneLinkLost: path.join(evidenceDirectory, `${prefix}drone-link-lost-1920x1080.png`),
  responsive: path.join(evidenceDirectory, `${prefix}responsive-1280x720.png`),
  keyboardFocus: path.join(evidenceDirectory, `${prefix}keyboard-focus-1920x1080.png`)
});
const healthPath = path.join(evidenceDirectory, `${prefix}browser-health.json`);
const reportPath = path.join(evidenceDirectory, `${prefix}verification.md`);
const healthSamples: BrowserHealth[] = [];
const capturedScreenshots = new Set<string>();

const collectBrowserHealth = (page: Page): BrowserHealth => {
  const health: BrowserHealth = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    httpErrors: [],
    missingAssets: []
  };

  page.on("console", (message) => {
    if (message.type() === "error") health.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => health.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const message = `${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`;
    health.failedRequests.push(message);
    if (["image", "font", "stylesheet", "script"].includes(request.resourceType())) health.missingAssets.push(message);
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    const message = `${response.status()} ${response.request().method()} ${response.url()}`;
    health.httpErrors.push(message);
    if (response.status() === 404) health.missingAssets.push(message);
  });

  healthSamples.push(health);
  return health;
};

const expectHealthy = (health: BrowserHealth) => {
  expect(health.consoleErrors, "unfiltered console errors").toEqual([]);
  expect(health.pageErrors, "unfiltered page errors").toEqual([]);
  expect(health.failedRequests, "unfiltered failed requests").toEqual([]);
  expect(health.httpErrors, "unfiltered HTTP errors").toEqual([]);
  expect(health.missingAssets, "missing assets").toEqual([]);
};

const openPrototype = async (page: Page, viewport = { width: 1920, height: 1080 }) => {
  await page.setViewportSize(viewport);
  await page.goto(route, { waitUntil: "networkidle" });
  await expect(page.getByTestId("authority-banner")).toHaveText(authorityNotice);
  await expect(page.getByTestId("authority-banner")).toBeVisible();
};

const selectScenario = async (page: Page, scenario: string) => {
  await page.getByTestId("scenario-select").selectOption(scenario);
};

const capture = async (page: Page, filePath: string) => {
  await mkdir(evidenceDirectory, { recursive: true });
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
  await page.screenshot({ path: filePath, fullPage: false });
  const file = await stat(filePath);
  expect(file.size, `${path.basename(filePath)} must not be empty`).toBeGreaterThan(10_000);
  capturedScreenshots.add(filePath);
};

const expectNoViewportOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    bodyWidth: document.body.scrollWidth
  }));
  expect(overflow.documentWidth, "document horizontal overflow").toBeLessThanOrEqual(overflow.viewportWidth);
  expect(overflow.bodyWidth, "body horizontal overflow").toBeLessThanOrEqual(overflow.viewportWidth);
};

test.describe.configure({ mode: "serial" });

test("nominal overview exposes the complete mock authority boundary", async ({ page }) => {
  const health = collectBrowserHealth(page);
  await openPrototype(page);

  await expect(page.getByRole("heading", { name: "Approach and Pad Control" })).toBeVisible();
  await expect(page.locator("[data-pad='A']")).toContainText("Occupied");
  await expect(page.locator("[data-pad='A']")).toContainText("CSV Kestrel");
  await expect(page.locator("[data-pad='B']")).toContainText("Reserved");
  await expect(page.locator("[data-pad='C']")).toContainText("Maintenance");
  await expect(page.getByText("Cargo port alignment", { exact: true })).toBeVisible();
  await expectNoViewportOverflow(page);
  await capture(page, screenshotPaths.overview);
  expectHealthy(health);
});

test("pad conflict remains visible and blocks approach confirmation", async ({ page }) => {
  const health = collectBrowserHealth(page);
  await openPrototype(page);
  await selectScenario(page, "pad-conflict");

  await expect(page.getByTestId("pad-conflict-warning")).toBeVisible();
  await expect(page.locator("[data-pad='B']")).toContainText("Reservation Conflict");
  await expect(page.getByRole("button", { name: "Confirm approach clearance" })).toBeDisabled();
  await capture(page, screenshotPaths.padConflict);
  expectHealthy(health);
});

test("illegal cargo presents a textual blocked reason and no transfer command", async ({ page }) => {
  const health = collectBrowserHealth(page);
  await openPrototype(page);
  await selectScenario(page, "illegal-cargo");

  await expect(page.getByRole("heading", { name: "Cargo and Storage" })).toBeVisible();
  await expect(page.getByTestId("cargo-blocked-reason")).toContainText("Mock permit AF-07-DK");
  await expect(page.getByTestId("illegal-cargo-row")).toContainText("Illegal under mock permit");
  await expect(page.getByRole("button", { name: "Transfer blocked" })).toBeDisabled();
  await expect(page.locator("[data-requires-hold='true']")).toHaveCount(2);
  await capture(page, screenshotPaths.cargoBlocked);
  expectHealthy(health);
});

test("refuel supports local start cancel complete and unavailable states", async ({ page }) => {
  const health = collectBrowserHealth(page);
  await openPrototype(page);
  await page.getByRole("button", { name: "Refuel & Consumables" }).click();

  await page.getByRole("button", { name: "Start local simulation" }).click();
  await expect(page.getByTestId("refuel-state")).toContainText("Running");
  await page.getByRole("button", { name: "Complete simulation" }).click();
  await expect(page.getByTestId("refuel-state")).toContainText("Complete");

  await selectScenario(page, "refuel-unavailable");
  await expect(page.getByTestId("refuel-unavailable-reason")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start local simulation" })).toBeDisabled();
  expectHealthy(health);
});

test("repair queue exposes materials duration blockers and queue position", async ({ page }) => {
  const health = collectBrowserHealth(page);
  await openPrototype(page);
  await selectScenario(page, "repair-queue");

  await expect(page.getByTestId("repair-queue-warning")).toContainText("position 3");
  await expect(page.getByText("Hull inspection", { exact: true })).toBeVisible();
  await expect(page.getByText("External sensor", { exact: true })).toBeVisible();
  await expect(page.getByText("Thermal system", { exact: true })).toBeVisible();
  await expect(page.getByText("Drone repair", { exact: true })).toBeVisible();
  expectHealthy(health);
});

test("mission board shows five mock offers and accepted local state", async ({ page }) => {
  const health = collectBrowserHealth(page);
  await openPrototype(page);
  await selectScenario(page, "mission-accepted");

  for (const name of ["Geological Survey", "Relay Repair", "Cargo Courier", "Hazard Sample", "Salvage Recovery"]) {
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
  await expect(page.locator("[data-mission='geological']")).toContainText("Accepted");
  await expect(page.locator("[data-mission='geological']").getByRole("button", { name: "Accept locally" })).toBeDisabled();
  await capture(page, screenshotPaths.missionBoard);
  expectHealthy(health);
});

test("drone link lost exposes warning actions and focus-return telemetry dialog", async ({ page }) => {
  const health = collectBrowserHealth(page);
  await openPrototype(page);
  await selectScenario(page, "drone-link-lost");

  await expect(page.getByTestId("drone-link-lost-warning")).toBeVisible();
  const scout = page.locator("[data-drone='scout']");
  await expect(scout).toContainText("Link Lost");
  await expect(page.locator("[data-drone='mining']")).toContainText("Needs Attention");
  const telemetryButton = scout.getByRole("button", { name: "Open telemetry" });
  await telemetryButton.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("No scheduler or drone authority");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(telemetryButton).toBeFocused();
  await capture(page, screenshotPaths.droneLinkLost);
  expectHealthy(health);
});

test("outpost lockdown visibly blocks service availability", async ({ page }) => {
  const health = collectBrowserHealth(page);
  await openPrototype(page);
  await selectScenario(page, "lockdown");

  await expect(page.getByRole("heading", { name: "Legal and Access" })).toBeVisible();
  await expect(page.getByTestId("lockdown-warning")).toContainText("impound hold");
  await expect(page.getByText("HIGH / mock hold active", { exact: true })).toBeVisible();
  await expect(page.getByTestId("context-column").getByText("Mock security lockdown blocks departure, cargo, refuel, repair, market, and drone launch services.")).toBeVisible();
  expectHealthy(health);
});

test("1280x720 layout keeps section tabs primary action status and authority visible", async ({ page }) => {
  const health = collectBrowserHealth(page);
  await openPrototype(page, { width: 1280, height: 720 });
  await selectScenario(page, "responsive");

  await expect(page.getByTestId("section-tabs")).toBeVisible();
  await expect(page.getByTestId("section-tabs").getByRole("button", { name: "Pad Control" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm approach clearance" })).toBeVisible();
  await expect(page.getByTestId("context-column")).toBeVisible();
  await expect(page.getByTestId("authority-banner")).toBeVisible();
  await expectNoViewportOverflow(page);
  await capture(page, screenshotPaths.responsive);
  expectHealthy(health);
});

test("keyboard focus is visible shortcuts avoid inputs and IDs stay unique", async ({ page }) => {
  const health = collectBrowserHealth(page);
  await openPrototype(page);

  await page.getByRole("button", { name: "Release Pad A" }).focus();
  await expect(page.getByRole("button", { name: "Release Pad A" })).toBeFocused();
  const focusOutline = await page.getByRole("button", { name: "Release Pad A" }).evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(focusOutline).not.toBe("none");
  await capture(page, screenshotPaths.keyboardFocus);

  await page.getByRole("button", { name: "Cargo & Storage" }).first().click();
  const quantity = page.locator("#transfer-quantity");
  await quantity.focus();
  await page.keyboard.press("7");
  await expect(page.getByRole("heading", { name: "Cargo and Storage" })).toBeVisible();

  const audit = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    const nativeControls = [...document.querySelectorAll("button,input,select")].length;
    return { duplicateIds: [...new Set(duplicateIds)], nativeControls };
  });
  expect(audit.duplicateIds, "duplicate DOM IDs").toEqual([]);
  expect(audit.nativeControls).toBeGreaterThan(12);
  expectHealthy(health);
});

test.afterAll(async () => {
  const allScreenshots = Object.values(screenshotPaths);
  expect([...capturedScreenshots].sort()).toEqual([...allScreenshots].sort());

  const totals = healthSamples.reduce((result, health) => ({
    consoleErrors: result.consoleErrors + health.consoleErrors.length,
    pageErrors: result.pageErrors + health.pageErrors.length,
    failedRequests: result.failedRequests + health.failedRequests.length,
    httpErrors: result.httpErrors + health.httpErrors.length,
    missingAssets: result.missingAssets + health.missingAssets.length
  }), { consoleErrors: 0, pageErrors: 0, failedRequests: 0, httpErrors: 0, missingAssets: 0 });

  expect(totals).toEqual({ consoleErrors: 0, pageErrors: 0, failedRequests: 0, httpErrors: 0, missingAssets: 0 });

  const screenshotEvidence = await Promise.all(allScreenshots.map(async (filePath) => ({
    file: path.relative(browserApplicationRoot, filePath).replaceAll("\\", "/"),
    bytes: (await stat(filePath)).size
  })));
  const report = {
    prototype: "browser-outpost-operations-console-ui-prototype-v1",
    route,
    authorityNotice,
    focusedTestCount: 10,
    requiredScenarioCount: 9,
    requiredScreenshotCount: allScreenshots.length,
    browserHealth: totals,
    screenshots: screenshotEvidence,
    mockBoundaries: [
      "No gameplay or outpost authority",
      "No Resource/Cargo authority",
      "No economy or mission authority",
      "No drone scheduler or legal authority",
      "All commands are in-memory prototype intents"
    ]
  };

  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(healthPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Outpost Operations Console UI V1 Verification

- Route: \`${route}\`
- Authority banner: \`${authorityNotice}\`
- Focused Playwright: 10 tests
- Required scenarios: 9/9
- Required screenshots: ${allScreenshots.length}/${allScreenshots.length}
- Browser Health: console errors ${totals.consoleErrors}; page errors ${totals.pageErrors}; failed requests ${totals.failedRequests}; HTTP errors ${totals.httpErrors}; missing assets ${totals.missingAssets}

## Screenshots

${screenshotEvidence.map((artifact) => `- \`${artifact.file}\` (${artifact.bytes} bytes)`).join("\n")}

## Mock boundaries

${report.mockBoundaries.map((boundary) => `- ${boundary}`).join("\n")}
`, "utf8");
});
