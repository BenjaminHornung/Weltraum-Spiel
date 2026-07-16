import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ciTimeout } from "./support/ciTiming";

const evidenceDirectory = path.resolve(process.cwd(), "evidence");
const repositoryRoot = path.resolve(process.cwd(), "../..");
const mirroredEvidenceDirectory = path.resolve(
  repositoryRoot,
  ".devtoolbox/specs/changes/browser-hestia-microvoxel-surface-lab-v1/tests/task-5.1-live"
);
const summaryPath = path.join(evidenceDirectory, "browser-hestia-microvoxel-surface-lab-v1-summary.json");
const markdownPath = path.join(evidenceDirectory, "browser-hestia-microvoxel-surface-lab-v1.md");
const focusedCommand = "npx playwright test tests/e2e/hestia-microvoxel-surface-lab.spec.ts --reporter=list";
const readinessTimeoutMilliseconds = 120_000;
const changedSeed = "hestia-surface-lab-v1-e2e-alt";

const screenshotPaths = {
  default: path.join(evidenceDirectory, "hestia-surface-lab-default-1920x1080.png"),
  wireframe: path.join(evidenceDirectory, "hestia-surface-lab-wireframe-1920x1080.png"),
  quarterMeter: path.join(evidenceDirectory, "hestia-surface-lab-quarter-meter-1920x1080.png")
} as const;

interface BrowserEvents {
  readonly consoleErrors: string[];
  readonly consoleWarnings: string[];
  readonly pageErrors: string[];
  readonly requestFailures: string[];
  readonly httpErrors: string[];
}

interface SurfaceLabTelemetry {
  readonly lifecycle: string;
  readonly seed: string;
  readonly preset: string;
  readonly voxelSizeMeters: number;
  readonly extent: string;
  readonly requested: number;
  readonly ready: number;
  readonly failed: number;
  readonly cancelled: number;
  readonly staleRejects: number;
  readonly queue: number;
  readonly running: number;
  readonly workerRestarts: number;
  readonly planningEpoch: number;
  readonly workerEpoch: number;
  readonly vertices: number;
  readonly triangles: number;
  readonly meshBytes: number;
  readonly generationMilliseconds: number;
  readonly meshingMilliseconds: number;
  readonly uploadMilliseconds: number;
  readonly frameMilliseconds: number;
  readonly frameSampleCount: number;
  readonly cacheHits: number;
  readonly cacheMisses: number;
  readonly cacheBypasses: number;
  readonly brickHashes: readonly string[];
  readonly meshHashes: readonly string[];
  readonly cameraMode: string;
  readonly cameraPosition: string;
  readonly cameraTarget: string;
  readonly cameraQuaternion: string;
  readonly fogEnabled: boolean;
  readonly waterEnabled: boolean;
  readonly vegetationEnabled: boolean;
  readonly wireframeEnabled: boolean;
  readonly boundariesEnabled: boolean;
}

interface SettledObservation {
  readonly readinessMilliseconds: number;
  readonly telemetry: SurfaceLabTelemetry;
}

interface ScreenshotObservation {
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly role: "default" | "wireframe-and-boundaries" | "quarter-meter";
}

interface SurfaceLabEvidence {
  readonly schemaVersion: "browser-hestia-microvoxel-surface-lab-v1";
  readonly status: "PASS";
  readonly generatedAtUtc: string;
  readonly generator: "apps/weltraum-browser/tests/e2e/hestia-microvoxel-surface-lab.spec.ts";
  readonly route: "/?surfaceLab=1";
  readonly viewport: { readonly width: 1920; readonly height: 1080 };
  readonly normalVisibleDom: {
    readonly hudVisible: true;
    readonly backendCanvasCount: 1;
    readonly testBridgeOwnProperty: false;
    readonly testBridgeInWindow: false;
  };
  readonly runs: {
    readonly initialDefault: SettledObservation;
    readonly sameSeedCacheBypass: SettledObservation;
    readonly changedSeed: SettledObservation;
    readonly afterCameraAndPresentationControls: SurfaceLabTelemetry;
    readonly quarterMeter: SettledObservation;
  };
  readonly determinism: {
    readonly sameSeedBrickHashesIdentical: true;
    readonly sameSeedMeshHashesIdentical: true;
    readonly changedSeedBrickHashesDifferent: true;
    readonly changedSeedMeshHashesDifferent: true;
    readonly cameraAndPresentationPreservedBrickHashes: true;
    readonly cameraAndPresentationPreservedMeshHashes: true;
  };
  readonly interaction: {
    readonly flyKeyboardPositionBefore: string;
    readonly flyKeyboardPositionAfter: string;
    readonly orbitQuaternionBefore: string;
    readonly orbitQuaternionAfter: string;
    readonly wireframeEnabled: true;
    readonly boundariesEnabled: true;
  };
  readonly screenshots: readonly ScreenshotObservation[];
  readonly browserHealth: {
    readonly consoleErrors: readonly string[];
    readonly consoleWarnings: readonly string[];
    readonly knownRajdhaniOrOtsWarnings: readonly string[];
    readonly unexpectedWarnings: readonly string[];
    readonly pageErrors: readonly string[];
    readonly requestFailures: readonly string[];
    readonly httpErrors: readonly string[];
  };
  readonly visualFidelity: {
    readonly status: "DEFERRED_KNOWN_FAILING";
    readonly owner: "browser-hestia-surface-lab-visual-fidelity-v1";
    readonly claim: "Technical runtime evidence only; no concept, pixel-parity, or visual-acceptance claim.";
  };
  readonly verification: {
    readonly focusedCommand: string;
    readonly readinessTimeoutMilliseconds: 120000;
    readonly observedResult: "pass";
  };
}

test.use({
  viewport: { width: 1_920, height: 1_080 },
  screenshot: "off",
  trace: "retain-on-failure"
});

const installBrowserEventCollectors = (page: Page): BrowserEvents => {
  const events: BrowserEvents = {
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: []
  };
  page.on("console", (message) => {
    const location = message.location();
    const formatted = `${message.text()} @ ${location.url}:${location.lineNumber}:${location.columnNumber}`;
    if (message.type() === "error") events.consoleErrors.push(formatted);
    if (message.type() === "warning") events.consoleWarnings.push(formatted);
  });
  page.on("pageerror", (error) => events.pageErrors.push(error.message));
  page.on("requestfailed", (request) => events.requestFailures.push(
    `${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`
  ));
  page.on("response", (response) => {
    if (response.status() >= 400) {
      events.httpErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  return events;
};

test("Surface Lab entrypoint contains a failed dynamic module request without activating flight", async ({ page }) => {
  const pageErrors: string[] = [];
  const abortedSurfaceLabRequests: string[] = [];
  let stateAtModuleRequest: readonly [string | null, string | null] | undefined;
  page.on("pageerror", (error) => pageErrors.push(error.message));

  // Vite resolves the directory import in main.ts to this source-module URL; the regex permits only its cache query.
  await page.route(/\/src\/surface-lab\/index\.ts(?:\?.*)?$/, async (route) => {
    abortedSurfaceLabRequests.push(route.request().url());
    stateAtModuleRequest = await page.evaluate(() => [
      document.body.dataset.surfaceLab ?? null,
      document.body.dataset.surfaceLabState ?? null
    ] as const);
    await route.abort("failed");
  });

  await page.goto("/?surfaceLab=1", { waitUntil: "domcontentloaded" });

  const body = page.locator("body");
  await expect(body).toHaveAttribute("data-surface-lab", "1");
  await expect(body).toHaveAttribute("data-surface-lab-state", "Failed");
  expect(abortedSurfaceLabRequests).toHaveLength(1);
  expect(stateAtModuleRequest).toEqual(["1", null]);

  const failure = page.locator("#surface-lab-failure");
  await expect(failure).toBeVisible();
  await expect(failure).toHaveAttribute("role", "alert");
  await expect(failure).toHaveAttribute("aria-live", "assertive");
  await expect(failure.getByRole("heading", { name: "SURFACE LAB UNAVAILABLE", exact: true })).toBeVisible();
  await expect(failure).toContainText("NOT GAMEPLAY · no terrain readiness is being claimed");

  await expect(page.locator("#flight-hud")).toBeHidden();
  expect(await body.getAttribute("data-ui-surface")).toBeNull();
  expect(await body.getAttribute("data-graphics-settings-ready")).toBeNull();
  expect(await readTestBridgeState(page)).toEqual({ ownProperty: false, inWindow: false });
  expect(pageErrors).toEqual([]);
});

const readTestBridgeState = (page: Page): Promise<{ readonly ownProperty: boolean; readonly inWindow: boolean }> =>
  page.evaluate(() => ({
    ownProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
    inWindow: "TestBridge" in window
  }));

const readTelemetry = (page: Page): Promise<SurfaceLabTelemetry> => page.evaluate(() => {
  const data = document.body.dataset;
  const number = (value: string | undefined): number => Number(value ?? Number.NaN);
  const hashes = (value: string | undefined): readonly string[] => value === undefined || value === ""
    ? []
    : value.split(",");
  return {
    lifecycle: data.surfaceLabState ?? "",
    seed: data.surfaceLabSeed ?? "",
    preset: data.surfaceLabPreset ?? "",
    voxelSizeMeters: number(data.surfaceLabVoxelSize),
    extent: data.surfaceLabExtent ?? "",
    requested: number(data.surfaceLabRequested),
    ready: number(data.surfaceLabReady),
    failed: number(data.surfaceLabFailed),
    cancelled: number(data.surfaceLabCancelled),
    staleRejects: number(data.surfaceLabStaleRejects),
    queue: number(data.surfaceLabQueue),
    running: number(data.surfaceLabRunning),
    workerRestarts: number(data.surfaceLabWorkerRestarts),
    planningEpoch: number(data.surfaceLabPlanningEpoch),
    workerEpoch: number(data.surfaceLabWorkerEpoch),
    vertices: number(data.surfaceLabVertices),
    triangles: number(data.surfaceLabTriangles),
    meshBytes: number(data.surfaceLabMeshBytes),
    generationMilliseconds: number(data.surfaceLabGenerationMilliseconds),
    meshingMilliseconds: number(data.surfaceLabMeshingMilliseconds),
    uploadMilliseconds: number(data.surfaceLabUploadMilliseconds),
    frameMilliseconds: number(data.surfaceLabFrameMilliseconds),
    frameSampleCount: number(data.surfaceLabFrameSampleCount),
    cacheHits: number(data.surfaceLabCacheHits),
    cacheMisses: number(data.surfaceLabCacheMisses),
    cacheBypasses: number(data.surfaceLabCacheBypasses),
    brickHashes: hashes(data.surfaceLabBrickHashes),
    meshHashes: hashes(data.surfaceLabHashes),
    cameraMode: data.surfaceLabCameraMode ?? "",
    cameraPosition: data.surfaceLabCameraPosition ?? "",
    cameraTarget: data.surfaceLabCameraTarget ?? "",
    cameraQuaternion: data.surfaceLabCameraQuaternion ?? "",
    fogEnabled: data.surfaceLabFog === "true",
    waterEnabled: data.surfaceLabWater === "true",
    vegetationEnabled: data.surfaceLabVegetation === "true",
    wireframeEnabled: data.surfaceLabWireframe === "true",
    boundariesEnabled: data.surfaceLabBoundaries === "true"
  };
});

const assertHashSet = (hashes: readonly string[], label: string): void => {
  expect(hashes, `${label} must contain one hash per ready chunk`).toHaveLength(16);
  expect(new Set(hashes).size, `${label} hashes must be unique by spatial brick`).toBe(16);
  expect(hashes.every((hash) => /^[a-z0-9_.-]+:[a-f0-9]+$/i.test(hash)), `${label} hash format`).toBe(true);
  expect([...hashes].sort(), `${label} must use canonical ordering`).toEqual(hashes);
};

const assertSettledTelemetry = (telemetry: SurfaceLabTelemetry): void => {
  expect(telemetry).toMatchObject({
    lifecycle: "Ready",
    requested: 16,
    ready: 16,
    failed: 0,
    queue: 0,
    running: 0,
    frameSampleCount: 300
  });
  expect(telemetry.preset).toBe("hestia.nebelwald-archipelago.preview.v1");
  expect(telemetry.vertices).toBeGreaterThan(0);
  expect(telemetry.triangles).toBeGreaterThan(0);
  expect(telemetry.meshBytes).toBeGreaterThan(0);
  for (const [label, value] of Object.entries({
    generationMilliseconds: telemetry.generationMilliseconds,
    meshingMilliseconds: telemetry.meshingMilliseconds,
    uploadMilliseconds: telemetry.uploadMilliseconds,
    frameMilliseconds: telemetry.frameMilliseconds
  })) {
    expect(Number.isFinite(value), `${label} must be a measured finite value`).toBe(true);
    expect(value, `${label} must not be negative`).toBeGreaterThanOrEqual(0);
  }
  assertHashSet(telemetry.brickHashes, "brick");
  assertHashSet(telemetry.meshHashes, "mesh");
};

const waitForSettled = async (page: Page, previousPlanningEpoch?: number): Promise<SettledObservation> => {
  const started = Date.now();
  await page.waitForFunction((previousEpoch) => {
    const data = document.body.dataset;
    const planningEpoch = Number(data.surfaceLabPlanningEpoch);
    return data.surfaceLabState === "Ready"
      && data.surfaceLabRequested === "16"
      && data.surfaceLabReady === "16"
      && data.surfaceLabFailed === "0"
      && data.surfaceLabQueue === "0"
      && data.surfaceLabRunning === "0"
      && (previousEpoch === null || planningEpoch > previousEpoch);
  }, previousPlanningEpoch ?? null, { timeout: readinessTimeoutMilliseconds });
  await expect.poll(
    () => page.evaluate(() => Number(document.body.dataset.surfaceLabFrameSampleCount ?? Number.NaN)),
    { timeout: readinessTimeoutMilliseconds, message: "Surface Lab must publish its bounded 300-settled-frame sample" }
  ).toBe(300);
  const observation = {
    readinessMilliseconds: Date.now() - started,
    telemetry: await readTelemetry(page)
  };
  assertSettledTelemetry(observation.telemetry);
  return observation;
};

const pngDimensions = async (filePath: string): Promise<{ readonly width: number; readonly height: number }> => {
  const bytes = await readFile(filePath);
  expect(bytes.subarray(0, 8).toString("hex"), `${filePath} must be a PNG`).toBe("89504e470d0a1a0a");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

const captureScreenshot = async (
  page: Page,
  filePath: string,
  role: ScreenshotObservation["role"]
): Promise<ScreenshotObservation> => {
  await page.screenshot({ path: filePath, fullPage: false });
  const dimensions = await pngDimensions(filePath);
  expect(dimensions).toEqual({ width: 1_920, height: 1_080 });
  return {
    path: path.relative(repositoryRoot, filePath).replaceAll("\\", "/"),
    ...dimensions,
    role
  };
};

const createMarkdown = (evidence: SurfaceLabEvidence): string => {
  const telemetryRows = Object.entries(evidence.runs)
    .map(([name, value]) => {
      const telemetry = "telemetry" in value ? value.telemetry : value;
      const readiness = "readinessMilliseconds" in value ? `${value.readinessMilliseconds}` : "n/a";
      return `| ${name} | ${telemetry.seed} | ${telemetry.voxelSizeMeters} | ${telemetry.extent} | ${telemetry.ready}/${telemetry.requested}/${telemetry.failed} | ${telemetry.queue}/${telemetry.running} | ${telemetry.vertices} | ${telemetry.triangles} | ${telemetry.meshBytes} | ${telemetry.generationMilliseconds} | ${telemetry.meshingMilliseconds} | ${telemetry.uploadMilliseconds} | ${telemetry.frameMilliseconds} (${telemetry.frameSampleCount}) | ${telemetry.cacheHits}/${telemetry.cacheMisses}/${telemetry.cacheBypasses} | ${telemetry.staleRejects}/${telemetry.workerRestarts} | ${readiness} |`;
    })
    .join("\n");
  const hashSection = (label: string, telemetry: SurfaceLabTelemetry): string => [
    `### ${label}`,
    "",
    `- Brick hashes (ordered): \`${telemetry.brickHashes.join("`, `")}\``,
    `- Mesh hashes (ordered): \`${telemetry.meshHashes.join("`, `")}\``
  ].join("\n");

  return `# Browser Hestia Microvoxel Surface Lab V1 — Live Evidence

- Status: **PASS**
- Generated: ${evidence.generatedAtUtc}
- Route: \`${evidence.route}\`
- Generator: \`${evidence.generator}\`
- TestBridge absent: \`${!evidence.normalVisibleDom.testBridgeOwnProperty && !evidence.normalVisibleDom.testBridgeInWindow}\`
- Backend canvas count: \`${evidence.normalVisibleDom.backendCanvasCount}\`
- Readiness bound: \`${evidence.verification.readinessTimeoutMilliseconds} ms\` per generation

## Measured runtime facts

| Run | Seed | Voxel m | Extent | Ready/requested/failed | Queue/running | Vertices | Triangles | Mesh bytes | Generation ms | Meshing ms | Upload ms | Frame ms (settled samples) | Cache hit/miss/bypass | Stale/restarts | Readiness ms |
| --- | --- | ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | ---: |
${telemetryRows}

${hashSection("Initial default", evidence.runs.initialDefault.telemetry)}

${hashSection("Explicit same-seed cache-bypass regeneration", evidence.runs.sameSeedCacheBypass.telemetry)}

${hashSection("Changed seed", evidence.runs.changedSeed.telemetry)}

${hashSection("Quarter-meter", evidence.runs.quarterMeter.telemetry)}

## Determinism and visible controls

- Explicit regenerate used the same seed and cache bypass, producing identical ordered brick and mesh hash sets.
- Visible seed editing plus Regenerate produced valid different ordered brick and mesh hash sets.
- Fly mode plus real keyboard W input changed camera position from \`${evidence.interaction.flyKeyboardPositionBefore}\` to \`${evidence.interaction.flyKeyboardPositionAfter}\`.
- Orbit pointer input changed camera quaternion from \`${evidence.interaction.orbitQuaternionBefore}\` to \`${evidence.interaction.orbitQuaternionAfter}\`.
- Wireframe and chunk-boundary controls were enabled through visible buttons and preserved canonical hashes.
- The visible 0.25 m selector settled at \`${evidence.runs.quarterMeter.telemetry.extent}\` (default \`${evidence.runs.initialDefault.telemetry.extent}\`).

## Browser health and technical screenshots

- Console errors: \`${evidence.browserHealth.consoleErrors.length}\`
- Page errors: \`${evidence.browserHealth.pageErrors.length}\`
- Failed requests: \`${evidence.browserHealth.requestFailures.length}\`
- HTTP >=400 responses: \`${evidence.browserHealth.httpErrors.length}\`
- Console warnings (recorded, not normalized away): \`${evidence.browserHealth.consoleWarnings.length}\`
- Known Rajdhani/OTS warnings: ${evidence.browserHealth.knownRajdhaniOrOtsWarnings.length === 0 ? "none observed" : evidence.browserHealth.knownRajdhaniOrOtsWarnings.map((warning) => `\`${warning}\``).join("; ")}
- Unexpected warnings: ${evidence.browserHealth.unexpectedWarnings.length === 0 ? "none" : evidence.browserHealth.unexpectedWarnings.map((warning) => `\`${warning}\``).join("; ")}
${evidence.screenshots.map((screenshot) => `- ${screenshot.role}: \`${screenshot.path}\` — ${screenshot.width}x${screenshot.height}`).join("\n")}

## Explicit visual-fidelity boundary

Visual fidelity is **deferred and known-failing**. These captures are technical runtime evidence only; they do not assert concept parity, pixel parity, acceptable final art direction, or visual acceptance. Follow-up owner: \`${evidence.visualFidelity.owner}\`.
`;
};

test("live Hestia Surface Lab proves deterministic voxel, worker, mesh and render truth without TestBridge", async ({ page }) => {
  test.setTimeout(ciTimeout(600_000, 600_000));
  const browserEvents = installBrowserEventCollectors(page);
  await mkdir(evidenceDirectory, { recursive: true });
  await mkdir(mirroredEvidenceDirectory, { recursive: true });
  await page.setViewportSize({ width: 1_920, height: 1_080 });

  await page.goto("/?surfaceLab=1", { waitUntil: "domcontentloaded" });
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe("/?surfaceLab=1");
  const hud = page.locator("#surface-lab-hud");
  const canvas = page.locator("#debug-scene");
  await expect(hud).toBeVisible();
  await expect(canvas).toBeVisible();
  await expect(page.getByText("SURFACE LAB", { exact: true })).toBeVisible();
  await expect(page.getByText("TECHNICAL PROVING GROUND", { exact: true })).toBeVisible();
  await expect(page.getByText("NOT GAMEPLAY", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Surface Lab controls", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Technical telemetry", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Regenerate", exact: true })).toBeVisible();
  await expect(page.getByLabel("Voxel size")).toBeVisible();
  await expect(page.getByLabel("Deterministic Hestia seed")).toBeVisible();
  expect(await page.locator("canvas").count()).toBe(1);
  expect(await canvas.count()).toBe(1);
  expect(await readTestBridgeState(page)).toEqual({ ownProperty: false, inWindow: false });
  await expect(page.locator("body")).not.toContainText("TestBridge");
  expect(await canvas.getAttribute("aria-label")).toBe("Hestia Surface Lab terrain viewport");
  const canvasBounds = await canvas.boundingBox();
  expect(canvasBounds).toMatchObject({ width: 1_920, height: 1_080 });

  const initialDefault = await waitForSettled(page);
  expect(initialDefault.telemetry).toMatchObject({
    seed: "hestia-surface-lab-v1",
    voxelSizeMeters: 0.5,
    extent: "64x32x64"
  });
  await expect(page.locator("#surface-lab-extent")).toHaveText("64 × 32 × 64 m");
  const screenshots: ScreenshotObservation[] = [
    await captureScreenshot(page, screenshotPaths.default, "default")
  ];

  await page.getByRole("button", { name: "Regenerate", exact: true }).click();
  const sameSeedCacheBypass = await waitForSettled(page, initialDefault.telemetry.planningEpoch);
  expect(sameSeedCacheBypass.telemetry.seed).toBe(initialDefault.telemetry.seed);
  expect(sameSeedCacheBypass.telemetry.cacheBypasses).toBe(16);
  expect(sameSeedCacheBypass.telemetry.brickHashes).toEqual(initialDefault.telemetry.brickHashes);
  expect(sameSeedCacheBypass.telemetry.meshHashes).toEqual(initialDefault.telemetry.meshHashes);

  await page.getByLabel("Deterministic Hestia seed").fill(changedSeed);
  await page.getByRole("button", { name: "Regenerate", exact: true }).click();
  const changedSeedRun = await waitForSettled(page, sameSeedCacheBypass.telemetry.planningEpoch);
  expect(changedSeedRun.telemetry.seed).toBe(changedSeed);
  expect(changedSeedRun.telemetry.cacheBypasses).toBe(16);
  expect(changedSeedRun.telemetry.brickHashes).not.toEqual(initialDefault.telemetry.brickHashes);
  expect(changedSeedRun.telemetry.meshHashes).not.toEqual(initialDefault.telemetry.meshHashes);

  await page.getByRole("button", { name: "Fly", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute("data-surface-lab-camera-mode", "Fly");
  const flyKeyboardPositionBefore = (await readTelemetry(page)).cameraPosition;
  await page.keyboard.down("w");
  try {
    await page.waitForTimeout(450);
  } finally {
    await page.keyboard.up("w");
  }
  await expect.poll(() => readTelemetry(page).then((telemetry) => telemetry.cameraPosition)).not.toBe(flyKeyboardPositionBefore);
  const flyKeyboardPositionAfter = (await readTelemetry(page)).cameraPosition;

  await page.getByRole("button", { name: "Orbit", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute("data-surface-lab-camera-mode", "Orbit");
  const orbitQuaternionBefore = (await readTelemetry(page)).cameraQuaternion;
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 90, box!.y + box!.height / 2 - 45, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => readTelemetry(page).then((telemetry) => telemetry.cameraQuaternion)).not.toBe(orbitQuaternionBefore);
  const orbitQuaternionAfter = (await readTelemetry(page)).cameraQuaternion;

  const wireframeButton = page.getByRole("button", { name: "Wireframe", exact: true });
  const boundariesButton = page.getByRole("button", { name: "Chunk boundaries", exact: true });
  await wireframeButton.click();
  await boundariesButton.click();
  await expect(wireframeButton).toHaveAttribute("aria-pressed", "true");
  await expect(boundariesButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("body")).toHaveAttribute("data-surface-lab-wireframe", "true");
  await expect(page.locator("body")).toHaveAttribute("data-surface-lab-boundaries", "true");
  const afterCameraAndPresentationControls = await readTelemetry(page);
  expect(afterCameraAndPresentationControls.brickHashes).toEqual(changedSeedRun.telemetry.brickHashes);
  expect(afterCameraAndPresentationControls.meshHashes).toEqual(changedSeedRun.telemetry.meshHashes);
  screenshots.push(await captureScreenshot(page, screenshotPaths.wireframe, "wireframe-and-boundaries"));

  await wireframeButton.click();
  await boundariesButton.click();
  await expect(wireframeButton).toHaveAttribute("aria-pressed", "false");
  await expect(boundariesButton).toHaveAttribute("aria-pressed", "false");
  await page.getByLabel("Voxel size").selectOption("0.25");
  const quarterMeter = await waitForSettled(page, changedSeedRun.telemetry.planningEpoch);
  expect(quarterMeter.telemetry).toMatchObject({
    seed: changedSeed,
    voxelSizeMeters: 0.25,
    extent: "32x16x32"
  });
  await expect(page.locator("#surface-lab-extent")).toHaveText("32 × 16 × 32 m");
  expect(quarterMeter.telemetry.brickHashes).not.toEqual(changedSeedRun.telemetry.brickHashes);
  expect(quarterMeter.telemetry.meshHashes).not.toEqual(changedSeedRun.telemetry.meshHashes);
  screenshots.push(await captureScreenshot(page, screenshotPaths.quarterMeter, "quarter-meter"));

  expect(await readTestBridgeState(page)).toEqual({ ownProperty: false, inWindow: false });
  const knownRajdhaniOrOtsWarnings = browserEvents.consoleWarnings.filter((warning) =>
    /Rajdhani|failed to decode downloaded font|OTS parsing error/i.test(warning)
  );
  const unexpectedWarnings = browserEvents.consoleWarnings.filter((warning) =>
    !knownRajdhaniOrOtsWarnings.includes(warning)
  );
  expect(browserEvents.consoleErrors).toEqual([]);
  expect(browserEvents.pageErrors).toEqual([]);
  expect(browserEvents.requestFailures).toEqual([]);
  expect(browserEvents.httpErrors).toEqual([]);
  expect(unexpectedWarnings).toEqual([]);

  const evidence: SurfaceLabEvidence = {
    schemaVersion: "browser-hestia-microvoxel-surface-lab-v1",
    status: "PASS",
    generatedAtUtc: new Date().toISOString(),
    generator: "apps/weltraum-browser/tests/e2e/hestia-microvoxel-surface-lab.spec.ts",
    route: "/?surfaceLab=1",
    viewport: { width: 1_920, height: 1_080 },
    normalVisibleDom: {
      hudVisible: true,
      backendCanvasCount: 1,
      testBridgeOwnProperty: false,
      testBridgeInWindow: false
    },
    runs: {
      initialDefault,
      sameSeedCacheBypass,
      changedSeed: changedSeedRun,
      afterCameraAndPresentationControls,
      quarterMeter
    },
    determinism: {
      sameSeedBrickHashesIdentical: true,
      sameSeedMeshHashesIdentical: true,
      changedSeedBrickHashesDifferent: true,
      changedSeedMeshHashesDifferent: true,
      cameraAndPresentationPreservedBrickHashes: true,
      cameraAndPresentationPreservedMeshHashes: true
    },
    interaction: {
      flyKeyboardPositionBefore,
      flyKeyboardPositionAfter,
      orbitQuaternionBefore,
      orbitQuaternionAfter,
      wireframeEnabled: true,
      boundariesEnabled: true
    },
    screenshots,
    browserHealth: {
      consoleErrors: browserEvents.consoleErrors,
      consoleWarnings: browserEvents.consoleWarnings,
      knownRajdhaniOrOtsWarnings,
      unexpectedWarnings,
      pageErrors: browserEvents.pageErrors,
      requestFailures: browserEvents.requestFailures,
      httpErrors: browserEvents.httpErrors
    },
    visualFidelity: {
      status: "DEFERRED_KNOWN_FAILING",
      owner: "browser-hestia-surface-lab-visual-fidelity-v1",
      claim: "Technical runtime evidence only; no concept, pixel-parity, or visual-acceptance claim."
    },
    verification: {
      focusedCommand,
      readinessTimeoutMilliseconds: 120_000,
      observedResult: "pass"
    }
  };
  const markdown = createMarkdown(evidence);
  await writeFile(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, markdown, "utf8");
  await writeFile(
    path.join(mirroredEvidenceDirectory, "browser-events.json"),
    `${JSON.stringify({
      schemaVersion: evidence.schemaVersion,
      generatedAtUtc: evidence.generatedAtUtc,
      route: evidence.route,
      browserHealth: evidence.browserHealth
    }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(mirroredEvidenceDirectory, "run-notes.md"),
    `# Task 5.1 live run notes\n\n- Generated: ${evidence.generatedAtUtc}\n- Focused command: \`${focusedCommand}\`\n- Result: PASS\n- Summary: \`${path.relative(repositoryRoot, summaryPath).replaceAll("\\", "/")}\`\n- Technical captures: ${evidence.screenshots.map((screenshot) => `\`${screenshot.path}\``).join(", ")}\n- Browser errors/page errors/request failures/HTTP >=400: 0/0/0/0\n- Browser warnings: ${evidence.browserHealth.consoleWarnings.length}; Rajdhani/OTS warnings are retained verbatim in \`browser-events.json\`.\n- Visual fidelity remains deferred and known-failing under \`browser-hestia-surface-lab-visual-fidelity-v1\`; screenshots are technical evidence only.\n`,
    "utf8"
  );
});
