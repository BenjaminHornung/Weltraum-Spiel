import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Vector3 = Readonly<{ x: number; y: number; z: number }>;

type LocomotionIntent = Readonly<{
  moveX?: number;
  moveZ?: number;
  sprint?: boolean;
  crouch?: boolean;
  jump?: boolean;
}>;

type LocomotionContact = Readonly<{
  kind: string;
  surfaceId: string;
  normal: Vector3;
  point?: Vector3;
  penetration: number;
}>;

type LocomotionTelemetry = Readonly<{
  tick: number;
  timeSeconds: number;
  position: Vector3;
  velocity: Vector3;
  horizontalSpeed: number;
  speed: number;
  verticalVelocity: number;
  grounded: boolean;
  crouched: boolean;
  standingBlocked: boolean;
  jumpedThisStep: boolean;
  landedThisStep: boolean;
  supportSurfaceId: string;
  slopeDegrees: number;
  traction: number;
  contactCount: number;
  contacts: readonly LocomotionContact[];
  bounds: Readonly<{ shape: string; radius: number; height: number }>;
  presetName: string;
  fixtureNotice: string;
  fixedDeltaSeconds: number;
  fixedStepBacklogSeconds: number;
  fixedStepBacklogSteps: number;
  fixedStepsLastAdvance: number;
  finite: boolean;
}>;

type SandboxHealth = Readonly<{
  runtimeErrors: number;
  consoleErrors: number;
  failedRequests: number;
  nonFiniteSamples: number;
}>;

type SandboxFixtures = Readonly<{
  course: Readonly<{
    start: Readonly<{ x: number; y: number; z: number; yawRadians: number }>;
    slipperyTraction: number;
    ramps: Readonly<{ lanes: readonly Readonly<{ id: string; minX: number; degrees: number }>[] }>;
    stairs: readonly Readonly<{ id: string; stepRise: number; stepCount: number }>[];
    tunnel: Readonly<{ id: string; minZ: number; maxZ: number; ceilingY: number }>;
  }>;
  locomotion: Readonly<{ fixedDeltaSeconds: number }>;
  presets: Readonly<Record<string, Readonly<{ parameters: Readonly<Record<string, number>> }>>>;
  notice: string;
}>;

type SandboxApi = Readonly<{
  version: number;
  reset: (options?: { preset?: string }) => LocomotionTelemetry;
  setInput: (intent: LocomotionIntent) => LocomotionIntent;
  clearInput: () => LocomotionIntent;
  step: (count?: number) => LocomotionTelemetry;
  resume: () => void;
  telemetry: () => LocomotionTelemetry;
  finite: () => boolean;
  health: () => SandboxHealth;
  presentation: () => Readonly<{
    headBobEnabled: boolean;
    fovKickEnabled: boolean;
    reducedMotion: boolean;
    headBobEffective: boolean;
    fovKickEffective: boolean;
  }>;
  fixtures: () => SandboxFixtures;
}>;

declare global {
  interface Window {
    WeltraumFirstPersonLocomotionSandboxV1?: SandboxApi;
  }
}

type BrowserHealthCapture = {
  pageErrors: string[];
  consoleErrors: string[];
  failedRequests: string[];
};

type DriveSummary = Readonly<{
  final: LocomotionTelemetry;
  maxY: number;
  maxZ: number;
  minZ: number;
  contactKeys: readonly string[];
  supportSurfaceIds: readonly string[];
}>;

type StopSummary = Readonly<{
  release: LocomotionTelemetry;
  afterSixSteps: LocomotionTelemetry;
  stopped: LocomotionTelemetry;
  stopSteps: number;
  stopDistance: number;
  measuredDeceleration: number;
}>;

type EvidenceCase = Readonly<{
  name: string;
  result: Record<string, unknown>;
  tolerance: string;
}>;

type EvidenceArtifact = Readonly<{
  file: string;
  kind: "screenshot" | "telemetry-json" | "telemetry-markdown";
  status: "captured" | "generated-after-gate";
  bytes?: number;
}>;

type RunContext = Readonly<{
  actualBaseURL: string;
  runLabel: "focused-evidence-5223" | "root-ui-ci-5173" | "behavioral-assertions-only";
  focusedEvidenceMode: boolean;
}>;

const sandboxRoute = "/prototypes/first-person-locomotion-sandbox-v1/";
const focusedEvidenceBaseURL = "http://127.0.0.1:5223";
const rootUiCiBaseURL = "http://127.0.0.1:5173";
const specDirectory = path.dirname(fileURLToPath(import.meta.url));
const browserApplicationRoot = path.resolve(specDirectory, "../..");
const evidenceDirectory = path.join(browserApplicationRoot, "evidence");
const evidencePrefix = "first-person-locomotion-sandbox-v1-";
const overviewScreenshotPath = path.join(evidenceDirectory, `${evidencePrefix}course-overview.png`);
const actionScreenshotPath = path.join(evidenceDirectory, `${evidencePrefix}crouch-blocked-standing.png`);
const focusScreenshotPath = path.join(evidenceDirectory, `${evidencePrefix}desktop-focus.png`);
const narrowScreenshotPath = path.join(evidenceDirectory, `${evidencePrefix}narrow-pointer-state.png`);
const telemetryJsonPath = path.join(evidenceDirectory, `${evidencePrefix}telemetry.json`);
const telemetryMarkdownPath = path.join(evidenceDirectory, `${evidencePrefix}telemetry.md`);

// These deliberately broad bands come from the current Grounded fixture's pure-model smoke values:
// walk 7.669 m and sprint 12.944 m after 120 fixed 60 Hz steps. They are UX fixtures, not balance claims.
const tolerance = Object.freeze({
  positionEpsilon: 1e-7,
  walkDistanceMetres: { min: 7.4, max: 7.9 },
  sprintDistanceMetres: { min: 12.6, max: 13.3 },
  jumpInitialVerticalVelocity: { min: 4.7, max: 5.2 },
  jumpPeakHeightMetres: { min: 1.15, max: 1.4 },
  jumpLandingMaximumSteps: 80,
  walkableRampMinimumHeightMetres: 4,
  walkableRampMinimumForwardMetres: 11,
  blockedRampMaximumForwardMetres: 5.25,
  passableStepMinimumHeightMetres: 1.15,
  passableStepMinimumForwardMetres: 18,
  blockedStepForwardMetres: { min: 13.5, max: 13.8 },
  normalStopMaximumSteps: 12,
  slipperyStopMinimumSteps: 50,
  normalStopMaximumDistanceMetres: 0.5,
  slipperyStopMinimumDistanceMetres: 1.5
});

const requiredEvidenceCaseNames: readonly string[] = Object.freeze([
  "direct route and named start",
  "walk and sprint distance bands",
  "crouch tunnel and blocked standing",
  "jump impulse and landing",
  "slope limit boundary",
  "passable and blocked step heights",
  "slippery deceleration",
  "exact reset finite state and Browser Health",
  "visible automation and keyboard convergence",
  "pointer lock and presentation accessibility",
  "deterministic canonical mixed sequence"
]);
const requiredScreenshotPaths: readonly string[] = Object.freeze([
  overviewScreenshotPath,
  actionScreenshotPath,
  focusScreenshotPath,
  narrowScreenshotPath
]);
const evidenceCases: EvidenceCase[] = [];
const browserHealthSamples: SandboxHealth[] = [];
const completedScreenshots = new Map<string, EvidenceArtifact>();

const deriveRunContext = (testInfo: TestInfo): RunContext => {
  const configuredBaseURL = testInfo.project.use.baseURL;
  expect(typeof configuredBaseURL, "Playwright project use.baseURL must be configured").toBe("string");
  const actualBaseURL = configuredBaseURL as string;
  const focusedEvidenceMode = actualBaseURL === focusedEvidenceBaseURL;
  return {
    actualBaseURL,
    focusedEvidenceMode,
    runLabel: focusedEvidenceMode
      ? "focused-evidence-5223"
      : actualBaseURL === rootUiCiBaseURL
        ? "root-ui-ci-5173"
        : "behavioral-assertions-only"
  };
};

const collectBrowserHealth = (page: Page): BrowserHealthCapture => {
  const capture: BrowserHealthCapture = { pageErrors: [], consoleErrors: [], failedRequests: [] };
  page.on("pageerror", (error) => capture.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") capture.consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    capture.failedRequests.push(`${request.method()} ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
  });
  return capture;
};

const openSandbox = async (page: Page): Promise<{ health: BrowserHealthCapture; start: LocomotionTelemetry }> => {
  const health = collectBrowserHealth(page);
  const response = await page.goto(sandboxRoute, { waitUntil: "networkidle" });
  expect(response, "the direct prototype route returns a document response").not.toBeNull();
  expect(response?.ok(), `direct route response status was ${response?.status()}`).toBe(true);
  await expect(page.getByRole("heading", { name: "PROVING GROUND / DIAGNOSTIC", exact: true })).toBeVisible();
  await page.waitForFunction(() => window.WeltraumFirstPersonLocomotionSandboxV1?.version === 1);
  const start = await page.evaluate(() => {
    const api = window.WeltraumFirstPersonLocomotionSandboxV1;
    if (!api) throw new Error("First-person locomotion sandbox API is unavailable.");
    return api.reset({ preset: "Grounded" });
  });
  return { health, start };
};

const resetSandbox = (page: Page, preset = "Grounded"): Promise<LocomotionTelemetry> =>
  page.evaluate((nextPreset) => {
    const api = window.WeltraumFirstPersonLocomotionSandboxV1;
    if (!api) throw new Error("First-person locomotion sandbox API is unavailable.");
    return api.reset({ preset: nextPreset });
  }, preset);

const telemetry = (page: Page): Promise<LocomotionTelemetry> =>
  page.evaluate(() => {
    const api = window.WeltraumFirstPersonLocomotionSandboxV1;
    if (!api) throw new Error("First-person locomotion sandbox API is unavailable.");
    return api.telemetry();
  });

const fixtures = (page: Page): Promise<SandboxFixtures> =>
  page.evaluate(() => {
    const api = window.WeltraumFirstPersonLocomotionSandboxV1;
    if (!api) throw new Error("First-person locomotion sandbox API is unavailable.");
    return api.fixtures();
  });

const driveSteps = (page: Page, intent: LocomotionIntent, steps: number): Promise<DriveSummary> =>
  page.evaluate(({ nextIntent, stepCount }) => {
    const api = window.WeltraumFirstPersonLocomotionSandboxV1;
    if (!api) throw new Error("First-person locomotion sandbox API is unavailable.");
    api.setInput(nextIntent);
    let final = api.telemetry();
    let maxY = final.position.y;
    let maxZ = final.position.z;
    let minZ = final.position.z;
    const contactKeys = new Set<string>();
    const supportSurfaceIds = new Set<string>();
    for (let index = 0; index < stepCount; index += 1) {
      final = api.step(1);
      maxY = Math.max(maxY, final.position.y);
      maxZ = Math.max(maxZ, final.position.z);
      minZ = Math.min(minZ, final.position.z);
      supportSurfaceIds.add(final.supportSurfaceId);
      for (const contact of final.contacts) contactKeys.add(`${contact.kind}:${contact.surfaceId}`);
    }
    api.clearInput();
    return {
      final,
      maxY,
      maxZ,
      minZ,
      contactKeys: [...contactKeys].sort(),
      supportSurfaceIds: [...supportSurfaceIds].sort()
    };
  }, { nextIntent: intent, stepCount: steps });

const steerToX = (page: Page, targetX: number): Promise<LocomotionTelemetry> =>
  page.evaluate((target) => {
    const api = window.WeltraumFirstPersonLocomotionSandboxV1;
    if (!api) throw new Error("First-person locomotion sandbox API is unavailable.");
    const startX = api.telemetry().position.x;
    const direction = Math.sign(target - startX);
    if (direction !== 0) {
      api.setInput({ moveX: direction });
      for (let index = 0; index < 600; index += 1) {
        const sample = api.step(1);
        if ((direction > 0 && sample.position.x >= target) || (direction < 0 && sample.position.x <= target)) break;
      }
    }
    api.clearInput();
    api.step(30);
    return api.telemetry();
  }, targetX);

const driveForwardUntil = (
  page: Page,
  targetZ: number,
  options: Readonly<{ crouch?: boolean; sprint?: boolean; maxSteps?: number }> = {}
): Promise<DriveSummary> =>
  page.evaluate(({ target, crouch, sprint, maxSteps }) => {
    const api = window.WeltraumFirstPersonLocomotionSandboxV1;
    if (!api) throw new Error("First-person locomotion sandbox API is unavailable.");
    api.setInput({ moveZ: 1, crouch, sprint });
    let final = api.telemetry();
    let maxY = final.position.y;
    let maxZ = final.position.z;
    let minZ = final.position.z;
    const contactKeys = new Set<string>();
    const supportSurfaceIds = new Set<string>();
    for (let index = 0; index < maxSteps; index += 1) {
      final = api.step(1);
      maxY = Math.max(maxY, final.position.y);
      maxZ = Math.max(maxZ, final.position.z);
      minZ = Math.min(minZ, final.position.z);
      supportSurfaceIds.add(final.supportSurfaceId);
      for (const contact of final.contacts) contactKeys.add(`${contact.kind}:${contact.surfaceId}`);
      if (final.position.z >= target) break;
    }
    api.clearInput();
    return {
      final,
      maxY,
      maxZ,
      minZ,
      contactKeys: [...contactKeys].sort(),
      supportSurfaceIds: [...supportSurfaceIds].sort()
    };
  }, {
    target: targetZ,
    crouch: options.crouch ?? false,
    sprint: options.sprint ?? false,
    maxSteps: options.maxSteps ?? 1_200
  });

const releaseUntilStopped = (page: Page, maximumSteps = 180): Promise<StopSummary> =>
  page.evaluate((maxSteps) => {
    const api = window.WeltraumFirstPersonLocomotionSandboxV1;
    if (!api) throw new Error("First-person locomotion sandbox API is unavailable.");
    api.clearInput();
    const release = api.telemetry();
    let afterSixSteps = release;
    let stopped = release;
    let stopSteps = 0;
    for (let index = 1; index <= maxSteps; index += 1) {
      const sample = api.step(1);
      if (index === 6) afterSixSteps = sample;
      if (sample.horizontalSpeed < 0.1) {
        stopped = sample;
        stopSteps = index;
        break;
      }
    }
    if (stopSteps === 0) throw new Error(`Locomotion did not decelerate below 0.1 m/s in ${maxSteps} steps.`);
    const elapsedSixSteps = release.fixedDeltaSeconds * 6;
    return {
      release,
      afterSixSteps,
      stopped,
      stopSteps,
      stopDistance: Math.hypot(
        stopped.position.x - release.position.x,
        stopped.position.z - release.position.z
      ),
      measuredDeceleration: (release.horizontalSpeed - afterSixSteps.horizontalSpeed) / elapsedSixSteps
    };
  }, maximumSteps);

const assertFiniteTelemetry = (sample: Readonly<{ finite: boolean }>): void => {
  const visit = (value: unknown, pathLabel: string): void => {
    if (typeof value === "number") {
      expect(Number.isFinite(value), `${pathLabel} must not be NaN or Infinity`).toBe(true);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, `${pathLabel}[${index}]`));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) visit(child, `${pathLabel}.${key}`);
    }
  };
  visit(sample, "telemetry");
  expect(sample.finite).toBe(true);
};

const registerScreenshot = async (screenshotPath: string): Promise<void> => {
  const file = path.basename(screenshotPath);
  expect(file.startsWith(evidencePrefix), `${file} must use the approved evidence prefix`).toBe(true);
  const fileStat = await stat(screenshotPath);
  expect(fileStat.isFile(), `${file} must be a file`).toBe(true);
  expect(fileStat.size, `${file} must contain screenshot bytes`).toBeGreaterThan(0);
  completedScreenshots.set(file, {
    file,
    kind: "screenshot",
    status: "captured",
    bytes: fileStat.size
  });
};

const expectHealthy = async (page: Page, capture: BrowserHealthCapture): Promise<void> => {
  const appHealth = await page.evaluate(() => {
    const api = window.WeltraumFirstPersonLocomotionSandboxV1;
    if (!api) throw new Error("First-person locomotion sandbox API is unavailable.");
    return api.health();
  });
  const apiFinite = await page.evaluate(() => {
    const api = window.WeltraumFirstPersonLocomotionSandboxV1;
    if (!api) throw new Error("First-person locomotion sandbox API is unavailable.");
    return api.finite();
  });
  const sample = await telemetry(page);
  assertFiniteTelemetry(sample);
  expect(apiFinite).toBe(true);
  expect(capture.pageErrors, "page/runtime errors").toEqual([]);
  expect(capture.consoleErrors, "console errors").toEqual([]);
  expect(capture.failedRequests, "failed requests").toEqual([]);
  expect(appHealth, "app health order is runtime / console / request / non-finite").toEqual({
    runtimeErrors: 0,
    consoleErrors: 0,
    failedRequests: 0,
    nonFiniteSamples: 0
  });
  browserHealthSamples.push(appHealth);
  await expect(page.getByTestId("browser-health")).toHaveText("0/0/0/0");
  await expect(page.getByTestId("browser-health")).toHaveAttribute(
    "aria-label",
    "Runtime errors, console errors, failed requests, non-finite samples"
  );
};

const expectResetState = (sample: LocomotionTelemetry): void => {
  expect(sample.tick).toBe(0);
  expect(sample.timeSeconds).toBe(0);
  expect(sample.position).toEqual({ x: 0, y: 0, z: 0 });
  expect(sample.velocity).toEqual({ x: 0, y: 0, z: 0 });
  expect(sample.horizontalSpeed).toBe(0);
  expect(sample.verticalVelocity).toBe(0);
  expect(sample.grounded).toBe(true);
  expect(sample.crouched).toBe(false);
  expect(sample.standingBlocked).toBe(false);
  expect(sample.supportSurfaceId).toBe("flat-ground");
  expect(sample.contacts.map(({ kind, surfaceId }) => `${kind}:${surfaceId}`)).toEqual([
    "reset-support:flat-ground"
  ]);
  assertFiniteTelemetry(sample);
};

const recordEvidence = (entry: EvidenceCase): void => {
  expect(
    evidenceCases.some((candidate) => candidate.name === entry.name),
    `evidence case ${entry.name} must be recorded once`
  ).toBe(false);
  evidenceCases.push(entry);
};

const createEvidenceMarkdown = (payload: Record<string, unknown>): string => {
  const cases = payload.cases as EvidenceCase[];
  const status = payload.status as Record<string, unknown>;
  const artifacts = payload.artifacts as EvidenceArtifact[];
  const actualBaseURL = payload.baseURL as string;
  const runLabel = payload.runLabel as string;
  const lines = [
    "# First-Person Locomotion Sandbox V1 telemetry",
    "",
    `Focused Chromium evidence generated by run \`${runLabel}\` at actual base URL \`${actualBaseURL}\`.`,
    "All numerical values are UX fixtures — not final balance.",
    "",
    "## Execution status",
    "",
    `- Status: **${status.result}**`,
    `- Required/completed cases: **${status.completedCases}/${status.requiredCases}**`,
    `- Required/completed screenshots: **${status.completedScreenshots}/${status.requiredScreenshots}**`,
    `- Browser Health samples: **${status.healthSamples}**, all **0/0/0/0**`,
    "",
    "## Cases",
    ""
  ];
  for (const entry of cases) {
    lines.push(`- **${entry.name}:** ${JSON.stringify(entry.result)} — tolerance: ${entry.tolerance}`);
  }
  lines.push(
    "",
    "## Browser Health",
    "",
    "Required order: page/runtime errors, console errors, failed requests, non-finite samples = `0/0/0/0`.",
    "",
    "## Screenshots",
    ""
  );
  for (const artifact of artifacts) {
    lines.push(`- \`${artifact.file}\` — ${artifact.kind}; ${artifact.status}${artifact.bytes ? `; ${artifact.bytes} bytes` : ""}.`);
  }
  lines.push("");
  return lines.join("\n");
};

test.describe.serial("first-person locomotion sandbox v1", () => {
  test.afterAll(async ({}, testInfo) => {
    const runContext = deriveRunContext(testInfo);
    if (!runContext.focusedEvidenceMode) return;

    const completedCaseNames = evidenceCases.map(({ name }) => name);
    const missingCases = requiredEvidenceCaseNames.filter((name) => !completedCaseNames.includes(name));
    const unexpectedCases = completedCaseNames.filter((name) => !requiredEvidenceCaseNames.includes(name));
    const requiredScreenshotNames = requiredScreenshotPaths.map((screenshotPath) => path.basename(screenshotPath));
    const missingScreenshots = requiredScreenshotNames.filter((name) => !completedScreenshots.has(name));

    expect(missingCases, "telemetry evidence stays unwritten until every required case completed").toEqual([]);
    expect(unexpectedCases, "telemetry evidence contains only required cases").toEqual([]);
    expect(missingScreenshots, "telemetry evidence stays unwritten until every required screenshot completed").toEqual([]);
    expect(browserHealthSamples, "every required case completed a Browser Health check").toHaveLength(
      requiredEvidenceCaseNames.length
    );
    expect(
      browserHealthSamples.every((sample) => Object.values(sample).every((value) => value === 0)),
      "every recorded Browser Health sample is 0/0/0/0"
    ).toBe(true);

    const screenshotArtifacts = requiredScreenshotNames.map((name) => completedScreenshots.get(name));
    expect(screenshotArtifacts.every(Boolean)).toBe(true);
    const artifacts: EvidenceArtifact[] = [
      ...(screenshotArtifacts as EvidenceArtifact[]),
      { file: path.basename(telemetryJsonPath), kind: "telemetry-json", status: "generated-after-gate" },
      { file: path.basename(telemetryMarkdownPath), kind: "telemetry-markdown", status: "generated-after-gate" }
    ];
    const payload = {
      schemaVersion: "first-person-locomotion-sandbox-v1",
      generatedBy: "tests/e2e/first-person-locomotion-sandbox.spec.ts",
      route: sandboxRoute,
      baseURL: runContext.actualBaseURL,
      runLabel: runContext.runLabel,
      fixtureNotice: "UX fixture — not final balance",
      browserHealthOrder: ["page/runtime errors", "console errors", "failed requests", "non-finite samples"],
      browserHealthExpected: [0, 0, 0, 0],
      browserHealthActual: browserHealthSamples,
      status: {
        result: "passed",
        requiredCases: requiredEvidenceCaseNames.length,
        completedCases: evidenceCases.length,
        requiredScreenshots: requiredScreenshotNames.length,
        completedScreenshots: completedScreenshots.size,
        healthSamples: browserHealthSamples.length
      },
      screenshots: requiredScreenshotNames,
      artifacts,
      cases: evidenceCases
    };
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(telemetryJsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await writeFile(telemetryMarkdownPath, createEvidenceMarkdown(payload), "utf8");
  });

  test("loads the direct route at the exact named start and validates the course overview", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { health, start } = await openSandbox(page);
    expectResetState(start);
    const currentFixtures = await fixtures(page);
    expect(currentFixtures.notice).toBe("UX fixture — not final balance");
    expect(currentFixtures.course.ramps.lanes.map(({ degrees }) => degrees)).toEqual([10, 20, 35, 50]);
    expect(currentFixtures.course.stairs.map(({ stepRise }) => stepRise)).toEqual([0.16, 0.3, 0.5]);
    await expect(page.getByTestId("course-region-index")).toContainText("Named start / reset");
    await expect(page.getByTestId("course-region-index")).toContainText("50° ramp");
    await expect(page.getByTestId("course-region-index")).toContainText("Crouch tunnel");
    await expect(page.getByTestId("course-region-index")).toContainText("Slippery patch");
    await expect(page.getByTestId("course-region-index")).toContainText("R4 · 50° ramp · blocked");
    await expect(page.getByTestId("course-region-index")).toContainText("S3 · 0.50 m × 3 · blocked");
    if (deriveRunContext(testInfo).focusedEvidenceMode) {
      await mkdir(evidenceDirectory, { recursive: true });
      await page.screenshot({ path: overviewScreenshotPath, fullPage: true, animations: "disabled" });
      await registerScreenshot(overviewScreenshotPath);
    }
    await expectHealthy(page, health);
    recordEvidence({
      name: "direct route and named start",
      result: { position: start.position, support: start.supportSurfaceId, tick: start.tick },
      tolerance: "reset is exact; course catalog contains 10/20/35/50 degree ramps and 0.16/0.30/0.50 m steps"
    });
  });

  test("keeps walk and sprint inside fixture-derived distance bands", async ({ page }) => {
    const { health } = await openSandbox(page);
    const walk = await driveSteps(page, { moveZ: 1 }, 120);
    expect(walk.final.position.z).toBeGreaterThanOrEqual(tolerance.walkDistanceMetres.min);
    expect(walk.final.position.z).toBeLessThanOrEqual(tolerance.walkDistanceMetres.max);
    expect(walk.final.horizontalSpeed).toBeCloseTo(4, 6);
    expectResetState(await resetSandbox(page));
    const sprint = await driveSteps(page, { moveZ: 1, sprint: true }, 120);
    expect(sprint.final.position.z).toBeGreaterThanOrEqual(tolerance.sprintDistanceMetres.min);
    expect(sprint.final.position.z).toBeLessThanOrEqual(tolerance.sprintDistanceMetres.max);
    expect(sprint.final.horizontalSpeed).toBeCloseTo(7, 6);
    expect(sprint.final.position.z).toBeGreaterThan(walk.final.position.z + 4);
    await expect(page.getByTestId("diagnostic-speed")).toHaveText("7.00 m/s");
    await expectHealthy(page, health);
    recordEvidence({
      name: "walk and sprint distance bands",
      result: { walkMetres: walk.final.position.z, sprintMetres: sprint.final.position.z, fixedSteps: 120 },
      tolerance: "walk 7.4-7.9 m; sprint 12.6-13.3 m; sprint exceeds walk by more than 4 m"
    });
  });

  test("converges visible Press Hold Release and real keyboard input on authoritative outcomes", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { health } = await openSandbox(page);
    const automationControl = page.getByTestId("automation-control");
    const pressButton = page.getByTestId("automation-press");
    const holdButton = page.getByTestId("automation-hold");
    const releaseButton = page.getByTestId("automation-release");

    await automationControl.selectOption("forward");
    await pressButton.click();
    await expect(pressButton).toHaveAttribute("aria-pressed", "true");
    const pressOutcome = await page.evaluate(() => {
      const api = window.WeltraumFirstPersonLocomotionSandboxV1;
      if (!api) throw new Error("First-person locomotion sandbox API is unavailable.");
      return api.step(1);
    });
    expect(pressOutcome.position.z).toBeGreaterThan(0);
    await expect(pressButton).toHaveAttribute("aria-pressed", "false", { timeout: 1_000 });

    expectResetState(await resetSandbox(page));
    await holdButton.click();
    await expect(holdButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("automation-state")).toHaveText("W held");
    const visibleHoldOutcome = await page.evaluate(() => {
      const api = window.WeltraumFirstPersonLocomotionSandboxV1;
      if (!api) throw new Error("First-person locomotion sandbox API is unavailable.");
      return api.step(60);
    });
    await releaseButton.click();
    await expect(holdButton).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("automation-state")).toHaveText("Automation idle");
    await expect(page.getByTestId("active-input")).toHaveText("Idle");

    expectResetState(await resetSandbox(page));
    await holdButton.click();
    await expect(page.getByTestId("automation-state")).toHaveText("W held");
    await automationControl.selectOption("left");
    await expect(holdButton).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("automation-state")).toHaveText("Automation idle");
    await expect(page.getByTestId("active-input")).toHaveText("Idle");
    const afterSelectionChange = await telemetry(page);
    expect(afterSelectionChange.horizontalSpeed).toBe(0);

    expectResetState(await resetSandbox(page));
    const canvas = page.getByTestId("proving-ground-canvas");
    await canvas.focus();
    await page.keyboard.down("w");
    await expect(page.getByTestId("active-input")).toHaveText("W");
    const keyboardOutcome = await page.evaluate(() => {
      const api = window.WeltraumFirstPersonLocomotionSandboxV1;
      if (!api) throw new Error("First-person locomotion sandbox API is unavailable.");
      return api.step(60);
    });
    await page.keyboard.up("w");
    await expect(page.getByTestId("active-input")).toHaveText("Idle");

    expect(visibleHoldOutcome.horizontalSpeed).toBeCloseTo(4, 6);
    expect(keyboardOutcome.horizontalSpeed).toBeCloseTo(4, 6);
    expect(Math.abs(visibleHoldOutcome.position.z - keyboardOutcome.position.z)).toBeLessThan(0.35);

    expectResetState(await resetSandbox(page));
    await holdButton.focus();
    await expect(holdButton).toBeFocused();
    if (deriveRunContext(testInfo).focusedEvidenceMode) {
      await mkdir(evidenceDirectory, { recursive: true });
      await page.screenshot({ path: focusScreenshotPath, fullPage: true, animations: "disabled" });
      await registerScreenshot(focusScreenshotPath);
    }
    await expectHealthy(page, health);
    recordEvidence({
      name: "visible automation and keyboard convergence",
      result: {
        pressForwardZ: pressOutcome.position.z,
        visibleHoldForwardZ: visibleHoldOutcome.position.z,
        keyboardForwardZ: keyboardOutcome.position.z,
        selectionChangeReleasedPreviousHold: true
      },
      tolerance: "visible Press/Hold/Release and real W keyboard input use the same normalized authority; 60-step forward outcomes differ by less than 0.35 m"
    });
  });

  test("exposes pointer-lock and effective camera presentation state accessibly on a narrow layout", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { health } = await openSandbox(page);
    const canvas = page.getByRole("region", { name: "First-person locomotion course viewport", exact: true });
    await expect(canvas).toHaveAttribute("aria-describedby", "canvas-description pointer-lock-help");
    await expect(page.getByTestId("viewport-pointer-state")).toHaveText("Pointer free");
    await expect(page.getByTestId("viewport-pointer-action")).toContainText("engage pointer lock");
    if (deriveRunContext(testInfo).focusedEvidenceMode) {
      await mkdir(evidenceDirectory, { recursive: true });
      await page.screenshot({ path: narrowScreenshotPath, animations: "disabled" });
      await registerScreenshot(narrowScreenshotPath);
    }

    const headBobButton = page.getByRole("button", { name: "Head Bob", exact: true });
    const fovKickButton = page.getByRole("button", { name: "FOV Kick", exact: true });
    await expect(headBobButton).toHaveAttribute("aria-pressed", "true");
    await expect(fovKickButton).toHaveAttribute("aria-pressed", "true");
    await expect(headBobButton).toHaveAttribute("data-effective", "true");
    await expect(fovKickButton).toHaveAttribute("data-effective", "true");
    await fovKickButton.click();
    await expect(fovKickButton).toHaveAttribute("aria-pressed", "false");
    await fovKickButton.click();
    await expect(fovKickButton).toHaveAttribute("aria-pressed", "true");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(headBobButton).toHaveAttribute("data-effective", "false");
    await expect(fovKickButton).toHaveAttribute("data-effective", "false");
    await expect(page.getByTestId("camera-effective-state")).toHaveText(
      "Effective: Head Bob off · FOV Kick off · reduced motion suppresses enabled effects"
    );
    const reducedPresentation = await page.evaluate(() => {
      const api = window.WeltraumFirstPersonLocomotionSandboxV1;
      if (!api) throw new Error("First-person locomotion sandbox API is unavailable.");
      return api.presentation();
    });
    expect(reducedPresentation).toEqual({
      headBobEnabled: true,
      fovKickEnabled: true,
      reducedMotion: true,
      headBobEffective: false,
      fovKickEffective: false
    });

    await page.evaluate(() => {
      const status = document.querySelector('[data-testid="pointer-lock-status"]');
      if (!status) throw new Error("Pointer-lock status is unavailable.");
      const state = window as typeof window & { __pointerStatusTransitions?: string[] };
      state.__pointerStatusTransitions = [status.textContent ?? ""];
      new MutationObserver(() => state.__pointerStatusTransitions?.push(status.textContent ?? ""))
        .observe(status, { childList: true, characterData: true, subtree: true });
    });
    const pointerButton = page.getByTestId("pointer-lock-engage");
    const pointerStatus = page.getByTestId("pointer-lock-status");
    await pointerButton.click();
    await expect(pointerStatus).not.toHaveText("Requesting pointer lock…", { timeout: 3_000 });
    const requestStatus = (await pointerStatus.textContent()) ?? "";
    const pointerActivated = requestStatus.startsWith("Pointer lock active");
    if (pointerActivated) {
      await expect(pointerButton).toHaveAttribute("aria-pressed", "true");
      await expect(pointerButton).toBeDisabled();
      await page.keyboard.press("Escape");
      await expect(pointerButton).toHaveAttribute("aria-pressed", "false");
      await expect(pointerButton).toBeEnabled();
      await expect(pointerStatus).toContainText("released");
    } else {
      expect(requestStatus).toMatch(/not granted|request failed/);
      await expect(pointerButton).toHaveAttribute("aria-pressed", "false");
      await expect(pointerButton).toBeEnabled();
    }
    const pointerTransitions = await page.evaluate(() =>
      (window as typeof window & { __pointerStatusTransitions?: string[] }).__pointerStatusTransitions ?? []
    );
    expect(pointerTransitions).toContain("Requesting pointer lock…");

    await page.evaluate(() => document.dispatchEvent(new Event("pointerlockerror")));
    await expect(pointerStatus).toHaveText(
      "Pointer lock request failed. Keyboard and visible controls remain available."
    );
    await expect(pointerButton).toHaveAttribute("aria-pressed", "false");
    await expectHealthy(page, health);
    recordEvidence({
      name: "pointer lock and presentation accessibility",
      result: {
        chromiumPointerLockActivated: pointerActivated,
        requestStatus,
        requestTransitionObserved: true,
        releaseObservedWhenActivated: pointerActivated,
        errorStatusObserved: true,
        reducedMotion: reducedPresentation
      },
      tolerance: "real Chromium request is accepted or explicitly denied; active locks release with Escape; deterministic error event preserves fallback controls; reduced motion suppresses both enabled effects"
    });
  });

  test("traverses the tunnel crouched and blocks standing until clearance exists", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { health } = await openSandbox(page);
    const aligned = await steerToX(page, -1);
    expect(aligned.position.x).toBeGreaterThan(-1.7);
    expect(aligned.position.x).toBeLessThan(-0.7);
    const entered = await driveForwardUntil(page, 23, { crouch: true });
    expect(entered.final.position.z).toBeGreaterThanOrEqual(23);
    expect(entered.final.crouched).toBe(true);

    const blocked = await driveSteps(page, { moveZ: 1, crouch: false }, 1);
    expect(blocked.final.crouched).toBe(true);
    expect(blocked.final.standingBlocked).toBe(true);
    expect(blocked.contactKeys).toContain("standing-blocked:crouch-tunnel");
    await expect(page.getByTestId("diagnostic-stance")).toHaveText("Crouched · stand blocked");
    if (deriveRunContext(testInfo).focusedEvidenceMode) {
      await mkdir(evidenceDirectory, { recursive: true });
      await page.locator("main.sandbox-layout").screenshot({ path: actionScreenshotPath, animations: "disabled" });
      await registerScreenshot(actionScreenshotPath);
    }

    const exited = await page.evaluate(() => {
      const api = window.WeltraumFirstPersonLocomotionSandboxV1;
      if (!api) throw new Error("First-person locomotion sandbox API is unavailable.");
      api.setInput({ moveZ: 1, crouch: false });
      let sample = api.telemetry();
      let observedBlocked = sample.standingBlocked;
      for (let index = 0; index < 400; index += 1) {
        sample = api.step(1);
        observedBlocked = observedBlocked || sample.standingBlocked;
        if (!sample.crouched) break;
      }
      api.clearInput();
      return { sample, observedBlocked };
    });
    expect(exited.observedBlocked).toBe(true);
    expect(exited.sample.position.z).toBeGreaterThan(30.35);
    expect(exited.sample.crouched).toBe(false);
    expect(exited.sample.standingBlocked).toBe(false);
    await expectHealthy(page, health);
    recordEvidence({
      name: "crouch tunnel and blocked standing",
      result: {
        enteredZ: entered.final.position.z,
        blockedContact: "standing-blocked:crouch-tunnel",
        stoodAfterZ: exited.sample.position.z
      },
      tolerance: "aligned x -1.7..-0.7; enter z >= 23 crouched; standing clears only beyond tunnel capsule edge z > 30.35"
    });
  });

  test("applies a positive jump impulse and lands through gravity", async ({ page }) => {
    const { health } = await openSandbox(page);
    const impulse = await driveSteps(page, { jump: true }, 1);
    expect(impulse.final.jumpedThisStep).toBe(true);
    expect(impulse.final.grounded).toBe(false);
    expect(impulse.final.verticalVelocity).toBeGreaterThanOrEqual(tolerance.jumpInitialVerticalVelocity.min);
    expect(impulse.final.verticalVelocity).toBeLessThanOrEqual(tolerance.jumpInitialVerticalVelocity.max);

    const landing = await page.evaluate((maximumSteps) => {
      const api = window.WeltraumFirstPersonLocomotionSandboxV1;
      if (!api) throw new Error("First-person locomotion sandbox API is unavailable.");
      api.clearInput();
      let sample = api.telemetry();
      let maxY = sample.position.y;
      let landingSteps = 0;
      for (let index = 1; index <= maximumSteps; index += 1) {
        sample = api.step(1);
        maxY = Math.max(maxY, sample.position.y);
        if (sample.landedThisStep) {
          landingSteps = index;
          break;
        }
      }
      return { sample, maxY, landingSteps };
    }, tolerance.jumpLandingMaximumSteps);
    expect(landing.maxY).toBeGreaterThanOrEqual(tolerance.jumpPeakHeightMetres.min);
    expect(landing.maxY).toBeLessThanOrEqual(tolerance.jumpPeakHeightMetres.max);
    expect(landing.landingSteps).toBeGreaterThan(0);
    expect(landing.landingSteps).toBeLessThanOrEqual(tolerance.jumpLandingMaximumSteps);
    expect(landing.sample.grounded).toBe(true);
    expect(landing.sample.position.y).toBeCloseTo(0, 7);
    expect(landing.sample.verticalVelocity).toBeCloseTo(0, 7);
    await expectHealthy(page, health);
    recordEvidence({
      name: "jump impulse and landing",
      result: {
        initialVerticalVelocity: impulse.final.verticalVelocity,
        peakHeight: landing.maxY,
        landingSteps: landing.landingSteps
      },
      tolerance: "initial vy 4.7-5.2 m/s; peak 1.15-1.40 m; grounded landing within 80 fixed steps"
    });
  });

  test("walks the 35 degree boundary ramp and rejects the 50 degree ramp", async ({ page }) => {
    const { health } = await openSandbox(page);
    await steerToX(page, 2);
    const walkable = await driveSteps(page, { moveZ: 1 }, 420);
    expect(walkable.maxY).toBeGreaterThan(tolerance.walkableRampMinimumHeightMetres);
    expect(walkable.maxZ).toBeGreaterThan(tolerance.walkableRampMinimumForwardMetres);
    expect(walkable.supportSurfaceIds).toContain("ramp-35");
    expect(walkable.contactKeys).toContain("slope-support:ramp-35");
    expect(walkable.contactKeys).not.toContain("slope-blocked:ramp-35");

    expectResetState(await resetSandbox(page));
    await steerToX(page, 9);
    const blocked = await driveSteps(page, { moveZ: 1 }, 420);
    expect(blocked.maxZ).toBeLessThan(tolerance.blockedRampMaximumForwardMetres);
    expect(blocked.final.position.z).toBeLessThan(4.8);
    expect(blocked.maxY).toBeLessThan(0.25);
    expect(blocked.contactKeys).toContain("slope-blocked:ramp-50");
    await expect(page.getByTestId("contact-list")).toContainText("slope-blocked · ramp-50");
    await expectHealthy(page, health);
    recordEvidence({
      name: "slope limit boundary",
      result: {
        ramp35MaximumHeight: walkable.maxY,
        ramp35MaximumZ: walkable.maxZ,
        ramp50MaximumHeight: blocked.maxY,
        ramp50MaximumZ: blocked.maxZ
      },
      tolerance: "35 degree ramp reaches y > 4.0 and z > 11; 50 degree ramp stays below y 0.25 and z 5.25 with slope-blocked contact"
    });
  });

  test("steps over the 0.30 metre stairs and blocks the 0.50 metre rise", async ({ page }) => {
    const { health } = await openSandbox(page);
    await steerToX(page, -1.5);
    const passable = await driveSteps(page, { moveZ: 1 }, 500);
    expect(passable.maxY).toBeGreaterThan(tolerance.passableStepMinimumHeightMetres);
    expect(passable.maxZ).toBeGreaterThan(tolerance.passableStepMinimumForwardMetres);
    expect(passable.contactKeys.filter((key) => key.startsWith("step-up:stairs-passable-step-"))).toHaveLength(4);

    expectResetState(await resetSandbox(page));
    await steerToX(page, 5.5);
    const blocked = await driveSteps(page, { moveZ: 1 }, 500);
    expect(blocked.maxY).toBeCloseTo(0, 7);
    expect(blocked.maxZ).toBeGreaterThanOrEqual(tolerance.blockedStepForwardMetres.min);
    expect(blocked.maxZ).toBeLessThanOrEqual(tolerance.blockedStepForwardMetres.max);
    expect(blocked.contactKeys).toContain("step-blocked:stairs-blocked-step-1");
    await expectHealthy(page, health);
    recordEvidence({
      name: "passable and blocked step heights",
      result: {
        passableMaximumHeight: passable.maxY,
        passableMaximumZ: passable.maxZ,
        passableStepContacts: passable.contactKeys.filter((key) => key.startsWith("step-up:stairs-passable-step-")).length,
        blockedMaximumZ: blocked.maxZ
      },
      tolerance: "0.30 m x4 stairs reach y > 1.15 and z > 18; 0.50 m first rise blocks at z 13.5-13.8"
    });
  });

  test("measures longer and lower deceleration on the slippery patch", async ({ page }) => {
    const { health } = await openSandbox(page);
    await steerToX(page, -15);
    await driveForwardUntil(page, 25);
    await driveSteps(page, {}, 60);
    const normalAcceleration = await driveSteps(page, { moveZ: 1 }, 80);
    expect(normalAcceleration.final.supportSurfaceId).toBe("flat-ground");
    const normalStop = await releaseUntilStopped(page);

    expectResetState(await resetSandbox(page));
    await steerToX(page, -9);
    await driveForwardUntil(page, 25);
    await driveSteps(page, {}, 60);
    const slipperyAcceleration = await driveSteps(page, { moveZ: 1 }, 80);
    expect(slipperyAcceleration.final.supportSurfaceId).toBe("slippery-patch");
    const slipperyStop = await releaseUntilStopped(page);

    expect(normalStop.release.horizontalSpeed).toBeGreaterThan(3.9);
    expect(slipperyStop.release.horizontalSpeed).toBeGreaterThan(3.9);
    expect(normalStop.stopSteps).toBeLessThanOrEqual(tolerance.normalStopMaximumSteps);
    expect(slipperyStop.stopSteps).toBeGreaterThanOrEqual(tolerance.slipperyStopMinimumSteps);
    expect(normalStop.stopDistance).toBeLessThan(tolerance.normalStopMaximumDistanceMetres);
    expect(slipperyStop.stopDistance).toBeGreaterThan(tolerance.slipperyStopMinimumDistanceMetres);
    expect(slipperyStop.afterSixSteps.horizontalSpeed).toBeGreaterThan(normalStop.afterSixSteps.horizontalSpeed + 1.5);
    expect(slipperyStop.measuredDeceleration).toBeLessThan(normalStop.measuredDeceleration * 0.3);
    await expectHealthy(page, health);
    recordEvidence({
      name: "slippery deceleration",
      result: {
        normal: {
          stopSteps: normalStop.stopSteps,
          stopDistance: normalStop.stopDistance,
          measuredDeceleration: normalStop.measuredDeceleration
        },
        slippery: {
          stopSteps: slipperyStop.stopSteps,
          stopDistance: slipperyStop.stopDistance,
          measuredDeceleration: slipperyStop.measuredDeceleration
        }
      },
      tolerance: "normal <= 12 stop steps and < 0.5 m; slippery >= 50 stop steps and > 1.5 m; slippery measured deceleration < 30% of normal"
    });
  });

  test("replays a canonical mixed sequence twice with identical authoritative telemetry and contacts", async ({ page }) => {
    const { health } = await openSandbox(page);
    const replays = await page.evaluate(() => {
      const api = window.WeltraumFirstPersonLocomotionSandboxV1;
      if (!api) throw new Error("First-person locomotion sandbox API is unavailable.");
      const canonicalize = (sample: LocomotionTelemetry) => ({
        tick: sample.tick,
        timeSeconds: sample.timeSeconds,
        position: sample.position,
        velocity: sample.velocity,
        horizontalSpeed: sample.horizontalSpeed,
        verticalVelocity: sample.verticalVelocity,
        grounded: sample.grounded,
        crouched: sample.crouched,
        standingBlocked: sample.standingBlocked,
        jumpedThisStep: sample.jumpedThisStep,
        landedThisStep: sample.landedThisStep,
        supportSurfaceId: sample.supportSurfaceId,
        slopeDegrees: sample.slopeDegrees,
        traction: sample.traction,
        bounds: sample.bounds,
        presetName: sample.presetName,
        finite: sample.finite,
        contacts: sample.contacts.map((contact) => ({
          kind: contact.kind,
          surfaceId: contact.surfaceId,
          normal: contact.normal,
          point: contact.point,
          penetration: contact.penetration
        }))
      });
      const sequence = [
        { intent: { moveZ: 1 }, steps: 18 },
        { intent: { moveX: 1, moveZ: 1, sprint: true }, steps: 24 },
        { intent: { moveX: -1, crouch: true }, steps: 12 },
        { intent: { jump: true }, steps: 1 },
        { intent: {}, steps: 50 }
      ];
      const run = () => {
        api.reset({ preset: "Grounded" });
        const checkpoints = [canonicalize(api.telemetry())];
        for (const segment of sequence) {
          api.setInput(segment.intent);
          checkpoints.push(canonicalize(api.step(segment.steps)));
        }
        api.clearInput();
        checkpoints.push(canonicalize(api.step(1)));
        return checkpoints;
      };
      return [run(), run()];
    });
    expect(replays[1]).toEqual(replays[0]);
    for (const checkpoint of replays[0]) assertFiniteTelemetry(checkpoint);
    await expectHealthy(page, health);
    recordEvidence({
      name: "deterministic canonical mixed sequence",
      result: {
        replayCount: replays.length,
        checkpointCount: replays[0].length,
        deepEqual: true,
        final: replays[0].at(-1)
      },
      tolerance: "two runs after exact Grounded reset deep-compare equal across canonical authoritative telemetry and ordered contact payloads"
    });
  });

  test("restores the exact named reset state and reports finite 0/0/0/0 health", async ({ page }) => {
    const { health } = await openSandbox(page);
    await resetSandbox(page, "Slippery");
    await driveSteps(page, { moveX: 1, moveZ: 1, sprint: true, jump: true }, 90);
    const reset = await resetSandbox(page, "Grounded");
    expectResetState(reset);
    await expect(page.getByTestId("active-preset")).toHaveText("Grounded");
    await expect(page.getByTestId("diagnostic-position")).toHaveText("0.00 / 0.00 / 0.00");
    await expect(page.getByTestId("diagnostic-tick")).toHaveText("0");
    await expectHealthy(page, health);
    recordEvidence({
      name: "exact reset finite state and Browser Health",
      result: {
        position: reset.position,
        velocity: reset.velocity,
        tick: reset.tick,
        browserHealth: [0, 0, 0, 0]
      },
      tolerance: "exact named start/reset; all numeric telemetry finite; health order page/runtime, console, request, non-finite is 0/0/0/0"
    });
  });
});
