import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const evidenceDir = path.resolve(process.cwd(), "evidence");

type Classification = "Pass" | "KnownStress" | "ExpectedFail" | "Fail";
type SpeedProfile = "Safe" | "Balanced" | "Fast";

interface CourseEvidenceRequest {
  readonly id: string;
  readonly profile: SpeedProfile;
  readonly role: string;
}

interface CourseEvidenceResult {
  readonly courseId: string;
  readonly label: string;
  readonly category: string;
  readonly catalogSpeedProfile: SpeedProfile;
  readonly profile: SpeedProfile;
  readonly expectedOutcome: "Pass" | "KnownStress" | "ExpectedFail";
  readonly ticksToArrival: number | null;
  readonly tick: number;
  readonly simulatedSeconds: number;
  readonly targetDistance: number;
  readonly distanceMeters: number;
  readonly averageSpeed: number;
  readonly peakSpeed: number;
  readonly finalSpeed: number;
  readonly finalDistance: number;
  readonly settledSpeed: number;
  readonly settledDistance: number;
  readonly settlingTicks: number;
  readonly minObstacleClearance: number;
  readonly fuelUsed: number;
  readonly fuelReserveRemaining: number;
  readonly arrivalPhase: string;
  readonly status: string;
  readonly terminalSpeedLimit: number | null;
  readonly planHashBefore: string | null;
  readonly planHashAfter: string | null;
  readonly completedPlanHash: string | null;
  readonly routeLifecycle: string | null;
  readonly terminalCaptureTicks: number;
  readonly holdingTicks: number;
  readonly stationKeepingActive: boolean;
  readonly holdingActive: boolean;
  readonly replanRequired: boolean;
  readonly classification: Classification;
  readonly notes: readonly string[];
  readonly planner: string | null;
  readonly segmentKinds: readonly string[];
  readonly failureReasonCodes: readonly string[];
  readonly invalidationReasons: readonly string[];
  readonly evidenceRole: string;
}

interface CourseSmokeResult {
  readonly classification: Classification;
  readonly status: string;
  readonly distanceMeters: number;
  readonly profile: SpeedProfile;
  readonly planHashBefore: string | null;
  readonly planHashAfter: string | null;
  readonly completedPlanHash: string | null;
  readonly replanRequired: boolean;
}

const baselineCourseIds = [
  "direct-long",
  "s-curve-obstacles",
  "narrow-corridor",
  "offset-gates",
  "target-behind-obstacle",
  "target-near-obstacle",
  "high-initial-speed",
  "lateral-initial-velocity",
  "low-authority-terminal",
  "low-fuel-long-route",
  "off-route-disturbance-midcourse"
] as const;

const expandedCatalogCourseIds = [
  "direct-medium-stop",
  "direct-long-stop",
  "direct-very-long-stop",
  "single-blocking-obstacle-long",
  "terminal-overspeed-disturbance",
  "narrow-corridor-long",
  "off-route-fail-closed",
  "direct-long-safe",
  "direct-long-balanced",
  "direct-long-fast",
  "corridor-balanced"
] as const;

const representativeRequests: readonly CourseEvidenceRequest[] = [
  { id: "direct-medium-stop", profile: "Balanced", role: "500m direct baseline" },
  { id: "direct-long-stop", profile: "Balanced", role: "1000m direct baseline" },
  { id: "direct-very-long-stop", profile: "Balanced", role: "2500m direct long-range baseline" },
  { id: "single-blocking-obstacle-long", profile: "Balanced", role: "long single-obstacle route" },
  { id: "terminal-overspeed-disturbance", profile: "Balanced", role: "terminal overspeed ExpectedFail" },
  { id: "narrow-corridor-long", profile: "Balanced", role: "KnownStress multi-obstacle corridor" },
  { id: "off-route-fail-closed", profile: "Balanced", role: "ExpectedFail off-route fail-closed" }
];

const speedComparisonRequests: readonly CourseEvidenceRequest[] = [
  { id: "direct-very-long-stop", profile: "Safe", role: "2500m Safe speed profile comparison" },
  { id: "direct-very-long-stop", profile: "Balanced", role: "2500m Balanced speed profile comparison" },
  { id: "direct-very-long-stop", profile: "Fast", role: "2500m Fast speed profile comparison" }
];

const plannerLimits = [
  "Current local obstacle planner documents one-blocking-obstacle detours; multi-obstacle S-curves and corridors remain KnownStress evidence.",
  "ExpectedFail courses remain explicit for fuel, authority, brake-reserve and off-route invalidation instead of being hidden as successful arrivals.",
  "Executor consumes one locked RoutePlan and reports replanRequired/invalidation reasons; it does not silently replace the plan.",
  "Speed profiles may change desired route speeds and non-terminal brake margins only; StopWithinEnvelope and terminal speed gates stay invariant."
];

async function waitForShipVisualReady(page: Page) {
  await page.waitForFunction(() => {
    const snapshot = (window as any).TestBridge?.getRenderSnapshot?.();
    return snapshot?.shipVisual?.visualSource?.state && snapshot.shipVisual.visualSource.state !== "Loading";
  });
  return page.evaluate(() => (window as any).TestBridge.getRenderSnapshot().shipVisual);
}

function stablePlanHashFor(result: CourseSmokeResult): boolean {
  if (result.planHashBefore === null) {
    return result.planHashAfter === null && result.completedPlanHash === null;
  }

  return result.planHashAfter === result.planHashBefore && (result.completedPlanHash === null || result.completedPlanHash === result.planHashBefore);
}

function countClassifications(results: readonly CourseEvidenceResult[]): Record<Classification, number> {
  const counts: Record<Classification, number> = { Pass: 0, KnownStress: 0, ExpectedFail: 0, Fail: 0 };
  for (const result of results) {
    counts[result.classification] += 1;
  }
  return counts;
}

function rangeFor(results: readonly CourseEvidenceResult[], field: "fuelUsed" | "minObstacleClearance") {
  const values = results.map((result) => result[field]).filter((value) => Number.isFinite(value));
  return { min: Math.min(...values), max: Math.max(...values) };
}

function findFastest(results: readonly CourseEvidenceResult[]) {
  return [...results].sort((a, b) => a.simulatedSeconds - b.simulatedSeconds)[0] ?? null;
}

function findSlowest(results: readonly CourseEvidenceResult[]) {
  return [...results].sort((a, b) => b.simulatedSeconds - a.simulatedSeconds)[0] ?? null;
}

function formatResultLine(result: CourseEvidenceResult): string {
  return `| ${result.courseId} | ${result.profile} | ${result.distanceMeters} | ${result.classification} | ${result.status} | ${result.simulatedSeconds} | ${result.peakSpeed} | ${result.finalSpeed} | ${result.finalDistance} | ${result.settledSpeed} | ${result.settledDistance} | ${result.settlingTicks} | ${result.minObstacleClearance} | ${result.fuelUsed} | ${result.replanRequired} | ${result.planHashBefore ?? "null"} | ${result.planHashAfter ?? "null"} |`;
}

function createMarkdown(summary: Record<string, unknown>, representativeResults: readonly CourseEvidenceResult[], speedComparison: readonly CourseEvidenceResult[]) {
  const speedRows = speedComparison
    .map((result) => `| ${result.courseId} | ${result.profile} | ${result.distanceMeters} | ${result.classification} | ${result.simulatedSeconds} | ${result.peakSpeed} | ${result.finalSpeed} | ${result.settledSpeed} | ${result.settledDistance} | ${result.settlingTicks} | ${result.fuelUsed} | ${result.planHashBefore ?? "null"} | ${result.planHashAfter ?? "null"} |`)
    .join("\n");
  const representativeRows = representativeResults.map(formatResultLine).join("\n");

  return `# Browser Autopilot Long-Range Testfield v1 Evidence

Generated by \`apps/weltraum-browser/tests/e2e/autopilot-proving-ground-v2.spec.ts\` through the query-gated browser TestBridge.

## Summary

\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\`

## Representative Runtime Results

| Course | Profile | Distance (m) | Classification | Status | Sim seconds to first arrival | Peak speed | First-arrival final speed | First-arrival final distance | Settled speed | Settled distance | Settling ticks | Min obstacle clearance | Fuel used | Replan required | Plan hash before | Plan hash after |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
${representativeRows}

## 2500m Safe / Balanced / Fast Comparison

| Course | Profile | Distance (m) | Classification | Sim seconds to first arrival | Peak speed | First-arrival final speed | Settled speed | Settled distance | Settling ticks | Fuel used | Plan hash before | Plan hash after |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
${speedRows}

## Evidence Files

- \`apps/weltraum-browser/evidence/autopilot-long-range-summary.json\`
- \`apps/weltraum-browser/evidence/autopilot-long-range-speed-profile-summary.json\`
- \`apps/weltraum-browser/evidence/autopilot-long-range-direct-1000m.png\`
- \`apps/weltraum-browser/evidence/autopilot-long-range-direct-2500m.png\`
- \`apps/weltraum-browser/evidence/autopilot-long-range-obstacle-course.png\`
- \`apps/weltraum-browser/evidence/autopilot-long-range-known-stress.png\`

## Guardrail Confirmation

- TestBridge is only used after loading \`/?testBridge=1\`; the companion test keeps the default URL hidden assertion.
- GLB gating waits for \`shipVisual.visualSource.state === "GLBLoaded"\` before runtime evidence is recorded.
- No snap: evidence records final distance and arrival phase from the deterministic course runner instead of mutating ship position in the E2E.
- No velocity-zero shortcut: evidence records first-arrival terminal speeds and separate post-arrival holding speeds; the E2E does not zero velocity.
- No silent replan: representative expected-pass and KnownStress rows require \`replanRequired === false\`; ExpectedFail rows must expose explicit invalidation/failure signals.
- Stable planHash: all representative rows and speed-profile comparison rows preserve \`planHashBefore\`, \`planHashAfter\` and \`completedPlanHash\` according to the runner invariant.
`;
}

async function runCourse(page: Page, request: CourseEvidenceRequest): Promise<CourseEvidenceResult> {
  return page.evaluate(({ id, profile, role }) => {
    const result = (window as any).TestBridge.runAutopilotProvingGroundCourse(id, profile);
    return { ...result, evidenceRole: role };
  }, request);
}

async function captureCourseScreenshot(page: Page, request: CourseEvidenceRequest, fileName: string): Promise<CourseEvidenceResult> {
  const result = await runCourse(page, request);
  await page.screenshot({ path: path.join(evidenceDir, fileName), fullPage: true });
  return result;
}

test("browser autopilot proving-ground v2 remains compatible with the expanded catalog", async ({ page }) => {
  await page.goto("/?testBridge=1");
  await page.waitForFunction(() => Boolean((window as any).TestBridge));
  const shipVisual = await waitForShipVisualReady(page);
  expect(shipVisual.visualSource.state).toBe("GLBLoaded");

  const courseIds: string[] = await page.evaluate(() => (window as any).TestBridge.listAutopilotProvingGroundCourses());
  expect(courseIds).toEqual(expect.arrayContaining([...baselineCourseIds]));
  expect(courseIds).toEqual(expect.arrayContaining([...expandedCatalogCourseIds]));
  expect(courseIds.length).toBeGreaterThanOrEqual(35);

  const baselineSmoke: CourseSmokeResult = await page.evaluate(() => (window as any).TestBridge.runAutopilotProvingGroundCourse("direct-long", "Balanced"));
  expect(baselineSmoke).toEqual(expect.objectContaining({ classification: "Pass", status: "Arrived", profile: "Balanced" }));
  expect(baselineSmoke.replanRequired).toBe(false);
  expect(stablePlanHashFor(baselineSmoke)).toBe(true);

  const expandedSmoke: CourseSmokeResult = await page.evaluate(() => (window as any).TestBridge.runAutopilotProvingGroundCourse("direct-very-long-stop", "Balanced"));
  expect(expandedSmoke).toEqual(expect.objectContaining({ classification: "Pass", status: "Arrived", profile: "Balanced", distanceMeters: 2_500 }));
  expect(expandedSmoke.replanRequired).toBe(false);
  expect(stablePlanHashFor(expandedSmoke)).toBe(true);

  await expect(page.getByTestId("ship-visual-source")).toContainText("Ship visual: Demo Scout GLB");
});

test("browser autopilot proving-ground v2 records long-range evidence", async ({ page }) => {
  await mkdir(evidenceDir, { recursive: true });
  await page.goto("/?testBridge=1");
  await page.waitForFunction(() => Boolean((window as any).TestBridge));
  const shipVisual = await waitForShipVisualReady(page);
  expect(shipVisual.visualSource.state).toBe("GLBLoaded");

  const courseIds: string[] = await page.evaluate(() => (window as any).TestBridge.listAutopilotProvingGroundCourses());
  expect(courseIds).toEqual(expect.arrayContaining([...baselineCourseIds]));
  expect(courseIds).toEqual(expect.arrayContaining([...expandedCatalogCourseIds]));
  expect(courseIds.length).toBeGreaterThanOrEqual(35);

  const representativeResults = await Promise.all(representativeRequests.map((request) => runCourse(page, request)));
  const speedComparison = await Promise.all(speedComparisonRequests.map((request) => runCourse(page, request)));

  const directMedium = representativeResults.find((result) => result.courseId === "direct-medium-stop");
  expect(directMedium).toEqual(expect.objectContaining({ classification: "Pass", profile: "Balanced", status: "Arrived", distanceMeters: 500 }));

  const directLongBalanced = speedComparison.find((result) => result.profile === "Balanced");
  const directLongSafe = speedComparison.find((result) => result.profile === "Safe");
  const directLongFast = speedComparison.find((result) => result.profile === "Fast");
  expect(directLongSafe).toEqual(expect.objectContaining({ classification: "Pass", status: "Arrived", distanceMeters: 2_500 }));
  expect(directLongBalanced).toEqual(expect.objectContaining({ classification: "Pass", status: "Arrived", distanceMeters: 2_500 }));
  expect(directLongFast).toEqual(expect.objectContaining({ classification: "Pass", status: "Arrived", distanceMeters: 2_500 }));
  expect(directLongBalanced?.simulatedSeconds).toBeLessThan(directLongSafe?.simulatedSeconds ?? Number.POSITIVE_INFINITY);
  expect(directLongFast?.simulatedSeconds).toBeLessThanOrEqual(directLongBalanced?.simulatedSeconds ?? Number.POSITIVE_INFINITY);
  expect(directLongSafe?.finalSpeed).toBeLessThanOrEqual(directLongSafe?.terminalSpeedLimit ?? 0.5);
  expect(directLongBalanced?.finalSpeed).toBeLessThanOrEqual(directLongBalanced?.terminalSpeedLimit ?? 0.5);
  expect(directLongFast?.finalSpeed).toBeLessThanOrEqual(directLongFast?.terminalSpeedLimit ?? 0.5);
  expect(directLongFast?.settledSpeed).toBeLessThanOrEqual(0.45);
  expect(directLongFast?.settledSpeed).toBeLessThanOrEqual(directLongFast?.finalSpeed ?? 0);
  expect(directLongFast?.settledDistance).toEqual(expect.any(Number));
  expect(directLongFast?.settlingTicks).toBe(30);

  const singleObstacle = representativeResults.find((result) => result.courseId === "single-blocking-obstacle-long");
  expect(singleObstacle).toEqual(expect.objectContaining({ classification: "Pass", status: "Arrived" }));

  const knownStress = representativeResults.find((result) => result.classification === "KnownStress");
  expect(knownStress?.courseId).toBe("narrow-corridor-long");
  expect(knownStress?.notes.join(" ")).toMatch(/KnownStress|one-blocking-obstacle|corridor/i);
  expect(knownStress?.status).toBe("Arrived");
  expect(knownStress?.replanRequired).toBe(false);
  expect(knownStress?.finalDistance).toBeLessThanOrEqual(3);
  expect(knownStress?.finalSpeed).toBeLessThanOrEqual(knownStress?.terminalSpeedLimit ?? 0.5);

  const expectedFailures = representativeResults.filter((result) => result.classification === "ExpectedFail");
  expect(expectedFailures.map((result) => result.courseId)).toEqual(expect.arrayContaining(["terminal-overspeed-disturbance", "off-route-fail-closed"]));
  expect(expectedFailures.every((result) => result.replanRequired || result.failureReasonCodes.length > 0 || result.invalidationReasons.length > 0 || result.status !== "Arrived")).toBe(true);
  expect(expectedFailures.every((result) => result.expectedOutcome === "ExpectedFail")).toBe(true);

  const invariantRows = [...representativeResults, ...speedComparison];
  expect(invariantRows.every(stablePlanHashFor)).toBe(true);
  expect(representativeResults.filter((result) => result.expectedOutcome !== "ExpectedFail").every((result) => result.replanRequired === false)).toBe(true);

  await expect(page.getByTestId("ship-visual-source")).toContainText("Ship visual: Demo Scout GLB");

  const successfulResults = representativeResults.filter((result) => result.status === "Arrived" && (result.classification === "Pass" || result.classification === "KnownStress"));
  const obstacleResults = representativeResults.filter((result) => result.minObstacleClearance < 999_999);
  const summary = {
    generatedAt: new Date().toISOString(),
    evidenceOwner: "apps/weltraum-browser/tests/e2e/autopilot-proving-ground-v2.spec.ts",
    evidenceTest: "browser autopilot proving-ground v2 records long-range evidence",
    catalogCourseCount: courseIds.length,
    testedCourseCount: representativeResults.length,
    classificationCounts: countClassifications(representativeResults),
    longestTestedDistanceMeters: Math.max(...representativeResults.map((result) => result.distanceMeters)),
    fastestSuccessfulCourse: findFastest(successfulResults),
    slowestSuccessfulCourse: findSlowest(successfulResults),
    fuelUsedRange: rangeFor(representativeResults, "fuelUsed"),
    minObstacleClearanceRange: rangeFor(representativeResults, "minObstacleClearance"),
    obstacleCourseMinClearanceRange: rangeFor(obstacleResults, "minObstacleClearance"),
    speedProfileComparison: speedComparison,
    currentPlannerLimits: plannerLimits,
    invariantConfirmation: {
      noSnap: "E2E only invokes the deterministic course runner and records finalDistance/arrivalPhase; it does not mutate position to target.",
      noVelocityZeroShortcut: "E2E records first-arrival finalSpeed, terminalSpeedLimit and separate settledSpeed from runtime results; it does not zero velocity.",
      noSilentReplan: representativeResults.filter((result) => result.expectedOutcome !== "ExpectedFail").every((result) => result.replanRequired === false),
      stablePlanHash: invariantRows.every(stablePlanHashFor)
    },
    representativeResults
  };

  await writeFile(path.join(evidenceDir, "autopilot-long-range-summary.json"), JSON.stringify(summary, null, 2), "utf8");
  await writeFile(path.join(evidenceDir, "autopilot-long-range-speed-profile-summary.json"), JSON.stringify({ evidenceOwner: summary.evidenceOwner, evidenceTest: summary.evidenceTest, speedComparison, plannerLimits }, null, 2), "utf8");
  await writeFile(path.join(evidenceDir, "browser-autopilot-long-range-testfield-v1.md"), createMarkdown(summary, representativeResults, speedComparison), "utf8");

  await captureCourseScreenshot(page, { id: "direct-long-stop", profile: "Balanced", role: "1000m direct screenshot" }, "autopilot-long-range-direct-1000m.png");
  await captureCourseScreenshot(page, { id: "direct-very-long-stop", profile: "Balanced", role: "2500m direct screenshot" }, "autopilot-long-range-direct-2500m.png");
  await captureCourseScreenshot(page, { id: "single-blocking-obstacle-long", profile: "Balanced", role: "single obstacle screenshot" }, "autopilot-long-range-obstacle-course.png");
  await captureCourseScreenshot(page, { id: "narrow-corridor-long", profile: "Balanced", role: "KnownStress screenshot" }, "autopilot-long-range-known-stress.png");
});

test("product bootstrap still hides TestBridge by default", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await expect.poll(() => page.evaluate(() => "TestBridge" in window)).toBe(false);
  await expect(page.getByTestId("basic-hud")).not.toContainText("TestBridge");
});
