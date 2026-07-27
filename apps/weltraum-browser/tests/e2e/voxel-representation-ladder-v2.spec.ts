import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type RepresentationDomain = typeof import("../../src/voxel/representation/index");
type AdaptiveDomain = typeof import("../../src/voxel/adaptive/index");
type SettingsDomain = typeof import("../../src/settings/index");

const evidenceDirectory = path.resolve(process.cwd(), "evidence");
const summaryPath = path.join(evidenceDirectory, "browser-voxel-representation-ladder-v2-summary.json");
const markdownPath = path.join(evidenceDirectory, "browser-voxel-representation-ladder-v2.md");

interface BrowserErrors {
  readonly console: readonly string[];
  readonly page: readonly string[];
  readonly request: readonly string[];
  readonly http: readonly string[];
}

interface LadderEvidence {
  readonly schemaVersion: "browser-voxel-representation-ladder-v2";
  readonly status: "PASS";
  readonly generator: "apps/weltraum-browser/tests/e2e/voxel-representation-ladder-v2.spec.ts";
  readonly route: "/";
  readonly proofScope: "pure-core-normal-route-chromium-proof";
  readonly visualUiClaim: false;
  readonly screenshotRequired: false;
  readonly testBridge: { readonly ownProperty: false; readonly inWindow: false };
  readonly exactE2eGroup: "test:e2e:core";
  readonly observations: Readonly<Record<string, unknown>>;
  readonly browserErrors: BrowserErrors;
  readonly runtimeGaps: readonly string[];
  readonly excludedClaims: readonly string[];
}

const collectBrowserErrors = (page: Page): { console: string[]; page: string[]; request: string[]; http: string[] } => {
  const errors = { console: [] as string[], page: [] as string[], request: [] as string[], http: [] as string[] };
  page.on("console", (message) => {
    if (message.type() === "error") errors.console.push(message.text());
  });
  page.on("pageerror", (error) => errors.page.push(error.message));
  page.on("requestfailed", (request) => {
    errors.request.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.http.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
  return errors;
};

const createMarkdown = (evidence: LadderEvidence): string => `# Browser Voxel Representation Ladder V2 Evidence

This timestamp-free artifact is generated from the same in-memory result as the JSON summary.

## Result

- Status: **${evidence.status}**
- Route: \`${evidence.route}\`
- Scope: \`${evidence.proofScope}\`
- Exact E2E group: \`${evidence.exactE2eGroup}\`
- TestBridge absent as own property and via \`in\`: \`true\`
- Visual UI claim: \`${evidence.visualUiClaim}\`
- Screenshot required: \`${evidence.screenshotRequired}\`
- Browser console/page/request/HTTP errors: \`${evidence.browserErrors.console.length}/${evidence.browserErrors.page.length}/${evidence.browserErrors.request.length}/${evidence.browserErrors.http.length}\`

## Deterministic observations

\`\`\`json
${JSON.stringify(evidence.observations, null, 2)}
\`\`\`

## Explicit runtime gaps

${evidence.runtimeGaps.map((gap) => `- ${gap}`).join("\n")}

## Excluded claims

${evidence.excludedClaims.map((claim) => `- ${claim}`).join("\n")}
`;

test("normal Chromium route deterministically proves voxel representation ladder V2", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(new URL(page.url()).pathname).toBe("/");

  const testBridge = await page.evaluate(() => ({
    ownProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
    inWindow: "TestBridge" in window
  }));
  expect(testBridge).toEqual({ ownProperty: false, inWindow: false });

  const evidence = await page.evaluate<LadderEvidence>(async () => {
    const representationPath = String("/src/voxel/representation/index.ts");
    const adaptivePath = String("/src/voxel/adaptive/index.ts");
    const settingsPath = String("/src/settings/index.ts");
    const representation = (await import(/* @vite-ignore */ representationPath)) as RepresentationDomain;
    const adaptive = (await import(/* @vite-ignore */ adaptivePath)) as AdaptiveDomain;
    const settings = (await import(/* @vite-ignore */ settingsPath)) as SettingsDomain;
    const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const hashPattern = /^fnv1a64-v1:[0-9a-f]{16}$/;

    const runProbe = (): LadderEvidence => {
      const productKinds = [
        "AdaptiveMicrovoxel", "VoxelRenderProxy", "DamageAwareObjectProxy",
        "SurfaceRegionProxy", "SurfaceTileProxy", "CelestialProxy"
      ] as const;
      const makeBand = (rank: number) => ({
        bandId: `band.${String(rank).padStart(2, "0")}`,
        rank,
        productKind: productKinds[rank % productKinds.length],
        algorithmVersion: "algorithm.v2",
        productVersion: "product.v2",
        geometricErrorMeters: 0.125 * (2 ** rank),
        coverageBoundsMeters: { min: { x: -10, y: -10, z: -10 }, max: { x: 10, y: 10, z: 10 } },
        sourceBindingKinds: ["AdaptiveAuthority" as const, "EditJournal" as const],
        readinessRequirements: ["SourceCurrent" as const, "ProductComplete" as const],
        allowedDomains: ["Render" as const, "Fallback" as const],
        visualAdaptiveLevel: adaptive.adaptiveLevel(rank <= 3 ? 4 : 2),
        costs: { estimatedBytes: 1_000 + rank, workUnits: 100 + rank, uploadUnits: 10 + rank }
      });
      const descriptor = representation.createRepresentationLadderDescriptor({
        schemaVersion: representation.REPRESENTATION_LADDER_SCHEMA_VERSION,
        descriptorId: "ladder.browser-proof.v2",
        bands: Array.from({ length: 12 }, (_, rank) => makeBand(rank))
      });
      assert(descriptor.bands.length === 12, "Expected a count-driven 12-band descriptor.");
      assert(new Set(descriptor.bands.map((band) => band.productKind)).size === 6, "All six required product kinds must be represented.");
      assert(!descriptor.bands.some((band) => (band.productKind as string) === "Culled"), "Culled must remain selection-only.");
      assert(hashPattern.test(descriptor.descriptorHash), "Descriptor hash must use Adaptive FNV-1a64.");

      const adaptiveTable = [...adaptive.ADAPTIVE_LEVELS].reverse().map((level) => ({
        level,
        cellSizeMeters: adaptive.cellSizeMetersForLevel(adaptive.adaptiveLevel(level))
      }));
      assert(adaptive.canonicalAdaptiveJson(adaptiveTable) === adaptive.canonicalAdaptiveJson([
        { level: 4, cellSizeMeters: 0.125 },
        { level: 3, cellSizeMeters: 0.25 },
        { level: 2, cellSizeMeters: 0.5 },
        { level: 1, cellSizeMeters: 1 },
        { level: 0, cellSizeMeters: 2 }
      ]), "Fixed Adaptive table changed.");
      assert(adaptive.canonicalAdaptiveJson(adaptive.ADAPTIVE_LEVELS) === "[0,1,2,3,4]", "Adaptive levels changed.");

      const policyFor = (quality: "Low" | "Ultra") => settings.createVoxelQualityPolicy(
        settings.applyQualityPreset(settings.createDefaultGraphicsSettings(), quality)
      );
      const lowPolicy = policyFor("Low");
      const ultraPolicy = policyFor("Ultra");
      const projection = {
        cameraPosition: { x: 0, y: 0, z: 100 },
        boundsCenter: { x: 0, y: 0, z: 0 },
        boundsRadiusMeters: 1,
        viewportHeightPixels: 1_000,
        verticalFovRadians: Math.PI / 2,
        minimumDistanceMeters: 0.1
      };
      const thresholds = {
        refineErrorPixels: 10,
        collapseErrorPixels: 8,
        cullDistanceMeters: 100_000,
        cullProjectedBoundsRadiusPixels: 0.01
      };
      const sse = representation.computeScreenSpaceError({ ...projection, geometricErrorMeters: 2 });
      assert(Math.abs(sse.focalLengthPixels - 500) < 1e-10, "SSE focal length changed.");
      assert(sse.distanceToBoundsMeters === 99, "SSE distance-to-bounds changed.");

      const hardRequest = representation.createHardAuthorityRequirement({
        requestId: "request.browser.explosion",
        reason: "Explosion",
        region: {
          kind: "sphere",
          center: {
            x: adaptive.globalQuantumCoordinate(4),
            y: adaptive.globalQuantumCoordinate(5),
            z: adaptive.globalQuantumCoordinate(6)
          },
          radiusQuantum: adaptive.globalQuantumCoordinate(1)
        },
        priority: 10
      });
      const eviction = representation.deriveEvictionEligibility({ structuralState: "Settled", activePins: [] });
      const candidates = descriptor.bands.map((band) => ({ bandId: band.bandId, readiness: "Ready" as const, sourceCurrent: true }));
      const selectionInput = {
        descriptor,
        candidates,
        projection,
        thresholds,
        priorBandId: null,
        simulationRequirements: ["AdaptiveAuthorityCurrent", "StructuralAuthorityCurrent"],
        requiredAuthorityRequests: [hardRequest],
        fallbackGroup: null,
        readiness: ["DescriptorReady", "SourcesCurrent"],
        evictionEligibility: eviction
      } as const;
      const low = representation.selectRepresentation({ ...selectionInput, qualityPolicy: lowPolicy });
      const ultra = representation.selectRepresentation({ ...selectionInput, qualityPolicy: ultraPolicy });
      assert(low.status === "Accepted" && ultra.status === "Accepted", "Low and Ultra selections must be accepted.");
      assert(adaptive.canonicalAdaptiveJson(low.simulationRequirements) === adaptive.canonicalAdaptiveJson(ultra.simulationRequirements), "Quality changed simulation requirements.");
      assert(adaptive.canonicalAdaptiveJson(low.requiredAuthorityRequests) === adaptive.canonicalAdaptiveJson(ultra.requiredAuthorityRequests), "Quality changed Authority requirements.");
      assert(low.requiredAuthorityRequests[0]?.targetLevel === 4 && ultra.requiredAuthorityRequests[0]?.targetLevel === 4, "Hard interaction must request L4.");
      assert(adaptive.canonicalAdaptiveJson(descriptor.bands[0].sourceBindingKinds) === adaptive.canonicalAdaptiveJson(["AdaptiveAuthority", "EditJournal"]), "Source bindings changed.");
      assert(adaptive.canonicalAdaptiveJson(low.renderSelection) !== adaptive.canonicalAdaptiveJson(ultra.renderSelection), "Low and Ultra should demonstrate different render selections.");
      assert(low.renderSelection.kind === "Band" && ultra.renderSelection.kind === "Band"
        && Number(low.renderSelection.bandId.slice(-2)) > Number(ultra.renderSelection.bandId.slice(-2)),
      "Low must select a coarser render band than Ultra for the proof vector.");

      const hysteresisInput = { ...selectionInput, projection: { ...projection, cameraPosition: { x: 0, y: 0, z: 125 } }, qualityPolicy: ultraPolicy, priorBandId: "band.03" };
      const hysteresisFirst = representation.selectRepresentation(hysteresisInput);
      const hysteresisSecond = representation.selectRepresentation({ ...hysteresisInput, candidates: [...candidates].reverse() });
      assert(hysteresisFirst.status === "Accepted" && hysteresisSecond.status === "Accepted", "Hysteresis selections must be accepted.");
      assert(adaptive.canonicalAdaptiveJson(hysteresisFirst) === adaptive.canonicalAdaptiveJson(hysteresisSecond), "Candidate order changed hysteresis output.");
      assert(hysteresisFirst.decisionReasons[0] === "HysteresisHoldBeforeCollapse", "Expected hysteresis hold.");
      assert(hashPattern.test(hysteresisFirst.decisionHash), "Hysteresis decision hash is malformed.");
      const refined = representation.selectRepresentation({ ...selectionInput, projection: { ...projection, cameraPosition: { x: 0, y: 0, z: 100 } }, qualityPolicy: ultraPolicy, priorBandId: "band.04" });
      const collapsed = representation.selectRepresentation({ ...selectionInput, projection: { ...projection, cameraPosition: { x: 0, y: 0, z: 130 } }, qualityPolicy: ultraPolicy, priorBandId: "band.03" });
      assert(refined.status === "Accepted" && refined.decisionReasons[0] === "RefinedAcrossBoundary", "Expected deterministic refinement.");
      assert(collapsed.status === "Accepted" && collapsed.decisionReasons[0] === "CollapsedAcrossBoundary", "Expected deterministic collapse.");

      const cullInput = {
        ...selectionInput,
        projection: { ...projection, cameraPosition: { x: 0, y: 0, z: 1_000_000 } },
        thresholds: { ...thresholds, cullDistanceMeters: 1_000, cullProjectedBoundsRadiusPixels: 1 },
        qualityPolicy: ultraPolicy
      };
      const culled = representation.selectRepresentation(cullInput);
      assert(culled.status === "Accepted" && culled.renderSelection.kind === "Culled", "Culled must be a deterministic selection outcome.");

      const proxyInteraction = representation.resolveProxyInteraction({
        requestId: "request.browser.tool",
        reason: "ToolInteraction",
        authorityCoordinates: {
          x: adaptive.globalQuantumCoordinate(4),
          y: adaptive.globalQuantumCoordinate(5),
          z: adaptive.globalQuantumCoordinate(6)
        },
        hasLevel4Coverage: true,
        requiredAuthorityWork: 10,
        authorityWorkBudget: 10,
        priority: 5
      });
      assert(proxyInteraction.status === "READY", "Proxy interaction must resolve from explicit Authority coordinates.");
      assert(proxyInteraction.authorityRequest.targetLevel === 4, "Proxy interaction must request L4 Authority.");
      assert(adaptive.canonicalAdaptiveJson(proxyInteraction.authorityCoordinates) === adaptive.canonicalAdaptiveJson({ x: 4, y: 5, z: 6 }), "Proxy Authority coordinates changed.");

      const structuralHash = adaptive.hashAdaptiveCanonical({ structural: "intact" });
      const objectProxy = representation.createObjectProxyIdentity({
        objectId: "object.browser", objectRevision: 1, structuralContentHash: structuralHash,
        damageDigest: "intact", bandId: "band.02", proxyAlgorithmVersion: "proxy.v2"
      });
      const staleProxy = representation.checkObjectProxyCurrentSource(objectProxy, {
        objectId: "object.browser", objectRevision: 2,
        structuralContentHash: adaptive.hashAdaptiveCanonical({ structural: "damaged" }), damageDigest: "damage.1",
        bandId: "band.02", proxyAlgorithmVersion: "proxy.v2"
      });
      const damagedProxy = representation.checkObjectProxyCurrentSource(objectProxy, {
        objectId: "object.browser", objectRevision: 1, structuralContentHash: structuralHash, damageDigest: "damage.1",
        bandId: "band.02", proxyAlgorithmVersion: "proxy.v2"
      });
      assert(staleProxy.status === "Rejected" && staleProxy.code === "StaleObjectRevision", "Stale proxy did not reject.");
      assert(damagedProxy.status === "Rejected" && damagedProxy.code === "DamageDigestMismatch", "Old intact proxy survived damage.");

      const children = (count: number, revision = 4) => Array.from({ length: count }, (_, index) => ({
        childId: `child.${String(index).padStart(2, "0")}`,
        revision,
        readiness: "Ready" as const
      }));
      const requiredChildIds = children(64).map((child) => child.childId);
      const fallbackFor = (childValues: ReturnType<typeof children>) => representation.resolveAtomicFallback({
        groupId: "fallback.browser", parentId: "parent.coarse", revision: 4, requiredChildIds, children: childValues
      });
      const fallbackZero = fallbackFor(children(0));
      const fallbackPartial = fallbackFor(children(1));
      const fallback63 = fallbackFor(children(63));
      const fallback64 = fallbackFor(children(64));
      assert([fallbackZero, fallbackPartial, fallback63].every((entry) => entry.settledCoverage === "Parent" && entry.childIds.length === 0), "Incomplete children exposed mixed coverage.");
      assert(fallback64.settledCoverage === "Children" && fallback64.parentId === null && fallback64.childIds.length === 64, "64 current children did not atomically replace parent.");

      const typedRejection = (action: () => unknown): { code: string; path: string } => {
        try {
          action();
        } catch (error) {
          assert(error instanceof representation.RepresentationValidationError, "Expected typed RepresentationValidationError.");
          return { code: error.code, path: error.path };
        }
        throw new Error("Expected malformed representation input to reject.");
      };
      const malformedRejection = typedRejection(() => representation.createRepresentationLadderDescriptor({
        schemaVersion: representation.REPRESENTATION_LADDER_SCHEMA_VERSION,
        descriptorId: "ladder.malformed.v2",
        bands: [{ ...makeBand(0), geometricErrorMeters: Number.NaN }]
      }));
      let overCapReads = 0;
      const overCapBands = Array.from({ length: representation.REPRESENTATION_MAX_BANDS + 1 }, (_, rank) => makeBand(rank));
      Object.defineProperty(overCapBands, "0", { enumerable: true, get: () => { overCapReads += 1; throw new Error("must not read"); } });
      const over32Rejection = typedRejection(() => representation.createRepresentationLadderDescriptor({
        schemaVersion: representation.REPRESENTATION_LADDER_SCHEMA_VERSION,
        descriptorId: "ladder.over-cap.v2",
        bands: overCapBands
      }));
      assert(overCapReads === 0, "Over-32 descriptor read entries before rejection.");

      const hardPins = representation.HARD_ADAPTIVE_REFINEMENT_REASONS.map((reason) => representation.createHardAuthorityRequirement({
        requestId: `request.${reason}`,
        reason,
        region: {
          kind: "sphere",
          center: {
            x: adaptive.globalQuantumCoordinate(0),
            y: adaptive.globalQuantumCoordinate(0),
            z: adaptive.globalQuantumCoordinate(0)
          },
          radiusQuantum: adaptive.globalQuantumCoordinate(1)
        },
        priority: 1
      }));
      assert(hardPins.every((request) => request.targetLevel === 4 && request.requiredForCoverage), "A hard pin did not request required L4 coverage.");

      const fallbackObservations = [
        { readyChildren: 0, decision: fallbackZero, hash: adaptive.hashAdaptiveCanonical(fallbackZero) },
        { readyChildren: 1, decision: fallbackPartial, hash: adaptive.hashAdaptiveCanonical(fallbackPartial) },
        { readyChildren: 63, decision: fallback63, hash: adaptive.hashAdaptiveCanonical(fallback63) },
        { readyChildren: 64, decision: fallback64, hash: adaptive.hashAdaptiveCanonical(fallback64) }
      ];
      assert(fallbackObservations.every((entry) => hashPattern.test(entry.hash)), "Fallback hash is malformed.");

      return {
        schemaVersion: "browser-voxel-representation-ladder-v2",
        status: "PASS",
        generator: "apps/weltraum-browser/tests/e2e/voxel-representation-ladder-v2.spec.ts",
        route: "/",
        proofScope: "pure-core-normal-route-chromium-proof",
        visualUiClaim: false,
        screenshotRequired: false,
        testBridge: { ownProperty: false, inWindow: false },
        exactE2eGroup: "test:e2e:core",
        observations: {
          descriptor: {
            schemaVersion: descriptor.schemaVersion,
            descriptorId: descriptor.descriptorId,
            descriptorHash: descriptor.descriptorHash,
            bandCount: descriptor.bands.length,
            productKinds,
            culledIsSelectionOnly: true
          },
          adaptiveAuthority: { levels: adaptive.ADAPTIVE_LEVELS, fixedTable: adaptiveTable, unchanged: true },
          policies: {
            Low: lowPolicy,
            Ultra: ultraPolicy,
            visualOnly: true,
            authorityRequestEqual: adaptive.canonicalAdaptiveJson(low.requiredAuthorityRequests) === adaptive.canonicalAdaptiveJson(ultra.requiredAuthorityRequests),
            simulationRequirementsEqual: adaptive.canonicalAdaptiveJson(low.simulationRequirements) === adaptive.canonicalAdaptiveJson(ultra.simulationRequirements)
          },
          sse: {
            formula: "projectedErrorPixels = geometricErrorMeters * (viewportHeightPixels / (2 * tan(verticalFovRadians / 2))) / max(minimumDistanceMeters, centerDistanceMeters - boundsRadiusMeters)",
            input: { ...projection, geometricErrorMeters: 2 },
            vector: sse
          },
          hysteresis: {
            thresholds,
            hold: { renderSelection: hysteresisFirst.renderSelection, reasons: hysteresisFirst.decisionReasons, decisionHash: hysteresisFirst.decisionHash },
            refine: { renderSelection: refined.renderSelection, reasons: refined.decisionReasons, decisionHash: refined.decisionHash },
            collapse: { renderSelection: collapsed.renderSelection, reasons: collapsed.decisionReasons, decisionHash: collapsed.decisionHash },
            candidateOrderIndependent: true
          },
          pins: {
            reasons: representation.HARD_ADAPTIVE_REFINEMENT_REASONS,
            requestedLevels: hardPins.map((request) => request.targetLevel),
            requiredForCoverage: hardPins.map((request) => request.requiredForCoverage)
          },
          lowUltra: {
            renderSelections: { Low: low.renderSelection, Ultra: ultra.renderSelection },
            hardAuthorityRequestsEqual: true,
            simulationRequirementsEqual: true,
            sourceBindingsEqual: true,
            lowDecisionHash: low.decisionHash,
            ultraDecisionHash: ultra.decisionHash
          },
          culling: { renderSelection: culled.renderSelection, decisionHash: culled.decisionHash },
          proxyInteraction,
          proxyRejections: { stale: staleProxy, damaged: damagedProxy, objectProxyHash: objectProxy.proxyContentHash },
          typedRejections: { malformed: malformedRejection, over32Bands: over32Rejection, overCapEntryReads: overCapReads },
          fallback: fallbackObservations
        },
        browserErrors: { console: [], page: [], request: [], http: [] },
        runtimeGaps: [
          "No production planetary voxel streaming consumer is proven.",
          "No proxy mesh generation or renderer integration is proven.",
          "No physics handoff or building-collapse runtime is proven.",
          "No live player-settings application is proven."
        ],
        excludedClaims: [
          "visual UI behavior", "renderer authority", "streaming runtime", "worker integration",
          "physics integration", "building collapse", "live settings consumption", "TestBridge integration"
        ]
      };
    };

    const first = runProbe();
    const second = runProbe();
    const firstCanonical = adaptive.canonicalAdaptiveJson(first);
    const secondCanonical = adaptive.canonicalAdaptiveJson(second);
    const firstJson = `${JSON.stringify(first, null, 2)}\n`;
    const secondJson = `${JSON.stringify(second, null, 2)}\n`;
    assert(firstCanonical === secondCanonical, "Repeated domain probes changed canonical output.");
    assert(firstJson === secondJson, "Repeated domain probes changed JSON bytes.");
    return first;
  });

  expect(evidence.status).toBe("PASS");
  expect(evidence.testBridge).toEqual({ ownProperty: false, inWindow: false });
  expect(browserErrors).toEqual({ console: [], page: [], request: [], http: [] });

  const completedEvidence: LadderEvidence = {
    ...evidence,
    browserErrors: {
      console: [...browserErrors.console].sort(),
      page: [...browserErrors.page].sort(),
      request: [...browserErrors.request].sort(),
      http: [...browserErrors.http].sort()
    }
  };
  const jsonBytes = `${JSON.stringify(completedEvidence, null, 2)}\n`;
  const markdownBytes = createMarkdown(completedEvidence);
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(summaryPath, jsonBytes, "utf8");
  await writeFile(markdownPath, markdownBytes, "utf8");
});
