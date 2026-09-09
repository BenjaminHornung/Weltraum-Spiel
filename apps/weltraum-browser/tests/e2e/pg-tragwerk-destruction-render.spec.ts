import { expect, test, type Page } from "@playwright/test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const evidenceDirectory = path.resolve(process.cwd(), "evidence");
const focusedCommand = "npx playwright test tests/e2e/pg-tragwerk-destruction-render.spec.ts";
const recordEvidence = process.env.WELTRAUM_RECORD_EVIDENCE === "1";
const harnessDimensions = { width: 640, height: 360 } as const;
interface PixelDeltaBand {
  readonly calibrationChangedPixels: number;
  readonly calibrationChangedRatio: number;
  readonly calibrationMaximumChannelDelta: number;
  readonly minChangedPixels: number;
  readonly maxChangedPixels: number;
  readonly minMaximumChannelDelta: number;
}

interface PixelEvidenceContract {
  readonly dimensions: typeof harnessDimensions;
  readonly perChannelTolerance: 12;
  readonly nonEmptyMinimumRatio: 0.01;
  readonly deltaBands: {
    readonly beforeAfter: PixelDeltaBand;
    readonly lowHigh: PixelDeltaBand;
  };
}

interface ScreenshotEvidence {
  readonly width: number;
  readonly height: number;
  readonly nonEmpty: true;
}

const pixelEvidenceContract: PixelEvidenceContract = {
  dimensions: harnessDimensions,
  perChannelTolerance: 12,
  nonEmptyMinimumRatio: 0.01,
  deltaBands: {
    beforeAfter: {
      calibrationChangedPixels: 109,
      calibrationChangedRatio: 109 / (harnessDimensions.width * harnessDimensions.height),
      calibrationMaximumChannelDelta: 210,
      minChangedPixels: 50,
      maxChangedPixels: 2048,
      minMaximumChannelDelta: 100
    },
    lowHigh: {
      calibrationChangedPixels: 4324,
      calibrationChangedRatio: 4324 / (harnessDimensions.width * harnessDimensions.height),
      calibrationMaximumChannelDelta: 166,
      minChangedPixels: 1024,
      maxChangedPixels: 16384,
      minMaximumChannelDelta: 100
    }
  }
};

const persistDeterministicEvidence = async (fileName: string, content: Buffer | string): Promise<void> => {
  const filePath = path.join(evidenceDirectory, fileName);
  const bytes = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  try {
    if ((await readFile(filePath)).equals(bytes)) return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (!recordEvidence) {
    throw new Error(`Evidence differs at ${fileName}; rerun with WELTRAUM_RECORD_EVIDENCE=1 to record it explicitly.`);
  }
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(filePath, bytes);
};

const persistRecordedPngEvidence = async (fileName: string, content: Buffer): Promise<void> => {
  if (!recordEvidence) return;
  await persistDeterministicEvidence(fileName, content);
};

const pngNames = [
  "pg-tragwerk-r5b-before.png",
  "pg-tragwerk-r5b-after.png",
  "pg-tragwerk-r5b-lod-low.png",
  "pg-tragwerk-r5b-lod-high.png"
] as const;
type PngName = (typeof pngNames)[number];

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
  page.evaluate(async ({ expectedBase64, actualBase64, perChannelTolerance }) => {
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
        if (delta > perChannelTolerance) changed = true;
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
  }, {
    expectedBase64: expected.toString("base64"),
    actualBase64: actual.toString("base64"),
    perChannelTolerance: pixelEvidenceContract.perChannelTolerance
  });

const measureCanvas = async (page: Page, image: Buffer): Promise<CanvasMetrics> =>
  page.evaluate(async ({ base64, perChannelTolerance }) => {
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
        const differs = background.some((value, channel) => Math.abs(value - pixels[offset + channel]) > perChannelTolerance);
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
  }, { base64: image.toString("base64"), perChannelTolerance: pixelEvidenceContract.perChannelTolerance });

const assertPixelDeltaBand = (comparison: PixelComparison, band: PixelDeltaBand, label: string): void => {
  expect(comparison.changedPixels, `${label} changed-pixel lower band`).toBeGreaterThanOrEqual(band.minChangedPixels);
  expect(comparison.changedPixels, `${label} changed-pixel upper band`).toBeLessThanOrEqual(band.maxChangedPixels);
  expect(comparison.maximumChannelDelta, `${label} maximum channel delta`).toBeGreaterThanOrEqual(band.minMaximumChannelDelta);
};

const assertCanvasEvidence = async (page: Page, name: string, image: Buffer): Promise<CanvasMetrics> => {
  const metrics = await measureCanvas(page, image);
  expect(metrics.width, `${name} must use the deterministic harness width`).toBe(harnessDimensions.width);
  expect(metrics.height, `${name} must use the deterministic harness height`).toBe(harnessDimensions.height);
  expect(metrics.nonBackgroundRatio, `${name} must be visibly non-empty`).toBeGreaterThan(pixelEvidenceContract.nonEmptyMinimumRatio);
  return metrics;
};

const readStoredPngEvidence = async (directory: string, fileName: PngName): Promise<Buffer> => {
  const filePath = path.join(directory, fileName);
  try {
    return await readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Missing stored PNG evidence at ${filePath}; record it explicitly with WELTRAUM_RECORD_EVIDENCE=1.`, { cause: error });
    }
    throw error;
  }
};

// P-PROD-P04: Blank-Snippet-Duplikat beseitigt — beide Tests nutzen diesen
// einen Helfer statt zweier identischer Inline-Snippets.
const renderBlankPng = async (page: Page): Promise<Buffer> => {
  const blankImageBase64 = await page.evaluate(({ width, height }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas.toDataURL("image/png").split(",", 2)[1]!;
  }, harnessDimensions);
  return Buffer.from(blankImageBase64, "base64");
};

const loadAndValidateStoredPngEvidence = async (page: Page, directory: string): Promise<Readonly<Record<PngName, Buffer>>> => {
  const storedImages = {} as Record<PngName, Buffer>;
  for (const name of pngNames) storedImages[name] = await readStoredPngEvidence(directory, name);

  for (const name of pngNames) await assertCanvasEvidence(page, `stored ${name}`, storedImages[name]);

  const storedBeforeAfter = await decodeAndCompare(
    page,
    storedImages["pg-tragwerk-r5b-before.png"],
    storedImages["pg-tragwerk-r5b-after.png"]
  );
  assertPixelDeltaBand(storedBeforeAfter, pixelEvidenceContract.deltaBands.beforeAfter, "stored before/after destruction");

  const storedLowHigh = await decodeAndCompare(
    page,
    storedImages["pg-tragwerk-r5b-lod-low.png"],
    storedImages["pg-tragwerk-r5b-lod-high.png"]
  );
  assertPixelDeltaBand(storedLowHigh, pixelEvidenceContract.deltaBands.lowHigh, "stored low/high LOD");
  return storedImages;
};

test("normal route renders the operable PG-TRAGWERK-01 R5B destruction scene", async ({ page }) => {
  test.setTimeout(120_000);
  const failures = installFailureCollectors(page);
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await page.waitForLoadState("networkidle");
  expect(await testBridgeState(page)).toEqual({ ownProperty: false, inWindow: false });

  const scenario = await page.evaluateHandle(async () => {
    const presentationPath = String("/src/presentation/index.ts");
    const backendPath = String("/src/render/three/backend/index.ts");
    const structuralPath = String("/src/voxel/structural/index.ts");
    const fixturePath = String("/tests/support/pgTragwerkFixtureAdapter.ts");
    const queuePath = String("/src/workers/queue.ts");
    const workerIdsPath = String("/src/workers/ids.ts");
    const presentation = await import(/* @vite-ignore */ presentationPath);
    const backend = await import(/* @vite-ignore */ backendPath);
    const structural = await import(/* @vite-ignore */ structuralPath);
    const fixture = await import(/* @vite-ignore */ fixturePath);
    const queueModule = await import(/* @vite-ignore */ queuePath);
    const workerIds = await import(/* @vite-ignore */ workerIdsPath);

    const CANVAS_WIDTH = 640;
    const CANVAS_HEIGHT = 360;
    const CELL_METERS = 0.125;
    const LOD_LOW_COLOR: [number, number, number] = [1, 0.15, 0.75];
    const LOD_HIGH_COLORS: Array<[number, number, number]> = [[0.1, 0.9, 0.9], [1, 0.9, 0.1]];

    const container = document.createElement("section");
    container.setAttribute("data-testid", "pg-tragwerk-r5b");
    container.style.position = "fixed";
    container.style.left = "0";
    container.style.top = "0";
    container.style.zIndex = "2147483647";
    container.style.background = "#0b1118";
    container.style.color = "#e8eef4";
    container.style.font = "12px/1.4 system-ui, sans-serif";
    container.style.padding = "8px";
    const badge = document.createElement("div");
    badge.textContent = "Modus: PG-TRAGWERK R5B";
    const destroyButton = document.createElement("button");
    destroyButton.setAttribute("data-testid", "pg-tragwerk-destroy");
    destroyButton.textContent = "Zerstörung auslösen";
    destroyButton.type = "button";
    const status = document.createElement("div");
    status.setAttribute("data-testid", "pg-tragwerk-status");
    status.textContent = "Bereit";
    container.append(badge, destroyButton, status);
    document.body.append(container);

    const harness = backend.createDeterministicRenderHarness({ parent: container, backgroundColor: 0x101820 });
    harness.canvas.style.position = "static";

    const relativeFrame = presentation.frameId("frame:pg-r5b");
    let backendRevision = 0;
    let artifactRevision = 0;
    let frameRevision = 0;
    let planRevision = 0;

    const profile = (id: string, color: readonly [number, number, number]) => presentation.createMaterialProfile({
      id: presentation.materialProfileId(id),
      kind: "Unlit",
      baseColor: { r: color[0], g: color[1], b: color[2] },
      opacity: 1,
      doubleSided: true,
      wireframe: false,
      depthWrite: true
    });

    // Eine Box als 8 Vertices + 36 Indices (Unlit/doubleSided: Winding egal).
    const BOX_INDICES = [4, 5, 6, 4, 6, 7, 0, 2, 1, 0, 3, 2, 1, 2, 6, 1, 6, 5, 0, 4, 7, 0, 7, 3, 3, 7, 6, 3, 6, 2, 0, 1, 5, 0, 5, 4];

    interface RenderBox { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number]; readonly profileId: string }

    const showScene = (key: string, boxes: readonly RenderBox[], profiles: readonly unknown[], cameraDistance: number) => {
      const reset = harness.dispatch({
        kind: "ResetBackend",
        backendRevision: presentation.backendRevision(backendRevision),
        nextBackendRevision: presentation.backendRevision(backendRevision + 1)
      });
      if (reset.status !== "Accepted") throw new Error(`ResetBackend rejected: ${reset.status}`);
      backendRevision += 1;
      let minX = Infinity; let minY = Infinity; let minZ = Infinity;
      let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
      for (const box of boxes) {
        minX = Math.min(minX, box.min[0]); minY = Math.min(minY, box.min[1]); minZ = Math.min(minZ, box.min[2]);
        maxX = Math.max(maxX, box.max[0]); maxY = Math.max(maxY, box.max[1]); maxZ = Math.max(maxZ, box.max[2]);
      }
      const center: [number, number, number] = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
      const positions: number[] = [];
      const normals: number[] = [];
      const indices: number[] = [];
      boxes.forEach((box, boxIndex) => {
        const corners: Array<[number, number, number]> = [
          [box.min[0], box.min[1], box.min[2]], [box.max[0], box.min[1], box.min[2]],
          [box.max[0], box.max[1], box.min[2]], [box.min[0], box.max[1], box.min[2]],
          [box.min[0], box.min[1], box.max[2]], [box.max[0], box.min[1], box.max[2]],
          [box.max[0], box.max[1], box.max[2]], [box.min[0], box.max[1], box.max[2]]
        ];
        for (const corner of corners) {
          positions.push(corner[0] - center[0], corner[1] - center[1], corner[2] - center[2]);
          normals.push(0, 0, 1);
        }
        for (const index of BOX_INDICES) indices.push(boxIndex * 8 + index);
      });
      artifactRevision += 1;
      const representationKey = presentation.representationKey(key);
      const artifact = presentation.createMeshArtifact({
        representationKey,
        sourceRevision: presentation.sourceRevision(1),
        artifactRevision: presentation.artifactRevision(artifactRevision),
        algorithmVersion: "mesh:v1",
        frameId: relativeFrame,
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        indices: new Uint32Array(indices),
        materialRanges: boxes.map((box, boxIndex) => ({
          materialProfileId: presentation.materialProfileId(box.profileId),
          startIndex: boxIndex * BOX_INDICES.length,
          indexCount: BOX_INDICES.length
        })),
        bounds: { min: { x: minX - center[0], y: minY - center[1], z: minZ - center[2] }, max: { x: maxX - center[0], y: maxY - center[1], z: maxZ - center[2] } }
      });
      const upsert = harness.dispatch({
        kind: "UpsertMeshArtifact",
        backendRevision: presentation.backendRevision(backendRevision),
        artifact,
        materialProfiles: profiles as never
      });
      if (upsert.status !== "Accepted") throw new Error(`UpsertMeshArtifact rejected: ${upsert.status}`);
      frameRevision += 1;
      const projection = harness.dispatch({
        kind: "ApplyFrameProjection",
        backendRevision: presentation.backendRevision(backendRevision),
        snapshot: presentation.createFrameProjectionSnapshot({
          frameId: relativeFrame,
          frameRevision: presentation.frameRevision(frameRevision),
          cameraPositionRelative: { x: 0, y: 0, z: cameraDistance },
          cameraOrientation: { x: 0, y: 0, z: 0, w: 1 },
          projectionParameters: { kind: "Perspective", verticalFovDegrees: 50, aspect: CANVAS_WIDTH / CANVAS_HEIGHT, near: 0.01, far: 100 },
          representationTransforms: [{
            representationKey,
            positionRelative: { x: 0, y: 0, z: 0 },
            orientation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 }
          }]
        })
      });
      if (projection.status !== "Accepted") throw new Error(`ApplyFrameProjection rejected: ${projection.status}`);
      planRevision += 1;
      const plan = harness.dispatch({
        kind: "ApplyVisibilityPlan",
        backendRevision: presentation.backendRevision(backendRevision),
        plan: presentation.createVisibilityPlan({
          planRevision: presentation.visibilityPlanRevision(planRevision),
          visibleRepresentationKeys: [representationKey],
          fallbackRepresentationKeys: [],
          hiddenRepresentationKeys: []
        })
      });
      if (plan.status !== "Accepted") throw new Error(`ApplyVisibilityPlan rejected: ${plan.status}`);
      const rendered = harness.render();
      if (rendered.status !== "Accepted") throw new Error(`renderFrame rejected: ${rendered.status}`);
      return harness.backend.readDiagnostics();
    };

    const objectCells = (object: never) => {
      const cells: Array<{ readonly global: { readonly x: number; readonly y: number; readonly z: number }; readonly materialId: number }> = [];
      const bricks = (object as { bricks: ReadonlyArray<never> }).bricks as unknown as Array<{
        cells: ReadonlyArray<{ localIndex: unknown; state: { materialId: number } }>
      }>;
      for (const brick of bricks) {
        for (const cell of brick.cells) {
          const address = structural.structuralAddressForBrickCell(brick as never, cell.localIndex as never);
          const global = structural.globalQuantumForStructuralCell(address);
          cells.push({ global, materialId: cell.state.materialId });
        }
      }
      return cells;
    };

    const cellBoxes = (object: never, colors: Record<number, string>): readonly RenderBox[] =>
      objectCells(object).map((cell) => ({
        min: [cell.global.x * CELL_METERS, cell.global.y * CELL_METERS, cell.global.z * CELL_METERS] as const,
        max: [(cell.global.x + 1) * CELL_METERS, (cell.global.y + 1) * CELL_METERS, (cell.global.z + 1) * CELL_METERS] as const,
        profileId: colors[cell.materialId]
      }));

    const sceneMeshBudgets = { maxVisitedCells: 64, maxQuads: 1024, maxVertices: 4096, maxIndices: 6144 };
    const describeScene = (object: never, lod: "low" | "high") => {
      const meshResult = structural.extractStructuralMeshData(object, sceneMeshBudgets);
      if (meshResult.status !== "Produced") throw new Error(`Scene mesh not produced: ${meshResult.status}`);
      return structural.describeR5Scene(object, meshResult.product, lod);
    };
    const colorFromHex = (hex: string): [number, number, number] => [
      Number.parseInt(hex.slice(1, 3), 16) / 255,
      Number.parseInt(hex.slice(3, 5), 16) / 255,
      Number.parseInt(hex.slice(5, 7), 16) / 255
    ];
    const materialProfiles = (materials: ReadonlyArray<{ readonly materialId: number; readonly displayColor: string }>) => {
      const colorFor = (materialId: number): [number, number, number] => {
        const material = materials.find((candidate) => candidate.materialId === materialId);
        if (material === undefined) throw new Error(`Scene material ${materialId} missing`);
        return colorFromHex(material.displayColor);
      };
      return [
        profile("material:pg-terrain", colorFor(1)),
        profile("material:pg-steel", colorFor(2)),
        profile("material:pg-beam", colorFor(3))
      ];
    };
    const profileForMaterial: Record<number, string> = { 1: "material:pg-terrain", 2: "material:pg-steel", 3: "material:pg-beam" };

    const countOccupied = (object: never): number => objectCells(object).length;

    let covered = fixture.createCoveredPgTragwerk01() as never;
    let current = covered;
    let beforeHash = "";
    let afterHash = "";
    let lastCut: { readonly occupiedCells: number; readonly contentHash: string; readonly visibleKeys: readonly string[] } | null = null;

    const renderFullObject = (object: never, key: string) => {
      const scene = describeScene(object, "low");
      const boxes = cellBoxes(object, profileForMaterial);
      if (scene.sourceContentHash !== (object as { contentHash: string }).contentHash) {
        throw new Error("Scene descriptor is not bound to the rendered object.");
      }
      return showScene(key, boxes, materialProfiles(scene.materials), 4.2);
    };

    const initialDiagnostics = renderFullObject(current, "pg-r5b:before");
    beforeHash = (current as { contentHash: string }).contentHash;
    status.textContent = `Bereit: ${countOccupied(current)} Zellen`;

    const budgets = {
      mesh: { maxVisitedCells: 64, maxQuads: 1024, maxVertices: 4096, maxIndices: 6144 },
      connectivity: { maxVisitedCells: 64, maxComponents: 16, maxIndexedFacts: 64 },
      transition: { maxFragments: 8, maxCollidersPerFragment: 16, maxVoxelsPerFragment: 16 },
      mass: { maxVisitedCells: 64 },
      componentMass: { maxVisitedCells: 64, maxConnectivityCells: 64, maxComponents: 16, maxConnectivityFacts: 64 },
      prepare: { maxOccupiedCells: 64, maxBricks: 16, maxTotalWork: 512 }
    };

    const spinParentMotion = {
      velocityMetersPerSecond: { x: 1, y: 0.5, z: -0.25 },
      angularVelocityRadPerSecond: { x: 0, y: 1.5, z: 2 }
    };

    const commitCutThroughStructuralCommand = () => {
        const command = fixture.pgCutCommand(current, fixture.pgCutBounds, "command.pg-tragwerk-r5b-e2e-01");
        const result = structural.applyStructuralDestructionCommand(current, command);
        if (result.status !== "Applied") throw new Error(`Canonical cut rejected: ${(result as { code?: string }).code ?? result.status}`);
        current = result.object as never;
        afterHash = (current as { contentHash: string }).contentHash;
        const diagnostics = renderFullObject(current, "pg-r5b:after");
        status.textContent = `Zerstört: ${countOccupied(current)} Zellen`;
        return {
          occupiedCells: countOccupied(current),
          contentHash: afterHash,
          visibleKeys: diagnostics.visibleRepresentationKeys
        };
      };
    destroyButton.addEventListener("click", () => { lastCut = commitCutThroughStructuralCommand(); });

    return {
      occupiedBefore: () => countOccupied(current),
      initialVisibleKeys: () => initialDiagnostics.visibleRepresentationKeys as readonly string[],
      lastCut: () => lastCut,
      showLod: (lod: string) => {
        const classification = structural.deriveStructuralComponentClassification(current, budgets.connectivity);
        const plan = structural.deriveStructuralPhysicsTransition(
          current, classification, spinParentMotion, budgets.transition, budgets.componentMass, "live-parent-body"
        );
        if (plan.status !== "Installed") throw new Error(`LOD plan not installed: ${plan.status}`);
        const geometry = structural.selectR5RenderLodGeometry(plan, lod);
        const boxes: RenderBox[] = geometry.map((box: never, index: number) => {
          const typed = box as { minMeters: { x: number; y: number; z: number }; maxMeters: { x: number; y: number; z: number }; materialVariant: string };
          return {
            min: [typed.minMeters.x, typed.minMeters.y, typed.minMeters.z] as const,
            max: [typed.maxMeters.x, typed.maxMeters.y, typed.maxMeters.z] as const,
            profileId: lod === "low" ? "material:pg-lod-low" : `material:pg-lod-high-${index % 2}`
          };
        });
        const profiles = lod === "low"
          ? [profile("material:pg-lod-low", LOD_LOW_COLOR)]
          : [profile("material:pg-lod-high-0", LOD_HIGH_COLORS[0]), profile("material:pg-lod-high-1", LOD_HIGH_COLORS[1])];
        const diagnostics = showScene(`pg-r5b:lod-${lod}`, boxes, profiles, 1.1);
        return {
          boxCount: boxes.length,
          materialVariant: (geometry[0] as { materialVariant: string }).materialVariant,
          visibleKeys: diagnostics.visibleRepresentationKeys
        };
      },
      domainProof: () => {
        const timed = <T>(step: () => T): { value: T; ms: number } => {
          const start = performance.now();
          const value = step();
          return { value, ms: Math.max(0, performance.now() - start) };
        };
        const decision = structural.prepareR5Bounded(current, budgets.prepare);
        const classify = timed(() => structural.deriveStructuralComponentClassification(current, budgets.connectivity));
        const meshResult = timed(() => structural.extractStructuralMeshData(current, budgets.mesh));
        if (meshResult.value.status !== "Produced") throw new Error("Mesh not produced in domain proof");
        const mesh = meshResult.value.product;
        const transition = timed(() => structural.deriveStructuralPhysicsTransition(
          current, classify.value, spinParentMotion, budgets.transition, budgets.componentMass, "live-parent-body"
        ));
        const measured = structural.measureR5Work({
          occupiedCells: decision.occupiedCells,
          classification: classify.value,
          meshQuadCount: mesh.indices.length / 6,
          plan: transition.value,
          timings: { classifyMs: classify.ms, meshMs: meshResult.ms, transitionMs: transition.ms }
        });
        const massKg = structural.deriveStructuralObjectMassProperties(current, budgets.mass).totalMassKg;
        const low = structural.selectR5RenderLodGeometry(transition.value, "low");
        const high = structural.selectR5RenderLodGeometry(transition.value, "high");
        const lowScene = structural.describeR5Scene(current, mesh, "low");
        const highScene = structural.describeR5Scene(current, mesh, "high");
        // Deferred-Vollzug ueber die echte Queue (synchron dispatch-then-execute).
        const deferredDecision = structural.prepareR5Bounded(current, { maxOccupiedCells: 64, maxBricks: 16, maxTotalWork: 10 });
        const queue = new queueModule.StableWorkerJobQueue(4);
        const request = structural.createR5DeferredJobRequest(deferredDecision, current);
        const payloadRoundtrip = JSON.parse(JSON.stringify(request.payload));
        const enqueueResult = queue.enqueue(request);
        const completion = structural.completeR5DeferredRun(current, queue, request, budgets.prepare, {
          classify: (object: never) => structural.deriveStructuralComponentClassification(object, budgets.connectivity),
          mesh: (object: never) => {
            const produced = structural.extractStructuralMeshData(object, budgets.mesh);
            if (produced.status !== "Produced") throw new Error("Deferred mesh not produced");
            return produced.product;
          },
          transition: (object: never, classification: never) => structural.deriveStructuralPhysicsTransition(
            object, classification, spinParentMotion, budgets.transition, budgets.componentMass, "live-parent-body"
          ),
          massKg: (object: never) => structural.deriveStructuralObjectMassProperties(object, budgets.mass).totalMassKg
        });
        // Coverage-Bindung: Fixture ok, Fremd-Objekt/Revsion fail-closed.
        const freshCovered = fixture.createCoveredPgTragwerk01();
        let foreignThrows = false;
        try {
          structural.withFullKnownCoverage({ ...(freshCovered as object), objectId: "object.other" } as never);
        } catch { foreignThrows = true; }
        return {
          estimatedWork: decision.estimatedWork,
          estimatedWorkKind: decision.estimatedWorkKind,
          occupiedCells: decision.occupiedCells,
          brickCount: decision.brickCount,
          measured: {
            visitedCells: measured.visitedCells,
            components: measured.components,
            fragments: measured.fragments,
            quads: measured.quads,
            colliders: measured.colliders,
            totalMeasured: measured.totalMeasured
          },
          scene: {
            schemaVersion: lowScene.schemaVersion,
            sourceContentHash: lowScene.sourceContentHash,
            lowQuadCount: lowScene.quadCount,
            highQuadCount: highScene.quadCount
          },
          meshContentHash: mesh.contentHash,
          beforeContentHash: beforeHash,
          afterContentHash: afterHash,
          massKg,
          lowBoxCount: low.length,
          highBoxCount: high.length,
          lowMaterialVariant: (low[0] as { materialVariant: string }).materialVariant,
          highMaterialVariant: (high[0] as { materialVariant: string }).materialVariant,
          deferred: {
            status: deferredDecision.status,
            reason: deferredDecision.reason,
            payloadRoundtripEquals: JSON.stringify(payloadRoundtrip) === JSON.stringify(request.payload),
            jobKind: String(request.jobKind),
            targetKey: String(request.targetKey),
            inputRevision: Number(request.inputRevision),
            inputContentHash: request.payload.inputContentHash,
            enqueueKind: (enqueueResult as { kind: string }).kind,
            completionStatus: completion.decision.status,
            dispatchedJobId: completion.dispatchedJobId,
            requestJobId: request.jobId,
            anchoredVoxels: completion.anchoredVoxels,
            fragmentVoxels: completion.fragmentVoxels,
            dynamicVoxels: completion.dynamicVoxels,
            completionMassKg: completion.massKg,
            queueEmpty: queue.snapshot().size === 0
          },
          coverage: {
            coveredBricks: (freshCovered as { bricks: readonly unknown[] }).bricks.length,
            foreignThrows,
            digest: String(structural.R5_AUTHORED_FIXTURE_DIGEST)
          },
          workerIdsPresent: typeof workerIds.workerJobId === "function"
        };
      },
      dispose: () => harness.dispose()
    };
  });

  const canvas = page.locator('canvas[data-render-backend-harness="v1"]');
  await expect(canvas).toHaveCount(1);
  const captureCanvas = async (): Promise<Buffer> => {
    const box = await canvas.boundingBox();
    if (box === null) throw new Error("Deterministic harness canvas has no bounding box.");
    return page.screenshot({
      clip: { x: box.x, y: box.y, width: harnessDimensions.width, height: harnessDimensions.height }
    });
  };
  await expect(page.locator('[data-testid="pg-tragwerk-r5b"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="pg-tragwerk-destroy"]')).toHaveText("Zerstörung auslösen");
  await expect(page.locator("section[data-testid='pg-tragwerk-r5b']")).toContainText("Modus: PG-TRAGWERK R5B");
  // Spieler-HUD bleibt unberuehrt und vorhanden.
  await expect(page.locator("#flight-hud")).toHaveCount(1);

  expect(await scenario.evaluate((value) => value.occupiedBefore())).toBe(27);
  expect(await scenario.evaluate((value) => value.initialVisibleKeys())).toEqual(["pg-r5b:before"]);
  const beforeImage = await captureCanvas();

  await page.getByTestId("pg-tragwerk-destroy").click();
  const cut = await scenario.evaluate((value) => value.lastCut());
  expect(cut).not.toBeNull();
  if (cut === null) throw new Error("PG-TRAGWERK destroy button did not commit a cut.");
  expect(cut.occupiedCells).toBe(26);
  expect(cut.visibleKeys).toEqual(["pg-r5b:after"]);
  await expect(page.locator('[data-testid="pg-tragwerk-status"]')).toContainText("26 Zellen");
  const afterImage = await captureCanvas();

  const lodLow = await scenario.evaluate((value) => value.showLod("low"));
  expect(lodLow.boxCount).toBe(1);
  expect(lodLow.materialVariant).toBe("r5-low-shared");
  const lodLowImage = await captureCanvas();

  const lodHigh = await scenario.evaluate((value) => value.showLod("high"));
  expect(lodHigh.boxCount).toBe(2);
  expect(lodHigh.materialVariant).toBe("r5-high-per-voxel");
  const lodHighImage = await captureCanvas();

  const proof = await scenario.evaluate((value) => value.domainProof());
  expect(proof.estimatedWorkKind).toBe("estimate:9x-occupied-cells");
  expect(proof.estimatedWork).toBe(9 * proof.occupiedCells);
  expect(proof.occupiedCells).toBe(26);
  expect(proof.deferred.status).toBe("Deferred");
  expect(proof.deferred.enqueueKind).toBe("Accepted");
  expect(proof.deferred.completionStatus).toBe("Ready");
  expect(proof.deferred.dispatchedJobId).toBe(proof.deferred.requestJobId);
  expect(proof.deferred.anchoredVoxels + proof.deferred.fragmentVoxels).toBe(26);
  expect(proof.deferred.queueEmpty).toBe(true);
  expect(proof.deferred.payloadRoundtripEquals).toBe(true);
  expect(proof.deferred.jobKind).toBe("PgTragwerkR5Deferred");
  expect(proof.deferred.targetKey).toBe("object.pg-tragwerk-01");
  expect(proof.deferred.inputRevision).toBe(1);
  expect(proof.deferred.inputContentHash).toBe(proof.afterContentHash);
  expect(proof.coverage.foreignThrows).toBe(true);
  expect(proof.coverage.coveredBricks).toBe(7);
  expect(proof.coverage.digest).toBeTruthy();
  expect(proof.beforeContentHash).not.toBe(proof.afterContentHash);
  expect(proof.meshContentHash).toBeTruthy();
  expect(proof.scene.schemaVersion).toBe("pg-tragwerk-r5-scene-v1");
  expect(proof.scene.sourceContentHash).toBe(proof.afterContentHash);
  expect(proof.scene.lowQuadCount).toBe(proof.scene.highQuadCount);

  const images: Readonly<Record<PngName, Buffer>> = {
    "pg-tragwerk-r5b-before.png": beforeImage,
    "pg-tragwerk-r5b-after.png": afterImage,
    "pg-tragwerk-r5b-lod-low.png": lodLowImage,
    "pg-tragwerk-r5b-lod-high.png": lodHighImage
  };
  const screenshotEvidence: Record<PngName, ScreenshotEvidence> = {} as Record<PngName, ScreenshotEvidence>;
  for (const [name, image] of Object.entries(images) as Array<[PngName, Buffer]>) {
    const metrics = await assertCanvasEvidence(page, name, image);
    screenshotEvidence[name] = { width: metrics.width, height: metrics.height, nonEmpty: true };
  }

  const beforeAfter = await decodeAndCompare(page, beforeImage, afterImage);
  const lodDelta = await decodeAndCompare(page, lodLowImage, lodHighImage);
  // Renderer-tolerant: fixed count bands retain the observed local signal while
  // rejecting identical images and implausibly broad redraws.
  assertPixelDeltaBand(beforeAfter, pixelEvidenceContract.deltaBands.beforeAfter, "before/after destruction");
  assertPixelDeltaBand(lodDelta, pixelEvidenceContract.deltaBands.lowHigh, "low/high LOD");

  const identicalComparison = await decodeAndCompare(page, beforeImage, beforeImage);
  expect(() => assertPixelDeltaBand(
    identicalComparison,
    pixelEvidenceContract.deltaBands.beforeAfter,
    "identical images"
  )).toThrow();
  expect(() => assertPixelDeltaBand(
    identicalComparison,
    pixelEvidenceContract.deltaBands.lowHigh,
    "identical images"
  )).toThrow();
  const emptyImage = await renderBlankPng(page);
  await expect(measureCanvas(page, emptyImage)).rejects.toThrow("Harness canvas is empty");

  // Stored PNGs are read and decoded on every normal run. Explicit recording
  // is the only path allowed to replace a missing or stale checked-in golden.
  if (recordEvidence) {
    await Promise.all(Object.entries(images).map(([name, image]) => persistRecordedPngEvidence(name, image)));
  }
  await loadAndValidateStoredPngEvidence(page, evidenceDirectory);

  expect(await testBridgeState(page)).toEqual({ ownProperty: false, inWindow: false });
  const disposed = await scenario.evaluate((value) => value.dispose());
  expect(disposed.status).toBe("Accepted");
  await scenario.dispose();
  expect(failures).toEqual({ consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] });

  const summary = {
    schemaVersion: "pg-tragwerk-r5b-v4",
    status: "PASS",
    generator: "apps/weltraum-browser/tests/e2e/pg-tragwerk-destruction-render.spec.ts",
    route: "/",
    testBridgeAbsentBeforeAndAfter: true,
    harness: {
      ...harnessDimensions,
      screenshotDimensions: harnessDimensions,
      pixelRatio: 1,
      antialias: false,
      lighting: "None" as const
    },
    destruction: {
      occupiedBefore: 27,
      occupiedAfter: cut.occupiedCells,
      beforeContentHash: proof.beforeContentHash,
      afterContentHash: proof.afterContentHash,
      meshContentHash: proof.meshContentHash,
      massKg: proof.massKg
    },
    estimateVsMeasured: {
      estimatedWork: proof.estimatedWork,
      estimatedWorkKind: proof.estimatedWorkKind,
      occupiedCells: proof.occupiedCells,
      brickCount: proof.brickCount,
      measured: proof.measured
    },
    scene: proof.scene,
    visualEvidenceContract: pixelEvidenceContract,
    lod: {
      lowBoxCount: proof.lowBoxCount,
      highBoxCount: proof.highBoxCount,
      lowMaterialVariant: proof.lowMaterialVariant,
      highMaterialVariant: proof.highMaterialVariant,
      authorityNote: "physics-approximation (collider choice) and render-LOD (geometry+material projection) are separate decisions over the same plan; occupancy/mass/fragments/mesh hash are equal across LODs"
    },
    negativeChecks: {
      identicalImagesRejected: true,
      emptyImageRejected: true,
      storedMissingRejected: true,
      storedCorruptRejected: true,
      storedStaleRejected: true,
      storedBlankRejected: true,
      storedIdenticalReplacementRejected: true
    },
    deferred: proof.deferred,
    coverage: {
      binding: "object.pg-tragwerk-01@revision-0+empty-evidence",
      digest: proof.coverage.digest,
      coveredBricks: proof.coverage.coveredBricks,
      foreignThrows: proof.coverage.foreignThrows,
      sameIdForeignContentTest: "R5B-g"
    },
    scope: {
      kind: "test-side-harness-slice",
      productPaths: [
        "applyStructuralDestructionCommand",
        "prepareR5Bounded / StableWorkerJobQueue / completeR5DeferredRun",
        "extractStructuralMeshData / describeR5Scene",
        "selectR5RenderLodGeometry"
      ],
      harnessOnly: ["test-created PG-TRAGWERK overlay", "deterministic Three.js canvas projection"],
      excluded: ["normal scene wiring", "player gameplay state", "persistence"]
    },
    screenshots: screenshotEvidence,
    browserHealth: { consoleErrors: 0, pageErrors: 0, requestFailures: 0, httpErrors: 0 },
    verification: {
      command: focusedCommand,
      canvasTolerance: "renderer-tolerant: per-channel 12; non-empty > 0.01; fixed before/after and low/high delta bands",
      observedResult: "pass"
    }
  };
  await Promise.all([
    persistDeterministicEvidence("pg-tragwerk-r5b-summary.json", `${JSON.stringify(summary, null, 2)}\n`),
    persistDeterministicEvidence("pg-tragwerk-r5b.md", createMarkdown(summary))
  ]);
});

test("stored R5B PNG evidence rejects missing, corrupt, stale, blank, and identical replacements", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });

  const validImages = {} as Record<PngName, Buffer>;
  for (const name of pngNames) validImages[name] = await readStoredPngEvidence(evidenceDirectory, name);
  const blankImage = await renderBlankPng(page);

  const expectRejected = async (label: string, mutate: (directory: string) => Promise<void>): Promise<void> => {
    const directory = await mkdtemp(path.join(tmpdir(), "pg-tragwerk-r5b-negative-"));
    try {
      await Promise.all(pngNames.map((name) => writeFile(path.join(directory, name), validImages[name])));
      await mutate(directory);
      await expect(loadAndValidateStoredPngEvidence(page, directory), label).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  };

  await expectRejected("missing stored PNG", async (directory) => {
    await rm(path.join(directory, "pg-tragwerk-r5b-before.png"));
  });
  await expectRejected("corrupt stored PNG", async (directory) => {
    await writeFile(path.join(directory, "pg-tragwerk-r5b-before.png"), Buffer.from("not a PNG"));
  });
  await expectRejected("stale stored PNG", async (directory) => {
    await writeFile(path.join(directory, "pg-tragwerk-r5b-before.png"), validImages["pg-tragwerk-r5b-lod-low.png"]);
  });
  await expectRejected("blank stored PNG", async (directory) => {
    await writeFile(path.join(directory, "pg-tragwerk-r5b-before.png"), blankImage);
  });
  await expectRejected("identical replacement stored PNGs", async (directory) => {
    await Promise.all(pngNames.map((name) => writeFile(path.join(directory, name), validImages["pg-tragwerk-r5b-before.png"])));
  });
});

const createMarkdown = (summary: {
  readonly status: string;
  readonly harness: { readonly width: number; readonly height: number; readonly screenshotDimensions: { readonly width: number; readonly height: number }; readonly pixelRatio: number; readonly antialias: boolean; readonly lighting: string };
  readonly destruction: { readonly occupiedBefore: number; readonly occupiedAfter: number; readonly beforeContentHash: string; readonly afterContentHash: string; readonly massKg: number; readonly meshContentHash: string };
  readonly estimateVsMeasured: {
    readonly estimatedWork: number;
    readonly estimatedWorkKind: string;
    readonly occupiedCells: number;
    readonly brickCount: number;
    readonly measured: { readonly visitedCells: number; readonly components: number; readonly fragments: number; readonly quads: number; readonly colliders: number; readonly totalMeasured: number };
  };
  readonly scene: { readonly schemaVersion: string; readonly sourceContentHash: string; readonly lowQuadCount: number; readonly highQuadCount: number };
  readonly visualEvidenceContract: PixelEvidenceContract;
  readonly lod: {
    readonly lowBoxCount: number;
    readonly highBoxCount: number;
    readonly lowMaterialVariant: string;
    readonly highMaterialVariant: string;
  };
  readonly negativeChecks: {
    readonly identicalImagesRejected: boolean;
    readonly emptyImageRejected: boolean;
    readonly storedMissingRejected: boolean;
    readonly storedCorruptRejected: boolean;
    readonly storedStaleRejected: boolean;
    readonly storedBlankRejected: boolean;
    readonly storedIdenticalReplacementRejected: boolean;
  };
  readonly deferred: { readonly status: string; readonly completionStatus: string; readonly jobKind: string; readonly targetKey: string; readonly inputRevision: number; readonly inputContentHash: string; readonly anchoredVoxels: number; readonly fragmentVoxels: number; readonly dynamicVoxels: number; readonly completionMassKg: number; readonly dispatchedJobId: string };
  readonly coverage: { readonly binding: string; readonly digest: string; readonly coveredBricks: number; readonly foreignThrows: boolean; readonly sameIdForeignContentTest: string };
  readonly scope: { readonly kind: string; readonly productPaths: readonly string[]; readonly harnessOnly: readonly string[]; readonly excluded: readonly string[] };
  readonly screenshots: Record<string, ScreenshotEvidence>;
  readonly browserHealth: { readonly consoleErrors: number; readonly pageErrors: number; readonly requestFailures: number; readonly httpErrors: number };
}): string => `# PG-TRAGWERK-01 R5B Evidence

## Result

- Status: \`${summary.status}\`
- Normal route \`/\`; TestBridge absent before and after: \`true\`
- Deterministic harness: \`${summary.harness.width}x${summary.harness.height}\`, screenshot contract \`${summary.harness.screenshotDimensions.width}x${summary.harness.screenshotDimensions.height}\`, DPR \`${summary.harness.pixelRatio}\`, antialias \`${summary.harness.antialias}\`, lighting \`${summary.harness.lighting}\`
- Destruction: \`${summary.destruction.occupiedBefore} -> ${summary.destruction.occupiedAfter}\` Zellen, Masse \`${summary.destruction.massKg} kg\`
- Content: \`${summary.destruction.beforeContentHash}\` -> \`${summary.destruction.afterContentHash}\`; Mesh \`${summary.destruction.meshContentHash}\`

## Harness Scope

- Typ: \`${summary.scope.kind}\`
- Produktpfade: ${summary.scope.productPaths.map((path) => `\`${path}\``).join(", ")}
- Harness-only: ${summary.scope.harnessOnly.map((path) => `\`${path}\``).join(", ")}
- Explizit nicht behauptet: ${summary.scope.excluded.map((path) => `\`${path}\``).join(", ")}

## Fix -> Befund -> Test

- **F1 Button-Command:** Der sichtbare Button ruft den Structural-Command auf; E2E klickt den Button und prüft den echten Cut über \`lastCut\`.
- **F2 Deferred-Bindung:** Job-ID, Target, Revision und Content-Payload werden vor Re-Prepare/Hooks geprüft; R5B-f prüft Fremd-/Stale-Jobs und Hook-Fehler mit Requeue.
- **F3 Coverage:** Vollständige Coverage wird nach Rekonstruktion an den authored Digest gebunden; R5B-d und R5B-g prüfen Fremd-ID, Revision und Same-ID-Fremdinhalt.
- **F4 Deterministische Evidence:** Timings und rendererabhängige Pixelzähler werden nicht persistiert; JSON/Markdown bleiben byte-identisch, gespeicherte PNGs werden in jedem normalen Rerun gelesen, dekodiert und über Dimensionen, Nicht-Leerheit sowie Delta-Bänder tolerant geprüft, aber nicht umgeschrieben. PNG-Aufzeichnung ist ausschließlich mit \`WELTRAUM_RECORD_EVIDENCE=1\` explizit.
- **F5 Harness-Grenze:** Der Browsergraph importiert das Fixture ausschließlich aus \`tests/support\`; der Harness dokumentiert echte Produktpfade und testseitige Projektion separat.

## Estimate vs Measurement

\`estimatedWork\` ist eine Schaetzung (\`${summary.estimateVsMeasured.estimatedWorkKind}\`), keine Messung:

| Kennzahl | Wert |
| --- | --- |
| occupiedCells | \`${summary.estimateVsMeasured.occupiedCells}\` |
| brickCount | \`${summary.estimateVsMeasured.brickCount}\` |
| estimatedWork (9x occupiedCells) | \`${summary.estimateVsMeasured.estimatedWork}\` |
| measured visitedCells | \`${summary.estimateVsMeasured.measured.visitedCells}\` |
| measured components | \`${summary.estimateVsMeasured.measured.components}\` |
| measured fragments | \`${summary.estimateVsMeasured.measured.fragments}\` |
| measured quads | \`${summary.estimateVsMeasured.measured.quads}\` |
| measured colliders | \`${summary.estimateVsMeasured.measured.colliders}\` |
| measured total | \`${summary.estimateVsMeasured.measured.totalMeasured}\` |

## Renderer-tolerantes PNG-Evidence-Gate

- Capture-Vertrag: \`${summary.visualEvidenceContract.dimensions.width}x${summary.visualEvidenceContract.dimensions.height}\`, pro Kanal Toleranz \`${summary.visualEvidenceContract.perChannelTolerance}\`, Nicht-Leerheit \`> ${summary.visualEvidenceContract.nonEmptyMinimumRatio}\`.
- Before/After: lokale Kalibrierung \`${summary.visualEvidenceContract.deltaBands.beforeAfter.calibrationChangedPixels}\` px (\`${summary.visualEvidenceContract.deltaBands.beforeAfter.calibrationChangedRatio}\`), max. Kanal-Delta \`${summary.visualEvidenceContract.deltaBands.beforeAfter.calibrationMaximumChannelDelta}\`; zulässiges Band \`${summary.visualEvidenceContract.deltaBands.beforeAfter.minChangedPixels}..${summary.visualEvidenceContract.deltaBands.beforeAfter.maxChangedPixels}\` px und max. Kanal-Delta \`>= ${summary.visualEvidenceContract.deltaBands.beforeAfter.minMaximumChannelDelta}\`.
- Low/High: lokale Kalibrierung \`${summary.visualEvidenceContract.deltaBands.lowHigh.calibrationChangedPixels}\` px (\`${summary.visualEvidenceContract.deltaBands.lowHigh.calibrationChangedRatio}\`), max. Kanal-Delta \`${summary.visualEvidenceContract.deltaBands.lowHigh.calibrationMaximumChannelDelta}\`; zulässiges Band \`${summary.visualEvidenceContract.deltaBands.lowHigh.minChangedPixels}..${summary.visualEvidenceContract.deltaBands.lowHigh.maxChangedPixels}\` px und max. Kanal-Delta \`>= ${summary.visualEvidenceContract.deltaBands.lowHigh.minMaximumChannelDelta}\`.
- Die unteren Grenzen verwerfen identische Bilder; die Nicht-Leerheitsgrenze verwirft leere Bilder; die oberen Grenzen verwerfen einen unplausibel breiten Komplett-Redraw. Die Bänder tolerieren rendererabhängige Rasterabweichungen, ohne das Struktur-/LOD-Signal zu entfernen.
- Negative Checks: identische Bilder verworfen \`${summary.negativeChecks.identicalImagesRejected}\`, leeres Bild verworfen \`${summary.negativeChecks.emptyImageRejected}\`; gespeicherte missing/corrupt/stale/blank/identical-Replacements verworfen \`${summary.negativeChecks.storedMissingRejected}/${summary.negativeChecks.storedCorruptRejected}/${summary.negativeChecks.storedStaleRejected}/${summary.negativeChecks.storedBlankRejected}/${summary.negativeChecks.storedIdenticalReplacementRejected}\`.

## Scene und Render-LOD

- Scene-Descriptor: \`${summary.scene.schemaVersion}\`, Source-Hash \`${summary.scene.sourceContentHash}\`, Low/High-Quads \`${summary.scene.lowQuadCount}/${summary.scene.highQuadCount}\`
- Low: \`${summary.lod.lowBoxCount}\` gemergte Box(en), \`${summary.lod.lowMaterialVariant}\`
- High: \`${summary.lod.highBoxCount}\` per-Voxel-Boxen, \`${summary.lod.highMaterialVariant}\`
- Physik-Approximation und Render-LOD bleiben getrennte Projektionen desselben Plans.

## Deferred-Vollzug

- Entscheidung: \`${summary.deferred.status}\`, Completion: \`${summary.deferred.completionStatus}\`
- Job: \`${summary.deferred.jobKind}\`, Target \`${summary.deferred.targetKey}\`, Revision \`${summary.deferred.inputRevision}\`, Input-Hash \`${summary.deferred.inputContentHash}\`
- Dispatched Job-ID: \`${summary.deferred.dispatchedJobId}\`
- Anker \`${summary.deferred.anchoredVoxels}\` + Fragmente \`${summary.deferred.fragmentVoxels}\` bilanzieren jede Zelle; dynamisch \`${summary.deferred.dynamicVoxels}\`, Masse \`${summary.deferred.completionMassKg} kg\`.

## Coverage-Bindung

- Regel: \`${summary.coverage.binding}\`; authored Digest \`${summary.coverage.digest}\`; Bricks \`${summary.coverage.coveredBricks}\`.
- Fremde Objekt-ID wird verworfen: \`${summary.coverage.foreignThrows}\`; Same-ID-Fremdinhalt: Unit \`${summary.coverage.sameIdForeignContentTest}\`.

## Screenshots

- Alle vier PNGs: \`${summary.harness.screenshotDimensions.width}x${summary.harness.screenshotDimensions.height}\`.
- Die vier gespeicherten Captures werden im normalen Rerun gelesen/dekodiert und tolerant geprüft, aber wegen rendererabhängiger PNG-Bytes nicht umgeschrieben; explizites Recording bleibt über \`WELTRAUM_RECORD_EVIDENCE=1\` möglich.
- ${Object.entries(summary.screenshots).map(([name, screenshot]) => `\`${name}\`: ${screenshot.width}x${screenshot.height}, nicht leer \`${screenshot.nonEmpty}\``).join("\n- ")}

## Browser Health

- Console errors: \`${summary.browserHealth.consoleErrors}\`; page errors: \`${summary.browserHealth.pageErrors}\`; request failures: \`${summary.browserHealth.requestFailures}\`; HTTP errors: \`${summary.browserHealth.httpErrors}\`
`;
