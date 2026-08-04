import { describe, expect, it, vi } from "vitest";

const authorityProbeCounts = vi.hoisted(() => ({
  enabled: false,
  groundQueries: 0,
  densityQueries: 0
}));

vi.mock("../../src/surface-play/voxel-edit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/surface-play/voxel-edit")>();
  return {
    ...actual,
    createSurfaceRegionVoxelCollisionAdapter: (
      ...args: Parameters<typeof actual.createSurfaceRegionVoxelCollisionAdapter>
    ) => {
      const adapter = actual.createSurfaceRegionVoxelCollisionAdapter(...args);
      if (!authorityProbeCounts.enabled) return adapter;
      return Object.freeze({
        ...adapter,
        sampleDensity: (...queryArgs: Parameters<typeof adapter.sampleDensity>) => {
          authorityProbeCounts.densityQueries += 1;
          return adapter.sampleDensity(...queryArgs);
        },
        queryGround: (...queryArgs: Parameters<typeof adapter.queryGround>) => {
          authorityProbeCounts.groundQueries += 1;
          return adapter.queryGround(...queryArgs);
        }
      });
    }
  };
});

import {
  createSurfaceCapsuleSweepQuery,
  createSurfacePlayerCommand
} from "../../src/surface-play/contracts";
import {
  resolveHestiaSurfacePlaySpawn,
  resolveHestiaSurfacePlayWorld,
  revalidateHestiaSurfacePlayWorld
} from "../../src/surface-play/surfacePlayBootstrap";
import {
  createHestiaAgileGroundedLocomotionPresetV1,
  createSurfaceLocomotionState
} from "../../src/surface-play/player";
import {
  createHestiaSurfacePlayAuthorityInput,
  HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG,
  HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS
} from "../../src/surface-play/surfacePlayConfig";
import {
  createShoreBoundSurfaceCollisionDelegate,
  createSurfaceVoxelCollisionDelegate
} from "../../src/surface-play/surfacePlayCollision";
import { createSurfacePlayRuntime } from "../../src/surface-play/surfacePlayRuntime";
import {
  SURFACE_VOXEL_EDIT_QUANTUM_METERS,
  SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
  applySurfaceVoxelEdit,
  createSurfaceRegionVoxelAuthority,
  createSurfaceRegionVoxelCollisionAdapter,
  type SurfaceVoxelEditIntent
} from "../../src/surface-play/voxel-edit";
import {
  findHestiaShoreBoundaryFraction,
  revalidateHestiaSurfaceWorldAgainstAuthority,
  revalidateHestiaSurfaceWorldIncrementallyAgainstAuthority
} from "../../src/surface-play/world";
import {
  HESTIA_COAST_LUSH_PRESET_ID,
  HESTIA_SEA_LEVEL_METERS
} from "../../src/world-generation/hestia";

describe("Surface Play incremental Terrain adoption", () => {
  it("keeps the immutable initial dry-coast mask when a local crater removes traversal cells", () => {
    const sourceWorld = resolveHestiaSurfacePlayWorld();
    expect(sourceWorld.anchorCenterMeters).toMatchObject({ x: 64, z: -32 });
    const authority = createSurfaceRegionVoxelAuthority(createHestiaSurfacePlayAuthorityInput(sourceWorld));
    const adopted = revalidateHestiaSurfacePlayWorld(authority, sourceWorld);
    if (adopted.status === "Rejected") throw new Error(adopted.failure.message);
    const locomotion = createHestiaAgileGroundedLocomotionPresetV1();
    const cutCell = adopted.world.traversalDomain.cells.find((cell) =>
      cell.centerMeters.x === 80 && cell.centerMeters.z === -24
    );
    if (cutCell === undefined) throw new Error("Expected the deterministic interior crater cell.");
    const editIntent: SurfaceVoxelEditIntent = {
      schemaVersion: SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
      editId: "surface-edit:post-edit-crater-boundary",
      expectedRegionRevision: authority.state.regionRevision,
      tick: 1,
      actorId: "surface-player:post-edit-crater-boundary",
      sourceId: "hestia.pulse-cutter.v1",
      sourceImpactIntentId: "impact:post-edit-crater-boundary",
      bodyId: authority.state.bodyId,
      surfaceFrameId: authority.state.surfaceFrameId,
      regionId: authority.state.regionId,
      operation: "SubtractSphere",
      centerGlobalQuantum: {
        x: Math.round(cutCell.centerMeters.x / SURFACE_VOXEL_EDIT_QUANTUM_METERS),
        y: Math.round(cutCell.groundHeightMeters / SURFACE_VOXEL_EDIT_QUANTUM_METERS),
        z: Math.round(cutCell.centerMeters.z / SURFACE_VOXEL_EDIT_QUANTUM_METERS)
      },
      quantumMeters: SURFACE_VOXEL_EDIT_QUANTUM_METERS,
      radiusMeters: 0.75
    };
    const transition = applySurfaceVoxelEdit(authority, editIntent);
    expect(transition.result.status).toBe("Applied");
    const collisionAdapter = createSurfaceRegionVoxelCollisionAdapter(transition.authority);

    const revalidated = revalidateHestiaSurfaceWorldIncrementallyAgainstAuthority({
      sourceWorld: adopted.world,
      state: transition.state,
      adapter: collisionAdapter,
      frameOriginMeters: HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS,
      waterSurfaceHeightMeters: HESTIA_SEA_LEVEL_METERS,
      capsule: locomotion.capsule,
      collisionSkinMeters: locomotion.collisionSkinMeters,
      editIntent,
      editResult: transition.result
    });

    expect(revalidated.status).toBe("Selected");
    if (revalidated.status !== "Selected") throw new Error(revalidated.failure.message);
    expect(revalidated.world.identity.regionRevision).toBe(1);
    expect(revalidated.world.shoreBoundary.identity.regionRevision).toBe(1);
    expect(revalidated.world.traversalDomain.cells.length)
      .toBeLessThan(adopted.world.traversalDomain.cells.length);
    expect(revalidated.world.shoreBoundary.dryCellKeys)
      .toBe(adopted.world.shoreBoundary.dryCellKeys);
    expect(findHestiaShoreBoundaryFraction(
      revalidated.world.shoreBoundary,
      { x: 78.75, z: -24 },
      { x: 2.5, z: 0 },
      locomotion.capsule.radiusMeters
    )).toBeNull();
    const outerBoundaryFraction = findHestiaShoreBoundaryFraction(
      revalidated.world.shoreBoundary,
      { x: 64, z: -32 },
      { x: 40, z: 0 },
      locomotion.capsule.radiusMeters
    );
    expect(outerBoundaryFraction).not.toBeNull();
    expect(outerBoundaryFraction).toBeLessThan(1);

    const approachCell = adopted.world.traversalDomain.cells.find((cell) =>
      cell.centerMeters.x === 78.5 && cell.centerMeters.z === -24
    );
    if (approachCell === undefined) throw new Error("Expected the deterministic crater approach cell.");
    const sweepQuery = createSurfaceCapsuleSweepQuery({
      bodyId: transition.state.bodyId,
      regionId: transition.state.regionId,
      surfaceFrameId: transition.state.surfaceFrameId,
      regionRevision: transition.state.regionRevision,
      simulationTick: 2,
      queryId: "surface-sweep:post-edit-crater-boundary",
      kind: "CapsuleSweep",
      capsule: locomotion.capsule,
      startPositionMeters: {
        x: 78.75,
        y: approachCell.groundHeightMeters + locomotion.capsule.heightMeters / 2,
        z: -24
      },
      displacementMeters: { x: 2.5, y: 0, z: 0 }
    });
    const terrainOnly = createSurfaceVoxelCollisionDelegate(collisionAdapter, transition.state);
    const shoreBound = createShoreBoundSurfaceCollisionDelegate({
      boundary: revalidated.world.shoreBoundary,
      delegate: terrainOnly
    });
    const terrainSweep = terrainOnly.sweepCapsule(sweepQuery);
    const shoreBoundSweep = shoreBound.sweepCapsule(sweepQuery);
    expect(terrainSweep.status).toBe("Resolved");
    expect(shoreBoundSweep).toEqual(terrainSweep);
  }, 30_000);

  it("retains the Coast profile through full and incremental authority revalidation", () => {
    const sourceWorld = resolveHestiaSurfacePlayWorld(
      HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG,
      HESTIA_COAST_LUSH_PRESET_ID
    );
    const authority = createSurfaceRegionVoxelAuthority(
      createHestiaSurfacePlayAuthorityInput(sourceWorld, HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG)
    );
    const locomotion = createHestiaAgileGroundedLocomotionPresetV1();
    const full = revalidateHestiaSurfacePlayWorld(authority, sourceWorld);
    expect(full.status).toBe("Selected");
    if (full.status !== "Selected") throw new Error(full.failure.message);

    const stableCell = full.world.traversalDomain.cells.find((cell) =>
      cell.gridX === 46 && cell.gridZ === 8
    );
    if (stableCell === undefined) throw new Error("Expected the stable Coast traversal cell.");
    expect(stableCell.groundHeightMeters).toBeCloseTo(6.8, 3);

    const editCell = full.world.traversalDomain.cells.find((cell) =>
      Math.hypot(
        cell.centerMeters.x - stableCell.centerMeters.x,
        cell.centerMeters.z - stableCell.centerMeters.z
      ) >= 16
    );
    if (editCell === undefined) throw new Error("Expected a safe Coast Terrain edit cell.");
    const editIntent: SurfaceVoxelEditIntent = {
      schemaVersion: SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
      editId: "surface-edit:coast-incremental-profile",
      expectedRegionRevision: authority.state.regionRevision,
      tick: 1,
      actorId: "surface-player:coast-incremental-profile",
      sourceId: "hestia.pulse-cutter.v1",
      sourceImpactIntentId: "impact:coast-incremental-profile",
      bodyId: authority.state.bodyId,
      surfaceFrameId: authority.state.surfaceFrameId,
      regionId: authority.state.regionId,
      operation: "SubtractSphere",
      centerGlobalQuantum: {
        x: Math.round(editCell.centerMeters.x / SURFACE_VOXEL_EDIT_QUANTUM_METERS),
        y: Math.round(editCell.groundHeightMeters / SURFACE_VOXEL_EDIT_QUANTUM_METERS),
        z: Math.round(editCell.centerMeters.z / SURFACE_VOXEL_EDIT_QUANTUM_METERS)
      },
      quantumMeters: SURFACE_VOXEL_EDIT_QUANTUM_METERS,
      radiusMeters: 0.75
    };
    const transition = applySurfaceVoxelEdit(authority, editIntent);
    expect(transition.result.status).toBe("Applied");
    const incremental = revalidateHestiaSurfaceWorldIncrementallyAgainstAuthority({
      sourceWorld: full.world,
      state: transition.state,
      adapter: createSurfaceRegionVoxelCollisionAdapter(transition.authority),
      frameOriginMeters: HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS,
      waterSurfaceHeightMeters: HESTIA_SEA_LEVEL_METERS,
      capsule: locomotion.capsule,
      collisionSkinMeters: locomotion.collisionSkinMeters,
      editIntent,
      editResult: transition.result
    });

    expect(incremental.status).toBe("Selected");
    if (incremental.status !== "Selected") throw new Error(incremental.failure.message);
    const retainedCell = incremental.world.traversalDomain.cells.find((cell) =>
      cell.gridX === 46 && cell.gridZ === 8
    );
    expect(retainedCell?.groundHeightMeters).toBeCloseTo(6.8, 3);
  }, 60_000);

  it("rejects full revalidation for a foreign authority identity before relabeling the source world", () => {
    const sourceWorld = resolveHestiaSurfacePlayWorld();
    const foreignAuthority = createSurfaceRegionVoxelAuthority({
      ...createHestiaSurfacePlayAuthorityInput(sourceWorld),
      regionId: "region:hestia.surface-play.foreign.v1"
    });
    const locomotion = createHestiaAgileGroundedLocomotionPresetV1();
    const revalidated = revalidateHestiaSurfaceWorldAgainstAuthority({
      sourceWorld,
      state: foreignAuthority.state,
      adapter: createSurfaceRegionVoxelCollisionAdapter(foreignAuthority),
      frameOriginMeters: HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS,
      waterSurfaceHeightMeters: HESTIA_SEA_LEVEL_METERS,
      capsule: locomotion.capsule,
      collisionSkinMeters: locomotion.collisionSkinMeters
    });

    expect(revalidated).toEqual({
      status: "Rejected",
      failure: {
        code: "NoAdmissibleLandFootprint",
        message: "Hestia World environment facts are stale for the materialized authority.",
        attemptedCandidateCount: 1
      }
    });
  }, 60_000);

  it("bounds authoritative ground probes to the local cut dependency halo", () => {
    const sourceWorld = resolveHestiaSurfacePlayWorld();
    const authority = createSurfaceRegionVoxelAuthority(createHestiaSurfacePlayAuthorityInput(sourceWorld));
    const adopted = revalidateHestiaSurfacePlayWorld(authority, sourceWorld);
    if (adopted.status === "Rejected") throw new Error(adopted.failure.message);
    const locomotion = createHestiaAgileGroundedLocomotionPresetV1();
    const spawn = resolveHestiaSurfacePlaySpawn(authority, adopted.world);
    const cutCell = adopted.world.traversalDomain.cells.find((cell) =>
      cell.centerMeters.x === adopted.world.anchorCenterMeters.x + 16
      && cell.centerMeters.z === adopted.world.anchorCenterMeters.z + 8
    );
    if (cutCell === undefined) throw new Error("Expected deterministic interior Terrain cut cell.");
    const player = createSurfaceLocomotionState({
      ...spawn,
      positionMeters: {
        x: cutCell.centerMeters.x,
        y: cutCell.groundHeightMeters + locomotion.capsule.heightMeters / 2,
        z: cutCell.centerMeters.z
      },
      pitchRadians: -locomotion.maximumPitchRadians
    });
    const runtime = createSurfacePlayRuntime({
      routeId: "surface-play-terrain-adoption-performance",
      initialPlayerState: player,
      authority,
      world: adopted.world
    });
    const beforeAccepted = runtime.read();

    authorityProbeCounts.enabled = true;
    authorityProbeCounts.groundQueries = 0;
    authorityProbeCounts.densityQueries = 0;
    const adoptionStartedAt = performance.now();
    const advanced = runtime.advance(locomotion.fixedDeltaSeconds, (simulationTick, state) =>
      createSurfacePlayerCommand({
        playerId: state.playerId,
        surfaceFrameId: state.surfaceFrameId,
        simulationTick,
        moveAxes: { forward: 0, right: 0 },
        lookDeltaRadians: { yaw: 0, pitch: 0 },
        sprint: false,
        crouch: null,
        jump: false,
        fire: true,
        pointerLockIntent: "Unchanged",
        reset: "None"
      })
    );
    const adoptionElapsedMilliseconds = performance.now() - adoptionStartedAt;
    authorityProbeCounts.enabled = false;

    expect(authorityProbeCounts.groundQueries)
      .toBe(42);
    expect(authorityProbeCounts.densityQueries).toBeGreaterThan(0);
    expect(authorityProbeCounts.densityQueries).toBeLessThanOrEqual(42 * 32);
    expect(adoptionElapsedMilliseconds).toBeLessThan(2_000);
    expect(advanced.rejections).toEqual([]);
    expect(advanced.snapshot.latestVoxelTransition?.result.status).toBe("Applied");
    expect(advanced.snapshot.authorityState.regionRevision).toBe(1);
    expect(advanced.snapshot.world?.identity.regionRevision).toBe(1);
    expect(advanced.snapshot.presentation.terrain.regionRevision).toBe(1);
    expect(advanced.snapshot.appliedVoxelTransitions).toHaveLength(1);
    expect(advanced.snapshot.latestVoxelTransition)
      .toBe(advanced.snapshot.appliedVoxelTransitions[0]);
    expect(advanced.snapshot.latestVoxelTransition?.result).toMatchObject({
      priorRegionRevision: beforeAccepted.authorityState.regionRevision,
      resultingRegionRevision: advanced.snapshot.authorityState.regionRevision,
      priorRegionHash: beforeAccepted.authorityState.currentRegionContentHash,
      resultingRegionHash: advanced.snapshot.authorityState.currentRegionContentHash
    });
    expect(advanced.snapshot.latestVoxelTransition?.remeshPlan?.status).toBe("Planned");

    const applyWithInvalidCollisionEvidence: typeof applySurfaceVoxelEdit = (current, intent) => {
      const transition = applySurfaceVoxelEdit(current, intent);
      if (transition.result.status !== "Applied") return transition;
      return Object.freeze({
        ...transition,
        result: Object.freeze({
          ...transition.result,
          requiredCollisionRefreshKeys: Object.freeze([])
        })
      });
    };
    const failClosedRuntime = createSurfacePlayRuntime({
      routeId: "surface-play-terrain-adoption-fail-closed",
      initialPlayerState: player,
      authority,
      world: adopted.world,
      applyVoxelEdit: applyWithInvalidCollisionEvidence
    });
    const beforeFailClosed = failClosedRuntime.read();
    const failedAdoption = failClosedRuntime.advance(locomotion.fixedDeltaSeconds, (simulationTick, state) =>
      createSurfacePlayerCommand({
        playerId: state.playerId,
        surfaceFrameId: state.surfaceFrameId,
        simulationTick,
        moveAxes: { forward: 0, right: 0 },
        lookDeltaRadians: { yaw: 0, pitch: 0 },
        sprint: false,
        crouch: null,
        jump: false,
        fire: true,
        pointerLockIntent: "Unchanged",
        reset: "None"
      })
    );
    expect(failedAdoption.rejections).toMatchObject([{
      kind: "VoxelEdit",
      code: "AuthorityRefused"
    }]);
    expect(failedAdoption.snapshot.authorityState).toBe(beforeFailClosed.authorityState);
    expect(failedAdoption.snapshot.world).toBe(beforeFailClosed.world);
    expect(failedAdoption.snapshot.presentation.terrain).toBe(beforeFailClosed.presentation.terrain);
    if (
      failedAdoption.snapshot.presentation.structural === null
      || beforeFailClosed.presentation.structural === null
    ) throw new Error("Expected Structural presentation before and after fail-closed adoption.");
    const {
      simulationTick: _beforeStructuralTick,
      ...beforeFailClosedStructural
    } = beforeFailClosed.presentation.structural;
    const {
      simulationTick: _afterStructuralTick,
      ...afterFailClosedStructural
    } = failedAdoption.snapshot.presentation.structural;
    expect(afterFailClosedStructural).toEqual(beforeFailClosedStructural);
    expect(failedAdoption.snapshot.appliedVoxelTransitions).toEqual([]);

    const authorityBaseline = revalidateHestiaSurfaceWorldAgainstAuthority({
      sourceWorld: adopted.world,
      state: authority.state,
      adapter: createSurfaceRegionVoxelCollisionAdapter(authority),
      frameOriginMeters: HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS,
      waterSurfaceHeightMeters: HESTIA_SEA_LEVEL_METERS,
      capsule: locomotion.capsule,
      collisionSkinMeters: locomotion.collisionSkinMeters
    });
    if (authorityBaseline.status === "Rejected") throw new Error(authorityBaseline.failure.message);
    const baselineCells = authorityBaseline.world.traversalDomain.cells;
    const anchor = authorityBaseline.world.anchorCenterMeters;
    const boundary = authorityBaseline.world.traversalDomain.residentInsetBoundsMeters;
    const distanceFromAnchor = (cell: (typeof baselineCells)[number]) => Math.hypot(
      cell.centerMeters.x - anchor.x,
      cell.centerMeters.z - anchor.z
    );
    const boundaryDistance = (cell: (typeof baselineCells)[number]) => Math.min(
      cell.centerMeters.x - boundary.minInclusive.x,
      boundary.maxExclusive.x - cell.centerMeters.x,
      cell.centerMeters.z - boundary.minInclusive.z,
      boundary.maxExclusive.z - cell.centerMeters.z
    );
    const interior = baselineCells.find((cell) =>
      cell.gridX === cutCell.gridX && cell.gridZ === cutCell.gridZ
    );
    const slope = [...baselineCells]
      .filter((cell) => distanceFromAnchor(cell) >= 14 && boundaryDistance(cell) >= 4)
      .sort((left, right) => left.groundNormal.y - right.groundNormal.y
        || left.gridZ - right.gridZ || left.gridX - right.gridX)[0];
    const nearBoundary = [...baselineCells]
      .filter((cell) => distanceFromAnchor(cell) >= 14 && cell !== slope)
      .sort((left, right) => boundaryDistance(left) - boundaryDistance(right)
        || left.gridZ - right.gridZ || left.gridX - right.gridX)[0];
    if (interior === undefined || slope === undefined || nearBoundary === undefined) {
      throw new Error("Expected deterministic interior, slope, and near-boundary Terrain cells.");
    }

    for (const [label, cell] of [
      ["interior", interior],
      ["slope", slope],
      ["near-boundary", nearBoundary]
    ] as const) {
      const editIntent: SurfaceVoxelEditIntent = {
        schemaVersion: SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
        editId: `surface-edit:incremental-equivalence:${label}`,
        expectedRegionRevision: authority.state.regionRevision,
        tick: 1,
        actorId: "surface-player:incremental-equivalence",
        sourceId: "hestia.pulse-cutter.v1",
        sourceImpactIntentId: `impact:incremental-equivalence:${label}`,
        bodyId: authority.state.bodyId,
        surfaceFrameId: authority.state.surfaceFrameId,
        regionId: authority.state.regionId,
        operation: "SubtractSphere",
        centerGlobalQuantum: {
          x: Math.round(cell.centerMeters.x / SURFACE_VOXEL_EDIT_QUANTUM_METERS),
          y: Math.round(cell.groundHeightMeters / SURFACE_VOXEL_EDIT_QUANTUM_METERS),
          z: Math.round(cell.centerMeters.z / SURFACE_VOXEL_EDIT_QUANTUM_METERS)
        },
        quantumMeters: SURFACE_VOXEL_EDIT_QUANTUM_METERS,
        radiusMeters: 0.75
      };
      const transition = applySurfaceVoxelEdit(authority, editIntent);
      expect(transition.result.status, label).toBe("Applied");
      const common = {
        sourceWorld: authorityBaseline.world,
        state: transition.state,
        adapter: createSurfaceRegionVoxelCollisionAdapter(transition.authority),
        frameOriginMeters: HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS,
        waterSurfaceHeightMeters: HESTIA_SEA_LEVEL_METERS,
        capsule: locomotion.capsule,
        collisionSkinMeters: locomotion.collisionSkinMeters
      };
      const incremental = revalidateHestiaSurfaceWorldIncrementallyAgainstAuthority({
        ...common,
        editIntent,
        editResult: transition.result
      });
      const fullReference = revalidateHestiaSurfaceWorldAgainstAuthority(common);
      expect(incremental.status, label).toBe("Selected");
      expect(fullReference.status, label).toBe("Selected");
      if (incremental.status !== "Selected") throw new Error(incremental.failure.message);
      if (fullReference.status !== "Selected") throw new Error(fullReference.failure.message);
      const fullReferenceWithSelectedShoreMask = Object.freeze({
        ...fullReference.world,
        shoreBoundary: Object.freeze({
          ...fullReference.world.shoreBoundary,
          dryCellKeys: authorityBaseline.world.shoreBoundary.dryCellKeys
        })
      });
      expect(incremental.world, label).toEqual(fullReferenceWithSelectedShoreMask);
      expect(incremental.world.shoreBoundary.dryCellKeys, label)
        .toBe(authorityBaseline.world.shoreBoundary.dryCellKeys);
      const unchanged = baselineCells.find((candidate) =>
        Math.hypot(
          candidate.centerMeters.x - cell.centerMeters.x,
          candidate.centerMeters.z - cell.centerMeters.z
        ) >= 8
      );
      if (unchanged === undefined) throw new Error("Expected an unaffected traversal cell.");
      const incrementallyUnchanged = incremental.world.traversalDomain.cells.find((candidate) =>
        candidate.gridX === unchanged.gridX && candidate.gridZ === unchanged.gridZ
      );
      expect(incrementallyUnchanged, label).toBe(unchanged);
      expect(incremental.world.environment.decorativePopulation, label)
        .toBe(authorityBaseline.world.environment.decorativePopulation);
      expect(incremental.world.environment.waterPatches, label)
        .toBe(authorityBaseline.world.environment.waterPatches);
    }

    const noChangeIntent: SurfaceVoxelEditIntent = {
      schemaVersion: SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
      editId: "surface-edit:incremental-equivalence:no-change",
      expectedRegionRevision: authority.state.regionRevision,
      tick: 1,
      actorId: "surface-player:incremental-equivalence",
      sourceId: "hestia.pulse-cutter.v1",
      sourceImpactIntentId: "impact:incremental-equivalence:no-change",
      bodyId: authority.state.bodyId,
      surfaceFrameId: authority.state.surfaceFrameId,
      regionId: authority.state.regionId,
      operation: "SubtractSphere",
      centerGlobalQuantum: {
        x: Math.round(anchor.x / SURFACE_VOXEL_EDIT_QUANTUM_METERS),
        y: Math.round(30 / SURFACE_VOXEL_EDIT_QUANTUM_METERS),
        z: Math.round(anchor.z / SURFACE_VOXEL_EDIT_QUANTUM_METERS)
      },
      quantumMeters: SURFACE_VOXEL_EDIT_QUANTUM_METERS,
      radiusMeters: 0.125
    };
    const noChangeTransition = applySurfaceVoxelEdit(authority, noChangeIntent);
    expect(noChangeTransition.result.status).toBe("NoChange");
    authorityProbeCounts.enabled = true;
    authorityProbeCounts.groundQueries = 0;
    authorityProbeCounts.densityQueries = 0;
    const noChangeWorld = revalidateHestiaSurfaceWorldIncrementallyAgainstAuthority({
      sourceWorld: adopted.world,
      state: noChangeTransition.state,
      adapter: createSurfaceRegionVoxelCollisionAdapter(noChangeTransition.authority),
      frameOriginMeters: HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS,
      waterSurfaceHeightMeters: HESTIA_SEA_LEVEL_METERS,
      capsule: locomotion.capsule,
      collisionSkinMeters: locomotion.collisionSkinMeters,
      editIntent: noChangeIntent,
      editResult: noChangeTransition.result
    });
    authorityProbeCounts.enabled = false;
    expect(authorityProbeCounts.groundQueries).toBe(0);
    expect(authorityProbeCounts.densityQueries).toBe(0);
    expect(noChangeWorld.status).toBe("Selected");
    if (noChangeWorld.status !== "Selected") throw new Error(noChangeWorld.failure.message);
    expect(noChangeWorld.world.identity.regionRevision).toBe(1);
    expect(noChangeWorld.world.anchorCenterMeters).toBe(adopted.world.anchorCenterMeters);
    expect(noChangeWorld.world.verticalBand).toBe(adopted.world.verticalBand);
    expect(noChangeWorld.world.brickBounds).toBe(adopted.world.brickBounds);
    expect(noChangeWorld.world.residentBrickCoordinates).toBe(adopted.world.residentBrickCoordinates);
    expect(noChangeWorld.world.traversalDomain.cells).toBe(adopted.world.traversalDomain.cells);
    expect(noChangeWorld.world.shoreBoundary.dryCellKeys).toBe(adopted.world.shoreBoundary.dryCellKeys);
    expect(noChangeWorld.world.environment.decorativePopulation)
      .toBe(adopted.world.environment.decorativePopulation);
    expect(noChangeWorld.world.environment.waterPatches).toBe(adopted.world.environment.waterPatches);
    expect(noChangeWorld.world.encounter).toBe(adopted.world.encounter);

    const spawnNearCell = adopted.world.traversalDomain.cells.find((cell) =>
      cell.centerMeters.x === adopted.world.anchorCenterMeters.x + 8
      && cell.centerMeters.z === adopted.world.anchorCenterMeters.z + 8
    );
    if (spawnNearCell === undefined) throw new Error("Expected deterministic spawn-near Terrain cell.");
    const spawnNearPlayer = createSurfaceLocomotionState({
      ...spawn,
      positionMeters: {
        x: spawnNearCell.centerMeters.x,
        y: spawnNearCell.groundHeightMeters + locomotion.capsule.heightMeters / 2,
        z: spawnNearCell.centerMeters.z
      },
      pitchRadians: -locomotion.maximumPitchRadians
    });
    const spawnNearRuntime = createSurfacePlayRuntime({
      routeId: "surface-play-terrain-adoption-spawn-near",
      initialPlayerState: spawnNearPlayer,
      authority,
      world: adopted.world
    });
    const beforeSpawnNear = spawnNearRuntime.read();
    authorityProbeCounts.enabled = true;
    authorityProbeCounts.groundQueries = 0;
    authorityProbeCounts.densityQueries = 0;
    const spawnNearStartedAt = performance.now();
    const spawnNearAdvance = spawnNearRuntime.advance(locomotion.fixedDeltaSeconds, (simulationTick, state) =>
      createSurfacePlayerCommand({
        playerId: state.playerId,
        surfaceFrameId: state.surfaceFrameId,
        simulationTick,
        moveAxes: { forward: 0, right: 0 },
        lookDeltaRadians: { yaw: 0, pitch: 0 },
        sprint: false,
        crouch: null,
        jump: false,
        fire: true,
        pointerLockIntent: "Unchanged",
        reset: "None"
      })
    );
    const spawnNearElapsedMilliseconds = performance.now() - spawnNearStartedAt;
    authorityProbeCounts.enabled = false;
    const afterSpawnNear = spawnNearAdvance.snapshot;

    expect(authorityProbeCounts.groundQueries)
      .toBeGreaterThan(0);
    expect(authorityProbeCounts.groundQueries)
      .toBeLessThanOrEqual(64);
    expect(spawnNearElapsedMilliseconds).toBeLessThan(2_000);
    expect(spawnNearAdvance.rejections).toEqual([]);
    expect(afterSpawnNear.latestVoxelTransition?.result.status).toBe("Applied");
    expect(afterSpawnNear.authorityState.regionRevision).toBe(1);
    expect(afterSpawnNear.world?.identity.regionRevision).toBe(1);
    expect(afterSpawnNear.presentation.terrain.regionRevision).toBe(1);
    expect(afterSpawnNear.appliedVoxelTransitions).toHaveLength(1);
    expect(afterSpawnNear.world?.traversalDomain.spawnPerimeterDistanceMeters).toBeLessThan(12);
    expect(afterSpawnNear.world?.shoreBoundary.dryCellKeys)
      .toBe(beforeSpawnNear.world?.shoreBoundary.dryCellKeys);
    expect(afterSpawnNear.authorityState).not.toBe(beforeSpawnNear.authorityState);
    expect(afterSpawnNear.world).not.toBe(beforeSpawnNear.world);
    expect(afterSpawnNear.presentation.terrain).not.toBe(beforeSpawnNear.presentation.terrain);
    expect(afterSpawnNear.combat.energyJoules).toBeLessThan(beforeSpawnNear.combat.energyJoules);
  }, 300_000);
});
