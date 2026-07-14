import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const evidenceDirectory = path.resolve(process.cwd(), "evidence");
const snapshotDirectory = path.resolve(process.cwd(), "tests/e2e/render-backend-mesh-lifecycle.spec.ts-snapshots");
const updateSnapshots = process.env.UPDATE_RENDER_BACKEND_SNAPSHOTS === "1";
const focusedCommand = "npm run test:e2e -- tests/e2e/render-backend-mesh-lifecycle.spec.ts";

const imageNames = [
  "render-backend-parent-fallback.png",
  "render-backend-child-active.png",
  "render-backend-replacement-active.png"
] as const;

type ImageName = typeof imageNames[number];

interface BrowserFailures {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly requestFailures: string[];
  readonly httpErrors: string[];
}

interface PixelComparison {
  readonly width: number;
  readonly height: number;
  readonly changedPixels: number;
  readonly changedRatio: number;
  readonly maximumChannelDelta: number;
}

interface CanvasMetrics {
  readonly width: number;
  readonly height: number;
  readonly nonBackgroundPixels: number;
  readonly nonBackgroundRatio: number;
  readonly bounds: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };
}

interface LifecycleEvidence {
  readonly schemaVersion: "browser-render-backend-mesh-lifecycle-v1";
  readonly status: "PASS";
  readonly generator: "apps/weltraum-browser/tests/e2e/render-backend-mesh-lifecycle.spec.ts";
  readonly route: "/";
  readonly testBridgeAbsentBeforeAndAfter: true;
  readonly harness: {
    readonly width: 640;
    readonly height: 360;
    readonly pixelRatio: 1;
    readonly antialias: false;
    readonly animation: false;
    readonly lighting: "None";
  };
  readonly commandStatuses: Record<string, string>;
  readonly visibleKeys: {
    readonly parentFallback: readonly string[];
    readonly childActive: readonly string[];
    readonly replacementActive: readonly string[];
    readonly afterChildRemove: readonly string[];
    readonly afterReset: readonly string[];
    readonly afterRebuild: readonly string[];
  };
  readonly diagnostics: Record<string, unknown>;
  readonly screenshots: Readonly<Record<ImageName, {
    readonly baselineComparison: PixelComparison;
    readonly canvasMetrics: CanvasMetrics;
  }>>;
  readonly stateDeltas: {
    readonly parentToChild: PixelComparison;
    readonly childToReplacement: PixelComparison;
  };
  readonly browserHealth: {
    readonly consoleErrors: 0;
    readonly pageErrors: 0;
    readonly requestFailures: 0;
    readonly httpErrors: 0;
  };
  readonly verification: {
    readonly command: string;
    readonly canvasTolerance: "per-channel 12; changed-pixel ratio <= 0.005";
    readonly observedResult: "pass";
  };
}

const installFailureCollectors = (page: Page): BrowserFailures => {
  const failures: BrowserFailures = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location();
    failures.consoleErrors.push(`${message.text()} @ ${location.url}:${location.lineNumber}:${location.columnNumber}`);
  });
  page.on("pageerror", (error) => failures.pageErrors.push(error.message));
  page.on("requestfailed", (request) => failures.requestFailures.push(
    `${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`
  ));
  page.on("response", (response) => {
    if (!response.ok()) failures.httpErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
  return failures;
};

const testBridgeState = (page: Page): Promise<{ readonly ownProperty: boolean; readonly inWindow: boolean }> =>
  page.evaluate(() => ({
    ownProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
    inWindow: "TestBridge" in window
  }));

const decodeAndCompare = async (page: Page, expected: Buffer, actual: Buffer): Promise<PixelComparison> =>
  page.evaluate(async ({ expectedBase64, actualBase64 }) => {
    const decode = async (base64: string): Promise<{ width: number; height: number; pixels: Uint8ClampedArray }> => {
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context === null) throw new Error("Canvas 2D context unavailable for PNG comparison");
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      bitmap.close();
      return { width: canvas.width, height: canvas.height, pixels };
    };
    const expectedImage = await decode(expectedBase64);
    const actualImage = await decode(actualBase64);
    if (expectedImage.width !== actualImage.width || expectedImage.height !== actualImage.height) {
      throw new Error(`PNG size mismatch: ${expectedImage.width}x${expectedImage.height} vs ${actualImage.width}x${actualImage.height}`);
    }
    let changedPixels = 0;
    let maximumChannelDelta = 0;
    for (let offset = 0; offset < expectedImage.pixels.length; offset += 4) {
      let changed = false;
      for (let channel = 0; channel < 4; channel += 1) {
        const delta = Math.abs(expectedImage.pixels[offset + channel] - actualImage.pixels[offset + channel]);
        maximumChannelDelta = Math.max(maximumChannelDelta, delta);
        if (delta > 12) changed = true;
      }
      if (changed) changedPixels += 1;
    }
    return {
      width: actualImage.width,
      height: actualImage.height,
      changedPixels,
      changedRatio: changedPixels / (actualImage.width * actualImage.height),
      maximumChannelDelta
    };
  }, { expectedBase64: expected.toString("base64"), actualBase64: actual.toString("base64") });

const measureCanvas = async (page: Page, image: Buffer): Promise<CanvasMetrics> =>
  page.evaluate(async (base64) => {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("Canvas 2D context unavailable for PNG measurement");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const background = [pixels[0], pixels[1], pixels[2], pixels[3]];
    let nonBackgroundPixels = 0;
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const offset = (y * canvas.width + x) * 4;
        const differs = background.some((value, channel) => Math.abs(value - pixels[offset + channel]) > 12);
        if (!differs) continue;
        nonBackgroundPixels += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    if (nonBackgroundPixels === 0) throw new Error("Harness canvas is empty");
    return {
      width: canvas.width,
      height: canvas.height,
      nonBackgroundPixels,
      nonBackgroundRatio: nonBackgroundPixels / (canvas.width * canvas.height),
      bounds: { minX, minY, maxX, maxY }
    };
  }, image.toString("base64"));

const compareOrUpdateBaseline = async (page: Page, name: ImageName, actual: Buffer): Promise<PixelComparison> => {
  const baselinePath = path.join(snapshotDirectory, name);
  if (updateSnapshots) await writeFile(baselinePath, actual);
  let expected: Buffer;
  try {
    expected = await readFile(baselinePath);
  } catch (error) {
    throw new Error(`Missing baseline ${baselinePath}; rerun with UPDATE_RENDER_BACKEND_SNAPSHOTS=1`, { cause: error });
  }
  const comparison = await decodeAndCompare(page, expected, actual);
  expect(comparison.width).toBe(640);
  expect(comparison.height).toBe(360);
  expect(comparison.changedRatio, `${name} changed-pixel ratio`).toBeLessThanOrEqual(0.005);
  return comparison;
};

const createMarkdown = (evidence: LifecycleEvidence): string => `# Browser Render Backend Mesh Lifecycle V1 Evidence

## Result

- Status: \`${evidence.status}\`
- Normal route: \`${evidence.route}\`
- TestBridge absent before and after: \`${evidence.testBridgeAbsentBeforeAndAfter}\`
- Harness: \`${evidence.harness.width}x${evidence.harness.height}\`, DPR \`${evidence.harness.pixelRatio}\`, antialias \`${evidence.harness.antialias}\`, lighting \`${evidence.harness.lighting}\`
- Console/Page/Request/HTTP errors: \`${evidence.browserHealth.consoleErrors}/${evidence.browserHealth.pageErrors}/${evidence.browserHealth.requestFailures}/${evidence.browserHealth.httpErrors}\`

## Lifecycle

- Parent fallback visible keys: ${evidence.visibleKeys.parentFallback.map((key) => `\`${key}\``).join(", ")}
- Child active visible keys: ${evidence.visibleKeys.childActive.map((key) => `\`${key}\``).join(", ")}
- Replacement visible keys: ${evidence.visibleKeys.replacementActive.map((key) => `\`${key}\``).join(", ")}
- After child removal: ${evidence.visibleKeys.afterChildRemove.map((key) => `\`${key}\``).join(", ")}
- After reset: \`${evidence.visibleKeys.afterReset.length}\` visible keys
- After rebuild: ${evidence.visibleKeys.afterRebuild.map((key) => `\`${key}\``).join(", ")}
- Stale replace/remove: \`${evidence.commandStatuses.staleReplace}\` / \`${evidence.commandStatuses.staleRemove}\`
- Pinned fallback remove: \`${evidence.commandStatuses.pinnedParentRemove}\`
- Reset/replay: \`${evidence.commandStatuses.reset}\` / \`${evidence.commandStatuses.replayReplacement}\`

## Canvas Evidence

${imageNames.map((name) => {
  const entry = evidence.screenshots[name];
  return `- \`${name}\`: diff \`${entry.baselineComparison.changedRatio}\`, non-background \`${entry.canvasMetrics.nonBackgroundRatio}\`, bounds \`${entry.canvasMetrics.bounds.minX},${entry.canvasMetrics.bounds.minY}-${entry.canvasMetrics.bounds.maxX},${entry.canvasMetrics.bounds.maxY}\``;
}).join("\n")}

- Parent-to-child changed ratio: \`${evidence.stateDeltas.parentToChild.changedRatio}\`
- Child-to-replacement changed ratio: \`${evidence.stateDeltas.childToReplacement.changedRatio}\`

## Diagnostics After Rebuild

\`\`\`json
${JSON.stringify(evidence.diagnostics, null, 2)}
\`\`\`

## Verification

- Command: \`${evidence.verification.command}\`
- Canvas tolerance: ${evidence.verification.canvasTolerance}
- Observed: \`${evidence.verification.observedResult}\`
`;

test("normal route proves the deterministic render backend mesh lifecycle", async ({ page }) => {
  test.setTimeout(90_000);
  const failures = installFailureCollectors(page);
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await page.waitForLoadState("networkidle");
  expect(await testBridgeState(page)).toEqual({ ownProperty: false, inWindow: false });

  const scenario = await page.evaluateHandle(async () => {
    const presentationPath = "/src/presentation/index.ts";
    const backendPath = "/src/render/three/backend/index.ts";
    const presentation = await import(/* @vite-ignore */ presentationPath);
    const backend = await import(/* @vite-ignore */ backendPath);
    const harness = backend.createDeterministicRenderHarness({ parent: document.body, backgroundColor: 0x101820 });
    harness.canvas.style.position = "fixed";
    harness.canvas.style.left = "0";
    harness.canvas.style.top = "0";
    harness.canvas.style.zIndex = "2147483647";
    const parentKey = presentation.representationKey("planet:parent");
    const childKey = presentation.representationKey("planet:child");
    const relativeFrame = presentation.frameId("frame:camera-relative");
    const parentMaterialId = presentation.materialProfileId("material:parent");

    const profile = (id: string, color: readonly [number, number, number]) => presentation.createMaterialProfile({
      id: presentation.materialProfileId(id),
      kind: "Unlit",
      baseColor: { r: color[0], g: color[1], b: color[2] },
      opacity: 1,
      doubleSided: true,
      wireframe: false,
      depthWrite: true
    });
    const parentProfile = profile(parentMaterialId, [0.08, 0.36, 0.86]);

    const createArtifact = (
      key: string,
      revision: number,
      positions: readonly number[],
      indices: readonly number[],
      materialIds: readonly string[],
      ranges: readonly { readonly materialIndex: number; readonly startIndex: number; readonly indexCount: number }[]
    ) => presentation.createMeshArtifact({
      representationKey: presentation.representationKey(key),
      sourceRevision: presentation.sourceRevision(1),
      artifactRevision: presentation.artifactRevision(revision),
      algorithmVersion: "mesh:v1",
      frameId: relativeFrame,
      positions: new Float32Array(positions),
      normals: new Float32Array(Array.from({ length: positions.length / 3 }, () => [0, 0, 1]).flat()),
      indices: new Uint16Array(indices),
      materialRanges: ranges.map((range) => ({
        materialProfileId: presentation.materialProfileId(materialIds[range.materialIndex]),
        startIndex: range.startIndex,
        indexCount: range.indexCount
      })),
      bounds: { min: { x: -1.7, y: -1, z: 0 }, max: { x: 1.7, y: 1, z: 0 } }
    });

    const makeParent = () => createArtifact(
      parentKey,
      1,
      [-1.6, -1, 0, 1.6, -1, 0, 1.6, 1, 0, -1.6, 1, 0],
      [0, 1, 2, 0, 2, 3],
      [parentMaterialId],
      [{ materialIndex: 0, startIndex: 0, indexCount: 6 }]
    );
    const childV1Ids = ["material:child-left", "material:child-right"];
    const makeChildV1 = () => createArtifact(
      childKey,
      1,
      [-1.6, -1, 0, 0, -1, 0, 0, 1, 0, -1.6, 1, 0, 0, -1, 0, 1.6, -1, 0, 1.6, 1, 0, 0, 1, 0],
      [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7],
      childV1Ids,
      [{ materialIndex: 0, startIndex: 0, indexCount: 6 }, { materialIndex: 1, startIndex: 6, indexCount: 6 }]
    );
    const replacementIds = [
      "material:replacement-bottom",
      "material:replacement-right",
      "material:replacement-top",
      "material:replacement-left"
    ];
    const makeReplacement = () => createArtifact(
      childKey,
      2,
      [-1.6, -1, 0, 1.6, -1, 0, 1.6, 1, 0, -1.6, 1, 0, 0, 0, 0],
      [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4],
      replacementIds,
      [
        { materialIndex: 0, startIndex: 0, indexCount: 3 },
        { materialIndex: 1, startIndex: 3, indexCount: 3 },
        { materialIndex: 2, startIndex: 6, indexCount: 3 },
        { materialIndex: 3, startIndex: 9, indexCount: 3 }
      ]
    );
    const childProfiles = () => [profile(childV1Ids[0], [0.08, 0.82, 0.54]), profile(childV1Ids[1], [0.08, 0.72, 0.96])];
    const replacementProfiles = () => [
      profile(replacementIds[0], [1, 0.28, 0.06]),
      profile(replacementIds[1], [0.96, 0.06, 0.48]),
      profile(replacementIds[2], [1, 0.88, 0.08]),
      profile(replacementIds[3], [0.54, 0.12, 0.96])
    ];
    const transform = (representationKey: string) => ({
      representationKey: presentation.representationKey(representationKey),
      positionRelative: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    });
    const projection = (revision: number, keys: readonly string[]) => presentation.createFrameProjectionSnapshot({
      frameId: relativeFrame,
      frameRevision: presentation.frameRevision(revision),
      cameraPositionRelative: { x: 0, y: 0, z: 5 },
      cameraOrientation: { x: 0, y: 0, z: 0, w: 1 },
      projectionParameters: { kind: "Perspective", verticalFovDegrees: 50, aspect: 640 / 360, near: 0.1, far: 100 },
      representationTransforms: keys.map(transform)
    });
    const visibility = (revision: number, visible: readonly string[], fallback: readonly string[]) => presentation.createVisibilityPlan({
      planRevision: presentation.visibilityPlanRevision(revision),
      visibleRepresentationKeys: visible.map(presentation.representationKey),
      fallbackRepresentationKeys: fallback.map(presentation.representationKey),
      hiddenRepresentationKeys: []
    });
    let parentArtifact = makeParent();
    let childArtifact = makeChildV1();
    let replacementArtifact = makeReplacement();

    return {
      parentFallback: () => {
        const parentUpsert = harness.dispatch({ kind: "UpsertMeshArtifact", backendRevision: presentation.backendRevision(0), artifact: parentArtifact, materialProfiles: [parentProfile] });
        const parentProjection = harness.dispatch({ kind: "ApplyFrameProjection", backendRevision: presentation.backendRevision(0), snapshot: projection(1, [parentKey]) });
        const parentPlan = harness.dispatch({ kind: "ApplyVisibilityPlan", backendRevision: presentation.backendRevision(0), plan: visibility(1, [parentKey], []) });
        const fallbackPlan = harness.dispatch({ kind: "ApplyVisibilityPlan", backendRevision: presentation.backendRevision(0), plan: visibility(2, [childKey], [parentKey]) });
        const rendered = harness.render();
        return { parentUpsert, parentProjection, parentPlan, fallbackPlan, rendered, diagnostics: harness.backend.readDiagnostics() };
      },
      childActive: () => {
        const childUpsert = harness.dispatch({ kind: "UpsertMeshArtifact", backendRevision: presentation.backendRevision(0), artifact: childArtifact, materialProfiles: childProfiles() });
        const beforeTransform = harness.backend.readDiagnostics();
        const childProjection = harness.dispatch({ kind: "ApplyFrameProjection", backendRevision: presentation.backendRevision(0), snapshot: projection(2, [parentKey, childKey]) });
        const rendered = harness.render();
        return { childUpsert, beforeTransform, childProjection, rendered, diagnostics: harness.backend.readDiagnostics() };
      },
      replacementActive: () => {
        const replacementUpsert = harness.dispatch({ kind: "UpsertMeshArtifact", backendRevision: presentation.backendRevision(0), artifact: replacementArtifact, materialProfiles: replacementProfiles() });
        const rendered = harness.render();
        return { replacementUpsert, rendered, diagnostics: harness.backend.readDiagnostics() };
      },
      staleAndRemove: () => {
        const staleArtifact = makeChildV1();
        const staleReplace = harness.dispatch({ kind: "UpsertMeshArtifact", backendRevision: presentation.backendRevision(0), artifact: staleArtifact, materialProfiles: childProfiles() });
        const staleRemove = harness.dispatch({
          kind: "RemoveRepresentation",
          backendRevision: presentation.backendRevision(0),
          representationKey: childKey,
          expectedSourceRevision: staleArtifact.sourceRevision,
          expectedArtifactRevision: staleArtifact.artifactRevision,
          expectedContentHash: staleArtifact.contentHash
        });
        const pinnedParentRemove = harness.dispatch({
          kind: "RemoveRepresentation",
          backendRevision: presentation.backendRevision(0),
          representationKey: parentKey,
          expectedSourceRevision: parentArtifact.sourceRevision,
          expectedArtifactRevision: parentArtifact.artifactRevision,
          expectedContentHash: parentArtifact.contentHash
        });
        const childRemove = harness.dispatch({
          kind: "RemoveRepresentation",
          backendRevision: presentation.backendRevision(0),
          representationKey: childKey,
          expectedSourceRevision: replacementArtifact.sourceRevision,
          expectedArtifactRevision: replacementArtifact.artifactRevision,
          expectedContentHash: replacementArtifact.contentHash
        });
        const rendered = harness.render();
        return { staleReplace, staleRemove, pinnedParentRemove, childRemove, rendered, diagnostics: harness.backend.readDiagnostics() };
      },
      resetReplay: () => {
        const reset = harness.dispatch({ kind: "ResetBackend", backendRevision: presentation.backendRevision(0), nextBackendRevision: presentation.backendRevision(1) });
        const afterReset = harness.backend.readDiagnostics();
        parentArtifact = makeParent();
        replacementArtifact = makeReplacement();
        const replayParent = harness.dispatch({ kind: "UpsertMeshArtifact", backendRevision: presentation.backendRevision(1), artifact: parentArtifact, materialProfiles: [parentProfile] });
        const replayReplacement = harness.dispatch({ kind: "UpsertMeshArtifact", backendRevision: presentation.backendRevision(1), artifact: replacementArtifact, materialProfiles: replacementProfiles() });
        const replayProjection = harness.dispatch({ kind: "ApplyFrameProjection", backendRevision: presentation.backendRevision(1), snapshot: projection(1, [parentKey, childKey]) });
        const replayPlan = harness.dispatch({ kind: "ApplyVisibilityPlan", backendRevision: presentation.backendRevision(1), plan: visibility(1, [childKey], [parentKey]) });
        const rendered = harness.render();
        return { reset, afterReset, replayParent, replayReplacement, replayProjection, replayPlan, rendered, diagnostics: harness.backend.readDiagnostics() };
      },
      dispose: () => ({ result: harness.dispose(), diagnostics: harness.backend.readDiagnostics() })
    };
  });

  const canvas = page.locator("canvas[data-render-backend-harness='v1']");
  await expect(canvas).toHaveCount(1);

  const parent = await scenario.evaluate((value) => value.parentFallback());
  expect(parent.parentUpsert).toMatchObject({ status: "Accepted", ownership: "MovedToBackend" });
  expect(parent.fallbackPlan.status).toBe("Accepted");
  expect(parent.diagnostics.visibleRepresentationKeys).toEqual(["planet:parent"]);
  expect(parent.diagnostics.pinnedFallbackRepresentationKeys).toEqual(["planet:parent"]);
  const parentImage = await canvas.screenshot();

  const child = await scenario.evaluate((value) => value.childActive());
  expect(child.childUpsert).toMatchObject({ status: "Accepted", ownership: "MovedToBackend" });
  expect(child.beforeTransform.visibleRepresentationKeys).toEqual(["planet:parent"]);
  expect(child.diagnostics.visibleRepresentationKeys).toEqual(["planet:child"]);
  const childImage = await canvas.screenshot();

  const replacement = await scenario.evaluate((value) => value.replacementActive());
  expect(replacement.replacementUpsert).toMatchObject({ status: "Accepted", ownership: "MovedToBackend" });
  expect(replacement.diagnostics.visibleRepresentationKeys).toEqual(["planet:child"]);
  expect(replacement.diagnostics.replacementCount).toBe(1);
  expect(replacement.diagnostics.geometryDisposals).toBe(1);
  const replacementImage = await canvas.screenshot();

  const removed = await scenario.evaluate((value) => value.staleAndRemove());
  expect(removed.staleReplace.status).toBe("RejectedStaleRevision");
  expect(removed.staleRemove.status).toBe("RejectedStaleRevision");
  expect(removed.pinnedParentRemove).toMatchObject({ status: "RejectedContentConflict", reasonCode: "PinnedFallback" });
  expect(removed.childRemove).toMatchObject({ status: "Accepted", ownership: "ReleasedByBackend" });
  expect(removed.diagnostics.visibleRepresentationKeys).toEqual(["planet:parent"]);
  const restoredParentImage = await canvas.screenshot();

  const resetReplay = await scenario.evaluate((value) => value.resetReplay());
  expect(resetReplay.reset).toMatchObject({ status: "Accepted", ownership: "ReleasedByBackend" });
  expect(resetReplay.afterReset).toMatchObject({
    backendRevision: 1,
    activeRepresentations: 0,
    estimatedGpuBytes: 0,
    ownedCpuBytes: 0,
    resetCount: 1
  });
  expect(resetReplay.replayParent.status).toBe("Accepted");
  expect(resetReplay.replayReplacement.status).toBe("Accepted");
  expect(resetReplay.diagnostics.visibleRepresentationKeys).toEqual(["planet:child"]);
  const rebuiltReplacementImage = await canvas.screenshot();

  await mkdir(snapshotDirectory, { recursive: true });
  await mkdir(evidenceDirectory, { recursive: true });
  const images: Readonly<Record<ImageName, Buffer>> = {
    "render-backend-parent-fallback.png": parentImage,
    "render-backend-child-active.png": childImage,
    "render-backend-replacement-active.png": replacementImage
  };
  const screenshotEvidence = {} as Record<ImageName, { baselineComparison: PixelComparison; canvasMetrics: CanvasMetrics }>;
  for (const name of imageNames) {
    const image = images[name];
    await writeFile(path.join(evidenceDirectory, name), image);
    const baselineComparison = await compareOrUpdateBaseline(page, name, image);
    const canvasMetrics = await measureCanvas(page, image);
    expect(canvasMetrics.nonBackgroundRatio, `${name} must be visibly non-empty`).toBeGreaterThan(0.08);
    expect(canvasMetrics.bounds.minX).toBeGreaterThan(0);
    expect(canvasMetrics.bounds.minY).toBeGreaterThan(0);
    expect(canvasMetrics.bounds.maxX).toBeLessThan(639);
    expect(canvasMetrics.bounds.maxY).toBeLessThan(359);
    screenshotEvidence[name] = { baselineComparison, canvasMetrics };
  }

  const restoredParentComparison = await decodeAndCompare(page, parentImage, restoredParentImage);
  expect(restoredParentComparison.changedRatio, "child removal must restore the parent pixels").toBeLessThanOrEqual(0.005);
  const rebuiltReplacementComparison = await decodeAndCompare(page, replacementImage, rebuiltReplacementImage);
  expect(rebuiltReplacementComparison.changedRatio, "reset/replay must restore replacement pixels").toBeLessThanOrEqual(0.005);
  const parentToChild = await decodeAndCompare(page, parentImage, childImage);
  const childToReplacement = await decodeAndCompare(page, childImage, replacementImage);
  expect(parentToChild.changedRatio).toBeGreaterThan(0.05);
  expect(childToReplacement.changedRatio).toBeGreaterThan(0.05);

  expect(await testBridgeState(page)).toEqual({ ownProperty: false, inWindow: false });
  const disposed = await scenario.evaluate((value) => value.dispose());
  expect(disposed.result.status).toBe("Accepted");
  expect(disposed.diagnostics).toMatchObject({ activeRepresentations: 0, estimatedGpuBytes: 0, ownedCpuBytes: 0, backendState: "Disposed" });
  await scenario.dispose();
  expect(failures).toEqual({ consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] });

  const evidence: LifecycleEvidence = {
    schemaVersion: "browser-render-backend-mesh-lifecycle-v1",
    status: "PASS",
    generator: "apps/weltraum-browser/tests/e2e/render-backend-mesh-lifecycle.spec.ts",
    route: "/",
    testBridgeAbsentBeforeAndAfter: true,
    harness: { width: 640, height: 360, pixelRatio: 1, antialias: false, animation: false, lighting: "None" },
    commandStatuses: {
      parentUpsert: parent.parentUpsert.status,
      fallbackPlan: parent.fallbackPlan.status,
      childUpsert: child.childUpsert.status,
      childProjection: child.childProjection.status,
      replacementUpsert: replacement.replacementUpsert.status,
      staleReplace: removed.staleReplace.status,
      staleRemove: removed.staleRemove.status,
      pinnedParentRemove: removed.pinnedParentRemove.status,
      childRemove: removed.childRemove.status,
      reset: resetReplay.reset.status,
      replayParent: resetReplay.replayParent.status,
      replayReplacement: resetReplay.replayReplacement.status
    },
    visibleKeys: {
      parentFallback: parent.diagnostics.visibleRepresentationKeys,
      childActive: child.diagnostics.visibleRepresentationKeys,
      replacementActive: replacement.diagnostics.visibleRepresentationKeys,
      afterChildRemove: removed.diagnostics.visibleRepresentationKeys,
      afterReset: resetReplay.afterReset.visibleRepresentationKeys,
      afterRebuild: resetReplay.diagnostics.visibleRepresentationKeys
    },
    diagnostics: resetReplay.diagnostics,
    screenshots: screenshotEvidence,
    stateDeltas: { parentToChild, childToReplacement },
    browserHealth: { consoleErrors: 0, pageErrors: 0, requestFailures: 0, httpErrors: 0 },
    verification: {
      command: focusedCommand,
      canvasTolerance: "per-channel 12; changed-pixel ratio <= 0.005",
      observedResult: "pass"
    }
  };
  await writeFile(
    path.join(evidenceDirectory, "browser-render-backend-mesh-lifecycle-v1-summary.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(evidenceDirectory, "browser-render-backend-mesh-lifecycle-v1.md"),
    createMarkdown(evidence),
    "utf8"
  );
});
