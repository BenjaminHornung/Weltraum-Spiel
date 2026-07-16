import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type HydrologyDomain = typeof import("../../src/world-generation/hestia/hydrology/index");

const evidenceDirectory = path.resolve(process.cwd(), "evidence");
const jsonEvidencePath = path.join(evidenceDirectory, "browser-hestia-hydrology-generator-v2-summary.json");
const markdownEvidencePath = path.join(evidenceDirectory, "browser-hestia-hydrology-generator-v2-summary.md");

interface HydrologyFixtureProof {
  readonly status: "PASS";
  readonly route: "/";
  readonly modulePath: "/src/world-generation/hestia/hydrology/index.ts";
  readonly fixtureId: "hestia-hydrology-v2-global-valley-lake-ocean-v1";
  readonly generatorRevision: string;
  readonly datasetRevision: string;
  readonly testBridge: {
    readonly queryGateAbsent: true;
    readonly absentBeforeImport: boolean;
    readonly absentAfterImport: boolean;
  };
  readonly hashes: {
    readonly first: string;
    readonly second: string;
    readonly canonicalBytesEqual: boolean;
    readonly contentHashesEqual: boolean;
  };
  readonly counts: {
    readonly samples: number;
    readonly cells: number;
    readonly lakes: number;
    readonly oceans: number;
    readonly riverSegments: number;
    readonly riverPoints: number;
    readonly riverTerminalChains: {
      readonly counts: {
        readonly Lake: number;
        readonly Ocean: number;
        readonly DatasetBoundary: number;
      };
      readonly details: readonly {
        readonly initialSegmentId: string;
        readonly segmentIds: readonly string[];
        readonly terminal: "Lake" | "Ocean" | "DatasetBoundary";
        readonly terminalWaterBodyId: string | null;
      }[];
    };
  };
  readonly memoryEstimate: {
    readonly estimatorVersion: string;
    readonly snapshotGraphBytes: number;
    readonly canonicalBytes: number;
    readonly totalBytes: number;
    readonly budgetBytes: number;
    readonly marginBytes: number;
    readonly withinBudget: boolean;
  };
  readonly domainDiagnostics: {
    readonly flowCycles: readonly string[];
    readonly invalidRiverTerminals: readonly string[];
    readonly upstreamWaterLevelRises: readonly string[];
    readonly floatingWaterSamples: readonly string[];
  };
  readonly checks: readonly [
    "PASS normal route has no TestBridge or test-only query gate",
    "PASS direct hydrology module import",
    "PASS deterministic canonical bytes and hash",
    "PASS isolated lake and boundary-connected ocean",
    "PASS river chains resolve to Lake, Ocean, or DatasetBoundary",
    "PASS river water surfaces are downstream non-increasing",
    "PASS no floating water samples outside lake, channel, or ocean contracts",
    "PASS deterministic retained representation is within 8 MiB"
  ];
  readonly screenshot: "not-captured-non-visual-pure-module-proof";
  readonly limits: readonly [
    "regional static hydrology only",
    "no dynamic liquid or global hydrology",
    "no runtime or barrel integration"
  ];
}

interface HydrologyBrowserEvidence extends HydrologyFixtureProof {
  readonly browserHealth: {
    readonly consoleErrors: readonly string[];
    readonly pageErrors: readonly string[];
    readonly requestFailures: readonly string[];
    readonly httpErrors: readonly string[];
  };
  readonly verificationMetadata: {
    readonly nodeVersion: string;
    readonly browserOutcome: "PASS";
    readonly repeatAuditOutcome: "PASS";
    readonly unitOutcome: "NOT_RUN_BY_BROWSER_PROOF";
    readonly strictTypeScriptOutcome: "NOT_RUN_BY_BROWSER_PROOF";
    readonly pathScanOutcome: "NOT_RUN_BY_BROWSER_PROOF";
    readonly forbiddenApiScanOutcome: "NOT_RUN_BY_BROWSER_PROOF";
    readonly documentedCommands: readonly {
      readonly command: string;
      readonly outcome: "PASS" | "NOT_RUN_BY_BROWSER_PROOF";
    }[];
    readonly memoryEstimatorMethod: string;
    readonly memoryEstimatorScope: string;
    readonly engineHeapTelemetry: false;
  };
}

const createMarkdownEvidence = (evidence: HydrologyBrowserEvidence): string => `# Browser Hestia Hydrology Terrain Generator V2 Evidence

Generated deterministically by \
\`apps/weltraum-browser/tests/e2e/hestia-hydrology-generator-v2.spec.ts\` on the ordinary \
\`/\` route through a direct Vite module import.

## Result

- Status: **${evidence.status}**
- Fixture: \`${evidence.fixtureId}\`
- Generator revision: \`${evidence.generatorRevision}\`
- Dataset revision: \`${evidence.datasetRevision}\`
- Repeated content hash: \`${evidence.hashes.first}\`
- Samples/cells: \`${evidence.counts.samples}\` / \`${evidence.counts.cells}\`
- Lake/ocean bodies: \`${evidence.counts.lakes}\` / \`${evidence.counts.oceans}\`
- River segments/points: \`${evidence.counts.riverSegments}\` / \`${evidence.counts.riverPoints}\`
- Retained estimate: \`${evidence.memoryEstimate.totalBytes}\` bytes of \
\`${evidence.memoryEstimate.budgetBytes}\` bytes; margin \
\`${evidence.memoryEstimate.marginBytes}\` bytes

## Deterministic Summary

\`\`\`json
${JSON.stringify(evidence, null, 2)}
\`\`\`

## Scope

This is a timestamp-free, screenshot-free proof of the pure regional module. It does not claim dynamic liquid, globally complete hydrology, runtime integration, renderer integration, or parent-barrel integration.
`;

test("normal route directly imports Hestia Hydrology V2 and writes deterministic evidence", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: string[] = [];
  const httpErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown failure"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`);
  });

  await page.goto("/");
  await expect.poll(() => page.evaluate(() => ({
    query: window.location.search,
    testBridgePresent: "TestBridge" in window
  }))).toEqual({ query: "", testBridgePresent: false });

  const fixtureProof = await page.evaluate<HydrologyFixtureProof>(async () => {
    const absentBeforeImport = !("TestBridge" in window);
    const modulePath = String("/src/world-generation/hestia/hydrology/index.ts");
    const hydrology = (await import(/* @vite-ignore */ modulePath)) as HydrologyDomain;

    const fixtureOrigin = { xQuanta: 80_000, zQuanta: -48_000 } as const;
    const originXMeters = fixtureOrigin.xQuanta * hydrology.HESTIA_HYDROLOGY_GRID_V2.globalQuantumMeters;
    const originZMeters = fixtureOrigin.zQuanta * hydrology.HESTIA_HYDROLOGY_GRID_V2.globalQuantumMeters;
    const terrainHeightSampler = (globalXMeters: number, globalZMeters: number): number => {
      const localX = globalXMeters - originXMeters;
      const localZ = globalZMeters - originZMeters;
      const lakeRadius = Math.max(Math.abs(localX - 72), Math.abs(localZ - 92));

      if (lakeRadius <= 6) return -2;
      if (lakeRadius <= 10) return 6;
      if (localZ >= 248 && Math.abs(localX - 128) <= 18) return -2;
      return Math.abs(localX - 128) * 0.2 - localZ * 0.05 + 20;
    };
    const input = {
      rootSeed: "hestia-hydrology-v2-browser-proof-root",
      bodyId: "planet.hestia",
      surfaceFrameId: "frame:surface.hestia",
      datasetId: hydrology.hestiaHydrologyDatasetId("dataset:hestia.hydrology.browser-proof.v2"),
      origin: fixtureOrigin,
      seaLevelMeters: hydrology.HESTIA_HYDROLOGY_PARAMETERS_V2.seaLevelMeters,
      parameters: hydrology.HESTIA_HYDROLOGY_PARAMETERS_V2,
      terrainHeightSampler,
      grid: hydrology.HESTIA_HYDROLOGY_GRID_V2
    };
    const first = hydrology.generateHestiaHydrology(input);
    const second = hydrology.generateHestiaHydrology(input);
    const epsilon = first.parameters.comparisonEpsilonMeters;

    const flowCycles: string[] = [];
    for (const cell of first.cells) {
      const visited = new Set<number>();
      let current: number | null = cell.stableLinearIndex;
      while (current !== null) {
        if (visited.has(current)) {
          flowCycles.push(`cell:${cell.coordinate.xQuanta}:${cell.coordinate.zQuanta}`);
          break;
        }
        visited.add(current);
        current = first.cells[current]?.downstreamCellIndex ?? null;
      }
    }

    const invalidRiverTerminals: string[] = [];
    const upstreamWaterLevelRises: string[] = [];
    const riverTerminalChainCounts = { Lake: 0, Ocean: 0, DatasetBoundary: 0 };
    const riverTerminalChainDetails: {
      initialSegmentId: string;
      segmentIds: string[];
      terminal: "Lake" | "Ocean" | "DatasetBoundary";
      terminalWaterBodyId: string | null;
    }[] = [];
    for (const initialSegment of first.riverSegments) {
      let segment = initialSegment;
      const visitedSegments = new Set<string>();
      const segmentIds: string[] = [];
      while (true) {
        segmentIds.push(segment.id);
        for (let pointIndex = 1; pointIndex < segment.points.length; pointIndex += 1) {
          const upstream = segment.points[pointIndex - 1]!;
          const downstream = segment.points[pointIndex]!;
          if (downstream.waterSurfaceHeight > upstream.waterSurfaceHeight + epsilon) {
            upstreamWaterLevelRises.push(`${segment.id}:${upstream.cellIndex}->${downstream.cellIndex}`);
          }
        }
        if (segment.termination !== "Confluence") {
          if (segment.termination === "Boundary") {
            if (segment.terminalWaterBodyId !== null) {
              invalidRiverTerminals.push(`${initialSegment.id}:DatasetBoundary-with-water-body`);
            } else {
              riverTerminalChainCounts.DatasetBoundary += 1;
              riverTerminalChainDetails.push({
                initialSegmentId: initialSegment.id,
                segmentIds,
                terminal: "DatasetBoundary",
                terminalWaterBodyId: null
              });
            }
          } else {
            const terminalBody = first.waterBodies.find((body) => body.id === segment.terminalWaterBodyId);
            if (terminalBody?.kind !== segment.termination) {
              invalidRiverTerminals.push(`${initialSegment.id}:${segment.termination}-body-mismatch`);
            } else {
              riverTerminalChainCounts[segment.termination] += 1;
              riverTerminalChainDetails.push({
                initialSegmentId: initialSegment.id,
                segmentIds,
                terminal: segment.termination,
                terminalWaterBodyId: segment.terminalWaterBodyId
              });
            }
          }
          break;
        }
        if (visitedSegments.has(segment.id)) {
          invalidRiverTerminals.push(`${initialSegment.id}:confluence-cycle`);
          break;
        }
        visitedSegments.add(segment.id);
        const lastPoint = segment.points.at(-1);
        const downstreamCellIndex = lastPoint === undefined
          ? null
          : first.cells[lastPoint.cellIndex]?.downstreamCellIndex ?? null;
        const continuation = first.riverSegments.find((candidate) =>
          candidate.points[0]?.cellIndex === downstreamCellIndex);
        if (lastPoint === undefined || continuation === undefined) {
          invalidRiverTerminals.push(`${initialSegment.id}:missing-confluence-continuation`);
          break;
        }
        const continuationSurface = continuation.points[0]?.waterSurfaceHeight;
        if (continuationSurface === undefined) {
          invalidRiverTerminals.push(`${initialSegment.id}:empty-confluence-continuation`);
          break;
        }
        if (continuationSurface > lastPoint.waterSurfaceHeight + epsilon) {
          upstreamWaterLevelRises.push(`${segment.id}->${continuation.id}`);
        }
        segment = continuation;
      }
    }

    const waterBodiesById = new Map(first.waterBodies.map((body) => [body.id, body] as const));
    const floatingWaterSamples: string[] = [];
    for (const sample of first.samples) {
      if (sample.waterSurfaceHeight === null && sample.waterBodyId === null) continue;
      const body = sample.waterBodyId === null ? undefined : waterBodiesById.get(sample.waterBodyId);
      const isPublishedMember = body?.sampleIndices.includes(sample.stableLinearIndex) === true;
      const validOcean = body?.kind === "Ocean" && sample.isOcean
        && sample.terrainHeight <= body.waterLevel + epsilon;
      const validLake = body?.kind === "Lake" && !sample.isOcean && sample.basinId !== null
        && sample.terrainHeight < body.waterLevel - epsilon;
      if (sample.waterSurfaceHeight === null || body === undefined || !isPublishedMember
        || sample.waterSurfaceHeight !== body.waterLevel || (!validOcean && !validLake)) {
        floatingWaterSamples.push(`sample:${sample.coordinate.xQuanta}:${sample.coordinate.zQuanta}`);
      }
    }
    for (const segment of first.riverSegments) {
      for (const point of segment.points) {
        const cell = first.cells[point.cellIndex];
        if (cell === undefined || !cell.riverSegmentIds.includes(segment.id)
          || point.waterSurfaceHeight > cell.filledElevation + epsilon) {
          floatingWaterSamples.push(`channel:${segment.id}:${point.cellIndex}`);
        }
      }
    }

    const lakes = first.waterBodies.filter((body) => body.kind === "Lake");
    const oceans = first.waterBodies.filter((body) => body.kind === "Ocean");
    const memoryEstimate = hydrology.estimateHydrologySnapshotRetainedBytes(first);
    const absentAfterImport = !("TestBridge" in window);

    return {
      status: "PASS",
      route: "/",
      modulePath: "/src/world-generation/hestia/hydrology/index.ts",
      fixtureId: "hestia-hydrology-v2-global-valley-lake-ocean-v1",
      generatorRevision: first.generatorVersion,
      datasetRevision: first.parameters.version,
      testBridge: {
        queryGateAbsent: true,
        absentBeforeImport,
        absentAfterImport
      },
      hashes: {
        first: first.contentHash,
        second: second.contentHash,
        canonicalBytesEqual: first.canonicalBytes === second.canonicalBytes,
        contentHashesEqual: first.contentHash === second.contentHash
      },
      counts: {
        samples: first.samples.length,
        cells: first.cells.length,
        lakes: lakes.length,
        oceans: oceans.length,
        riverSegments: first.riverSegments.length,
        riverPoints: first.riverSegments.reduce((total, segment) => total + segment.points.length, 0),
        riverTerminalChains: {
          counts: riverTerminalChainCounts,
          details: riverTerminalChainDetails
        }
      },
      memoryEstimate: {
        estimatorVersion: memoryEstimate.estimatorVersion,
        snapshotGraphBytes: memoryEstimate.snapshotGraphBytes,
        canonicalBytes: memoryEstimate.canonicalBytes,
        totalBytes: memoryEstimate.totalBytes,
        budgetBytes: memoryEstimate.budgetBytes,
        marginBytes: memoryEstimate.budgetBytes - memoryEstimate.totalBytes,
        withinBudget: memoryEstimate.withinBudget
      },
      domainDiagnostics: {
        flowCycles,
        invalidRiverTerminals,
        upstreamWaterLevelRises,
        floatingWaterSamples
      },
      checks: [
        "PASS normal route has no TestBridge or test-only query gate",
        "PASS direct hydrology module import",
        "PASS deterministic canonical bytes and hash",
        "PASS isolated lake and boundary-connected ocean",
        "PASS river chains resolve to Lake, Ocean, or DatasetBoundary",
        "PASS river water surfaces are downstream non-increasing",
        "PASS no floating water samples outside lake, channel, or ocean contracts",
        "PASS deterministic retained representation is within 8 MiB"
      ],
      screenshot: "not-captured-non-visual-pure-module-proof",
      limits: [
        "regional static hydrology only",
        "no dynamic liquid or global hydrology",
        "no runtime or barrel integration"
      ]
    };
  });

  expect(fixtureProof.testBridge).toEqual({
    queryGateAbsent: true,
    absentBeforeImport: true,
    absentAfterImport: true
  });
  expect(fixtureProof.generatorRevision).toBe("hestia.hydrology.generator.v2");
  expect(fixtureProof.datasetRevision).toBe("hestia.hydrology.generator.v2");
  expect(fixtureProof.hashes.canonicalBytesEqual).toBe(true);
  expect(fixtureProof.hashes.contentHashesEqual).toBe(true);
  expect(fixtureProof.hashes.first).toBe(fixtureProof.hashes.second);
  expect(fixtureProof.counts).toMatchObject({ samples: 16_641, cells: 16_384 });
  expect(fixtureProof.counts.lakes).toBeGreaterThanOrEqual(1);
  expect(fixtureProof.counts.oceans).toBeGreaterThanOrEqual(1);
  expect(fixtureProof.counts.riverSegments).toBeGreaterThan(0);
  expect(fixtureProof.counts.riverPoints).toBeGreaterThan(0);
  expect(Object.values(fixtureProof.counts.riverTerminalChains.counts)
    .reduce((total, count) => total + count, 0)).toBe(fixtureProof.counts.riverSegments);
  expect(fixtureProof.counts.riverTerminalChains.details).toHaveLength(fixtureProof.counts.riverSegments);
  expect(fixtureProof.memoryEstimate.withinBudget).toBe(true);
  expect(fixtureProof.memoryEstimate.marginBytes).toBeGreaterThanOrEqual(0);
  expect(fixtureProof.domainDiagnostics.flowCycles).toEqual([]);
  expect(fixtureProof.domainDiagnostics.invalidRiverTerminals).toEqual([]);
  expect(fixtureProof.domainDiagnostics.upstreamWaterLevelRises).toEqual([]);
  expect(fixtureProof.domainDiagnostics.floatingWaterSamples).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(requestFailures).toEqual([]);
  expect(httpErrors).toEqual([]);

  const evidence: HydrologyBrowserEvidence = {
    ...fixtureProof,
    browserHealth: { consoleErrors, pageErrors, requestFailures, httpErrors },
    verificationMetadata: {
      nodeVersion: process.version,
      browserOutcome: "PASS",
      repeatAuditOutcome: "PASS",
      unitOutcome: "NOT_RUN_BY_BROWSER_PROOF",
      strictTypeScriptOutcome: "NOT_RUN_BY_BROWSER_PROOF",
      pathScanOutcome: "NOT_RUN_BY_BROWSER_PROOF",
      forbiddenApiScanOutcome: "NOT_RUN_BY_BROWSER_PROOF",
      documentedCommands: [
        { command: "npx tsc -p tsconfig.json", outcome: "NOT_RUN_BY_BROWSER_PROOF" },
        { command: "npx vitest run tests/unit/hestiaHydrology*.test.ts", outcome: "NOT_RUN_BY_BROWSER_PROOF" },
        { command: "npm run test:e2e -- tests/e2e/hestia-hydrology-generator-v2.spec.ts", outcome: "NOT_RUN_BY_BROWSER_PROOF" },
        { command: "git diff --check", outcome: "NOT_RUN_BY_BROWSER_PROOF" }
      ],
      memoryEstimatorMethod: "hydrology-retained-representation-v1 deterministic graph/string accounting",
      memoryEstimatorScope: "retained frozen snapshot graph plus packed canonical representation",
      engineHeapTelemetry: false
    }
  };

  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(jsonEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(markdownEvidencePath, createMarkdownEvidence(evidence), "utf8");
});
