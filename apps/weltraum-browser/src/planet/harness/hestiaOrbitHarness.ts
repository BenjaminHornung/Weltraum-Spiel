import {
  artifactRevision,
  backendRevision,
  createFrameProjectionSnapshot,
  createMaterialProfile,
  frameId,
  frameRevision,
  materialProfileId,
  adaptPlanetPresentation,
  createPlanetShellMeshArtifact,
  planetTileRepresentationKey,
  sourceRevision
} from "../planetPresentationAdapter";
import { createDeterministicRenderHarness, type DeterministicRenderHarness } from "../../render/three/backend";
import { planetTileId } from "../ids";
import {
  createDeterministicPlanetHeightSampler,
  generatePlanetShellMesh,
  type PlanetShellMesh
} from "../shellMeshGenerator";
import { createPlanetTileReadinessSnapshot, type PlanetTileReadinessEntry } from "../tileReadiness";
import { selectPlanetTiles } from "../tileSelector";
import { planetTileChildren } from "../tileTree";
import { PLANET_FACES, type PlanetTileId, type PlanetTileKey } from "../types";
import type { PlanetTileVisibilityPlan, PlanetTileVisibilityReason } from "../tileVisibilityPlan";

type PlanetRepresentationKey = ReturnType<typeof planetTileRepresentationKey>;
type PlanetRenderCommandResult = ReturnType<DeterministicRenderHarness["dispatch"]>;

export const HESTIA_ORBIT_STATES = Object.freeze([
  "far-orbit",
  "near-orbit",
  "parent-fallback",
  "child-ready",
  "evicted"
] as const);

export type HestiaOrbitState = (typeof HESTIA_ORBIT_STATES)[number];

export interface HestiaOrbitSnapshot {
  readonly state: HestiaOrbitState;
  readonly selectionRevision: number;
  readonly readinessRevision: number;
  readonly cameraPositionMeters: Readonly<{ x: number; y: number; z: number }>;
  readonly primary: readonly PlanetTileId[];
  readonly fallback: readonly PlanetTileId[];
  readonly culled: readonly PlanetTileId[];
  readonly visibleTileIds: readonly PlanetTileId[];
  readonly visibleRepresentationKeys: readonly PlanetRepresentationKey[];
  readonly loadRequests: readonly Readonly<{
    tileId: PlanetTileId;
    reason: string;
    requiredForCoverage: boolean;
  }>[];
  readonly reasons: readonly PlanetTileVisibilityReason[];
  readonly highlightedReason: PlanetTileVisibilityReason;
  readonly coverageStatus: "READY" | "NOT_READY";
}

export interface HestiaOrbitHarnessController {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  showState(state: HestiaOrbitState): HestiaOrbitSnapshot;
  showFarOrbit(): HestiaOrbitSnapshot;
  showNearOrbit(): HestiaOrbitSnapshot;
  showParentFallback(): HestiaOrbitSnapshot;
  showChildReady(): HestiaOrbitSnapshot;
  showEvicted(): HestiaOrbitSnapshot;
  readSnapshot(): HestiaOrbitSnapshot;
  reset(): HestiaOrbitSnapshot;
  dispose(): PlanetRenderCommandResult;
}

interface StateDefinition {
  readonly state: HestiaOrbitState;
  readonly label: string;
  readonly badge: string;
  readonly selectionRevision: number;
  readonly readinessRevision: number;
  readonly cameraZ: number;
  readonly visualScale: number;
  readonly maxLevel: 0 | 1;
  readonly splitThresholdPixels: number;
  readonly childStates: readonly PlanetTileReadinessEntry["state"][];
  readonly highlightedReasonCode:
    | "culled-horizon"
    | "primary-max-level"
    | "fallback-incomplete-child-coverage"
    | "parent-hidden-complete-child-coverage"
    | "requested-child-evicted";
  readonly highlightedTile: "target-parent" | "horizon-root" | "evicted-child";
}

const BODY_ID = "hestia";
const BODY_RADIUS_METERS = 1_000;
const GRID_SEGMENTS = 12;
const CAMERA_VISUAL_Z = 4.5;
const TARGET_PARENT: PlanetTileKey = Object.freeze({
  bodyId: BODY_ID,
  face: "+Z",
  level: 0,
  x: 0,
  y: 0
});
const TARGET_PARENT_ID = planetTileId(TARGET_PARENT);
const TARGET_CHILDREN = Object.freeze(planetTileChildren(TARGET_PARENT));
const TARGET_CHILD_IDS = Object.freeze(TARGET_CHILDREN.map(planetTileId));
const HORIZON_ROOT_ID = planetTileId({ bodyId: BODY_ID, face: "-Z", level: 0, x: 0, y: 0 });
const FRAME_ID = frameId("frame:hestia-orbit-harness");
const ROOT_MATERIAL_ID = materialProfileId("material:hestia-root-cyan");
const CHILD_MATERIAL_IDS = Object.freeze([
  materialProfileId("material:hestia-child-green-0"),
  materialProfileId("material:hestia-child-green-1"),
  materialProfileId("material:hestia-child-green-2"),
  materialProfileId("material:hestia-child-green-3")
]);

const rootKeys = Object.freeze(PLANET_FACES.map((face): PlanetTileKey => Object.freeze({
  bodyId: BODY_ID,
  face,
  level: 0,
  x: 0,
  y: 0
})));
const rootIds = Object.freeze(rootKeys.map(planetTileId));

const states: Readonly<Record<HestiaOrbitState, StateDefinition>> = Object.freeze({
  "far-orbit": Object.freeze({
    state: "far-orbit",
    label: "Far orbit",
    badge: "FAR ORBIT · COARSE SHELL · HORIZON CULLING",
    selectionRevision: 101,
    readinessRevision: 201,
    cameraZ: 3_000,
    visualScale: 0.00082,
    maxLevel: 0,
    splitThresholdPixels: Number.MAX_VALUE,
    childStates: Object.freeze([] as const),
    highlightedReasonCode: "culled-horizon",
    highlightedTile: "horizon-root"
  }),
  "near-orbit": Object.freeze({
    state: "near-orbit",
    label: "Near orbit",
    badge: "NEAR ORBIT · MAXIMUM ACTIVE LEVEL 0",
    selectionRevision: 102,
    readinessRevision: 202,
    cameraZ: 1_300,
    visualScale: 0.00138,
    maxLevel: 0,
    splitThresholdPixels: 0,
    childStates: Object.freeze([] as const),
    highlightedReasonCode: "primary-max-level",
    highlightedTile: "target-parent"
  }),
  "parent-fallback": Object.freeze({
    state: "parent-fallback",
    label: "Near orbit · parent fallback",
    badge: "NEAR ORBIT · PARENT FALLBACK ACTIVE",
    selectionRevision: 103,
    readinessRevision: 203,
    cameraZ: 1_300,
    visualScale: 0.00138,
    maxLevel: 1,
    splitThresholdPixels: 0,
    childStates: Object.freeze(["render-ready", "render-ready", "render-ready", "loading"] as const),
    highlightedReasonCode: "fallback-incomplete-child-coverage",
    highlightedTile: "target-parent"
  }),
  "child-ready": Object.freeze({
    state: "child-ready",
    label: "Near orbit · child-ready handoff",
    badge: "NEAR ORBIT · ATOMIC CHILD HANDOFF",
    selectionRevision: 104,
    readinessRevision: 204,
    cameraZ: 1_300,
    visualScale: 0.00138,
    maxLevel: 1,
    splitThresholdPixels: 0,
    childStates: Object.freeze(["render-ready", "render-ready", "render-ready", "render-ready"] as const),
    highlightedReasonCode: "parent-hidden-complete-child-coverage",
    highlightedTile: "target-parent"
  }),
  evicted: Object.freeze({
    state: "evicted",
    label: "Near orbit · child evicted",
    badge: "NEAR ORBIT · EVICTION · PARENT REACTIVATED",
    selectionRevision: 105,
    readinessRevision: 205,
    cameraZ: 1_300,
    visualScale: 0.00138,
    maxLevel: 1,
    splitThresholdPixels: 0,
    childStates: Object.freeze(["render-ready", "render-ready", "evicted", "render-ready"] as const),
    highlightedReasonCode: "requested-child-evicted",
    highlightedTile: "evicted-child"
  })
});

const rootMaterial = createMaterialProfile({
  id: ROOT_MATERIAL_ID,
  kind: "Unlit",
  baseColor: { r: 112 / 255, g: 223 / 255, b: 1 },
  opacity: 1,
  doubleSided: true,
  wireframe: false,
  depthWrite: true
});

const childMaterials = Object.freeze(CHILD_MATERIAL_IDS.map((id, index) => createMaterialProfile({
  id,
  kind: "Unlit",
  baseColor: {
    r: (112 + index * 7) / 255,
    g: 1,
    b: (142 + index * 8) / 255
  },
  opacity: 1,
  doubleSided: true,
  wireframe: false,
  depthWrite: true
})));
const residentTileDefinitions = Object.freeze([
  ...rootKeys.map((tileKey) => Object.freeze({ tileKey, material: rootMaterial })),
  ...TARGET_CHILDREN.map((tileKey, index) => Object.freeze({ tileKey, material: childMaterials[index] }))
]);

const assertAccepted = (operation: string, result: PlanetRenderCommandResult): void => {
  if (result.status !== "Accepted" && result.status !== "AlreadyApplied") {
    throw new Error(`${operation} failed: ${result.reasonCode ?? result.status}`);
  }
};

const readinessFor = (definition: StateDefinition) => createPlanetTileReadinessSnapshot({
  revision: definition.readinessRevision,
  entries: [
    ...rootIds.map((tileId): PlanetTileReadinessEntry => ({ tileId, state: "render-ready" })),
    ...TARGET_CHILD_IDS.map((tileId, index): PlanetTileReadinessEntry => ({
      tileId,
      state: definition.childStates[index] ?? "not-requested"
    }))
  ]
});

const selectFor = (definition: StateDefinition, readiness: ReturnType<typeof readinessFor>): PlanetTileVisibilityPlan => {
  const result = selectPlanetTiles({
    selectionRevision: definition.selectionRevision,
    acceptedReadinessRevision: definition.readinessRevision,
    bodyId: BODY_ID,
    bodyRadiusMeters: BODY_RADIUS_METERS,
    minHeightMeters: -12,
    maxHeightMeters: 12,
    conservativeHeightMarginMeters: 12,
    cameraPosition: { x: 0, y: 0, z: definition.cameraZ },
    viewportHeightPixels: 1_080,
    verticalFovRadians: Math.PI / 3,
    nearClampMeters: 1,
    frustumPlanes: [{ normal: { x: 1, y: 0, z: 0 }, constantMeters: 10_000 }],
    maxLevel: definition.maxLevel,
    geometricErrorMeters: definition.maxLevel === 0 ? 180 : [180, 90],
    splitThresholdPixels: definition.splitThresholdPixels,
    readiness,
    maxSelectedPrimaryTiles: 9,
    maxRequestedChildren: 24
  });
  if (result.status !== "accepted") {
    throw new Error(`Hestia selector rejected ${definition.state}: ${result.reason}`);
  }
  return result.plan;
};

const highlightedReasonFor = (
  definition: StateDefinition,
  plan: PlanetTileVisibilityPlan
): PlanetTileVisibilityReason => {
  const tileId = definition.highlightedTile === "target-parent"
    ? TARGET_PARENT_ID
    : definition.highlightedTile === "horizon-root"
      ? HORIZON_ROOT_ID
      : TARGET_CHILD_IDS[2];
  const reason = plan.reasons.find((entry) =>
    entry.tileId === tileId && entry.code === definition.highlightedReasonCode
  );
  if (reason === undefined) {
    throw new Error(`Missing ${definition.highlightedReasonCode} evidence for ${tileId}.`);
  }
  return reason;
};

const createShell = (tileKey: PlanetTileKey): PlanetShellMesh => generatePlanetShellMesh({
  tileKey,
  radiusMeters: BODY_RADIUS_METERS,
  gridSegments: GRID_SEGMENTS,
  heightSampler: createDeterministicPlanetHeightSampler(12)
});

const mountDom = (parent: HTMLElement): {
  root: HTMLElement;
  panel: HTMLElement;
  badge: HTMLElement;
  style: HTMLStyleElement;
} => {
  const style = document.createElement("style");
  style.dataset.hestiaOrbitHarnessStyle = "v1";
  style.textContent = `
    [data-hestia-orbit-harness="v1"] { position: fixed; inset: 0; z-index: 2147483000; overflow: hidden; background: #080b12; color: #e8f3ff; font-family: Inter, "Segoe UI", sans-serif; }
    [data-hestia-orbit-harness="v1"] canvas { position: absolute; inset: 0; z-index: 0; width: 100vw !important; height: 100vh !important; }
    [data-hestia-orbit-panel="v1"] { position: absolute; left: 28px; top: 28px; z-index: 1; width: min(470px, calc(100vw - 56px)); padding: 20px 22px; border: 1px solid rgba(116, 144, 186, 0.45); border-left: 3px solid #70dfff; background: rgba(8, 11, 18, 0.74); box-sizing: border-box; }
    [data-hestia-orbit-panel="v1"] h1 { margin: 0 0 4px; color: #70dfff; font-size: 18px; font-weight: 700; letter-spacing: 0.055em; text-transform: uppercase; }
    [data-hestia-orbit-panel="v1"] .subtitle { margin: 0 0 17px; color: #a7bdd7; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; }
    [data-hestia-orbit-panel="v1"] dl { display: grid; grid-template-columns: 132px 1fr; gap: 7px 12px; margin: 0; font-size: 13px; line-height: 1.35; }
    [data-hestia-orbit-panel="v1"] dt { color: #8ca5c3; }
    [data-hestia-orbit-panel="v1"] dd { min-width: 0; margin: 0; color: #f1f7ff; font-family: "Cascadia Mono", Consolas, monospace; overflow-wrap: anywhere; }
    [data-hestia-orbit-panel="v1"] dd[data-tone="decision"] { color: #80ff9f; }
    [data-hestia-orbit-status="v1"] { position: absolute; left: 50%; top: 30px; z-index: 1; transform: translateX(-50%); padding: 9px 16px; border: 1px solid rgba(116, 144, 186, 0.45); background: rgba(8, 11, 18, 0.74); color: #ffd166; font: 700 12px/1.2 "Cascadia Mono", Consolas, monospace; letter-spacing: 0.08em; white-space: nowrap; }
  `;
  document.head.append(style);
  const root = document.createElement("section");
  root.dataset.hestiaOrbitHarness = "v1";
  root.setAttribute("aria-label", "Hestia orbit diagnostic harness");
  const panel = document.createElement("aside");
  panel.dataset.hestiaOrbitPanel = "v1";
  const badge = document.createElement("div");
  badge.dataset.hestiaOrbitStatus = "v1";
  badge.setAttribute("role", "status");
  badge.setAttribute("aria-live", "polite");
  root.append(panel, badge);
  parent.append(root);
  return { root, panel, badge, style };
};

const updatePanel = (
  panel: HTMLElement,
  badge: HTMLElement,
  definition: StateDefinition,
  snapshot: HestiaOrbitSnapshot
): void => {
  badge.textContent = definition.badge;
  panel.innerHTML = `
    <h1>DIAGNOSTIC · Hestia orbit harness</h1>
    <p class="subtitle">Planet shell tile scheduler V1</p>
    <dl>
      <dt>State</dt><dd>${definition.label}</dd>
      <dt>Camera</dt><dd>0, 0, ${definition.cameraZ} m</dd>
      <dt>Revisions</dt><dd>selection ${snapshot.selectionRevision} · readiness ${snapshot.readinessRevision}</dd>
      <dt>Coverage</dt><dd>${snapshot.primary.length} primary · ${snapshot.fallback.length} fallback · ${snapshot.culled.length} culled</dd>
      <dt>Decision</dt><dd data-tone="decision">${snapshot.highlightedReason.code}</dd>
      <dt>Tile</dt><dd>${snapshot.highlightedReason.tileId}</dd>
      <dt>Load requests</dt><dd>${snapshot.loadRequests.length}</dd>
      <dt>Coverage status</dt><dd>${snapshot.coverageStatus}</dd>
    </dl>
  `;
};

export const mountHestiaOrbitHarness = (parent: HTMLElement = document.body): HestiaOrbitHarnessController => {
  const dom = mountDom(parent);
  const renderHarness: DeterministicRenderHarness = createDeterministicRenderHarness({
    parent: dom.root,
    backgroundColor: 0x080b12
  });
  let currentBackendRevision = 0;
  let currentDefinition: StateDefinition | undefined;
  let currentSnapshot: HestiaOrbitSnapshot | undefined;
  let disposed = false;
  let disposeResult: PlanetRenderCommandResult | undefined;
  let residentTransforms: readonly Readonly<{
    representationKey: PlanetRepresentationKey;
    originBodyCentered: Readonly<{ x: number; y: number; z: number }>;
  }>[] = Object.freeze([]);

  const hydrateBackend = (): void => {
    const nextTransforms: {
      representationKey: PlanetRepresentationKey;
      originBodyCentered: Readonly<{ x: number; y: number; z: number }>;
    }[] = [];
    for (const entry of residentTileDefinitions) {
      const mesh = createShell(entry.tileKey);
      const artifact = createPlanetShellMeshArtifact({
        mesh,
        sourceRevision: sourceRevision(1),
        artifactRevision: artifactRevision(1),
        frameId: FRAME_ID,
        materialProfileId: entry.material.id
      });
      nextTransforms.push(Object.freeze({
        representationKey: planetTileRepresentationKey(mesh.tileId),
        originBodyCentered: mesh.originBodyCentered
      }));
      assertAccepted(`Upsert ${mesh.tileId}`, renderHarness.dispatch({
        kind: "UpsertMeshArtifact",
        backendRevision: backendRevision(currentBackendRevision),
        artifact,
        materialProfiles: [entry.material]
      }));
    }
    residentTransforms = Object.freeze(nextTransforms);
  };

  const resetBackend = (): void => {
    const nextRevision = currentBackendRevision + 1;
    assertAccepted("Reset backend", renderHarness.dispatch({
      kind: "ResetBackend",
      backendRevision: backendRevision(currentBackendRevision),
      nextBackendRevision: backendRevision(nextRevision)
    }));
    currentBackendRevision = nextRevision;
    currentDefinition = undefined;
    currentSnapshot = undefined;
    hydrateBackend();
  };

  const applyState = (definition: StateDefinition): HestiaOrbitSnapshot => {
    if (disposed) throw new Error("The Hestia orbit harness is disposed.");
    if (
      currentDefinition !== undefined &&
      definition.selectionRevision < currentDefinition.selectionRevision
    ) {
      resetBackend();
    }
    const readiness = readinessFor(definition);
    const corePlan = selectFor(definition, readiness);
    const highlightedReason = highlightedReasonFor(definition, corePlan);
    const adapted = adaptPlanetPresentation({ corePlan, readiness });
    if (adapted.status !== "publish") {
      const missing = adapted.missingActiveTileKeys.length > 0
        ? adapted.missingActiveTileKeys.join(", ")
        : "none";
      throw new Error(
        `Hestia presentation adapter unexpectedly held ${definition.state}: ${adapted.reasonCode}; missing active tiles: ${missing}.`
      );
    }
    const scale = definition.visualScale;
    const projection = createFrameProjectionSnapshot({
      frameId: FRAME_ID,
      frameRevision: frameRevision(definition.selectionRevision),
      cameraPositionRelative: { x: 0, y: 0, z: CAMERA_VISUAL_Z },
      cameraOrientation: { x: 0, y: 0, z: 0, w: 1 },
      projectionParameters: {
        kind: "Perspective",
        verticalFovDegrees: 50,
        aspect: 16 / 9,
        near: 0.1,
        far: 100
      },
      representationTransforms: residentTransforms.map((entry) => ({
        representationKey: entry.representationKey,
        positionRelative: {
          x: entry.originBodyCentered.x * scale,
          y: entry.originBodyCentered.y * scale,
          z: entry.originBodyCentered.z * scale
        },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: scale, y: scale, z: scale }
      }))
    });
    assertAccepted("Apply projection", renderHarness.dispatch({
      kind: "ApplyFrameProjection",
      backendRevision: backendRevision(currentBackendRevision),
      snapshot: projection
    }));
    assertAccepted("Apply visibility", renderHarness.dispatch({
      kind: "ApplyVisibilityPlan",
      backendRevision: backendRevision(currentBackendRevision),
      plan: adapted.visibilityPlan
    }));
    assertAccepted("Render state", renderHarness.render());
    const diagnostics = renderHarness.backend.readDiagnostics();
    const visibleRepresentationKeys = new Set(diagnostics.visibleRepresentationKeys);
    const visibleTileIds = [...corePlan.primary, ...corePlan.fallback].filter((tileId) =>
      visibleRepresentationKeys.has(planetTileRepresentationKey(tileId))
    );
    const snapshot: HestiaOrbitSnapshot = Object.freeze({
      state: definition.state,
      selectionRevision: corePlan.selectionRevision,
      readinessRevision: corePlan.readinessRevision,
      cameraPositionMeters: Object.freeze({ x: 0, y: 0, z: definition.cameraZ }),
      primary: corePlan.primary,
      fallback: corePlan.fallback,
      culled: corePlan.culled,
      visibleTileIds: Object.freeze(visibleTileIds),
      visibleRepresentationKeys: Object.freeze([...diagnostics.visibleRepresentationKeys]),
      loadRequests: Object.freeze(adapted.loadJobs.map((job) => Object.freeze({
        tileId: job.tileId,
        reason: job.reason,
        requiredForCoverage: job.requiredForCoverage
      }))),
      reasons: corePlan.reasons,
      highlightedReason,
      coverageStatus: corePlan.coverageStatus
    });
    currentDefinition = definition;
    currentSnapshot = snapshot;
    updatePanel(dom.panel, dom.badge, definition, snapshot);
    return snapshot;
  };

  hydrateBackend();
  applyState(states["far-orbit"]);

  return Object.freeze({
    root: dom.root,
    canvas: renderHarness.canvas,
    showState: (state: HestiaOrbitState) => applyState(states[state]),
    showFarOrbit: () => applyState(states["far-orbit"]),
    showNearOrbit: () => applyState(states["near-orbit"]),
    showParentFallback: () => applyState(states["parent-fallback"]),
    showChildReady: () => applyState(states["child-ready"]),
    showEvicted: () => applyState(states.evicted),
    readSnapshot: () => {
      if (currentSnapshot === undefined) throw new Error("The Hestia orbit harness has no active state.");
      return currentSnapshot;
    },
    reset: () => {
      if (disposed) throw new Error("The Hestia orbit harness is disposed.");
      resetBackend();
      return applyState(states["far-orbit"]);
    },
    dispose: () => {
      if (disposed) return disposeResult as PlanetRenderCommandResult;
      disposed = true;
      const result = renderHarness.dispose();
      disposeResult = result;
      dom.root.remove();
      dom.style.remove();
      return result;
    }
  });
};
