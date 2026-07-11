import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const evidenceDir = path.resolve(process.cwd(), "evidence");

const liveTargets = [
  { targetId: "range-500m", label: "Range 500m", minMeters: 490, maxMeters: 830, distanceUnit: "m", radarBucket: "auto range 1.0 km" },
  { targetId: "range-1000m", label: "Range 1000m", minMeters: 995, maxMeters: 1_420, distanceUnit: "km", radarBucket: "auto range 1.0 km" },
  { targetId: "range-2500m", label: "Range 2500m", minMeters: 2_495, maxMeters: 3_200, distanceUnit: "km", radarBucket: "auto range 2.5 km" }
] as const;

test.use(
  process.env.CI
    ? { screenshot: "only-on-failure", trace: "retain-on-failure" }
    : { screenshot: "off", trace: "off" }
);

interface TargetPreviewEvidence {
  readonly targetId: string;
  readonly label: string;
  readonly selectedTarget: string;
  readonly hudDistanceDisplay: string;
  readonly hudDistanceMeters: number;
  readonly routeStatus: string;
  readonly radarStatus: string;
}

interface LiveFlightEvidence {
  readonly selectedTarget: string;
  readonly previewDistanceDisplay: string;
  readonly previewDistanceMeters: number;
  readonly initialDistanceDisplay: string;
  readonly initialDistanceMeters: number;
  readonly laterDistanceDisplay: string;
  readonly laterDistanceMeters: number;
  readonly finalDistanceDisplay: string;
  readonly finalDistanceMeters: number;
  readonly initialAutopilotState: string;
  readonly laterAutopilotState: string;
  readonly finalAutopilotState: string;
  readonly finalRouteState: string;
  readonly finalActionState: string;
  readonly warningState: string;
  readonly failureSummary: string;
  readonly arrivalOrHoldingReached: boolean;
  readonly arrivalLimitation: string;
}

interface CenterFlightAreaEvidence {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly safeAreaWidth: number;
  readonly safeAreaHeight: number;
}

function distanceFromHud(text: string): number {
  const match = text.match(/([\d.]+)\s*(km|m)\b/i);
  if (!match) {
    throw new Error(`Missing HUD distance in m or km: ${text}`);
  }

  const value = Number(match[1]);
  return match[2].toLowerCase() === "km" ? value * 1000 : value;
}

async function textFrom(page: Page, selector: string): Promise<string> {
  return (await page.locator(selector).innerText()).trim();
}

async function readDistance(page: Page): Promise<{ readonly display: string; readonly meters: number }> {
  const display = await textFrom(page, "#target-distance");
  return { display, meters: distanceFromHud(display) };
}

async function waitForRuntimeFrames(page: Page, frameCount: number): Promise<void> {
  await page.evaluate(async (frames) => {
    for (let index = 0; index < frames; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, frameCount);
}

async function expectNoTestBridgeLeakage(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => Object.prototype.hasOwnProperty.call(window, "TestBridge"))).toBe(false);
  await expect(page.getByTestId("basic-hud")).not.toContainText("TestBridge");
  await expect(page.locator("body")).not.toContainText("TestBridge");
  await expect(page.locator("#debug-hud")).toBeHidden();
}

async function expectCenterFlightAreaVisible(page: Page): Promise<CenterFlightAreaEvidence> {
  const canvas = await page.locator("#debug-scene").boundingBox();
  const safeArea = await page.locator(".hud-center-safe-area").boundingBox();
  expect(canvas, "Flight canvas should be visible for live screenshot evidence").toBeTruthy();
  expect(safeArea, "Center flight safe area should be measurable").toBeTruthy();
  expect(canvas!.width).toBeGreaterThan(900);
  expect(canvas!.height).toBeGreaterThan(500);
  expect(safeArea!.width).toBeGreaterThan(280);
  expect(safeArea!.height).toBeGreaterThan(220);

  const safeRect = {
    left: safeArea!.x,
    right: safeArea!.x + safeArea!.width,
    top: safeArea!.y,
    bottom: safeArea!.y + safeArea!.height
  };
  const allowedOverlapArea = Math.max(800, safeArea!.width * safeArea!.height * 0.06);

  for (const selector of ["#hud-top-strip", "#hud-left-panel", "#hud-right-panel", "#hud-bottom-strip"]) {
    const box = await page.locator(selector).boundingBox();
    expect(box, `${selector} should be available for live HUD layout evidence`).toBeTruthy();
    const overlapX = Math.max(0, Math.min(box!.x + box!.width, safeRect.right) - Math.max(box!.x, safeRect.left));
    const overlapY = Math.max(0, Math.min(box!.y + box!.height, safeRect.bottom) - Math.max(box!.y, safeRect.top));
    expect(overlapX * overlapY, `${selector} overlaps center flight area`).toBeLessThan(allowedOverlapArea);
  }

  return {
    canvasWidth: Math.round(canvas!.width),
    canvasHeight: Math.round(canvas!.height),
    safeAreaWidth: Math.round(safeArea!.width),
    safeAreaHeight: Math.round(safeArea!.height)
  };
}

async function selectTargetAndAssertPreview(page: Page, target: (typeof liveTargets)[number]): Promise<TargetPreviewEvidence> {
  const button = page.locator(`button[data-target-id="${target.targetId}"]`);
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("selected-target")).toContainText(target.label);
  await expect(page.locator("#route-status")).toContainText("preview ready");
  await expect(page.getByTestId("radar-status")).toContainText(target.label);
  await expect(page.getByTestId("radar-status")).toContainText(target.radarBucket);

  const selectedTarget = await page.getByTestId("selected-target").innerText();
  const distance = await readDistance(page);
  const routeStatus = await textFrom(page, "#route-status");
  const radarStatus = await page.getByTestId("radar-status").innerText();

  expect(distance.display).toContain(target.distanceUnit);
  expect(distance.meters).toBeGreaterThanOrEqual(target.minMeters);
  expect(distance.meters).toBeLessThan(target.maxMeters);

  return {
    targetId: target.targetId,
    label: target.label,
    selectedTarget,
    hudDistanceDisplay: distance.display,
    hudDistanceMeters: distance.meters,
    routeStatus,
    radarStatus
  };
}

async function waitForDistanceDecrease(page: Page, initialMeters: number): Promise<{ readonly display: string; readonly meters: number }> {
  const deadline = Date.now() + 18_000;
  let latest = await readDistance(page);

  while (Date.now() < deadline) {
    await waitForRuntimeFrames(page, 30);
    await page.waitForTimeout(500);
    latest = await readDistance(page);
    if (latest.meters <= initialMeters - 20) {
      return latest;
    }
  }

  throw new Error(`Expected live HUD distance to decrease by at least 20m from ${initialMeters}, last distance was ${latest.meters}`);
}

async function waitForArrivalOrProgress(page: Page): Promise<{
  readonly finalDistance: { readonly display: string; readonly meters: number };
  readonly autopilotState: string;
  readonly routeState: string;
  readonly actionState: string;
  readonly arrivalOrHoldingReached: boolean;
}> {
  const deadline = Date.now() + 52_000;
  let finalDistance = await readDistance(page);
  let autopilotState = await page.getByTestId("autopilot-active").innerText();
  let routeState = await textFrom(page, "#route-status");
  let actionState = await textFrom(page, "#autopilot-action-state");

  while (Date.now() < deadline) {
    await waitForRuntimeFrames(page, 60);
    await page.waitForTimeout(500);
    finalDistance = await readDistance(page);
    autopilotState = await page.getByTestId("autopilot-active").innerText();
    routeState = await textFrom(page, "#route-status");
    actionState = await textFrom(page, "#autopilot-action-state");

    if (/Arrived at selected target|holding/i.test(`${autopilotState} ${routeState} ${actionState}`)) {
      return { finalDistance, autopilotState, routeState, actionState, arrivalOrHoldingReached: true };
    }
  }

  return { finalDistance, autopilotState, routeState, actionState, arrivalOrHoldingReached: false };
}

function createMarkdown(
  previews: readonly TargetPreviewEvidence[],
  liveFlight: LiveFlightEvidence,
  centerArea: CenterFlightAreaEvidence
): string {
  const previewRows = previews
    .map((preview) => `| ${preview.targetId} | ${preview.label} | ${preview.hudDistanceDisplay} | ${preview.hudDistanceMeters} | ${preview.routeStatus} | ${preview.radarStatus} |`)
    .join("\n");
  const arrivalStatement = liveFlight.arrivalOrHoldingReached
    ? "Arrival/Holding was reached inside the live E2E budget; after route completion the HUD distance field may return to the ready route-preview distance."
    : liveFlight.arrivalLimitation;

  return `# Browser Live Large Field Flight Acceptance v1 Evidence

Generated by \`apps/weltraum-browser/tests/e2e/playable-large-field-live-flight.spec.ts\`.

## Runtime Contract

- URL: normal browser runtime \`/\`
- TestBridge: absent from \`window\`, absent from the visible HUD, and no \`/?testBridge=1\` route was used
- Interaction path: player HUD buttons only
- Ship visual: Demo Scout GLB player-facing source line confirmed before flight
- Selected live-flight target: ${liveFlight.selectedTarget}

## Target Preview Sweep

| Target ID | Label | HUD distance display | Parsed distance (m) | Route status | Radar status |
| --- | --- | --- | ---: | --- | --- |
${previewRows}

## Live Flight Proof

| Field | Value |
| --- | --- |
| Preview distance before engage | ${liveFlight.previewDistanceDisplay} (${liveFlight.previewDistanceMeters} m) |
| Initial locked-route distance | ${liveFlight.initialDistanceDisplay} (${liveFlight.initialDistanceMeters} m) |
| Later in-flight distance | ${liveFlight.laterDistanceDisplay} (${liveFlight.laterDistanceMeters} m) |
| Final HUD distance display | ${liveFlight.finalDistanceDisplay} (${liveFlight.finalDistanceMeters} m) |
| Initial autopilot state | ${liveFlight.initialAutopilotState} |
| Later autopilot state | ${liveFlight.laterAutopilotState} |
| Final autopilot state | ${liveFlight.finalAutopilotState} |
| Final route state | ${liveFlight.finalRouteState} |
| Final action state | ${liveFlight.finalActionState} |
| Warning state | ${liveFlight.warningState} |
| Failure summary | ${liveFlight.failureSummary} |
| Arrival/Holding result | ${arrivalStatement} |

## Center Flight Area

- Canvas: ${centerArea.canvasWidth} x ${centerArea.canvasHeight}
- HUD center safe area: ${centerArea.safeAreaWidth} x ${centerArea.safeAreaHeight}
- Edge HUD overlap stayed below the live acceptance threshold.

## Screenshots

- \`apps/weltraum-browser/evidence/live-large-field-before-engage.png\`
- \`apps/weltraum-browser/evidence/live-large-field-in-flight.png\`
- \`apps/weltraum-browser/evidence/live-large-field-arrival-or-progress.png\`

## Guardrails

- The test never loads \`/?testBridge=1\` and never calls the TestBridge API.
- Distance reduction is read from the visible HUD while the normal render loop advances.
- No ship snapping, velocity zeroing, planner retuning, or terminal capture changes were made.
- No debug HUD leakage, warning chip, route invalidation, or replan-required player message was visible at completion.
`;
}

test("normal player HUD flies a large-field target with live browser runtime movement", async ({ page }) => {
  test.setTimeout(95_000);
  await mkdir(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await expect(page.getByTestId("basic-hud")).toBeVisible();
  await expectNoTestBridgeLeakage(page);
  await expect(page.getByTestId("ship-visual-source")).toContainText("Ship visual: Demo Scout GLB", { timeout: 20_000 });

  const centerArea = await expectCenterFlightAreaVisible(page);
  const targetOptions = page.getByTestId("target-options");
  for (const target of liveTargets) {
    await expect(targetOptions).toContainText(target.label);
    await expect(page.locator(`button[data-target-id="${target.targetId}"]`)).toBeVisible();
  }

  const previews: TargetPreviewEvidence[] = [];
  for (const target of liveTargets) {
    previews.push(await selectTargetAndAssertPreview(page, target));
  }

  const selectedForFlight = await selectTargetAndAssertPreview(page, liveTargets[0]);
  const previewDistance = await readDistance(page);
  await expectCenterFlightAreaVisible(page);
  const beforeEngageScreenshot = await page.screenshot({ fullPage: true });

  await page.locator("#engage-autopilot").click();
  await expect(page.getByTestId("autopilot-active")).toContainText(/Autopilot executing|Arrived at selected target/);
  await expect(page.locator("#route-status")).toContainText(/locked route valid|holding at target/i);
  await expect(page.locator("#autopilot-action-state")).toContainText(/Cancel current route|Holding at target|Ready/i);
  await expectNoTestBridgeLeakage(page);

  const initialDistance = await readDistance(page);
  const initialAutopilotState = await page.getByTestId("autopilot-active").innerText();
  const laterDistance = await waitForDistanceDecrease(page, initialDistance.meters);
  const laterAutopilotState = await page.getByTestId("autopilot-active").innerText();
  await expect(page.locator("#warning-chips")).toContainText("none");
  await expect(page.locator("#failure-reasons")).toContainText("none");
  await expect(page.locator("#route-status")).not.toContainText(/invalid|new plan required/i);
  const inFlightScreenshot = await page.screenshot({ fullPage: true });

  const arrival = await waitForArrivalOrProgress(page);
  await expect(page.locator("#warning-chips")).toContainText("none");
  await expect(page.locator("#failure-reasons")).toContainText("none");
  await expect(page.locator("#route-status")).not.toContainText(/invalid|new plan required/i);
  await expectNoTestBridgeLeakage(page);
  await expectCenterFlightAreaVisible(page);
  const arrivalOrProgressScreenshot = await page.screenshot({ fullPage: true });

  const liveFlight: LiveFlightEvidence = {
    selectedTarget: `${selectedForFlight.label} (${selectedForFlight.targetId})`,
    previewDistanceDisplay: previewDistance.display,
    previewDistanceMeters: previewDistance.meters,
    initialDistanceDisplay: initialDistance.display,
    initialDistanceMeters: initialDistance.meters,
    laterDistanceDisplay: laterDistance.display,
    laterDistanceMeters: laterDistance.meters,
    finalDistanceDisplay: arrival.finalDistance.display,
    finalDistanceMeters: arrival.finalDistance.meters,
    initialAutopilotState,
    laterAutopilotState,
    finalAutopilotState: arrival.autopilotState,
    finalRouteState: arrival.routeState,
    finalActionState: arrival.actionState,
    warningState: await textFrom(page, "#warning-chips"),
    failureSummary: await textFrom(page, "#failure-reasons"),
    arrivalOrHoldingReached: arrival.arrivalOrHoldingReached,
    arrivalLimitation:
      "Arrival/Holding was not reached within the bounded 52s post-progress wait, so this acceptance records live distance reduction, executing state, and no error/replan HUD leakage."
  };

  expect(liveFlight.laterDistanceMeters).toBeLessThan(liveFlight.initialDistanceMeters - 20);
  expect(liveFlight.arrivalOrHoldingReached || liveFlight.finalDistanceMeters < liveFlight.initialDistanceMeters).toBe(true);
  expect(liveFlight.finalAutopilotState).toMatch(/Autopilot executing|Arrived at selected target/);

  await writeFile(path.join(evidenceDir, "live-large-field-before-engage.png"), beforeEngageScreenshot);
  await writeFile(path.join(evidenceDir, "live-large-field-in-flight.png"), inFlightScreenshot);
  await writeFile(path.join(evidenceDir, "live-large-field-arrival-or-progress.png"), arrivalOrProgressScreenshot);
  await writeFile(path.join(evidenceDir, "browser-live-large-field-flight-acceptance-v1.md"), createMarkdown(previews, liveFlight, centerArea), "utf8");
});
