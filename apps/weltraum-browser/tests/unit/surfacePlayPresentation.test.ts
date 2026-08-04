import { beforeAll, describe, expect, it } from "vitest";
import {
  VOXEL_BRICK_CELL_COUNT,
  allocateVoxelChannels,
  createVoxelBrick,
  editRevision,
  type VoxelBrick
} from "../../src/voxel";
import type { RenderCommand } from "../../src/presentation";
import { ThreeRenderBackend, type ThreeRendererPort } from "../../src/render/three/backend";
import {
  createSurfaceTerrainPresentationSnapshot,
  type SurfaceTerrainPresentationSnapshot
} from "../../src/surface-play/contracts";
import {
  createHestiaAgileGroundedLocomotionPresetV1,
  createSurfaceLocomotionState
} from "../../src/surface-play/player";
import { HESTIA_SURFACE_PLAY_V1_CONFIG } from "../../src/surface-play/surfacePlayConfig";
import {
  createSurfacePlayRuntime,
  surfacePlayPresentationBrickId,
  type SurfacePlayRuntimeSnapshot,
  type SurfacePlayRuntimeVoxelTransitionSnapshot
} from "../../src/surface-play/surfacePlayRuntime";
import { createSurfacePlayPresentation } from "../../src/surface-play/surfacePlayPresentation";
import {
  SURFACE_VOXEL_EDIT_QUANTUM_METERS,
  SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
  applySurfaceVoxelEdit,
  createSurfaceRegionVoxelAuthority,
  createSurfaceVoxelRemeshPlan,
  type SurfaceRegionMaterializedVoxelBrick,
  type SurfaceRegionVoxelAuthority,
  type SurfaceVoxelEditTransition,
  type SurfaceVoxelRemeshPlanResult
} from "../../src/surface-play/voxel-edit";
import type { HestiaSurfaceWorldFacts } from "../../src/surface-play/world";

class FakeRenderer implements ThreeRendererPort {
  public renders = 0;
  public disposals = 0;
  public setPixelRatio(): void {}
  public setSize(): void {}
  public render(): void { this.renders += 1; }
  public dispose(): void { this.disposals += 1; }
}

class RecordingThreeRenderBackend extends ThreeRenderBackend {
  public readonly commands: RenderCommand[] = [];

  public override dispatch(command: RenderCommand) {
    this.commands.push(command);
    return super.dispatch(command);
  }
}

const authorityInput = {
  ...HESTIA_SURFACE_PLAY_V1_CONFIG,
  seed: "surface-play-presentation-unit",
  brickBounds: {
    minInclusive: { x: 0, y: -1, z: 0 },
    maxExclusive: { x: 2, y: 0, z: 1 }
  },
  residentBrickCoordinates: [
    { x: 0, y: -1, z: 0 },
    { x: 1, y: -1, z: 0 }
  ]
} as const;

let baseAuthority: SurfaceRegionVoxelAuthority;
let firstEdit: SurfaceVoxelEditTransition;
let secondEdit: SurfaceVoxelEditTransition;
let firstPlan: Extract<SurfaceVoxelRemeshPlanResult, { status: "Planned" }>;
let secondPlan: Extract<SurfaceVoxelRemeshPlanResult, { status: "Planned" }>;

const plan = (
  transition: Readonly<SurfaceVoxelEditTransition>
): Extract<SurfaceVoxelRemeshPlanResult, { status: "Planned" }> => {
  const result = createSurfaceVoxelRemeshPlan(transition.result, {
    bodyId: transition.state.bodyId,
    regionId: transition.state.regionId,
    surfaceFrameId: transition.state.surfaceFrameId,
    regionRevision: transition.state.regionRevision,
    editRevision: transition.state.editRevision,
    residentBrickKeys: transition.state.materializedBricks.map((brick) => brick.key),
    maxRemeshBricks: transition.state.materializedBricks.length,
    maxEstimatedCellWork: VOXEL_BRICK_CELL_COUNT * transition.state.materializedBricks.length
  });
  if (result.status !== "Planned") throw new Error(`Expected planned remesh work, received ${result.reason}.`);
  return result;
};

beforeAll(() => {
  baseAuthority = createSurfaceRegionVoxelAuthority(authorityInput);
  firstEdit = applySurfaceVoxelEdit(baseAuthority, {
    schemaVersion: SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
    editId: "edit:presentation:first",
    expectedRegionRevision: 0,
    tick: 1,
    actorId: "actor:surface-player",
    sourceId: "weapon:pulse-cutter",
    sourceImpactIntentId: "impact:presentation:first",
    bodyId: authorityInput.bodyId,
    surfaceFrameId: authorityInput.surfaceFrameId,
    regionId: authorityInput.regionId,
    operation: "SubtractSphere",
    centerGlobalQuantum: { x: 128, y: -64, z: 64 },
    quantumMeters: SURFACE_VOXEL_EDIT_QUANTUM_METERS,
    radiusMeters: 1
  });
  if (firstEdit.result.status !== "Applied") throw new Error(`First fixture edit was ${firstEdit.result.status}.`);
  firstPlan = plan(firstEdit);

  secondEdit = applySurfaceVoxelEdit(firstEdit.authority, {
    schemaVersion: SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
    editId: "edit:presentation:second",
    expectedRegionRevision: firstEdit.state.regionRevision,
    tick: 2,
    actorId: "actor:surface-player",
    sourceId: "weapon:pulse-cutter",
    sourceImpactIntentId: "impact:presentation:second",
    bodyId: authorityInput.bodyId,
    surfaceFrameId: authorityInput.surfaceFrameId,
    regionId: authorityInput.regionId,
    operation: "SubtractSphere",
    centerGlobalQuantum: { x: 64, y: -64, z: 64 },
    quantumMeters: SURFACE_VOXEL_EDIT_QUANTUM_METERS,
    radiusMeters: 1
  });
  if (secondEdit.result.status !== "Applied") throw new Error(`Second fixture edit was ${secondEdit.result.status}.`);
  secondPlan = plan(secondEdit);
}, 30_000);

const worldForAuthority = (
  authority: Readonly<SurfaceRegionVoxelAuthority>
): Readonly<HestiaSurfaceWorldFacts> => {
  const state = authority.state;
  const identity = Object.freeze({
    bodyId: state.bodyId,
    regionId: state.regionId,
    surfaceFrameId: state.surfaceFrameId,
    regionRevision: state.regionRevision
  });
  const anchorCenterMeters = Object.freeze({ x: 8, y: 0, z: 8 });
  const residentBrickCoordinates = Object.freeze(
    state.residentBrickCoordinates.map((coordinate) => Object.freeze({ ...coordinate }))
  );
  const residentInsetBoundsMeters = Object.freeze({
    minInclusive: Object.freeze({ x: 0, z: 0 }),
    maxExclusive: Object.freeze({ x: 16, z: 16 })
  });
  return Object.freeze({
    identity,
    anchorCenterMeters,
    verticalBand: Object.freeze({ minimumMeters: -32, maximumExclusiveMeters: 0 }),
    brickBounds: state.brickBounds,
    residentBrickCoordinates,
    traversalDomain: Object.freeze({
      identity,
      gridSizeMeters: 0.5,
      gridOriginMeters: Object.freeze({ x: 8, z: 8 }),
      gridCounts: Object.freeze({ x: 1, z: 1 }),
      residentInsetBoundsMeters,
      componentBoundsMeters: Object.freeze({
        minInclusive: Object.freeze({ x: 8, z: 8 }),
        maxExclusive: Object.freeze({ x: 8.5, z: 8.5 }),
        size: Object.freeze({ x: 0.5, z: 0.5 })
      }),
      spawnGridCell: Object.freeze({ gridX: 0, gridZ: 0 }),
      spawnPerimeterDistanceMeters: 0,
      cells: Object.freeze([])
    }),
    shoreBoundary: Object.freeze({
      identity,
      gridSizeMeters: 0.5,
      gridOriginMeters: Object.freeze({ x: 8, z: 8 }),
      gridCounts: Object.freeze({ x: 1, z: 1 }),
      residentInsetBoundsMeters,
      dryCellKeys: Object.freeze([])
    }),
    waterSurfaceHeightMeters: 0,
    environment: Object.freeze({
      identity,
      rootSeed: state.seed,
      voxelSizeMeters: state.voxelSizeMeters,
      residentBrickCoordinates,
      waterSurfaceHeightMeters: 0,
      anchorCenterMeters,
      decorativePopulation: Object.freeze([]),
      waterPatches: Object.freeze([])
    }),
    encounter: Object.freeze({
      surveyDronePositionMeters: Object.freeze({ x: 8, y: 1.62, z: -4 }),
      structuralTrees: Object.freeze([])
    })
  });
};

const initialSnapshot = (): Readonly<SurfacePlayRuntimeSnapshot> => {
  const locomotion = createHestiaAgileGroundedLocomotionPresetV1();
  const snapshot = createSurfacePlayRuntime({
    routeId: "surface-play-presentation-unit",
    authority: baseAuthority,
    initialPlayerState: createSurfaceLocomotionState({
      playerId: "surface-player:presentation-unit",
      surfaceFrameId: authorityInput.surfaceFrameId,
      positionMeters: { x: 8, y: 0.9, z: 8 },
      velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
      yawRadians: 0,
      pitchRadians: 0,
      grounded: true,
      groundNormal: { x: 0, y: 1, z: 0 },
      movementMode: "Walk",
      capsule: locomotion.capsule,
      simulationTick: 0,
      jumpHeld: false
    })
  }).read();
  return Object.freeze({ ...snapshot, world: worldForAuthority(baseAuthority) });
};

const transitionSnapshot = (
  initial: Readonly<SurfacePlayRuntimeSnapshot>,
  authority: SurfaceRegionVoxelAuthority,
  transitions: readonly Readonly<SurfacePlayRuntimeVoxelTransitionSnapshot>[]
): Readonly<SurfacePlayRuntimeSnapshot> => {
  const terrain: SurfaceTerrainPresentationSnapshot = createSurfaceTerrainPresentationSnapshot({
    ...initial.presentation.terrain,
    regionRevision: authority.state.regionRevision,
    visibleBrickIds: authority.state.materializedBricks
      .map((brick) => surfacePlayPresentationBrickId(brick.coordinate))
      .sort()
  });
  return Object.freeze({
    ...initial,
    authorityState: authority.state,
    world: worldForAuthority(authority),
    presentation: Object.freeze({ ...initial.presentation, terrain }),
    appliedVoxelTransitions: Object.freeze([...transitions]),
    latestVoxelTransition: transitions.at(-1) ?? null
  });
};

const transition = (
  edit: Readonly<SurfaceVoxelEditTransition>,
  remeshPlan: Extract<SurfaceVoxelRemeshPlanResult, { status: "Planned" }>
): Readonly<SurfacePlayRuntimeVoxelTransitionSnapshot> => Object.freeze({
  intent: edit.state.editJournal.at(-1) === undefined
    ? (() => { throw new Error("Expected journaled fixture edit."); })()
    : {
        schemaVersion: SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
        editId: edit.state.editJournal.at(-1)!.editId,
        expectedRegionRevision: edit.result.priorRegionRevision,
        tick: edit.state.editJournal.at(-1)!.tick,
        actorId: edit.state.editJournal.at(-1)!.actorId,
        sourceId: edit.state.editJournal.at(-1)!.sourceId,
        sourceImpactIntentId: edit.state.editJournal.at(-1)!.sourceImpactIntentId,
        bodyId: edit.state.bodyId,
        surfaceFrameId: edit.state.surfaceFrameId,
        regionId: edit.state.regionId,
        operation: "SubtractSphere" as const,
        centerGlobalQuantum: edit.state.editJournal.at(-1)!.centerGlobalQuantum,
        quantumMeters: SURFACE_VOXEL_EDIT_QUANTUM_METERS,
        radiusMeters: edit.state.editJournal.at(-1)!.radiusMeters
      },
  result: edit.result,
  remeshPlan
});

const backendFixture = () => {
  const renderer = new FakeRenderer();
  const backend = new RecordingThreeRenderBackend({
    canvas: {} as HTMLCanvasElement,
    lightingMode: "None",
    rendererFactory: () => renderer
  });
  return { backend, renderer };
};

const sequentialMaterializer = (
  versions: readonly SurfaceRegionVoxelAuthority[]
): ((key: string) => Readonly<SurfaceRegionMaterializedVoxelBrick> | undefined) => {
  const callsByKey = new Map<string, number>();
  return (key) => {
    const index = callsByKey.get(key) ?? 0;
    callsByKey.set(key, index + 1);
    return versions[Math.min(index, versions.length - 1)].materializeBrick(key);
  };
};

describe("Surface Play presentation", () => {
  it("fails closed before backend initialization when World-owned facts are absent or stale", () => {
    const initial = initialSnapshot();
    const missingWorld = Object.freeze({ ...initial, world: null });
    const missingBackend = backendFixture().backend;
    expect(() => createSurfacePlayPresentation({
      backend: missingBackend,
      initialSnapshot: missingWorld,
      materializeBrick: sequentialMaterializer([baseAuthority])
    })).toThrow("requires World-owned environment facts");
    expect(missingBackend.commands).toHaveLength(0);

    if (initial.world === null) throw new Error("Expected World-bound presentation fixture.");
    const staleWorld = Object.freeze({
      ...initial.world,
      environment: Object.freeze({ ...initial.world.environment, rootSeed: "stale-world-seed" })
    });
    const staleBackend = backendFixture().backend;
    expect(() => createSurfacePlayPresentation({
      backend: staleBackend,
      initialSnapshot: Object.freeze({ ...initial, world: staleWorld }),
      materializeBrick: sequentialMaterializer([baseAuthority])
    })).toThrow("stale for the voxel authority");
    expect(staleBackend.commands).toHaveLength(0);
  });

  it("publishes canonical visible bricks and consumes ordered edit transitions exactly once", () => {
    const initial = initialSnapshot();
    const first = transition(firstEdit, firstPlan);
    const second = transition(secondEdit, secondPlan);
    const current = transitionSnapshot(initial, secondEdit.authority, [first, second]);
    const { backend, renderer } = backendFixture();
    const presentation = createSurfacePlayPresentation({
      backend,
      initialSnapshot: initial,
      materializeBrick: sequentialMaterializer([baseAuthority, firstEdit.authority, secondEdit.authority])
    });
    expect(Object.keys(presentation).sort()).toEqual(["dispose", "present", "presentStructural", "render"]);

    expect(initial.presentation.terrain.visibleBrickIds).toEqual(
      baseAuthority.state.materializedBricks.map((brick) => surfacePlayPresentationBrickId(brick.coordinate)).sort()
    );
    expect(backend.readDiagnostics()).toMatchObject({
      activeRepresentations: 2,
      visibleRepresentationKeys: expect.arrayContaining([...backend.readDiagnostics().residentRepresentationKeys])
    });

    presentation.present(current);
    const expectedArtifactRevisions = [
      ...baseAuthority.state.materializedBricks.map(() => 0),
      ...firstPlan.orderedRemeshKeys.map(() => firstEdit.state.editRevision),
      ...secondPlan.orderedRemeshKeys.map(() => secondEdit.state.editRevision)
    ];
    const upserts = backend.commands.filter((command) => command.kind === "UpsertMeshArtifact");
    expect(upserts.map((command) => command.artifact.artifactRevision)).toEqual(expectedArtifactRevisions);
    expect(backend.commands.filter((command) => command.kind === "ApplyFrameProjection")).toHaveLength(upserts.length);
    expect(backend.commands.filter((command) => command.kind === "ApplyVisibilityPlan")).toHaveLength(upserts.length);
    expect(backend.readDiagnostics()).toMatchObject({
      activeRepresentations: 2,
      removeCount: expectedArtifactRevisions.length - 2,
      replacementCount: 0
    });

    presentation.present(current);
    expect(backend.commands.filter((command) => command.kind === "UpsertMeshArtifact")).toHaveLength(upserts.length);
    expect(backend.commands.filter((command) => command.kind === "ApplyFrameProjection")).toHaveLength(upserts.length);
    expect(backend.commands.filter((command) => command.kind === "ApplyVisibilityPlan")).toHaveLength(upserts.length);

    presentation.render();
    expect(renderer.renders).toBe(1);
    presentation.dispose();
    presentation.dispose();
    expect(renderer.disposals).toBe(1);
    expect(backend.commands.filter((command) => command.kind === "DisposeBackend")).toHaveLength(1);
    expect(backend.readDiagnostics()).toMatchObject({
      backendState: "Disposed",
      activeRepresentations: 0,
      geometryAllocations: expectedArtifactRevisions.length,
      geometryDisposals: expectedArtifactRevisions.length,
      estimatedGpuBytes: 0
    });
  });

  it("ignores a snapshot older than the monotonic edit cursor", () => {
    const initial = initialSnapshot();
    const first = transition(firstEdit, firstPlan);
    const current = transitionSnapshot(initial, firstEdit.authority, [first]);
    const { backend } = backendFixture();
    const presentation = createSurfacePlayPresentation({
      backend,
      initialSnapshot: initial,
      materializeBrick: sequentialMaterializer([baseAuthority, firstEdit.authority])
    });
    presentation.present(current);
    const publicationCount = backend.commands.length;

    expect(() => presentation.present(initial)).not.toThrow();
    expect(backend.commands).toHaveLength(publicationCount);
    presentation.dispose();
  });

  it("removes an existing representation when remeshing yields an empty brick", () => {
    const initial = initialSnapshot();
    const first = transition(firstEdit, firstPlan);
    const current = transitionSnapshot(initial, firstEdit.authority, [first]);
    const firstKey = firstPlan.orderedRemeshKeys[0];
    const source = firstEdit.authority.materializeBrick(firstKey);
    if (source === undefined) throw new Error("Expected materialized edit fixture brick.");
    const channels = allocateVoxelChannels();
    channels.densityBuffer.fill(1);
    const emptyVoxelBrick: VoxelBrick = createVoxelBrick({
      ...source.voxelBrick,
      editRevision: editRevision(0),
      ...channels
    });
    const empty: SurfaceRegionMaterializedVoxelBrick = Object.freeze({
      ...source,
      editRevision: firstEdit.state.editRevision,
      voxelBrick: emptyVoxelBrick
    });
    const calls = new Map<string, number>();
    const { backend } = backendFixture();
    const presentation = createSurfacePlayPresentation({
      backend,
      initialSnapshot: initial,
      materializeBrick: (key) => {
        const count = calls.get(key) ?? 0;
        calls.set(key, count + 1);
        return key === firstKey && count > 0 ? empty : baseAuthority.materializeBrick(key);
      }
    });

    presentation.present(current);

    expect(backend.commands.filter((command) => command.kind === "RemoveRepresentation")).toHaveLength(1);
    expect(backend.commands.filter((command) => command.kind === "ApplyFrameProjection")).toHaveLength(
      baseAuthority.state.materializedBricks.length + firstPlan.orderedRemeshKeys.length
    );
    expect(backend.commands.filter((command) => command.kind === "ApplyVisibilityPlan")).toHaveLength(
      baseAuthority.state.materializedBricks.length + firstPlan.orderedRemeshKeys.length
    );
    expect(backend.readDiagnostics()).toMatchObject({ activeRepresentations: 1, removeCount: 1 });
    presentation.dispose();
  });
});
