import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, totalmem } from "node:os";
import { join } from "node:path";

test.use({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const evidenceRoot = "evidence/hestia-voxel-v2-coast-lush-visual-parity/iteration-08-production-telemetry";
const parityEvidenceRoot = "evidence/hestia-voxel-v2-coast-lush-visual-parity/iteration-23-candidate";

const pngEvidence = (path: string): { readonly path: string; readonly sha256: string; readonly width: number; readonly height: number } => {
  const bytes = readFileSync(path);
  if (bytes.readUInt32BE(0) !== 0x89504e47 || bytes.toString("ascii", 1, 4) !== "PNG") throw new Error(`Not a PNG: ${path}`);
  return {
    path,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20)
  };
};

const workingTreeContentSha256 = (): string => {
  const repositoryRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const gitOptions = { cwd: repositoryRoot, encoding: "utf8" as const };
  const hash = createHash("sha256");
  hash.update(execFileSync(
    "git",
    ["diff", "--binary", "HEAD", "--", ".", ":(exclude)apps/weltraum-browser/evidence/**"],
    gitOptions
  ));
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], gitOptions)
    .split(/\r?\n/)
    .filter((path) => path.length > 0 && !path.startsWith("apps/weltraum-browser/evidence/"))
    .sort();
  for (const path of untracked) {
    hash.update(`\0${path}\0`);
    hash.update(readFileSync(join(repositoryRoot, path)));
  }
  return hash.digest("hex");
};

const runRealInputCutGrid = async (page: Page): Promise<void> => {
  for (let index = 0; index < 100; index += 1) {
    const row = Math.floor(index / 10);
    const direction = row % 2 === 0 ? "KeyA" : "KeyD";
    await page.keyboard.down(direction);
    await page.waitForTimeout(65);
    await page.keyboard.up(direction);
    await page.mouse.click(960, 540);
    if (index % 10 === 9) {
      await page.keyboard.down("KeyW");
      await page.waitForTimeout(85);
      await page.keyboard.up("KeyW");
    }
  }
};

const waitForReady = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => document.body.dataset.voxelV2State === "Ready", undefined, { timeout: 120_000 });
  await expect(page.locator("[data-testid=voxel-v2-state]")).toHaveText("READY");
  await expect(page.locator("#flight-hud")).toBeHidden();
  await expect(page.locator("#debug-hud")).toBeHidden();
  if (await page.evaluate(() => document.body.dataset.voxelV2View !== "player")) {
    await expect(page.locator("#voxel-v2-ui")).toBeHidden();
  }
  expect(await page.evaluate(() => "TestBridge" in window)).toBe(false);
};

test("runs the V2 ready, movement, edit, liveness and screenshot protocol", async ({ page }) => {
  test.skip(process.env.WELTRAUM_V2_PRODUCTION === "1", "The production run uses the telemetry-only protocol below.");
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(`console: ${message.text()}`); });

  await page.goto("/?voxelV2=1&voxelV2View=coast", { waitUntil: "domcontentloaded" });
  await waitForReady(page);
  await page.screenshot({ path: `${evidenceRoot}/01-coast-lagoon-vista.png` });

  await page.goto("/?voxelV2=1&voxelV2View=river", { waitUntil: "domcontentloaded" });
  await waitForReady(page);
  await page.screenshot({ path: `${evidenceRoot}/02-inland-river-valley-vista.png` });

  await page.goto("/?voxelV2=1&voxelV2View=player", { waitUntil: "domcontentloaded" });
  await waitForReady(page);
  const initialPosition = await page.evaluate(() => document.body.dataset.voxelV2PlayerPosition);
  await page.screenshot({ path: `${evidenceRoot}/03-first-person-spawn-interaction.png` });
  const canvas = page.locator("#debug-scene");
  await canvas.click();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(450);
  await page.keyboard.up("KeyW");
  const movedPosition = await page.evaluate(() => document.body.dataset.voxelV2PlayerPosition);
  expect(movedPosition).not.toBe(initialPosition);

  await page.screenshot({ path: `${evidenceRoot}/04-before-terrain-cut.png` });
  await page.mouse.click(960, 540);
  await expect(page.locator("[data-testid=voxel-v2-hit]")).toContainText(/Hit|Accepted|NoChange/);
  await page.waitForFunction(() => document.body.dataset.voxelV2State === "Ready"
    && Number(document.body.dataset.voxelV2WorldRevision ?? "0") >= 1
    && Number(document.body.dataset.voxelV2VisibleMeshRevision ?? "0") >= 1
    && Number(document.body.dataset.voxelV2PendingMeshes ?? "0") === 0, undefined, { timeout: 30_000 });
  await expect(page.locator("[data-testid=voxel-v2-edit]")).toContainText("cells");
  await page.screenshot({ path: `${evidenceRoot}/05-after-terrain-cut.png` });

  const startRevision = Number(await page.evaluate(() => document.body.dataset.voxelV2WorldRevision ?? "0"));
  const stressBefore = await page.evaluate(() => ({
    accepted: Number(document.body.dataset.voxelV2AcceptedEdits ?? "0"),
    hitCount: Number(document.body.dataset.voxelV2HitCount ?? "0")
  }));
  await runRealInputCutGrid(page);
  await page.waitForTimeout(1_500);
  const liveness = await page.evaluate(() => ({
    state: document.body.dataset.voxelV2State,
    revision: Number(document.body.dataset.voxelV2WorldRevision ?? "0"),
    pending: Number(document.body.dataset.voxelV2PendingMeshes ?? "0"),
    visible: Number(document.body.dataset.voxelV2VisibleMeshRevision ?? "0"),
    lastEdit: document.body.dataset.voxelV2LastEdit,
    accepted: Number(document.body.dataset.voxelV2AcceptedEdits ?? "0"),
    hitCount: Number(document.body.dataset.voxelV2HitCount ?? "0")
  }));
  expect(liveness.state).toBe("Ready");
  expect(liveness.revision).toBeGreaterThanOrEqual(startRevision);
  expect(liveness.pending).toBeLessThanOrEqual(256);
  expect(liveness.pending).toBe(0);
  expect(liveness.visible).toBe(liveness.revision);
  expect(liveness.visible).toBeGreaterThanOrEqual(startRevision);
  expect(liveness.hitCount - stressBefore.hitCount).toBe(100);
  expect(liveness.accepted - stressBefore.accepted).toBeGreaterThan(0);
  expect(liveness.lastEdit).toBeTruthy();
  expect(browserErrors).toEqual([]);
});

test("preserves the normal and Surface Lab route seams", async ({ page }) => {
  test.skip(process.env.WELTRAUM_V2_PRODUCTION === "1", "Route seam smoke belongs to the dev verification pass.");
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(`console: ${message.text()}`); });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#flight-hud")).toBeVisible();
  expect(await page.evaluate(() => document.body.dataset.voxelV2)).toBeUndefined();
  await page.goto("/?surfaceLab=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.dataset.surfaceLab === "1", undefined, { timeout: 30_000 });
  expect(await page.evaluate(() => document.body.dataset.runtimeMode)).toBeUndefined();
  expect(await page.evaluate(() => document.body.dataset.voxelV2)).toBeUndefined();
  expect(browserErrors).toEqual([]);
});

test("records warm production telemetry and 100-cut stress evidence", async ({ page }) => {
  test.skip(process.env.WELTRAUM_V2_PRODUCTION !== "1", "Run with WELTRAUM_V2_PRODUCTION=1 against vite preview.");
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(`console: ${message.text()}`); });
  await page.goto("/?voxelV2=1&voxelV2Diagnostics=1&voxelV2View=player", { waitUntil: "domcontentloaded" });
  await waitForReady(page);
  await page.goto("/?voxelV2=1&voxelV2View=coast", { waitUntil: "domcontentloaded" });
  await waitForReady(page);
  await page.screenshot({ path: `${evidenceRoot}/01-coast-lagoon-vista.png` });
  await page.goto("/?voxelV2=1&voxelV2View=river", { waitUntil: "domcontentloaded" });
  await waitForReady(page);
  await page.screenshot({ path: `${evidenceRoot}/02-inland-river-valley-vista.png` });
  await page.goto("/?voxelV2=1&voxelV2Diagnostics=1&voxelV2View=player", { waitUntil: "domcontentloaded" });
  await waitForReady(page);
  await page.screenshot({ path: `${evidenceRoot}/03-first-person-spawn-interaction.png` });
  await page.waitForTimeout(3_000);
  const readDiagnostics = async (): Promise<Record<string, unknown>> => {
    const text = await page.locator("[data-testid=voxel-v2-diagnostics]").textContent();
    return JSON.parse(text ?? "{}") as Record<string, unknown>;
  };
  const warmup = await readDiagnostics();
  const samples: Record<string, unknown>[] = [];
  for (let index = 0; index < 40; index += 1) {
    await page.waitForTimeout(100);
    samples.push(await readDiagnostics());
  }
  await page.screenshot({ path: `${evidenceRoot}/04-before-terrain-cut.png` });
  await page.locator("#debug-scene").click();
  await page.mouse.click(960, 540);
  await page.waitForFunction(() => Number(document.body.dataset.voxelV2WorldRevision ?? "0") >= 1
    && Number(document.body.dataset.voxelV2VisibleMeshRevision ?? "0") >= 1, undefined, { timeout: 30_000 });
  await page.screenshot({ path: `${evidenceRoot}/05-after-terrain-cut.png` });
  const stressBefore = await readDiagnostics();
  await runRealInputCutGrid(page);
  await page.waitForTimeout(2_000);
  const afterCuts = await readDiagnostics();
  const longTasks = await page.evaluate(() => performance.getEntriesByType("longtask").map((entry) => ({
    name: entry.name,
    startTime: entry.startTime,
    duration: entry.duration
  })));
  const gitHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const gitStatus = execFileSync("git", ["status", "--short"], { encoding: "utf8" });
  const evidence = {
    repository: {
       baseSha: "b9ba0e14d897ca2392013c456bd1b88b58934381",
       headSha: gitHead,
       branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
       dirtyStatusSha256: createHash("sha256").update(gitStatus).digest("hex"),
       workingTreeContentSha256: workingTreeContentSha256()
    },
    machine: { platform: process.platform, node: process.version, logicalCores: cpus().length, memoryBytes: totalmem() },
    browser: { ...(await page.evaluate(() => ({ userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight } }))), version: page.context().browser()?.version() ?? "unknown" },
    dependencies: { three: "0.185.1", vite: "8.1.5", playwright: "1.61.1" },
    build: "vite preview production dist",
    route: "/?voxelV2=1&voxelV2Diagnostics=1&voxelV2View=player",
    warmup,
    samples,
    afterCuts,
    longTasks,
    screenshots: [
      pngEvidence(`${evidenceRoot}/01-coast-lagoon-vista.png`),
      pngEvidence(`${evidenceRoot}/02-inland-river-valley-vista.png`),
      pngEvidence(`${evidenceRoot}/03-first-person-spawn-interaction.png`),
      pngEvidence(`${evidenceRoot}/04-before-terrain-cut.png`),
      pngEvidence(`${evidenceRoot}/05-after-terrain-cut.png`)
    ],
    browserErrors,
    thresholds: {
      frameP95Ms: { actual: (afterCuts.frameTimeMs as { p95?: number }).p95 ?? null, target: 18, pass: ((afterCuts.frameTimeMs as { p95?: number }).p95 ?? Infinity) <= 18 },
      frameP99Ms: { actual: (afterCuts.frameTimeMs as { p99?: number }).p99 ?? null, target: 25, pass: ((afterCuts.frameTimeMs as { p99?: number }).p99 ?? Infinity) <= 25 },
      inputToHitP95Ms: { actual: (afterCuts.inputToHitMs as { p95?: number }).p95 ?? null, target: 16.7, pass: ((afterCuts.inputToHitMs as { p95?: number }).p95 ?? Infinity) <= 16.7 },
      inputToAuthorityP95Ms: { actual: (afterCuts.inputToAuthorityMs as { p95?: number }).p95 ?? null, target: 16, pass: ((afterCuts.inputToAuthorityMs as { p95?: number }).p95 ?? Infinity) <= 16 },
      inputToVisibleMeshP95Ms: { actual: (afterCuts.inputToVisibleMeshMs as { p95?: number }).p95 ?? null, target: 100, pass: ((afterCuts.inputToVisibleMeshMs as { p95?: number }).p95 ?? Infinity) <= 100 },
      warmLocalCutLongTasks: { actual: Math.max(0, (afterCuts.longTaskCount as number) - (warmup.longTaskCount as number)), target: 0, pass: (afterCuts.longTaskCount as number) === (warmup.longTaskCount as number) },
      stressInputs: {
        actual: (afterCuts.inputToHitMs as { count?: number }).count! - (stressBefore.inputToHitMs as { count?: number }).count!,
        target: 100,
        pass: (afterCuts.inputToHitMs as { count?: number }).count! - (stressBefore.inputToHitMs as { count?: number }).count! === 100
      },
      stressAccepted: {
        actual: (afterCuts.acceptedEdits as number) - (stressBefore.acceptedEdits as number),
        target: ">0",
        pass: (afterCuts.acceptedEdits as number) - (stressBefore.acceptedEdits as number) > 0
      },
      readyAfterCuts: { actual: afterCuts.state, target: "Ready", pass: afterCuts.state === "Ready" },
      boundedPendingQueue: { actual: (afterCuts.pendingMeshJobs as number | undefined) ?? null, target: 256, pass: ((afterCuts.pendingMeshJobs as number | undefined) ?? Infinity) <= 256 },
      noBrowserErrors: { actual: browserErrors.length, target: 0, pass: browserErrors.length === 0 }
    }
  };
  writeFileSync(`${evidenceRoot}/production-telemetry.json`, JSON.stringify(evidence, null, 2), "utf8");
  expect(browserErrors).toEqual([]);
  expect(afterCuts.state).toBe("Ready");
  expect((afterCuts.frameTimeMs as { p95?: number }).p95 ?? Infinity).toBeLessThanOrEqual(18);
  expect((afterCuts.frameTimeMs as { p99?: number }).p99 ?? Infinity).toBeLessThanOrEqual(25);
  expect((afterCuts.longTaskCount as number) - (warmup.longTaskCount as number)).toBe(0);
  expect((afterCuts.pendingMeshJobs as number | undefined) ?? Infinity).toBe(0);
  expect(afterCuts.visibleMeshWorldRevision).toBe(afterCuts.worldRevision);
  expect((afterCuts.inputToHitMs as { count?: number }).count! - (stressBefore.inputToHitMs as { count?: number }).count!).toBe(100);
  expect((afterCuts.acceptedEdits as number) - (stressBefore.acceptedEdits as number)).toBeGreaterThan(0);
});

test("captures the four canonical V2 parity views and a first-person cut", async ({ page }) => {
  mkdirSync(parityEvidenceRoot, { recursive: true });
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(`console: ${message.text()}`); });

  const beautyViews = [
    ["coast", "01-coastal-valley.png"],
    ["archipelago", "02-archipelago-mountain.png"],
    ["river", "03-wetland-roots.png"]
  ] as const;
  for (const [view, filename] of beautyViews) {
    await page.goto(`/?voxelV2=1&voxelV2View=${view}`, { waitUntil: "domcontentloaded" });
    await waitForReady(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${parityEvidenceRoot}/${filename}` });
  }

  await page.goto("/?voxelV2=1&voxelV2View=player", { waitUntil: "domcontentloaded" });
  await waitForReady(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${parityEvidenceRoot}/04-first-person-spawn-before-cut.png` });
  const canvas = page.locator("#debug-scene");
  await canvas.click();
  await page.mouse.click(960, 540);
  await expect(page.locator("[data-testid=voxel-v2-hit]")).toContainText(/Hit|Accepted|NoChange/);
  await page.waitForFunction(() => Number(document.body.dataset.voxelV2WorldRevision ?? "0") >= 1
    && Number(document.body.dataset.voxelV2VisibleMeshRevision ?? "0") >= 1
    && Number(document.body.dataset.voxelV2PendingMeshes ?? "0") === 0, undefined, { timeout: 30_000 });
  await page.screenshot({ path: `${parityEvidenceRoot}/05-first-person-spawn-after-cut.png` });

  const screenshots = [
    "01-coastal-valley.png",
    "02-archipelago-mountain.png",
    "03-wetland-roots.png",
    "04-first-person-spawn-before-cut.png",
    "05-first-person-spawn-after-cut.png"
  ].map((filename) => pngEvidence(`${parityEvidenceRoot}/${filename}`));
  const gitStatus = execFileSync("git", ["status", "--short"], { encoding: "utf8" });
  const manifest = {
    repository: {
      headSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
      dirtyStatusSha256: createHash("sha256").update(gitStatus).digest("hex"),
      workingTreeContentSha256: workingTreeContentSha256()
    },
    browser: await page.evaluate(() => ({ userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight } })),
    screenshots,
    browserErrors
  };
  writeFileSync(`${parityEvidenceRoot}/manifest.json`, JSON.stringify(manifest, null, 2), "utf8");
  expect(browserErrors).toEqual([]);
});
