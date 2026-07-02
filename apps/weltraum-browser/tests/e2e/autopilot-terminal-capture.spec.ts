import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const speedOf = (telemetry: any): number => Math.hypot(telemetry.ship.velocity.x, telemetry.ship.velocity.y, telemetry.ship.velocity.z);

async function waitForBridge(page: Page) {
  await page.goto("/?testBridge=1");
  await page.waitForFunction(() => Boolean((window as any).TestBridge));
  await page.waitForFunction(() => {
    const snapshot = (window as any).TestBridge?.getRenderSnapshot?.();
    return snapshot?.shipVisual?.visualSource?.state && snapshot.shipVisual.visualSource.state !== "Loading";
  });
}

async function stepUntil(page: Page, predicateSource: string, maxSteps: number) {
  return page.evaluate(
    ({ predicateSource: source, maxSteps: limit }) => {
      const predicate = new Function("telemetry", `return (${source})(telemetry);`) as (telemetry: any) => boolean;
      let current = (window as any).TestBridge.getTelemetry();
      for (let i = 0; i < limit && !predicate(current); i += 1) {
        current = (window as any).TestBridge.step(1);
      }
      return current;
    },
    { predicateSource, maxSteps }
  );
}

test("default navigation target terminal capture brakes, captures, and holds without snapping", async ({ page }) => {
  await waitForBridge(page);
  const initialVisual = await page.evaluate(() => (window as any).TestBridge.getRenderSnapshot().shipVisual);
  expect(initialVisual.visualSource.state).toBe("GLBLoaded");

  await page.locator('[data-target-id="nav-beta"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().selectedTarget?.id)).toBe("nav-beta");
  const preview = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
  expect(preview.selectedTarget.arrivalEnvelope).toEqual({ radius: 3, terminalSpeed: 0.5, stopBehavior: "StopWithinEnvelope" });

  await page.evaluate(() => (window as any).TestBridge.dispatchCommand({ type: "EngageAutopilot", planner: "DirectLocal" }));
  const engaged = await page.evaluate(() => (window as any).TestBridge.getTelemetry());
  const planHash = engaged.executor.planHash;
  expect(planHash).toMatch(/^[a-f0-9]{8}$/);

  const terminalBrake = await stepUntil(
    page,
    `(telemetry) => telemetry.executor.arrivalPhase === "TerminalBrake" && telemetry.executor.currentSpeed > telemetry.executor.terminalSpeedLimit`,
    1_200
  );
  expect(terminalBrake.executor.arrivalPhase).toBe("TerminalBrake");
  expect(terminalBrake.executor.planHash).toBe(planHash);
  expect(terminalBrake.executor.terminalSpeedLimit).toBeLessThanOrEqual(0.5);
  expect(terminalBrake.executor.currentSpeed).toBeGreaterThan(terminalBrake.executor.terminalSpeedLimit);
  expect(terminalBrake.ship.actuatorTelemetry.mainThrustActive).toBe(true);

  const evidenceDir = path.resolve(process.cwd(), "evidence");
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDir, "autopilot-terminal-brake.png"), fullPage: true });

  const capture = await stepUntil(
    page,
    `(telemetry) => telemetry.executor.arrivalPhase === "Capture" && telemetry.executor.status === "Executing" && telemetry.executor.distanceToTarget <= telemetry.lockedPlan.target.arrivalEnvelope.radius && telemetry.executor.currentSpeed > telemetry.executor.terminalSpeedLimit`,
    1_200
  );
  expect(capture.executor.status).toBe("Executing");
  expect(capture.executor.arrivalPhase).toBe("Capture");
  expect(capture.executor.planHash).toBe(planHash);
  expect(capture.executor.distanceToTarget).toBeLessThanOrEqual(capture.lockedPlan.target.arrivalEnvelope.radius);
  expect(capture.executor.currentSpeed).toBeGreaterThan(capture.executor.terminalSpeedLimit);
  expect(capture.executor.terminalCaptureActive).toBe(true);
  expect(capture.ship.position).not.toEqual(capture.lockedPlan.target.position);
  await page.screenshot({ path: path.join(evidenceDir, "autopilot-terminal-capture.png"), fullPage: true });

  const holding = await stepUntil(
    page,
    `(telemetry) => telemetry.executor.status === "Arrived" && telemetry.executor.arrivalPhase === "Holding" && telemetry.executor.currentSpeed <= telemetry.executor.terminalSpeedLimit`,
    1_800
  );
  expect(holding.executor.status).toBe("Arrived");
  expect(holding.executor.arrivalPhase).toBe("Holding");
  expect(holding.executor.terminalHoldingActive).toBe(true);
  expect(holding.executor.planHash).toBeNull();
  expect(holding.executor.completedPlanHash).toBe(planHash);
  expect(holding.executor.canAcceptNewPlan).toBe(true);
  expect(holding.executor.canSelectNewTarget).toBe(true);
  expect(holding.lockedPlan).toBeNull();
  expect(holding.executor.distanceToTarget).toBeLessThanOrEqual(holding.selectedTarget.arrivalEnvelope.radius);
  expect(speedOf(holding)).toBeLessThanOrEqual(0.500001);
  expect(holding.ship.position).not.toEqual(holding.selectedTarget.position);
  expect(holding.executor.desiredTerminalVelocity).toEqual({ x: 0, y: 0, z: 0 });

  const afterHold = await page.evaluate(() => (window as any).TestBridge.step(5));
  expect(afterHold.executor.status).toBe("Arrived");
  expect(afterHold.executor.arrivalPhase).toBe("Holding");
  expect(afterHold.executor.planHash).toBeNull();
  expect(afterHold.executor.completedPlanHash).toBe(planHash);
  expect(afterHold.ship.position).not.toEqual(holding.ship.position);
  expect(afterHold.ship.position).not.toEqual(afterHold.selectedTarget.position);
  expect(afterHold.selectedTarget.position).toEqual(holding.selectedTarget.position);

  const renderSnapshot = await page.evaluate(() => (window as any).TestBridge.getRenderSnapshot());
  expect(renderSnapshot.shipVisual.visualSource.state).toBe("GLBLoaded");
  expect(renderSnapshot.targetPosition).toEqual(holding.selectedTarget.position);
  expect(renderSnapshot.shipPosition).not.toEqual(holding.selectedTarget.position);
  expect(renderSnapshot.planHash).toBeNull();
  expect(renderSnapshot.usesInterpolatedPose).toBe(true);
  await page.screenshot({ path: path.join(evidenceDir, "autopilot-terminal-hold.png"), fullPage: true });

  await writeFile(
    path.join(evidenceDir, "autopilot-terminal-capture-telemetry.json"),
    JSON.stringify({ engaged, terminalBrake, capture, holding, afterHold, renderSnapshot }, null, 2),
    "utf8"
  );
});
