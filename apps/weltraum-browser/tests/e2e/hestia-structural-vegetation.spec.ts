import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StructuralInertiaTensor } from "../../src/voxel/structural";
import type * as VegetationModule from "../../src/world-generation/hestia/vegetation/index";

type VegetationDomain = typeof VegetationModule;

const evidenceDirectory = path.resolve(process.cwd(), "evidence");
const summaryPath = path.join(evidenceDirectory, "browser-hestia-structural-vegetation-v1-summary.json");
const markdownPath = path.join(evidenceDirectory, "browser-hestia-structural-vegetation-v1.md");

interface BrowserFailures {
  readonly consoleErrors: readonly string[];
  readonly pageErrors: readonly string[];
  readonly failedRequests: readonly string[];
  readonly warnings: readonly string[];
  readonly ignoredPlatformWarnings: readonly string[];
  readonly httpErrors: readonly string[];
}

interface TestBridgeState {
  readonly ownProperty: boolean;
  readonly inWindow: boolean;
}

interface VegetationScenarioFacts {
  readonly modulePath: "/src/world-generation/hestia/vegetation/index.ts";
  readonly fixture: {
    readonly fixtureId: "hestia-structural-vegetation-v1-hydrology-fixture";
    readonly hydrologyGeneratorVersion: "hestia.hydrology.generator.v2";
    readonly hydrologyContentHash: "fnv1a32:60c8562c";
    readonly terrainHeightMeters: 7.375;
    readonly riverPointMeters: Readonly<{ x: 7; z: 0 }>;
  };
  readonly population: {
    readonly instanceCount: number;
    readonly populationHash: string;
    readonly candidateSetHash: string;
    readonly umbrellaInstanceId: string;
    readonly umbrellaInstanceHash: string;
    readonly rootQuantum: Readonly<{ x: number; y: number; z: number }>;
  };
  readonly proxy: {
    readonly contentHash: string;
    readonly partCount: number;
    readonly rootParts: number;
    readonly trunkParts: number;
    readonly branchParts: number;
    readonly canopyParts: number;
    readonly flatCanopyLobes: boolean;
    readonly singleConeOrSphere: false;
  };
  readonly structural: {
    readonly adaptiveLevel: 4;
    readonly brickCount: number;
    readonly objectContentHash: string;
    readonly anchorCount: number;
    readonly intactComponentCount: number;
    readonly intactAnchoredCount: number;
    readonly intactDetachedCount: number;
  };
  readonly cut: {
    readonly status: "Applied";
    readonly contentHash: string;
    readonly resultHash: string;
    readonly changedVoxelCount: number;
    readonly detachedComponentId: string;
    readonly detachedComponentHash: string;
    readonly detachedCellCount: number;
    readonly detachedCrownBranchProven: true;
    readonly detachedMassKg: number;
    readonly centerOfMassMeters: Readonly<{ x: number; y: number; z: number }>;
    readonly inertiaTensorKgMetersSquared: StructuralInertiaTensor;
  };
}

interface VegetationBrowserEvidence {
  readonly schemaVersion: "browser-hestia-structural-vegetation-v1";
  readonly status: "PASS";
  readonly generator: "apps/weltraum-browser/tests/e2e/hestia-structural-vegetation.spec.ts";
  readonly route: "/";
  readonly proofScope: "pure-core-browser-proof-via-vegetation-public-barrel";
  readonly dependencyShas: {
    readonly structural: "67daf4f532873214b506967af46dd90d85b45986";
    readonly adaptiveParent: "5fb372bdba677e43e71566121c53efb5e244b93a";
    readonly hydrology: "501c24390b9ea2b8320b55cea56087875f2a63e2";
    readonly dependencyMerge: "4aabdd1e1ab133a392f4a7ed1a75303e6baa4eae";
  };
  readonly testBridge: {
    readonly beforeImport: TestBridgeState;
    readonly afterProof: TestBridgeState;
  };
  readonly deterministicRepeat: {
    readonly firstCanonicalHash: string;
    readonly secondCanonicalHash: string;
    readonly canonicalBytesEqual: true;
  };
  readonly browserHealth: {
    readonly consoleErrors: 0;
    readonly pageErrors: 0;
    readonly failedRequests: 0;
    readonly warnings: 0;
    readonly httpErrors: 0;
  };
  readonly scenario: VegetationScenarioFacts;
  readonly checks: readonly string[];
  readonly visualUiChange: false;
  readonly excludedClaims: readonly ["runtime-wiring", "renderer-integration", "physics-integration", "gameplay-integration"];
}

const isKnownChromiumReadPixelsDriverWarning = (text: string): boolean =>
  text.includes("GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High)")
  && text.includes("GPU stall due to ReadPixels");

const collectBrowserFailures = (page: Page): BrowserFailures => {
  const failures = {
    consoleErrors: [] as string[],
    pageErrors: [] as string[],
    failedRequests: [] as string[],
    warnings: [] as string[],
    ignoredPlatformWarnings: [] as string[],
    httpErrors: [] as string[]
  };
  page.on("console", (message) => {
    if (message.type() === "error") failures.consoleErrors.push(message.text());
    if (message.type() === "warning") {
      if (isKnownChromiumReadPixelsDriverWarning(message.text())) {
        failures.ignoredPlatformWarnings.push(message.text());
      } else {
        failures.warnings.push(message.text());
      }
    }
  });
  page.on("pageerror", (error) => failures.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    failures.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failures.httpErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
  return failures;
};

const readTestBridgeState = (page: Page): Promise<TestBridgeState> => page.evaluate(() => ({
  ownProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
  inWindow: "TestBridge" in window
}));

const createMarkdown = (evidence: VegetationBrowserEvidence): string => `# Browser Structural Hestia Vegetation V1 Evidence

This timestamp-free artifact is generated from the same deterministic result as the JSON summary by \`${evidence.generator}\`.

## Result

- Status: **${evidence.status}**
- Route: \`${evidence.route}\`
- Dynamic module: \`${evidence.scenario.modulePath}\`
- Hydrology fixture: \`${evidence.scenario.fixture.fixtureId}\`
- Population hash: \`${evidence.scenario.population.populationHash}\`
- Umbrella instance: \`${evidence.scenario.population.umbrellaInstanceId}\`
- Proxy parts: \`${evidence.scenario.proxy.partCount}\` (${evidence.scenario.proxy.rootParts} root, ${evidence.scenario.proxy.trunkParts} trunk, ${evidence.scenario.proxy.branchParts} branch, ${evidence.scenario.proxy.canopyParts} canopy)
- Level-4 bricks / root anchors: \`${evidence.scenario.structural.brickCount}\` / \`${evidence.scenario.structural.anchorCount}\`
- Intact anchored/detached components: \`${evidence.scenario.structural.intactAnchoredCount}\` / \`${evidence.scenario.structural.intactDetachedCount}\`
- Detached component: \`${evidence.scenario.cut.detachedComponentId}\`
- Browser health errors/page/request/warnings: \`${evidence.browserHealth.consoleErrors}/${evidence.browserHealth.pageErrors}/${evidence.browserHealth.failedRequests}/${evidence.browserHealth.warnings}\`
- TestBridge absent before import and after proof: \`true\`
- Repeated canonical scenario bytes equal: \`${evidence.deterministicRepeat.canonicalBytesEqual}\`

## Dependency Pins

- Structural: \`${evidence.dependencyShas.structural}\`
- Adaptive parent: \`${evidence.dependencyShas.adaptiveParent}\`
- Hydrology: \`${evidence.dependencyShas.hydrology}\`
- Dependency merge: \`${evidence.dependencyShas.dependencyMerge}\`

## Deterministic Summary

The JSON artifact records the complete canonical scenario, including all population, proxy, Structural object, cut, detached-component, mass, center-of-mass, and inertia facts:

- \`apps/weltraum-browser/evidence/browser-hestia-structural-vegetation-v1-summary.json\`

Its repeated canonical scenario hash is \`${evidence.deterministicRepeat.firstCanonicalHash}\`.

## Scope

This proves pure vegetation, Adaptive, Structural, and pinned Hydrology-contract execution in Chromium through the vegetation public barrel. It makes no runtime, renderer, physics, gameplay, or visual integration claim. There is no UI/render change, so no screenshot is produced.
`;

const createEvidence = (
  scenario: VegetationScenarioFacts,
  firstCanonicalHash: string,
  secondCanonicalHash: string,
  beforeImport: TestBridgeState,
  afterProof: TestBridgeState
): VegetationBrowserEvidence => ({
  schemaVersion: "browser-hestia-structural-vegetation-v1",
  status: "PASS",
  generator: "apps/weltraum-browser/tests/e2e/hestia-structural-vegetation.spec.ts",
  route: "/",
  proofScope: "pure-core-browser-proof-via-vegetation-public-barrel",
  dependencyShas: {
    structural: "67daf4f532873214b506967af46dd90d85b45986",
    adaptiveParent: "5fb372bdba677e43e71566121c53efb5e244b93a",
    hydrology: "501c24390b9ea2b8320b55cea56087875f2a63e2",
    dependencyMerge: "4aabdd1e1ab133a392f4a7ed1a75303e6baa4eae"
  },
  testBridge: { beforeImport: { ...beforeImport }, afterProof: { ...afterProof } },
  deterministicRepeat: { firstCanonicalHash, secondCanonicalHash, canonicalBytesEqual: true },
  browserHealth: { consoleErrors: 0, pageErrors: 0, failedRequests: 0, warnings: 0, httpErrors: 0 },
  scenario,
  checks: [
    "PASS normal / route and TestBridge absence before import and after proof",
    "PASS exact vegetation public-barrel dynamic import",
    "PASS pinned Hydrology V2 fixture to deterministic Umbrella population",
    "PASS multi-part root, trunk, branch, and flat-canopy proxy",
    "PASS intersecting Adaptive Level-4 Structural bricks and root anchors",
    "PASS intact single anchored component",
    "PASS deterministic trunk cut and stable detached crown/branch component",
    "PASS finite detached mass, center of mass, and inertia",
    "PASS two byte-identical canonical scenario executions",
    "PASS browser health 0 console errors / 0 page errors / 0 failed requests / 0 warnings"
  ],
  visualUiChange: false,
  excludedClaims: ["runtime-wiring", "renderer-integration", "physics-integration", "gameplay-integration"]
});

test("normal route proves deterministic structural Hestia vegetation through its public barrel", async ({ page }) => {
  test.setTimeout(300_000);
  const failures = collectBrowserFailures(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(new URL(page.url()).pathname).toBe("/");
  expect(new URL(page.url()).search).toBe("");
  const beforeImport = await readTestBridgeState(page);
  expect(beforeImport).toEqual({ ownProperty: false, inWindow: false });

  const repeated = await page.evaluate<{
    first: VegetationScenarioFacts;
    second: VegetationScenarioFacts;
    firstCanonicalJson: string;
    secondCanonicalJson: string;
    firstCanonicalHash: string;
    secondCanonicalHash: string;
  }>(async () => {
    const modulePath = String("/src/world-generation/hestia/vegetation/index.ts") as VegetationScenarioFacts["modulePath"];
    const vegetation = (await import(/* @vite-ignore */ modulePath)) as VegetationDomain;
    const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const freeze = <T>(value: T): T => {
      if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
        for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
        Object.freeze(value);
      }
      return value;
    };

    const grid = {
      cellsX: 128, cellsZ: 128, samplesX: 129, samplesZ: 129,
      gridSpacingMeters: 2, extentXMeters: 256, extentZMeters: 256,
      globalQuantumMeters: 0.125, originAlignmentQuanta: 16
    } as const;
    const origin = { xQuanta: -32, zQuanta: -32 } as const;
    const terrainHeightMeters = 7.375 as const;
    const sampleCoordinate = (x: number, z: number) => ({
      xQuanta: origin.xQuanta + x * 16,
      zQuanta: origin.zQuanta + z * 16,
      xMeters: origin.xQuanta * 0.125 + x * 2,
      zMeters: origin.zQuanta * 0.125 + z * 2
    });
    const samples = Array.from({ length: grid.samplesX * grid.samplesZ }, (_, stableLinearIndex) => {
      const x = stableLinearIndex % grid.samplesX;
      const z = Math.floor(stableLinearIndex / grid.samplesX);
      return {
        coordinate: sampleCoordinate(x, z), stableLinearIndex,
        terrainHeight: terrainHeightMeters, filledElevation: terrainHeightMeters,
        depressionDepth: 0, spillElevation: terrainHeightMeters, basinId: null,
        isOcean: false, waterBodyId: null, waterSurfaceHeight: null
      };
    });
    const riverSegmentId = "river:hestia.vegetation.fixture.v1";
    const riverCellIndex = 2 * grid.cellsX + 5;
    const cells = Array.from({ length: grid.cellsX * grid.cellsZ }, (_, stableLinearIndex) => {
      const x = stableLinearIndex % grid.cellsX;
      const z = Math.floor(stableLinearIndex / grid.cellsX);
      return {
        coordinate: sampleCoordinate(x, z), stableLinearIndex,
        terrainHeight: terrainHeightMeters, filledElevation: terrainHeightMeters,
        depressionDepth: 0, spillElevation: terrainHeightMeters, basinId: null,
        isOcean: false, waterBodyId: null, waterSurfaceHeight: null,
        flowDirection: null, downstreamCellIndex: null, isBoundaryOutlet: false,
        accumulation: stableLinearIndex === riverCellIndex ? 48 : 1,
        riverSegmentIds: stableLinearIndex === riverCellIndex ? [riverSegmentId] : []
      };
    });
    const riverCoordinate = { xQuanta: 56, zQuanta: 0, xMeters: 7, zMeters: 0 } as const;
    const hydrologyFixture = freeze({
      generatorVersion: "hestia.hydrology.generator.v2",
      rootSeed: "hestia-structural-vegetation-v1-browser-fixture",
      bodyId: "planet.hestia",
      surfaceFrameId: "frame:surface.hestia",
      datasetId: "dataset:hestia.structural-vegetation.v1",
      origin,
      grid,
      parameters: {
        version: "hestia.hydrology.generator.v2", gridSpacingMeters: 2, seaLevelMeters: 0,
        minimumLakeDepthMeters: 0.15, riverSourceAccumulationCells: 48,
        minimumRiverDepthMeters: 0.2, maximumRiverDepthMeters: 2.5,
        minimumRiverHalfWidthMeters: 0.5, maximumRiverHalfWidthMeters: 4,
        channelBankSlope: 0.65, moistureFalloffMeters: 18,
        comparisonEpsilonMeters: 1e-9, spillElevationQuantizationPerMeter: 1_000_000,
        carveDepthLog2Coefficient: 0.35, halfWidthSqrtCoefficient: 0.6,
        riverWaterSurfaceDepthFraction: 0.5,
        d8DirectionOrder: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
        priorityFloodKeyOrder: ["filledElevation", "globalZ", "globalX", "stableLinearIndex"],
        accumulationContributionPerCell: 1,
        moistureFormulaVersion: "linear-distance-plus-depression-v1",
        channelFormulaVersion: "log2-sqrt-v1",
        flatRoutingPolicyVersion: "priority-flood-parent-v1",
        bankBlendFormulaVersion: "linear-slope-v1"
      },
      samples,
      cells,
      waterBodies: [],
      riverSegments: [{
        id: riverSegmentId,
        sourceCoordinate: riverCoordinate,
        points: [{
          cellIndex: riverCellIndex, coordinate: riverCoordinate, accumulation: 48,
          carveDepth: 0.25, halfWidth: 0.5, waterSurfaceHeight: 7
        }],
        termination: "Boundary", terminalWaterBodyId: null
      }],
      canonicalBytes: "hestia-structural-vegetation-v1-hydrology-fixture",
      contentHash: "fnv1a32:60c8562c"
    }) as unknown as Parameters<VegetationDomain["createHestiaVegetationHydrologySampler"]>[0];

    const runScenario = (): VegetationScenarioFacts => {
      const hydrologySampler = vegetation.createHestiaVegetationHydrologySampler(hydrologyFixture);
      const umbrellaSpecies = vegetation.getHestiaVegetationSpecies("hestia.umbrella-tree.v1");
      const population = vegetation.populateHestiaVegetation({
        rootSeed: "hestia-structural-vegetation-v1-browser-proof",
        bodyId: "planet.hestia",
        surfaceFrameId: "frame:surface.hestia",
        regions: [{ minXQuanta: 0, maxXQuanta: 1, minZQuanta: 0, maxZQuanta: 1 }],
        speciesIds: ["hestia.umbrella-tree.v1"],
        hydrologySampler,
        terrainSampler: () => ({
          materialId: umbrellaSpecies.allowedMaterialIds[0]!,
          biomeId: "hestia.biome.mist-forest.v1",
          rootMaterialId: 1
        }),
        budget: { maxInstances: 1, maxCrownAreaSquareMeters: 100 }
      });
      const instance = population.instances.find((entry) => entry.speciesId === "hestia.umbrella-tree.v1");
      assert(instance !== undefined, "The pinned Hydrology fixture must place one Umbrella Tree.");
      const graph = vegetation.createHestiaUmbrellaTreeGraph(instance);
      const proxy = vegetation.createHestiaVegetationProxy(instance);
      assert(proxy.parts.length === graph.segments.length, "The proxy must project every graph segment.");
      assert(proxy.parts.some((part) => part.role === "trunk"), "The proxy is missing its trunk.");
      assert(proxy.parts.some((part) => part.role === "branch"), "The proxy is missing branches.");
      assert(proxy.parts.filter((part) => part.role === "canopy").length > 1, "The proxy needs multiple canopy lobes.");
      assert(proxy.parts.every((part) => part.shape !== ("cone" as never) && part.shape !== ("sphere" as never)), "The proxy collapsed to a cone or sphere.");

      const requestedBounds = vegetation.createHestiaVegetationRequestedQuantumBounds({
        min: { x: instance.rootQuantum.x - 112, y: instance.rootQuantum.y - 16, z: instance.rootQuantum.z - 112 },
        max: { x: instance.rootQuantum.x + 112, y: instance.rootQuantum.y + 160, z: instance.rootQuantum.z + 112 }
      });
      const object = vegetation.compileVegetationStructuralBricks(instance, requestedBounds, 4);
      assert(object.bricks.length > 0 && object.bricks.every((brick) => brick.key.level === 4), "Compilation must emit Level-4 bricks.");
      assert(object.anchors.length > 0, "Compiled root cells must be anchored.");
      const intact = vegetation.classifyVegetationStructuralObject(object);
      assert(intact.components.length === 1 && intact.anchoredComponents.length === 1 && intact.detachedComponents.length === 0, "The intact tree must be one anchored component.");

      const cut = vegetation.applyHestiaVegetationTrunkCut(instance, object);
      assert(cut.commandResult.status === "Applied", "The deterministic trunk cut must apply.");
      assert(cut.detachedComponent.occupiedCells.length > 0 && cut.classification.detachedComponents.some((component) => component.componentId === cut.detachedComponent.componentId), "The cut must select a detached crown/branch component.");
      const addressKey = (
        brickKey: (typeof cut.detachedComponent.occupiedCells)[number]["brickKey"],
        local: (typeof cut.detachedComponent.occupiedCells)[number]["local"]
      ): string => `${brickKey.level}:${brickKey.originQuantum.x}:${brickKey.originQuantum.y}:${brickKey.originQuantum.z}:${local.x}:${local.y}:${local.z}`;
      const detachedAddresses = new Set(cut.detachedComponent.occupiedCells.map((cell) => addressKey(cell.brickKey, cell.local)));
      const crownBranchSegmentIds = new Set(graph.segments.filter((segment) =>
        segment.role === "primary" || segment.role === "secondary" || segment.role === "canopy")
        .map((segment) => segment.segmentId));
      const detachedCrownBranchProven = cut.commandResult.object.bricks.some((brick) => brick.cells.some((cell) => {
        const local = {
          x: cell.localIndex % 16,
          y: Math.floor(cell.localIndex / 16) % 16,
          z: Math.floor(cell.localIndex / (16 ** 2))
        };
        return detachedAddresses.has(addressKey(brick.key, local)) && crownBranchSegmentIds.has(cell.state.semanticKey ?? "");
      }));
      assert(detachedCrownBranchProven, "The detached component must contain authored crown or branch semantics.");
      assert(cut.detachedMassProperties.totalMassKg > 0 && Number.isFinite(cut.detachedMassProperties.totalMassKg), "Detached mass must be finite and positive.");
      const centerOfMassMeters = cut.detachedMassProperties.centerOfMassMeters;
      assert(centerOfMassMeters !== null && Object.values(centerOfMassMeters).every(Number.isFinite), "Detached COM must be finite.");
      assert(Object.values(cut.detachedMassProperties.inertiaTensorKgMetersSquared).every(Number.isFinite), "Detached inertia must be finite.");

      const canopyParts = proxy.parts.filter((part) => part.role === "canopy");
      return freeze({
        modulePath,
        fixture: {
          fixtureId: "hestia-structural-vegetation-v1-hydrology-fixture",
          hydrologyGeneratorVersion: "hestia.hydrology.generator.v2",
          hydrologyContentHash: "fnv1a32:60c8562c",
          terrainHeightMeters,
          riverPointMeters: { x: 7, z: 0 }
        },
        population: {
          instanceCount: population.instances.length,
          populationHash: population.populationHash,
          candidateSetHash: population.candidateSetHash,
          umbrellaInstanceId: instance.instanceId,
          umbrellaInstanceHash: instance.instanceHash,
          rootQuantum: instance.rootQuantum
        },
        proxy: {
          contentHash: proxy.contentHash,
          partCount: proxy.parts.length,
          rootParts: proxy.parts.filter((part) => part.role === "root").length,
          trunkParts: proxy.parts.filter((part) => part.role === "trunk").length,
          branchParts: proxy.parts.filter((part) => part.role === "branch").length,
          canopyParts: canopyParts.length,
          flatCanopyLobes: canopyParts.every((part) => part.dimensionsMeters.y < part.dimensionsMeters.x && part.dimensionsMeters.y < part.dimensionsMeters.z),
          singleConeOrSphere: false
        },
        structural: {
          adaptiveLevel: 4,
          brickCount: object.bricks.length,
          objectContentHash: object.contentHash,
          anchorCount: object.anchors.length,
          intactComponentCount: intact.components.length,
          intactAnchoredCount: intact.anchoredComponents.length,
          intactDetachedCount: intact.detachedComponents.length
        },
        cut: {
          status: cut.commandResult.status,
          contentHash: cut.contentHash,
          resultHash: cut.commandResult.resultHash,
          changedVoxelCount: cut.commandResult.changedVoxelCount,
          detachedComponentId: cut.detachedComponent.componentId,
          detachedComponentHash: cut.detachedComponent.componentContentHash,
          detachedCellCount: cut.detachedComponent.occupiedCells.length,
          detachedCrownBranchProven,
          detachedMassKg: cut.detachedMassProperties.totalMassKg,
          centerOfMassMeters,
          inertiaTensorKgMetersSquared: cut.detachedMassProperties.inertiaTensorKgMetersSquared
        }
      });
    };

    const first = runScenario();
    const second = runScenario();
    const firstCanonicalJson = vegetation.canonicalHestiaVegetationJson(first);
    const secondCanonicalJson = vegetation.canonicalHestiaVegetationJson(second);
    return {
      first,
      second,
      firstCanonicalJson,
      secondCanonicalJson,
      firstCanonicalHash: vegetation.hashHestiaVegetationCanonical(first),
      secondCanonicalHash: vegetation.hashHestiaVegetationCanonical(second)
    };
  });

  expect(repeated.second).toEqual(repeated.first);
  expect(repeated.secondCanonicalJson).toBe(repeated.firstCanonicalJson);
  expect(repeated.secondCanonicalHash).toBe(repeated.firstCanonicalHash);
  expect(repeated.first.population.instanceCount).toBe(1);
  expect(repeated.first.proxy.partCount).toBeGreaterThan(8);
  expect(repeated.first.proxy.rootParts + repeated.first.proxy.trunkParts
    + repeated.first.proxy.branchParts + repeated.first.proxy.canopyParts).toBe(repeated.first.proxy.partCount);
  expect(repeated.first.proxy.flatCanopyLobes).toBe(true);
  expect(repeated.first.structural).toMatchObject({
    adaptiveLevel: 4,
    intactComponentCount: 1,
    intactAnchoredCount: 1,
    intactDetachedCount: 0
  });
  expect(repeated.first.cut.status).toBe("Applied");
  expect(repeated.first.cut.detachedCrownBranchProven).toBe(true);

  const afterProof = await readTestBridgeState(page);
  expect(afterProof).toEqual({ ownProperty: false, inWindow: false });
  expect(failures.ignoredPlatformWarnings.every(isKnownChromiumReadPixelsDriverWarning)).toBe(true);
  expect({
    consoleErrors: failures.consoleErrors,
    pageErrors: failures.pageErrors,
    failedRequests: failures.failedRequests,
    warnings: failures.warnings,
    httpErrors: failures.httpErrors
  }).toEqual({ consoleErrors: [], pageErrors: [], failedRequests: [], warnings: [], httpErrors: [] });

  const firstEvidence = createEvidence(
    repeated.first,
    repeated.firstCanonicalHash,
    repeated.secondCanonicalHash,
    beforeImport,
    afterProof
  );
  const secondEvidence = createEvidence(
    repeated.second,
    repeated.firstCanonicalHash,
    repeated.secondCanonicalHash,
    beforeImport,
    afterProof
  );
  expect(secondEvidence).not.toBe(firstEvidence);
  expect(secondEvidence.scenario).not.toBe(firstEvidence.scenario);
  const firstJson = `${JSON.stringify(firstEvidence, null, 2)}\n`;
  const secondJson = `${JSON.stringify(secondEvidence, null, 2)}\n`;
  const firstMarkdown = createMarkdown(firstEvidence);
  const secondMarkdown = createMarkdown(secondEvidence);
  expect(secondJson).toBe(firstJson);
  expect(secondMarkdown).toBe(firstMarkdown);

  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(summaryPath, firstJson, "utf8");
  await writeFile(markdownPath, firstMarkdown, "utf8");
});
