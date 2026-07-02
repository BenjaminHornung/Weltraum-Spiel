import { expect, test, type Page } from "@playwright/test";

type SpeedProfile = "Safe" | "Balanced" | "Fast";

interface CourseSmokeResult {
  readonly classification: "Pass" | "KnownStress" | "ExpectedFail" | "Fail";
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
