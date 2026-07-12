import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  engageVisiblePreview,
  openVisiblePlanner,
  previewVisibleRoute,
  readVisiblePreviewHash,
  selectVisiblePlannerProfile,
  selectVisiblePlannerTarget
} from "./support/plannerWorkflow";

const evidenceRoot = path.resolve(process.cwd(), "evidence");
const repositoryRoot = path.resolve(process.cwd(), "../..");
const targetId = "range-2500m";
const targetLabel = "Range 2500m";
const landmarkEntityIds = new Set([
  "range-gate-500-port",
  "range-gate-500-starboard",
  "range-gate-1000-port",
  "range-gate-1000-starboard",
  "range-gate-2500-port",
  "range-gate-2500-starboard",
  "range-beacon-1500",
  "range-beacon-2100"
]);

const screenshotPaths = {
  preview: path.join(evidenceRoot, "live-world-preview-route.png"),
  locked: path.join(evidenceRoot, "live-world-locked-route.png"),
  obstacles: path.join(evidenceRoot, "live-world-obstacle-proxies.png")
};

test.use({ screenshot: "off", trace: "retain-on-failure" });

async function waitFrames(page: Page, frameCount: number): Promise<void> {
  await page.evaluate(async (frames) => {
    for (let index = 0; index < frames; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, frameCount);
}

async function expectNormalRuntime(page: Page): Promise<Locator> {
  await page.waitForSelector("#debug-scene", { state: "visible" });
  expect(new URL(page.url()).search).toBe("");
  await expect.poll(() => page.evaluate(() => Object.prototype.hasOwnProperty.call(window, "TestBridge"))).toBe(false);
  await expect(page.locator("body")).not.toContainText("TestBridge");
  const canvas = page.locator("#debug-scene");
  await expect.poll(async () => Number(await canvas.getAttribute("data-world-presentation-revision"))).toBeGreaterThan(0);
  return canvas;
}

async function numberAttribute(locator: Locator, name: string): Promise<number> {
  const value = Number(await locator.getAttribute(name));
  expect(Number.isFinite(value), `${name} must be finite`).toBe(true);
  return value;
}

async function readCanvasEvidence(canvas: Locator) {
  const evidence = {
    selectedTargetProxyVisible: await canvas.getAttribute("data-selected-target-proxy-visible"),
    routeProxyVisible: await canvas.getAttribute("data-route-proxy-visible"),
    routeProxyVisibility: await canvas.getAttribute("data-route-proxy-visibility"),
    routeProxySegmentCount: await numberAttribute(canvas, "data-route-proxy-segment-count"),
    truthObstacleProxyCount: await numberAttribute(canvas, "data-truth-obstacle-proxy-count"),
    runtimeTruthObstacleCount: await numberAttribute(canvas, "data-runtime-truth-obstacle-count"),
    navigationFocusBeaconCount: await numberAttribute(canvas, "data-navigation-focus-beacon-count"),
    worldEntitySlotCount: await numberAttribute(canvas, "data-world-entity-slot-count"),
    worldEntityCount: await numberAttribute(canvas, "data-world-entity-count"),
    residentWorldEntityCount: await numberAttribute(canvas, "data-resident-world-entity-count"),
    visibleWorldEntityCount: await numberAttribute(canvas, "data-visible-world-entity-count"),
    landmarkWorldEntityCount: await numberAttribute(canvas, "data-landmark-world-entity-count"),
    ambientWorldEntityCount: await numberAttribute(canvas, "data-ambient-world-entity-count"),
    decorativeAsteroidCount: await numberAttribute(canvas, "data-decorative-asteroid-count"),
    decorativeLandmarkCount: await numberAttribute(canvas, "data-decorative-landmark-count"),
    decorativeObjectsExcludedFromRadar: await canvas.getAttribute("data-decorative-objects-excluded-from-radar"),
    rendererOwnsWorldTruth: await canvas.getAttribute("data-renderer-owns-world-truth")
  };

  expect(evidence).toMatchObject({
    selectedTargetProxyVisible: "true",
    routeProxyVisible: "true",
    routeProxyVisibility: "Visible",
    worldEntitySlotCount: 14,
    worldEntityCount: 14,
    residentWorldEntityCount: 14,
    landmarkWorldEntityCount: 8,
    ambientWorldEntityCount: 6,
    decorativeAsteroidCount: 150,
    decorativeLandmarkCount: 0,
    decorativeObjectsExcludedFromRadar: "true",
    rendererOwnsWorldTruth: "false"
  });
  expect(evidence.routeProxySegmentCount).toBeGreaterThan(0);
  expect(evidence.truthObstacleProxyCount).toBeGreaterThan(0);
  expect(evidence.truthObstacleProxyCount).toBe(evidence.runtimeTruthObstacleCount);
  expect(evidence.navigationFocusBeaconCount).toBeGreaterThanOrEqual(0);
  expect(evidence.navigationFocusBeaconCount).toBeLessThanOrEqual(1);
  expect(evidence.visibleWorldEntityCount).toBeGreaterThan(0);
  expect(evidence.visibleWorldEntityCount).toBeLessThanOrEqual(evidence.residentWorldEntityCount);
  return evidence;
}

async function assertCanvasHasNoFullTruthValues(canvas: Locator): Promise<void> {
  for (const attribute of [
    "data-selected-target-proxy-id",
    "data-route-proxy-plan-hash",
    "data-route-segment-ids",
    "data-world-entity-ids",
    "data-source-navigation-map-signature",
    "data-world-presentation-signature"
  ]) {
    expect(await canvas.getAttribute(attribute), `${attribute} must remain query-gated`).toBeNull();
  }
}

function relativeEvidencePath(filePath: string): string {
  return path.relative(repositoryRoot, filePath).replaceAll("\\", "/");
}

test("normal and query-gated runtime expose live world presentation truth without renderer ownership", async ({ page }) => {
  test.setTimeout(100_000);
  await mkdir(evidenceRoot, { recursive: true });
  await page.setViewportSize({ width: 1_920, height: 1_080 });

  await page.goto("/");
  const canvas = await expectNormalRuntime(page);
  await assertCanvasHasNoFullTruthValues(canvas);

  const planner = await openVisiblePlanner(page);
  await selectVisiblePlannerTarget(page, targetId, targetLabel);
  await selectVisiblePlannerProfile(page, "Balanced");
  const previewPlanHash = await previewVisibleRoute(page);
  await expect(planner).toHaveAttribute("data-visible-preview-hash", previewPlanHash);

  const map = page.locator("#planner-route-svg");
  const target = map.locator(`[data-map-object="target"][data-target-id="${targetId}"]`);
  await expect(target).toBeVisible();
  await expect(target).toHaveAttribute("aria-pressed", "true");
  const routeSegments = map.locator("[data-map-layer='route'] [data-segment-id]");
  await expect(routeSegments.first()).toBeVisible();
  const lastSegment = routeSegments.last();
  expect(await numberAttribute(lastSegment, "data-end-x")).toBe(await numberAttribute(target, "data-absolute-x"));
  expect(await numberAttribute(lastSegment, "data-end-z")).toBe(await numberAttribute(target, "data-absolute-z"));
  await expect(map.locator("[data-map-layer='obstacles'] [data-obstacle-id]").first()).toBeVisible();
  await expect(map.locator("[data-map-layer='world-entities'] [data-world-entity-id]").first()).toBeVisible();
  await page.screenshot({ path: screenshotPaths.preview, fullPage: false });

  await page.locator("#planner-close").click();
  await expect(planner).toBeHidden();
  await expect(canvas).toHaveAttribute("data-selected-target-proxy-visible", "true");
  await expect(canvas).toHaveAttribute("data-route-proxy-visible", "true");
  await expect(canvas).toHaveAttribute("data-route-proxy-visibility", "Visible");
  await waitFrames(page, 8);
  const previewCanvasEvidence = await readCanvasEvidence(canvas);
  await assertCanvasHasNoFullTruthValues(canvas);
  await page.screenshot({ path: screenshotPaths.obstacles, fullPage: false });

  await engageVisiblePreview(page, previewPlanHash);
  await expect(page.getByTestId("autopilot-active")).toContainText(/Autopilot executing|Arrived at selected target/);
  const lockedPlanner = await openVisiblePlanner(page);
  await expect(lockedPlanner).toHaveAttribute("data-locked", "true");
  await expect(lockedPlanner).toHaveAttribute("data-visible-preview-hash", previewPlanHash);
  const lockedVisiblePlanHash = await readVisiblePreviewHash(page);
  expect(lockedVisiblePlanHash).toBe(previewPlanHash);
  await page.screenshot({ path: screenshotPaths.locked, fullPage: false });
  await page.locator("#planner-close").click();
  await expectNormalRuntime(page);
  const lockedCanvasEvidence = await readCanvasEvidence(canvas);
  await assertCanvasHasNoFullTruthValues(canvas);

  await page.goto("/?testBridge=1");
  await page.waitForFunction(() => Boolean((window as any).TestBridge?.getRenderSnapshot?.()));
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await selectVisiblePlannerTarget(page, targetId, targetLabel);
  await selectVisiblePlannerProfile(page, "Balanced");
  const bridgePreviewPlanHash = await previewVisibleRoute(page);
  await page.locator("#planner-close").click();
  await page.waitForFunction((planHash) => {
    const bridge = (window as any).TestBridge;
    const telemetry = bridge?.getTelemetry?.();
    const render = bridge?.getRenderSnapshot?.();
    return telemetry?.navigationMap?.route?.planHash === planHash && render?.routeProxyPlanHash === planHash;
  }, bridgePreviewPlanHash);

  const previewTruth = await page.evaluate(() => ({
    telemetry: (window as any).TestBridge.getTelemetry(),
    render: (window as any).TestBridge.getRenderSnapshot()
  }));
  const navigationMap = previewTruth.telemetry.navigationMap;
  const render = previewTruth.render;
  expect(navigationMap).toBeTruthy();
  expect(navigationMap.absoluteFrameId).toBeTruthy();
  expect(navigationMap.entities).toHaveLength(14);
  const mapTarget = navigationMap.targets.find((candidate: any) => candidate.id === targetId);
  expect(mapTarget).toBeTruthy();
  expect(navigationMap.selectedTargetId).toBe(targetId);
  expect(navigationMap.route?.planHash).toBe(bridgePreviewPlanHash);
  expect(navigationMap.route?.targetId).toBe(targetId);

  expect(render.selectedTarget).toMatchObject({
    sourceTargetId: targetId,
    label: mapTarget.label,
    kind: mapTarget.kind,
    position: mapTarget.absolutePosition.value,
    arrivalRadius: mapTarget.arrivalRadius,
    selected: true,
    locked: false,
    truthBacked: true
  });
  expect(render.selectedTargetProjectedPosition).toBeTruthy();
  expect(render.selectedTargetProxyVisible).toBe(true);
  expect(render.routeProxyVisible).toBe(true);
  expect(render.routeProxyVisibility).toBe("Visible");
  expect(render.routeProxyPlanHash).toBe(navigationMap.route.planHash);
  expect(render.routeSegmentIds).toEqual(navigationMap.route.segments.map((segment: any) => segment.id));
  expect(render.routeSegments.map((segment: any) => ({
    sourceSegmentId: segment.sourceSegmentId,
    kind: segment.kind,
    start: segment.start,
    end: segment.end,
    desiredSpeed: segment.desiredSpeed,
    clearanceRadius: segment.clearanceRadius,
    brakeMarginMultiplier: segment.brakeMarginMultiplier
  }))).toEqual(navigationMap.route.segments.map((segment: any) => ({
    sourceSegmentId: segment.id,
    kind: segment.kind,
    start: segment.start.value,
    end: segment.end.value,
    desiredSpeed: segment.desiredSpeed,
    clearanceRadius: segment.clearanceRadius,
    brakeMarginMultiplier: segment.brakeMarginMultiplier ?? null
  })));
  expect(render.sourceNavigationMapSignature).toBe(navigationMap.signature);
  expect(render.worldPresentationSignature).toMatch(/^[a-f0-9]{8}$/);
  expect(render.worldProvenance).toEqual(navigationMap.world);

  const expectedEntities = [...navigationMap.entities]
    .sort((left: any, right: any) => left.id.localeCompare(right.id))
    .map((entity: any) => ({
      sourceEntityId: entity.id,
      absolutePosition: entity.absolutePosition.value,
      chunkId: entity.chunkId,
      residence: entity.residence,
      renderLod: entity.renderLod,
      presentationKey: entity.presentationKey,
      role: landmarkEntityIds.has(entity.id) ? "Landmark" : "Ambient",
      renderEligible: entity.renderLod !== "Culled",
      truthBacked: true,
      renderOnly: false,
      radarVisible: true,
      collisionRelevant: false
    }));
  expect(render.worldEntities).toEqual(expectedEntities);
  expect(render.worldEntitySlotCount).toBe(14);
  expect(render.worldEntityCount).toBe(14);
  expect(render.residentWorldEntityCount).toBe(14);
  expect(render.visibleWorldEntityCount).toBe(expectedEntities.filter((entity) => entity.renderEligible).length);
  expect(render.landmarkWorldEntityCount).toBe(8);
  expect(render.ambientWorldEntityCount).toBe(6);
  expect(render.decorativeAsteroidCount).toBe(150);
  expect(render.decorativeLandmarkCount).toBe(0);
  expect(render.decorativeObjectsExcludedFromRadar).toBe(true);
  expect(render.rendererOwnsWorldTruth).toBe(false);
  expect(render.truthBackedObstacleProxyCount).toBe(navigationMap.obstacles.length);
  expect(render.runtimeTruthObstacleCount).toBe(navigationMap.obstacles.length);

  const stablePresentation = await page.evaluate(async () => {
    const first = (window as any).TestBridge.getRenderSnapshot();
    for (let index = 0; index < 6; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    const second = (window as any).TestBridge.getRenderSnapshot();
    return { first, second };
  });
  expect(stablePresentation.second.renderFrameRevision).toBeGreaterThan(stablePresentation.first.renderFrameRevision);
  expect(stablePresentation.second.worldPresentationSignature).toBe(stablePresentation.first.worldPresentationSignature);
  expect(stablePresentation.second.sourceNavigationMapSignature).toBe(stablePresentation.first.sourceNavigationMapSignature);

  await engageVisiblePreview(page, bridgePreviewPlanHash);
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().lockedPlan?.planHash)).toBe(bridgePreviewPlanHash);
  await expect.poll(() => page.evaluate(() => (window as any).TestBridge.getTelemetry().executor.planHash)).toBe(bridgePreviewPlanHash);
  await page.waitForFunction((planHash) => {
    const renderSnapshot = (window as any).TestBridge.getRenderSnapshot?.();
    return renderSnapshot?.routeProxyPlanHash === planHash && renderSnapshot?.selectedTarget?.locked === true;
  }, bridgePreviewPlanHash);
  const lockedTruth = await page.evaluate(() => ({
    telemetry: (window as any).TestBridge.getTelemetry(),
    render: (window as any).TestBridge.getRenderSnapshot()
  }));
  expect(lockedTruth.telemetry.routePreview.plan.planHash).toBe(bridgePreviewPlanHash);
  expect(lockedTruth.telemetry.lockedPlan.planHash).toBe(bridgePreviewPlanHash);
  expect(lockedTruth.telemetry.executor.planHash).toBe(bridgePreviewPlanHash);
  expect(lockedTruth.render.routeProxyPlanHash).toBe(bridgePreviewPlanHash);
  expect(lockedTruth.render.routeSegmentIds).toEqual(render.routeSegmentIds);
  expect(lockedTruth.render.selectedTarget).toMatchObject({ sourceTargetId: targetId, locked: true });

  const evidence = {
    schemaVersion: 1,
    normalRuntime: {
      url: "/",
      testBridgePresent: false,
      selectedTargetLabel: targetLabel,
      previewPlanHash,
      lockedVisiblePlanHash,
      previewToEngagePlanHashStable: lockedVisiblePlanHash === previewPlanHash,
      previewCanvas: previewCanvasEvidence,
      lockedCanvas: lockedCanvasEvidence,
      fullTruthCanvasAttributesPresent: false
    },
    queryGatedRuntime: {
      url: "/?testBridge=1",
      absoluteFrameId: navigationMap.absoluteFrameId,
      selectedTarget: render.selectedTarget,
      route: {
        sourcePlanHash: render.routeProxyPlanHash,
        sourceTargetId: navigationMap.route.targetId,
        segmentIds: render.routeSegmentIds,
        segments: render.routeSegments
      },
      entities: render.worldEntities,
      worldProvenance: render.worldProvenance,
      sourceNavigationMapSignature: render.sourceNavigationMapSignature,
      previewWorldPresentationSignature: render.worldPresentationSignature,
      lockedWorldPresentationSignature: lockedTruth.render.worldPresentationSignature,
      previewToEngagePlanHashStable: lockedTruth.telemetry.executor.planHash === bridgePreviewPlanHash,
      rendererOwnsWorldTruth: render.rendererOwnsWorldTruth
    },
    screenshots: Object.values(screenshotPaths).map(relativeEvidencePath)
  };
  await writeFile(
    path.join(evidenceRoot, "browser-live-world-presentation-truth-v1-summary.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(evidenceRoot, "browser-live-world-presentation-truth-v1.md"),
    `# Browser Live World Presentation Truth v1 Evidence\n\n` +
      `Generated by \`apps/weltraum-browser/tests/e2e/live-world-presentation-truth.spec.ts\`.\n\n` +
      `- Normal \`/\`: TestBridge absent; ${previewCanvasEvidence.worldEntityCount} map entities, ` +
      `${previewCanvasEvidence.landmarkWorldEntityCount} landmarks, ${previewCanvasEvidence.ambientWorldEntityCount} ambient entities, ` +
      `${previewCanvasEvidence.truthObstacleProxyCount} truth obstacle proxies, and ${previewCanvasEvidence.decorativeAsteroidCount} render-only cinematic asteroids.\n` +
      `- Visible Preview -> Engage PlanHash: \`${previewPlanHash}\` -> \`${lockedVisiblePlanHash}\`.\n` +
      `- Query-gated navigation-map signature: \`${render.sourceNavigationMapSignature}\`.\n` +
      `- Query-gated preview presentation signature: \`${render.worldPresentationSignature}\`.\n` +
      `- Renderer owns world truth: \`${render.rendererOwnsWorldTruth}\`.\n` +
      `- Full target, route segment, entity, provenance, and signature values: ` +
      `\`evidence/browser-live-world-presentation-truth-v1-summary.json\`.\n\n` +
      `## Screenshots\n\n` +
      Object.values(screenshotPaths).map((filePath) => `- \`${relativeEvidencePath(filePath)}\``).join("\n") +
      `\n`,
    "utf8"
  );
});
