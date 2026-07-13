import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const evidenceDir = path.resolve(process.cwd(), "evidence");

interface ObjectiveChainSnapshot {
  readonly phase: string;
  readonly objective: string;
  readonly status: string;
  readonly target: string;
  readonly distanceDisplay: string;
  readonly distanceMeters: number;
  readonly nextAction: string;
  readonly hint: string;
  readonly options: string;
  readonly selectedTarget: string;
  readonly routeStatus: string;
  readonly autopilotState: string;
  readonly previewHash: string;
}

const distanceFromHud = (text: string): number => {
  const match = text.match(/([\d.]+)\s*(km|m)\b/i);
  if (!match) {
    throw new Error(`Missing HUD distance in m or km: ${text}`);
  }

  const value = Number(match[1]);
  return match[2].toLowerCase() === "km" ? value * 1000 : value;
};

const textFrom = async (page: Page, selector: string): Promise<string> =>
  (await page.locator(selector).innerText()).trim();

async function expectTestBridgeAbsent(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => Object.prototype.hasOwnProperty.call(window, "TestBridge"))).toBe(false);
  await expect(page.getByTestId("basic-hud")).not.toContainText("TestBridge");
  await expect(page.locator("body")).not.toContainText("TestBridge");
  await expect(page.locator("#debug-hud")).toBeHidden();
}

async function selectVisiblePlannerTarget(
  page: Page,
  targetId: string,
  label: string,
  expectedObjective: string
): Promise<string> {
  await expect(page.locator("#open-navigation-planner")).toBeVisible();
  await page.locator("#open-navigation-planner").click();
  const planner = page.getByTestId("navigation-planner");
  await expect(planner).toBeVisible();
  const target = page.locator(`#planner-target-options button[data-planner-target-id="${targetId}"]`);
  await expect(target).toBeVisible();
  await target.click();
  await expect(target).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("planner-selected-target")).toContainText(label);
  await expect(page.getByTestId("planner-objective")).toContainText(expectedObjective);
  await expect.poll(async () => (await planner.getAttribute("data-visible-preview-hash")) ?? "").toMatch(/^[a-f0-9]{8}$/);
  const previewHash = (await planner.getAttribute("data-visible-preview-hash"))!;
  await expect(page.locator("#planner-route-detail")).toContainText(previewHash);
  await page.locator("#planner-close").click();
  await expect(planner).toBeHidden();
  return previewHash;
}

async function engageVisiblePreview(page: Page, expectedHash: string): Promise<void> {
  await page.locator("#open-navigation-planner").click();
  await expect(page.getByTestId("navigation-planner")).toHaveAttribute("data-visible-preview-hash", expectedHash);
  await expect(page.getByTestId("planner-engage-route")).toBeEnabled();
  await page.getByTestId("planner-engage-route").click();
  await expect(page.getByTestId("navigation-planner")).toBeHidden();
}

async function readObjectiveSnapshot(page: Page, phase: string): Promise<ObjectiveChainSnapshot> {
  const distanceDisplay = await page.getByTestId("objective-distance").innerText();
  return {
    phase,
    objective: await page.getByTestId("objective-label").innerText(),
    status: await page.getByTestId("objective-status").innerText(),
    target: await page.getByTestId("objective-target").innerText(),
    distanceDisplay,
    distanceMeters: distanceFromHud(distanceDisplay),
    nextAction: await page.getByTestId("objective-next-action").innerText(),
    hint: await page.getByTestId("objective-hint").innerText(),
    options: await page.getByTestId("objective-options").innerText(),
    selectedTarget: await page.getByTestId("selected-target").innerText(),
    routeStatus: await textFrom(page, "#route-status"),
    autopilotState: await page.getByTestId("autopilot-active").innerText(),
    previewHash: (await page.getByTestId("navigation-planner").getAttribute("data-visible-preview-hash")) ?? "none"
  };
}

async function waitForObjectiveComplete(
  page: Page,
  objective: "Reach Range 500m" | "Reach Range 1000m",
  phase: "500m-complete" | "1000m-complete"
): Promise<ObjectiveChainSnapshot> {
  await expect.poll(
    async () => {
      const latest = await readObjectiveSnapshot(page, phase);
      return `${latest.objective}|${latest.status}`;
    },
    { timeout: 70_000, intervals: [250, 500, 1_000] }
  ).toBe(`${objective}|Complete`);

  return readObjectiveSnapshot(page, phase);
}

function createMarkdown(rows: readonly ObjectiveChainSnapshot[]): string {
  const timelineRows = rows
    .map((row) => `| ${row.phase} | ${row.objective} | ${row.status} | ${row.target} | ${row.distanceDisplay} | ${row.distanceMeters} | ${row.nextAction} | ${row.selectedTarget} | ${row.autopilotState} | ${row.previewHash} |`)
    .join("\n");
  const selectedTargetRows = rows
    .map((row) => `| ${row.phase} | ${row.selectedTarget} | ${row.routeStatus} |`)
    .join("\n");
  const ready = rows.find((row) => row.phase === "500m-ready");
  const oneThousand = rows.find((row) => row.phase === "1000m-complete");
  const twoThousandFiveHundred = rows.find((row) => row.phase === "2500m-ready");

  return `# Browser Objective Chain 1000m Completion v2 Evidence

Generated by \`apps/weltraum-browser/tests/e2e/large-field-objective-chain-live.spec.ts\`.

## Runtime Contract

- URL: normal browser runtime \`/\`
- TestBridge: absent from \`window\`, absent from the visible HUD, and no \`/?testBridge=1\` route was used
- Interaction path: visible navigation planner target and Engage buttons only
- Ship visual: Demo Scout GLB player-facing source line confirmed before objective flight

## Objective State Timeline

| Phase | Objective | Status | Target | HUD distance | Parsed distance (m) | Next action | Selected target | Autopilot state | Visible preview hash |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- |
${timelineRows}

## Selected Target Timeline

| Phase | Selected target | Route status |
| --- | --- | --- |
${selectedTargetRows}

## Live Movement

- Initial 500m objective distance: ${ready?.distanceDisplay ?? "unknown"}
- Range 1000m terminal distance: ${oneThousand?.distanceDisplay ?? "unknown"}
- Range 1000m outcome: real objective Complete with visible Arrived/Holding state
- Range 2500m admitted preview distance: ${twoThousandFiveHundred?.distanceDisplay ?? "unknown"}
- Range 2500m visible preview hash: ${twoThousandFiveHundred?.previewHash ?? "unknown"}

## Screenshots

- \`apps/weltraum-browser/evidence/objective-chain-v2-500m-ready.png\`
- \`apps/weltraum-browser/evidence/objective-chain-v2-500m-enroute.png\`
- \`apps/weltraum-browser/evidence/objective-chain-v2-500m-complete.png\`
- \`apps/weltraum-browser/evidence/objective-chain-v2-1000m-ready.png\`
- \`apps/weltraum-browser/evidence/objective-chain-v2-1000m-complete.png\`
- \`apps/weltraum-browser/evidence/objective-chain-v2-2500m-ready.png\`

## Tests Run

- \`npm run test:e2e -- tests/e2e/large-field-objective-chain-live.spec.ts\`
`;
}

test("normal runtime completes 500m and 1000m before admitting the visible 2500m preview", async ({ page }) => {
  test.setTimeout(200_000);
  await mkdir(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await expect(page.getByTestId("basic-hud")).toBeVisible();
  await expectTestBridgeAbsent(page);
  await expect(page.getByTestId("ship-visual-source")).toContainText("Ship visual: Demo Scout GLB", { timeout: 20_000 });

  await expect(page.getByTestId("objective-label")).toContainText("Reach Range 500m");
  await expect(page.getByTestId("objective-label")).toBeVisible();
  await expect(page.getByTestId("objective-status")).toContainText("Available");
  await expect(page.getByTestId("objective-status")).toBeVisible();
  await expect(page.getByTestId("objective-distance")).toBeVisible();
  await expect(page.getByTestId("objective-options")).toBeHidden();

  const preview500mHash = await selectVisiblePlannerTarget(page, "range-500m", "Range 500m", "Reach Range 500m");
  await expect(page.getByTestId("selected-target")).toContainText("Range 500m");
  await expect(page.getByTestId("objective-status")).toContainText("Route ready");
  await expect(page.getByTestId("objective-next-action")).toContainText("engage autopilot");
  const ready500m = await readObjectiveSnapshot(page, "500m-ready");
  expect(ready500m.previewHash).toBe(preview500mHash);
  const ready500mScreenshot = await page.screenshot({ fullPage: true });

  await engageVisiblePreview(page, preview500mHash);
  await expect(page.getByTestId("autopilot-active")).toContainText(/Autopilot executing|Arrived at selected target/);
  await expect(page.getByTestId("objective-status")).toContainText(/Enroute|Complete/);
  const enroute500m = await readObjectiveSnapshot(page, "500m-enroute");
  const enroute500mScreenshot = await page.screenshot({ fullPage: true });

  const complete500m = await waitForObjectiveComplete(page, "Reach Range 500m", "500m-complete");
  await expect(page.getByTestId("autopilot-active")).toContainText("Arrived at selected target");
  await expect(page.locator("#route-status")).toContainText("Holding");
  expect(complete500m.nextAction).toBe("next objective available");
  expect(complete500m.hint).toContain("Reach Range 1000m is available");
  expect(complete500m.options).toContain("Reach Range 500m (complete)");
  expect(complete500m.options).toContain("Reach Range 1000m (available)");
  expect(complete500m.options).toContain("Reach Range 2500m (locked)");
  const complete500mScreenshot = await page.screenshot({ fullPage: true });

  const preview1000mHash = await selectVisiblePlannerTarget(page, "range-1000m", "Range 1000m", "Reach Range 1000m");
  await expect(page.getByTestId("objective-label")).toContainText("Reach Range 1000m");
  await expect(page.getByTestId("selected-target")).toContainText("Range 1000m");
  await expect(page.getByTestId("objective-status")).toContainText("Route ready");
  await expect(page.getByTestId("objective-options")).toContainText("Reach Range 500m (complete)");
  await expect(page.getByTestId("objective-options")).toContainText("Reach Range 1000m (route ready)");
  const ready1000m = await readObjectiveSnapshot(page, "1000m-ready");
  expect(ready1000m.previewHash).toBe(preview1000mHash);
  const ready1000mScreenshot = await page.screenshot({ fullPage: true });

  await engageVisiblePreview(page, preview1000mHash);
  await expect(page.getByTestId("objective-status")).toContainText(/Enroute|Complete/);
  const complete1000m = await waitForObjectiveComplete(page, "Reach Range 1000m", "1000m-complete");
  await expect(page.getByTestId("autopilot-active")).toContainText("Arrived at selected target");
  await expect(page.locator("#route-status")).toContainText("Holding");
  expect(complete1000m.distanceMeters).toBeLessThan(ready1000m.distanceMeters);
  expect(complete1000m.nextAction).toBe("next objective available");
  expect(complete1000m.options).toContain("Reach Range 500m (complete)");
  expect(complete1000m.options).toContain("Reach Range 1000m (complete)");
  expect(complete1000m.options).toContain("Reach Range 2500m (available)");
  const complete1000mScreenshot = await page.screenshot({ fullPage: true });

  const preview2500mHash = await selectVisiblePlannerTarget(page, "range-2500m", "Range 2500m", "Reach Range 2500m");
  expect(preview2500mHash).not.toBe(preview1000mHash);
  await expect(page.getByTestId("objective-label")).toContainText("Reach Range 2500m");
  await expect(page.getByTestId("selected-target")).toContainText("Range 2500m");
  await expect(page.getByTestId("objective-status")).toContainText("Route ready");
  await expect(page.getByTestId("objective-options")).toContainText("Reach Range 500m (complete)");
  await expect(page.getByTestId("objective-options")).toContainText("Reach Range 1000m (complete)");
  await expect(page.getByTestId("objective-options")).toContainText("Reach Range 2500m (route ready)");
  await expect(page.locator("#plan-hash")).toHaveText("Route preview ready");
  await expect(page.locator("#route-status")).toHaveText("Preview ready");
  await expect(page.locator("#route-status")).toHaveAttribute("data-hud-tone", "ready");
  await expect(page.locator("#engage-autopilot")).toBeEnabled();

  await page.locator("#open-navigation-planner").click();
  await expect(page.getByTestId("navigation-planner")).toHaveAttribute("data-visible-preview-hash", preview2500mHash);
  await expect(page.locator("#planner-route-detail")).toContainText(preview2500mHash);
  await expect(page.getByTestId("planner-engage-route")).toBeEnabled();
  await page.locator("#planner-close").click();
  await expect(page.getByTestId("navigation-planner")).toBeHidden();

  const ready2500m = await readObjectiveSnapshot(page, "2500m-ready");
  expect(ready2500m.previewHash).toBe(preview2500mHash);
  expect(ready2500m.distanceMeters).toBeGreaterThanOrEqual(1_450);
  expect(ready2500m.distanceMeters).toBeLessThanOrEqual(1_550);
  const ready2500mScreenshot = await page.screenshot({ fullPage: true });
  await expectTestBridgeAbsent(page);

  await writeFile(path.join(evidenceDir, "objective-chain-v2-500m-ready.png"), ready500mScreenshot);
  await writeFile(path.join(evidenceDir, "objective-chain-v2-500m-enroute.png"), enroute500mScreenshot);
  await writeFile(path.join(evidenceDir, "objective-chain-v2-500m-complete.png"), complete500mScreenshot);
  await writeFile(path.join(evidenceDir, "objective-chain-v2-1000m-ready.png"), ready1000mScreenshot);
  await writeFile(path.join(evidenceDir, "objective-chain-v2-1000m-complete.png"), complete1000mScreenshot);
  await writeFile(path.join(evidenceDir, "objective-chain-v2-2500m-ready.png"), ready2500mScreenshot);
  await writeFile(
    path.join(evidenceDir, "browser-objective-chain-1000m-completion-v2.md"),
    createMarkdown([ready500m, enroute500m, complete500m, ready1000m, complete1000m, ready2500m]),
    "utf8"
  );
});
