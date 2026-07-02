import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

async function waitForBridge(page: Page) {
  await page.goto("/?testBridge=1");
  await page.waitForFunction(() => Boolean((window as any).TestBridge));
  await page.waitForFunction(() => {
    const snapshot = (window as any).TestBridge?.getRenderSnapshot?.();
    return snapshot?.shipVisual?.visualSource?.state && snapshot.shipVisual.visualSource.state !== "Loading";
  });
}

const renderedShipFrameJumpThreshold = 2;
const cameraFrameJumpThreshold = 10;

test("completed terminal holding accepts a new route while active routes still block replacement and render uses interpolated pose", async ({ page }) => {
  await waitForBridge(page);
  const evidenceDir = path.resolve(process.cwd(), "evidence");
  await mkdir(evidenceDir, { recursive: true });

  await page.locator('[data-target-id="nav-beta"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().selectedTarget?.id)).toBe("nav-beta");
  await page.evaluate(() => (window as any).TestBridge.dispatchCommand({ type: "EngageAutopilot", planner: "DirectLocal" }));
  const engaged = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
  const firstPlanHash = engaged.executor.planHash;
  expect(firstPlanHash).toMatch(/^[a-f0-9]{8}$/);

  const holding = await page.evaluate(() => {
    let current = (window as any).TestBridge.getTelemetry();
    for (let i = 0; i < 1_800 && !current.executor.stationKeepingActive; i += 1) {
      current = (window as any).TestBridge.step(1);
    }
    return current;
  });

  expect(holding.executor.status).toBe("Arrived");
  expect(holding.executor.routeLifecycle).toBe("Holding");
  expect(holding.executor.planHash).toBeNull();
  expect(holding.executor.completedPlanHash).toBe(firstPlanHash);
  expect(holding.executor.canAcceptNewPlan).toBe(true);
  expect(holding.executor.canSelectNewTarget).toBe(true);
  expect(holding.lockedPlan).toBeNull();

  await page.locator('[data-target-id="nav-alpha"]').click();
  const selectedAfterHolding = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
  expect(selectedAfterHolding.selectedTarget?.id).toBe("nav-alpha");
  await page.locator("#engage-autopilot").click();
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().lockedPlan?.target.id)).toBe("nav-alpha");
  const newRoute = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
  expect(newRoute.executor.status).toBe("Executing");
  expect(newRoute.executor.planHash).toMatch(/^[a-f0-9]{8}$/);
  expect(newRoute.executor.planHash).not.toBe(firstPlanHash);
  expect(newRoute.executor.completedPlanHash).toBe(firstPlanHash);
  expect(newRoute.executor.canAcceptNewPlan).toBe(false);
  expect(newRoute.executor.canSelectNewTarget).toBe(false);

  await page.locator('[data-target-id="nav-beta"]').click();
  const blockedSelect = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
  expect(blockedSelect.executor.planHash).toBe(newRoute.executor.planHash);
  expect(blockedSelect.selectedTarget?.id).toBe("nav-alpha");
  expect(blockedSelect.runtimeMessage).toContain("Cancel the current autopilot route");
  await page.evaluate(() => (window as any).TestBridge.dispatchCommand({ type: "EngageAutopilot", planner: "DirectLocal" }));
  const blockedEngage = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
  expect(blockedEngage.executor.planHash).toBe(newRoute.executor.planHash);
  expect(blockedEngage.lockedPlan?.target.id).toBe("nav-alpha");

  await page.waitForFunction(() => {
    const snapshot = (window as any).TestBridge.getRenderSnapshot?.();
    return snapshot?.usesInterpolatedPose === true && snapshot.interpolationAlpha > 0 && snapshot.interpolationAlpha < 1 && snapshot.cameraSmoothingAlpha > 0;
  });
  const renderSnapshot = await page.evaluate(() => (window as any).TestBridge.getRenderSnapshot());
  expect(renderSnapshot.renderedShipPosition).toEqual(renderSnapshot.shipPosition);
  expect(renderSnapshot.renderedShipPosition).not.toEqual(renderSnapshot.truthShipPosition);
  expect(Math.hypot(
    renderSnapshot.truthShipPosition.x - renderSnapshot.renderedShipPosition.x,
    renderSnapshot.truthShipPosition.y - renderSnapshot.renderedShipPosition.y,
    renderSnapshot.truthShipPosition.z - renderSnapshot.renderedShipPosition.z
  )).toBeLessThan(3);
  expect(renderSnapshot.cameraSmoothingAlpha).toBeGreaterThan(0);
  expect(renderSnapshot.cameraSmoothingAlpha).toBeLessThan(1);
  expect(renderSnapshot.camera.mode).toBe("ChaseLocked");

  const frameJumpSample = await page.evaluate(async () => {
    const distanceBetween = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    const waitForNextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const samples: Array<{
      readonly executorStatus: string;
      readonly interpolationAlpha: number;
      readonly fixedStepCountThisFrame: number;
      readonly frameDeltaSeconds: number;
      readonly renderedShipPosition: { readonly x: number; readonly y: number; readonly z: number };
      readonly cameraPosition: { readonly x: number; readonly y: number; readonly z: number };
    }> = [];

    for (let i = 0; i < 12; i += 1) {
      await waitForNextFrame();
    }

    for (let i = 0; i < 32; i += 1) {
      await waitForNextFrame();
      const snapshot = (window as any).TestBridge.getRenderSnapshot();
      if (snapshot?.executorStatus === "Executing" && snapshot.usesInterpolatedPose === true && snapshot.camera?.position) {
        samples.push({
          executorStatus: snapshot.executorStatus,
          interpolationAlpha: snapshot.interpolationAlpha,
          fixedStepCountThisFrame: snapshot.fixedStepCountThisFrame,
          frameDeltaSeconds: snapshot.frameDeltaSeconds,
          renderedShipPosition: { ...snapshot.renderedShipPosition },
          cameraPosition: { ...snapshot.camera.position }
        });
      }
    }

    const consecutiveJumps = samples.slice(1).map((sample, index) => {
      const previous = samples[index];
      return {
        renderedShipJump: distanceBetween(sample.renderedShipPosition, previous.renderedShipPosition),
        cameraJump: distanceBetween(sample.cameraPosition, previous.cameraPosition)
      };
    });

    return {
      sampleCount: samples.length,
      maxRenderedShipJump: Math.max(0, ...consecutiveJumps.map((sample) => sample.renderedShipJump)),
      maxCameraJump: Math.max(0, ...consecutiveJumps.map((sample) => sample.cameraJump)),
      samples: samples.slice(0, 12),
      consecutiveJumps: consecutiveJumps.slice(0, 12)
    };
  });

  expect(frameJumpSample.sampleCount).toBeGreaterThanOrEqual(12);
  expect(Number.isFinite(frameJumpSample.maxRenderedShipJump)).toBe(true);
  expect(Number.isFinite(frameJumpSample.maxCameraJump)).toBe(true);
  expect(frameJumpSample.maxRenderedShipJump).toBeGreaterThan(0);
  expect(frameJumpSample.maxRenderedShipJump).toBeLessThanOrEqual(renderedShipFrameJumpThreshold);
  expect(frameJumpSample.maxCameraJump).toBeLessThanOrEqual(cameraFrameJumpThreshold);

  await page.screenshot({ path: path.join(evidenceDir, "render-smoothing-chasecam.png"), fullPage: true });
  await writeFile(
    path.join(evidenceDir, "autopilot-lifecycle-new-route-after-arrival.json"),
    JSON.stringify({ engaged, holding, selectedAfterHolding, newRoute, blockedSelect, blockedEngage }, null, 2),
    "utf8"
  );
  await writeFile(
    path.join(evidenceDir, "render-smoothing-sample.json"),
    JSON.stringify({
      renderSnapshot,
      frameJumpThresholds: {
        renderedShipFrameJumpThreshold,
        cameraFrameJumpThreshold
      },
      frameJumpSample
    }, null, 2),
    "utf8"
  );
});
