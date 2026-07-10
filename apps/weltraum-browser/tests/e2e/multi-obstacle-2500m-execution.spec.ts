import { expect, test } from "@playwright/test";

interface CourseResult {
  readonly courseId: string;
  readonly classification: string;
  readonly status: string;
  readonly finalDistance: number;
  readonly finalSpeed: number;
  readonly terminalSpeedLimit: number | null;
  readonly minObstacleClearance: number;
  readonly replanRequired: boolean;
  readonly planHashBefore: string | null;
  readonly planHashAfter: string | null;
  readonly completedPlanHash: string | null;
  readonly failureReasonCodes: readonly string[];
  readonly invalidationReasons: readonly string[];
}

test("keeps TestBridge absent from the normal product URL", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });

  await expect.poll(() => page.evaluate(() => Reflect.has(window, "TestBridge"))).toBe(false);
});

test("executes the 2500m multi-obstacle route through the query-gated TestBridge", async ({ page }) => {
  await page.goto("/?testBridge=1");
  await page.waitForFunction(() => Reflect.has(window, "TestBridge"));

  const result = await page.evaluate(() =>
    (window as typeof window & {
      TestBridge: { runAutopilotProvingGroundCourse: (id: string, profile: string) => CourseResult };
    }).TestBridge.runAutopilotProvingGroundCourse("multi-rock-field-2500m", "Balanced")
  );

  expect(result.courseId).toBe("multi-rock-field-2500m");
  expect(result.classification).toBe("Pass");
  expect(result.status).toBe("Arrived");
  expect(result.finalDistance).toBeLessThanOrEqual(3);
  expect(result.finalSpeed).toBeLessThanOrEqual(result.terminalSpeedLimit ?? 0.5);
  expect(result.minObstacleClearance).toBeGreaterThan(0);
  expect(result.replanRequired).toBe(false);
  expect(result.planHashBefore).not.toBeNull();
  expect(result.planHashAfter).toBe(result.planHashBefore);
  expect(result.completedPlanHash).toBe(result.planHashBefore);
  expect(result.failureReasonCodes).toEqual([]);
  expect(result.invalidationReasons).toEqual([]);
});
