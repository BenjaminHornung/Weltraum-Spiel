import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const evidenceDir = path.resolve(process.cwd(), "evidence");

async function waitForShipVisualReady(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => {
    const snapshot = (window as any).TestBridge?.getRenderSnapshot?.();
    return snapshot?.shipVisual?.visualSource?.state && snapshot.shipVisual.visualSource.state !== "Loading";
  });
  return page.evaluate(() => (window as any).TestBridge.getRenderSnapshot().shipVisual);
}

test("browser autopilot proving-ground v2 runs catalog courses and records evidence", async ({ page }) => {
  await mkdir(evidenceDir, { recursive: true });
  await page.goto("/?testBridge=1");
  await page.waitForFunction(() => Boolean((window as any).TestBridge));
  const shipVisual = await waitForShipVisualReady(page);
  expect(shipVisual.visualSource.state).toBe("GLBLoaded");

  const courseIds = await page.evaluate(() => (window as any).TestBridge.listAutopilotProvingGroundCourses());
  expect(courseIds).toEqual([
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
  ]);

  const selectedResults = await page.evaluate(() => {
    const bridge = (window as any).TestBridge;
    return ["direct-long", "s-curve-obstacles", "narrow-corridor", "offset-gates", "target-behind-obstacle"].map((id) =>
      bridge.runAutopilotProvingGroundCourse(id, "Balanced")
    );
  });
  expect(selectedResults).toHaveLength(5);
  expect(selectedResults.every((result: any) => result.planHashBefore === result.planHashAfter || result.planHashBefore === null)).toBe(true);
  expect(selectedResults.every((result: any) => ["Pass", "KnownStress", "ExpectedFail"].includes(result.classification))).toBe(true);

  const directLong = selectedResults.find((result: any) => result.courseId === "direct-long");
  expect(directLong).toEqual(expect.objectContaining({ classification: "Pass", status: "Arrived", profile: "Balanced" }));
  expect(directLong.ticksToArrival).toEqual(expect.any(Number));
  expect(directLong.finalSpeed).toBeLessThanOrEqual(directLong.terminalSpeedLimit ?? 0.5);
  expect(directLong.replanRequired).toBe(false);

  const stress = selectedResults.find((result: any) => result.courseId === "s-curve-obstacles" || result.courseId === "narrow-corridor");
  expect(stress?.classification).toBe("KnownStress");
  expect(stress?.notes.join(" ")).toMatch(/one-obstacle|first blocking obstacle/);

  const speedComparison = await page.evaluate(() => {
    const bridge = (window as any).TestBridge;
    return {
      safe: bridge.runAutopilotProvingGroundCourse("direct-long", "Safe"),
      balanced: bridge.runAutopilotProvingGroundCourse("direct-long", "Balanced")
    };
  });
  expect(speedComparison.safe.classification).toBe("Pass");
  expect(speedComparison.balanced.classification).toBe("Pass");
  expect(speedComparison.balanced.ticksToArrival).toBeLessThan(speedComparison.safe.ticksToArrival);
  expect(speedComparison.balanced.peakSpeed).toBeGreaterThan(speedComparison.safe.peakSpeed);
  expect(speedComparison.balanced.finalSpeed).toBeLessThanOrEqual(0.5);

  await expect(page.getByTestId("ship-visual-source")).toContainText("Ship visual: Demo Scout GLB");
  await page.screenshot({ path: path.join(evidenceDir, "autopilot-proving-ground-v2-direct-long.png"), fullPage: true });
  await page.evaluate(() => (window as any).TestBridge.runAutopilotProvingGroundCourse("narrow-corridor", "Balanced"));
  await page.screenshot({ path: path.join(evidenceDir, "autopilot-proving-ground-v2-corridor.png"), fullPage: true });
  await page.evaluate(() => (window as any).TestBridge.runAutopilotProvingGroundCourse("direct-long", "Safe"));
  await page.screenshot({ path: path.join(evidenceDir, "autopilot-proving-ground-v2-speed-profile.png"), fullPage: true });

  const matrix = await page.evaluate(() => (window as any).TestBridge.runAutopilotProvingGroundMatrix("Balanced"));
  await writeFile(path.join(evidenceDir, "autopilot-proving-ground-v2-summary.json"), JSON.stringify({ selectedResults, speedComparison, matrix }, null, 2), "utf8");
});

test("product bootstrap still hides TestBridge by default", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await expect.poll(() => page.evaluate(() => "TestBridge" in window)).toBe(false);
  await expect(page.getByTestId("basic-hud")).not.toContainText("TestBridge");
});
