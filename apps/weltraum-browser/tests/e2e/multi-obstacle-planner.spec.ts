import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ciTimeout } from "./support/ciTiming";

const evidenceDir = path.resolve(process.cwd(), "evidence");

type Classification = "Pass" | "KnownStress" | "ExpectedFail" | "Fail";
type SpeedProfile = "Safe" | "Balanced" | "Fast";

interface MultiObstacleCourseRequest {
  readonly id: string;
  readonly profile: SpeedProfile;
  readonly role: string;
  readonly expectedClassification: Classification;
  readonly maxSegments: number;
  readonly reclassificationReason: string;
}

interface MultiObstacleCourseResult {
  readonly courseId: string;
  readonly label: string;
  readonly category: string;
  readonly catalogSpeedProfile: SpeedProfile;
  readonly profile: SpeedProfile;
  readonly expectedOutcome: "Pass" | "KnownStress" | "ExpectedFail";
  readonly ticksToArrival: number | null;
  readonly tick: number;
  readonly simulatedSeconds: number;
  readonly distanceMeters: number;
  readonly finalSpeed: number;
  readonly finalDistance: number;
  readonly settledSpeed: number;
  readonly settledDistance: number;
  readonly minObstacleClearance: number;
  readonly status: string;
  readonly terminalSpeedLimit: number | null;
  readonly planHashBefore: string | null;
  readonly planHashAfter: string | null;
  readonly completedPlanHash: string | null;
  readonly replanRequired: boolean;
  readonly classification: Classification;
  readonly notes: readonly string[];
  readonly planner: string | null;
  readonly segmentKinds: readonly string[];
  readonly failureReasonCodes: readonly string[];
  readonly invalidationReasons: readonly string[];
  readonly evidenceRole: string;
  readonly expectedClassification: Classification;
  readonly maxSegments: number;
  readonly reclassificationReason: string;
}

const targetRequests: readonly MultiObstacleCourseRequest[] = [
  {
    id: "s-curve-obstacles",
    profile: "Balanced",
    role: "short S-curve reclassification",
    expectedClassification: "Pass",
    maxSegments: 5,
    reclassificationReason: "Pass because final distance, terminal speed, no-replan, and planHash hard gates pass."
  },
  {
    id: "s-curve-obstacles-long",
    profile: "Balanced",
    role: "long S-curve reclassification",
    expectedClassification: "Pass",
    maxSegments: 6,
    reclassificationReason: "Pass because the long S-curve keeps the locked plan stable through arrival."
  },
  {
    id: "narrow-corridor",
    profile: "Balanced",
    role: "short corridor reclassification",
    expectedClassification: "Pass",
    maxSegments: 5,
    reclassificationReason: "Pass because corridor terminal capture succeeds without silent replan."
  },
  {
    id: "narrow-corridor-long",
    profile: "Balanced",
    role: "long corridor reclassification",
    expectedClassification: "Pass",
    maxSegments: 6,
    reclassificationReason: "Pass because the long corridor satisfies hard gates under the new planner."
  },
  {
    id: "corridor-safe",
    profile: "Safe",
    role: "Safe profile corridor reclassification",
    expectedClassification: "Pass",
    maxSegments: 6,
    reclassificationReason: "Pass because the Safe corridor row keeps terminal capture strict."
  },
  {
    id: "corridor-balanced",
    profile: "Balanced",
    role: "Balanced profile corridor reclassification",
    expectedClassification: "Pass",
    maxSegments: 6,
    reclassificationReason: "Pass because the Balanced corridor row keeps terminal capture strict."
  },
  {
    id: "multi-rock-field-1000m",
    profile: "Balanced",
    role: "1000m dense field reclassification",
    expectedClassification: "Pass",
    maxSegments: 6,
    reclassificationReason: "Pass because the 1000m dense field chains a bounded multi-segment route without hard gate violations."
  },
  {
    id: "multi-rock-field-2500m",
    profile: "Balanced",
    role: "2500m dense field terminal-execution proof",
    expectedClassification: "Pass",
    maxSegments: 8,
    reclassificationReason: "Pass because bounded long-terminal approach control reaches the strict capture gates without replan or plan replacement."
  },
  {
    id: "unsolvable-blocked-corridor-negative",
    profile: "Balanced",
    role: "blocked corridor negative",
    expectedClassification: "ExpectedFail",
    maxSegments: 0,
    reclassificationReason: "ExpectedFail because the target envelope is sealed by obstacle geometry and planning rejects closed."
  }
];

async function waitForShipVisualReady(page: Page) {
  await page.waitForFunction(() => {
    const snapshot = (window as any).TestBridge?.getRenderSnapshot?.();
    return snapshot?.shipVisual?.visualSource?.state && snapshot.shipVisual.visualSource.state !== "Loading";
  });
  return page.evaluate(() => (window as any).TestBridge.getRenderSnapshot().shipVisual);
}

function stablePlanHashFor(result: Pick<MultiObstacleCourseResult, "planHashBefore" | "planHashAfter" | "completedPlanHash">): boolean {
  if (result.planHashBefore === null) {
    return result.planHashAfter === null && result.completedPlanHash === null;
  }

  return result.planHashAfter === result.planHashBefore && (result.completedPlanHash === null || result.completedPlanHash === result.planHashBefore);
}

function countClassifications(results: readonly MultiObstacleCourseResult[]): Record<Classification, number> {
  const counts: Record<Classification, number> = { Pass: 0, KnownStress: 0, ExpectedFail: 0, Fail: 0 };
  for (const result of results) {
    counts[result.classification] += 1;
  }
  return counts;
}

function hardGatePasses(result: MultiObstacleCourseResult): boolean {
  return (
    result.status === "Arrived" &&
    result.finalDistance <= 3 &&
    result.finalSpeed <= (result.terminalSpeedLimit ?? 0.5) + 1e-6 &&
    result.finalSpeed > 0 &&
    result.replanRequired === false &&
    stablePlanHashFor(result)
  );
}

async function runCourse(page: Page, request: MultiObstacleCourseRequest): Promise<MultiObstacleCourseResult> {
  return page.evaluate(({ id, profile, role, expectedClassification, maxSegments, reclassificationReason }) => {
    const result = (window as any).TestBridge.runAutopilotProvingGroundCourse(id, profile);
    return { ...result, evidenceRole: role, expectedClassification, maxSegments, reclassificationReason };
  }, request);
}

function formatResultLine(result: MultiObstacleCourseResult): string {
  return `| ${result.courseId} | ${result.profile} | ${result.classification} | ${result.status} | ${result.segmentKinds.length}/${result.maxSegments} | ${result.finalSpeed} | ${result.finalDistance} | ${result.minObstacleClearance} | ${result.replanRequired} | ${result.planHashBefore ?? "null"} | ${result.planHashAfter ?? "null"} | ${result.failureReasonCodes.join(", ") || "-"} | ${result.invalidationReasons.join(", ") || "-"} | ${result.reclassificationReason} |`;
}

function createMarkdown(summary: Record<string, unknown>, results: readonly MultiObstacleCourseResult[]): string {
  return `# Browser Multi-Obstacle Route Planner v1 Evidence

Generated by \`apps/weltraum-browser/tests/e2e/multi-obstacle-planner.spec.ts\` through the query-gated browser TestBridge.

## Summary

\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\`

## Course Results

| Course | Profile | Classification | Status | Segments/max | Final speed | Final distance | Min clearance | Replan required | Plan hash before | Plan hash after | Failure codes | Invalidation codes | Classification reason |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- |
${results.map(formatResultLine).join("\n")}

## Guardrail Confirmation

- TestBridge is only used after loading \`/?testBridge=1\`; this spec also verifies the default product URL keeps \`window.TestBridge\` hidden.
- No snap: results record the runner's final distance and arrival status; the E2E does not mutate ship position.
- No velocity-zero shortcut: pass rows must report a positive non-zero final speed within the terminal-speed limit.
- No silent replan: every Pass row requires \`replanRequired === false\`; ExpectedFail rows must expose explicit failure or invalidation signals.
- Stable planHash: Pass rows preserve \`planHashBefore\`, \`planHashAfter\`, and \`completedPlanHash\`; planning-rejected rows keep hashes null.
`;
}

test("multi-obstacle TestBridge remains query gated", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await expect.poll(() => page.evaluate(() => Reflect.has(window, "TestBridge"))).toBe(false);
  await expect(page.getByTestId("basic-hud")).not.toContainText("TestBridge");
});

test("browser multi-obstacle planner records course evidence", async ({ page }) => {
  test.setTimeout(ciTimeout(30_000, 90_000));
  await mkdir(evidenceDir, { recursive: true });
  await page.goto("/?testBridge=1");
  await page.waitForFunction(() => Reflect.has(window, "TestBridge"));
  const shipVisual = await waitForShipVisualReady(page);
  expect(shipVisual.visualSource.state).toBe("GLBLoaded");

  const courseIds: string[] = await page.evaluate(() => (window as any).TestBridge.listAutopilotProvingGroundCourses());
  expect(courseIds).toEqual(expect.arrayContaining(targetRequests.map((request) => request.id)));
  expect(courseIds.length).toBeGreaterThanOrEqual(38);

  const results = await Promise.all(targetRequests.map((request) => runCourse(page, request)));
  const passRows = results.filter((result) => result.expectedClassification === "Pass");
  const expectedFailRows = results.filter((result) => result.expectedClassification === "ExpectedFail");

  for (const result of results) {
    expect(result.classification, result.courseId).toBe(result.expectedClassification);
    expect(result.segmentKinds.length, result.courseId).toBeLessThanOrEqual(result.maxSegments);
    expect(stablePlanHashFor(result), result.courseId).toBe(true);
  }

  for (const result of passRows) {
    expect(hardGatePasses(result), result.courseId).toBe(true);
    expect(result.expectedOutcome, result.courseId).toBe("Pass");
    expect(result.failureReasonCodes, result.courseId).toEqual([]);
    expect(result.invalidationReasons, result.courseId).toEqual([]);
  }

  const remainingExpectedFailIds = expectedFailRows.map((result) => result.courseId);
  expect(remainingExpectedFailIds).toEqual(["unsolvable-blocked-corridor-negative"]);
  expect(expectedFailRows.every((result) => result.expectedOutcome === "ExpectedFail")).toBe(true);
  expect(expectedFailRows.every((result) => result.replanRequired || result.failureReasonCodes.length > 0 || result.invalidationReasons.length > 0 || result.status !== "Arrived")).toBe(true);
  expect(results.find((result) => result.courseId === "multi-rock-field-2500m")?.status).toBe("Arrived");
  expect(results.find((result) => result.courseId === "unsolvable-blocked-corridor-negative")?.status).toBe("PlanningRejected");
  expect(results.find((result) => result.courseId === "unsolvable-blocked-corridor-negative")?.failureReasonCodes).toContain("UnsafeObstacle");

  await expect(page.getByTestId("ship-visual-source")).toContainText("Ship visual: Demo Scout GLB");

  const summary = {
    generatedAt: new Date().toISOString(),
    evidenceOwner: "apps/weltraum-browser/tests/e2e/multi-obstacle-planner.spec.ts",
    evidenceTest: "browser multi-obstacle planner records course evidence",
    catalogCourseCount: courseIds.length,
    testedCourseCount: results.length,
    classificationCounts: countClassifications(results),
    solvedCourses: passRows.map((result) => result.courseId),
    remainingKnownStressOrExpectedFail: results
      .filter((result) => result.classification === "KnownStress" || result.classification === "ExpectedFail")
      .map((result) => ({
        courseId: result.courseId,
        classification: result.classification,
        status: result.status,
        reasonCodes: [...new Set([...result.failureReasonCodes, ...result.invalidationReasons])],
        reason: result.reclassificationReason
      })),
    reclassificationReasons: Object.fromEntries(results.map((result) => [result.courseId, result.reclassificationReason])),
    routeSegmentCounts: Object.fromEntries(results.map((result) => [result.courseId, { count: result.segmentKinds.length, kinds: result.segmentKinds, max: result.maxSegments }])),
    planHashStability: Object.fromEntries(results.map((result) => [result.courseId, stablePlanHashFor(result)])),
    invariantConfirmation: {
      finalDistance: passRows.every((result) => result.finalDistance <= 3),
      terminalSpeed: passRows.every((result) => result.finalSpeed <= (result.terminalSpeedLimit ?? 0.5) + 1e-6),
      noSnap: "E2E records finalDistance from TestBridge runner and does not mutate positions.",
      noVelocityZeroShortcut: passRows.every((result) => result.finalSpeed > 0),
      noSilentReplan: passRows.every((result) => result.replanRequired === false),
      planHashStable: results.every(stablePlanHashFor)
    },
    results
  };

  await writeFile(path.join(evidenceDir, "browser-multi-obstacle-route-planner-v1-summary.json"), JSON.stringify(summary, null, 2), "utf8");
  await writeFile(path.join(evidenceDir, "browser-multi-obstacle-route-planner-v1.md"), createMarkdown(summary, results), "utf8");
});
