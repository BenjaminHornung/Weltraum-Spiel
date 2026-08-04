import type { SurfaceRigidBodyTerrainColliderInput } from "../physics";
import type { HestiaAuthorityGroundSurfaceProbe } from "./hestiaAuthorityGroundProbe";
import type {
  SurfaceRegionVoxelState,
  SurfaceVoxelEditIntent,
  SurfaceVoxelEditResult
} from "../voxel-edit";
import type {
  HestiaSurfaceStructuralTreePlacement,
  HestiaSurfaceWorldFacts
} from "./hestiaSurfaceWorld";

const TERRAIN_COLLIDER_GRID_METERS = 1;
const DEFAULT_PATCH_RADIUS_METERS = 12;
export const HESTIA_RIGID_BODY_TERRAIN_PATCH_MAX_COLLIDERS = 24 * 24;

export interface HestiaSurfaceRigidBodyTerrainDerivationInput {
  readonly world: Readonly<HestiaSurfaceWorldFacts>;
  readonly placement: Readonly<HestiaSurfaceStructuralTreePlacement>;
  readonly groundSurfaceProbe: Readonly<HestiaAuthorityGroundSurfaceProbe>;
  readonly patchRadiusMeters?: number;
}

export interface HestiaSurfaceRigidBodyTerrainPatchIdentity {
  readonly bodyId: string;
  readonly regionId: string;
  readonly surfaceFrameId: string;
  readonly regionRevision: number;
  readonly editRevision: number;
  readonly regionContentHash: string;
}

export interface HestiaSurfaceRigidBodyTerrainPatchColumn {
  readonly groupX: number;
  readonly groupZ: number;
  readonly maximumY: number | null;
}

export interface HestiaSurfaceRigidBodyTerrainPatch {
  readonly identity: Readonly<HestiaSurfaceRigidBodyTerrainPatchIdentity>;
  readonly patchRadiusMeters: number;
  readonly minimumGroupX: number;
  readonly minimumGroupZ: number;
  readonly columns: readonly Readonly<HestiaSurfaceRigidBodyTerrainPatchColumn>[];
}

export interface HestiaSurfaceRigidBodyTerrainPatchDerivationInput
  extends HestiaSurfaceRigidBodyTerrainDerivationInput {
  readonly authorityState: Readonly<SurfaceRegionVoxelState>;
}

export interface HestiaSurfaceRigidBodyTerrainPatchRefreshInput
  extends HestiaSurfaceRigidBodyTerrainPatchDerivationInput {
  readonly sourcePatch: Readonly<HestiaSurfaceRigidBodyTerrainPatch>;
  readonly editIntent: Readonly<SurfaceVoxelEditIntent>;
  readonly editResult: Readonly<SurfaceVoxelEditResult>;
}

type HestiaSurfaceRigidBodyTerrainRejection = Readonly<{
  readonly status: "Rejected";
  readonly failure: Readonly<{
    readonly code: "NoAdmissibleLandFootprint";
    readonly message: string;
    readonly attemptedCandidateCount: number;
  }>;
}>;

export type HestiaSurfaceRigidBodyTerrainDerivationResult =
  | Readonly<{
      readonly status: "Resolved";
      readonly terrainColliders: readonly Readonly<SurfaceRigidBodyTerrainColliderInput>[];
    }>
  | HestiaSurfaceRigidBodyTerrainRejection;

export type HestiaSurfaceRigidBodyTerrainPatchDerivationResult =
  | Readonly<{
      readonly status: "Resolved";
      readonly patch: Readonly<HestiaSurfaceRigidBodyTerrainPatch>;
      readonly terrainColliders: readonly Readonly<SurfaceRigidBodyTerrainColliderInput>[];
    }>
  | HestiaSurfaceRigidBodyTerrainRejection;

const rejected = (
  message: string,
  attemptedCandidateCount: number
): HestiaSurfaceRigidBodyTerrainRejection => Object.freeze({
  status: "Rejected" as const,
  failure: Object.freeze({
    code: "NoAdmissibleLandFootprint" as const,
    message,
    attemptedCandidateCount
  })
});

interface TerrainPatchGrid {
  readonly patchRadiusMeters: number;
  readonly minimumGroupX: number;
  readonly maximumGroupXExclusive: number;
  readonly minimumGroupZ: number;
  readonly maximumGroupZExclusive: number;
  readonly groupCount: number;
}

const derivePatchGrid = (
  placement: Readonly<HestiaSurfaceStructuralTreePlacement>,
  patchRadiusMeters: number
): Readonly<TerrainPatchGrid> => {
  if (
    !Number.isSafeInteger(patchRadiusMeters)
    || patchRadiusMeters <= 0
    || patchRadiusMeters > DEFAULT_PATCH_RADIUS_METERS
  ) {
    throw new TypeError("Rigid-body Terrain patch radius must be a positive whole-metre value at most 12 m.");
  }
  const rootX = placement.rootQuantum.x * 0.125;
  const rootZ = placement.rootQuantum.z * 0.125;
  const minimumGroupX = Math.floor(rootX) - patchRadiusMeters;
  const minimumGroupZ = Math.floor(rootZ) - patchRadiusMeters;
  const maximumGroupXExclusive = minimumGroupX + patchRadiusMeters * 2;
  const maximumGroupZExclusive = minimumGroupZ + patchRadiusMeters * 2;
  const groupCount = (maximumGroupXExclusive - minimumGroupX)
    * (maximumGroupZExclusive - minimumGroupZ);
  if (groupCount > HESTIA_RIGID_BODY_TERRAIN_PATCH_MAX_COLLIDERS) {
    throw new TypeError("Rigid-body Terrain patch exceeds its fixed collider budget.");
  }
  return Object.freeze({
    patchRadiusMeters,
    minimumGroupX,
    maximumGroupXExclusive,
    minimumGroupZ,
    maximumGroupZExclusive,
    groupCount
  });
};

const sameWorldProbeIdentity = (
  world: Readonly<HestiaSurfaceWorldFacts>,
  groundSurfaceProbe: Readonly<HestiaAuthorityGroundSurfaceProbe>
): boolean => {
  const probeIdentity = groundSurfaceProbe.identity;
  return probeIdentity.bodyId === world.identity.bodyId
    && probeIdentity.regionId === world.identity.regionId
    && probeIdentity.surfaceFrameId === world.identity.surfaceFrameId
    && probeIdentity.regionRevision === world.identity.regionRevision;
};

const sameAuthorityProbeIdentity = (
  state: Readonly<SurfaceRegionVoxelState>,
  groundSurfaceProbe: Readonly<HestiaAuthorityGroundSurfaceProbe>
): boolean => {
  const probeIdentity = groundSurfaceProbe.identity;
  return probeIdentity.bodyId === state.bodyId
    && probeIdentity.regionId === state.regionId
    && probeIdentity.surfaceFrameId === state.surfaceFrameId
    && probeIdentity.regionRevision === state.regionRevision
    && probeIdentity.editRevision === state.editRevision;
};

const sampleColumn = (
  world: Readonly<HestiaSurfaceWorldFacts>,
  groundSurfaceProbe: Readonly<HestiaAuthorityGroundSurfaceProbe>,
  groupX: number,
  groupZ: number
): Readonly<HestiaSurfaceRigidBodyTerrainPatchColumn>
  | Readonly<{ readonly status: "Rejected"; readonly message: string }> => {
  const sample = groundSurfaceProbe.sampleGroundSurface(
    (groupX + 0.5) * TERRAIN_COLLIDER_GRID_METERS,
    (groupZ + 0.5) * TERRAIN_COLLIDER_GRID_METERS
  );
  if (sample.status === "Rejected") return Object.freeze({
    status: "Rejected" as const,
    message: `Rigid-body Terrain probe rejected cell ${groupZ}:${groupX}: ${sample.message}`
  });
  const probeIdentity = groundSurfaceProbe.identity;
  if (
    sample.regionRevision !== probeIdentity.regionRevision
    || sample.editRevision !== probeIdentity.editRevision
  ) return Object.freeze({
    status: "Rejected" as const,
    message: `Rigid-body Terrain probe returned stale revisions for cell ${groupZ}:${groupX}.`
  });
  if (sample.hit !== null && !Number.isFinite(sample.hit.pointMeters.y)) return Object.freeze({
    status: "Rejected" as const,
    message: `Rigid-body Terrain probe returned a non-finite surface for cell ${groupZ}:${groupX}.`
  });
  return Object.freeze({
    groupX,
    groupZ,
    maximumY: sample.hit === null || sample.hit.pointMeters.y <= world.verticalBand.minimumMeters
      ? null
      : sample.hit.pointMeters.y
  });
};

const materializeTerrainColliders = (
  world: Readonly<HestiaSurfaceWorldFacts>,
  identity: Readonly<HestiaSurfaceRigidBodyTerrainPatchIdentity>,
  columns: readonly Readonly<HestiaSurfaceRigidBodyTerrainPatchColumn>[]
): readonly Readonly<SurfaceRigidBodyTerrainColliderInput>[] => Object.freeze(
  columns.flatMap((column) => column.maximumY === null
    ? []
    : [Object.freeze({
        colliderKey: [
          "hestia-terrain-cell",
          world.identity.regionId,
          identity.regionRevision,
          identity.editRevision,
          column.groupZ,
          column.groupX
        ].join(":"),
        minimumMeters: Object.freeze({
          x: column.groupX * TERRAIN_COLLIDER_GRID_METERS,
          y: world.verticalBand.minimumMeters,
          z: column.groupZ * TERRAIN_COLLIDER_GRID_METERS
        }),
        maximumMeters: Object.freeze({
          x: (column.groupX + 1) * TERRAIN_COLLIDER_GRID_METERS,
          y: column.maximumY,
          z: (column.groupZ + 1) * TERRAIN_COLLIDER_GRID_METERS
        })
      })])
);

const deriveFullColumns = (
  world: Readonly<HestiaSurfaceWorldFacts>,
  groundSurfaceProbe: Readonly<HestiaAuthorityGroundSurfaceProbe>,
  grid: Readonly<TerrainPatchGrid>
): Readonly<{
  readonly status: "Resolved";
  readonly columns: readonly Readonly<HestiaSurfaceRigidBodyTerrainPatchColumn>[];
}> | HestiaSurfaceRigidBodyTerrainRejection => {
  const columns: Readonly<HestiaSurfaceRigidBodyTerrainPatchColumn>[] = [];
  let attemptedCandidateCount = 0;
  for (let groupZ = grid.minimumGroupZ; groupZ < grid.maximumGroupZExclusive; groupZ += 1) {
    for (let groupX = grid.minimumGroupX; groupX < grid.maximumGroupXExclusive; groupX += 1) {
      attemptedCandidateCount += 1;
      const column = sampleColumn(world, groundSurfaceProbe, groupX, groupZ);
      if ("status" in column) return rejected(column.message, attemptedCandidateCount);
      columns.push(column);
    }
  }
  return Object.freeze({ status: "Resolved" as const, columns: Object.freeze(columns) });
};

const createPatchIdentity = (
  state: Readonly<SurfaceRegionVoxelState>
): Readonly<HestiaSurfaceRigidBodyTerrainPatchIdentity> => Object.freeze({
  bodyId: state.bodyId,
  regionId: state.regionId,
  surfaceFrameId: state.surfaceFrameId,
  regionRevision: state.regionRevision,
  editRevision: state.editRevision,
  regionContentHash: state.currentRegionContentHash
});

const createPatch = (
  state: Readonly<SurfaceRegionVoxelState>,
  grid: Readonly<TerrainPatchGrid>,
  columns: readonly Readonly<HestiaSurfaceRigidBodyTerrainPatchColumn>[]
): Readonly<HestiaSurfaceRigidBodyTerrainPatch> => Object.freeze({
  identity: createPatchIdentity(state),
  patchRadiusMeters: grid.patchRadiusMeters,
  minimumGroupX: grid.minimumGroupX,
  minimumGroupZ: grid.minimumGroupZ,
  columns
});

const validCanonicalPatchColumns = (
  patch: Readonly<HestiaSurfaceRigidBodyTerrainPatch>,
  grid: Readonly<TerrainPatchGrid>,
  world: Readonly<HestiaSurfaceWorldFacts>
): boolean => {
  if (
    patch.patchRadiusMeters !== grid.patchRadiusMeters
    || patch.minimumGroupX !== grid.minimumGroupX
    || patch.minimumGroupZ !== grid.minimumGroupZ
    || patch.columns.length !== grid.groupCount
  ) return false;
  let index = 0;
  for (let groupZ = grid.minimumGroupZ; groupZ < grid.maximumGroupZExclusive; groupZ += 1) {
    for (let groupX = grid.minimumGroupX; groupX < grid.maximumGroupXExclusive; groupX += 1) {
      const column = patch.columns[index];
      if (
        column === undefined
        || column.groupX !== groupX
        || column.groupZ !== groupZ
        || (
          column.maximumY !== null
          && (
            !Number.isFinite(column.maximumY)
            || column.maximumY <= world.verticalBand.minimumMeters
          )
        )
      ) return false;
      index += 1;
    }
  }
  return true;
};

const sameOrderedKeys = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((key, index) => key === right[index]);

const validateRefreshEvidence = (
  input: Readonly<HestiaSurfaceRigidBodyTerrainPatchRefreshInput>
): string | null => {
  const { sourcePatch, authorityState: state, editIntent, editResult, world, groundSurfaceProbe } = input;
  const sourceIdentity = sourcePatch.identity;
  const journalRecord = state.editJournal[state.editJournal.length - 1];
  if (editResult.status === "Rejected") {
    return "Rejected Terrain edits cannot refresh the rigid-body Terrain patch.";
  }
  if (
    !sameWorldProbeIdentity(world, groundSurfaceProbe)
    || !sameAuthorityProbeIdentity(state, groundSurfaceProbe)
    || sourceIdentity.bodyId !== state.bodyId
    || sourceIdentity.regionId !== state.regionId
    || sourceIdentity.surfaceFrameId !== state.surfaceFrameId
    || sourceIdentity.regionRevision !== editResult.priorRegionRevision
    || sourceIdentity.editRevision !== editResult.priorEditRevision
    || sourceIdentity.regionContentHash !== editResult.priorRegionHash
    || state.regionRevision !== editResult.resultingRegionRevision
    || state.editRevision !== editResult.resultingEditRevision
    || state.currentRegionContentHash !== editResult.resultingRegionHash
    || world.identity.regionRevision !== state.regionRevision
    || editIntent.bodyId !== state.bodyId
    || editIntent.regionId !== state.regionId
    || editIntent.surfaceFrameId !== state.surfaceFrameId
    || editIntent.expectedRegionRevision !== editResult.priorRegionRevision
    || editResult.resultingRegionRevision !== editResult.priorRegionRevision + 1
    || editResult.resultingEditRevision !== editResult.priorEditRevision
      + (editResult.status === "Applied" ? 1 : 0)
    || journalRecord === undefined
    || journalRecord.sequence !== state.editJournal.length - 1
    || journalRecord.editId !== editIntent.editId
    || journalRecord.expectedRegionRevision !== editIntent.expectedRegionRevision
    || journalRecord.resultingRegionRevision !== editResult.resultingRegionRevision
    || journalRecord.resultingEditRevision !== editResult.resultingEditRevision
    || journalRecord.tick !== editIntent.tick
    || journalRecord.actorId !== editIntent.actorId
    || journalRecord.sourceId !== editIntent.sourceId
    || journalRecord.sourceImpactIntentId !== editIntent.sourceImpactIntentId
    || journalRecord.operation !== editIntent.operation
    || journalRecord.centerGlobalQuantum.x !== editIntent.centerGlobalQuantum.x
    || journalRecord.centerGlobalQuantum.y !== editIntent.centerGlobalQuantum.y
    || journalRecord.centerGlobalQuantum.z !== editIntent.centerGlobalQuantum.z
    || journalRecord.quantumMeters !== editIntent.quantumMeters
    || journalRecord.radiusMeters !== editIntent.radiusMeters
    || journalRecord.outcome !== editResult.status
    || journalRecord.priorRegionHash !== editResult.priorRegionHash
    || journalRecord.resultingRegionHash !== editResult.resultingRegionHash
    || !sameOrderedKeys(journalRecord.changedBrickKeys, editResult.changedBrickKeys)
  ) return "Incremental rigid-body Terrain patch authority, World, probe, edit, or hash binding is stale.";
  if (
    !sameOrderedKeys(editResult.requiredCollisionRefreshKeys, editResult.changedBrickKeys)
    || editResult.requiredCollisionRefreshKeys.some((key, index, keys) =>
      key.length === 0 || (index > 0 && keys[index - 1] >= key)
    )
  ) return "Rigid-body Terrain refresh keys are missing, unordered, duplicated, or inconsistent.";
  if (editResult.status === "NoChange") {
    if (
      editResult.changedBrickKeys.length !== 0
      || editResult.requiredCollisionRefreshKeys.length !== 0
    ) return "NoChange Terrain edits cannot publish rigid-body collision refresh work.";
    return null;
  }
  if (editResult.requiredCollisionRefreshKeys.length === 0) {
    return "Applied Terrain edits must publish rigid-body collision refresh work.";
  }
  const residentKeys = new Set(state.materializedBricks.map((brick) => brick.key));
  if (editResult.requiredCollisionRefreshKeys.some((key) => !residentKeys.has(key))) {
    return "Rigid-body Terrain collision refresh work lies outside resident authority coverage.";
  }
  return null;
};

/**
 * Materializes one fixed Tree-Fall contact patch from current Voxel Authority
 * ground truth. Traversability is deliberately not a Terrain-occupancy source:
 * slope, capsule, or connectivity filtering must never punch physics holes.
 */
export const deriveHestiaSurfaceRigidBodyTerrainColliders = (
  input: Readonly<HestiaSurfaceRigidBodyTerrainDerivationInput>
): HestiaSurfaceRigidBodyTerrainDerivationResult => {
  const patchRadiusMeters = input.patchRadiusMeters ?? DEFAULT_PATCH_RADIUS_METERS;
  const { world, placement, groundSurfaceProbe } = input;
  if (!sameWorldProbeIdentity(world, groundSurfaceProbe)) return rejected(
    "Rigid-body Terrain probe identity or region revision is stale for the selected World.",
    0
  );
  const grid = derivePatchGrid(placement, patchRadiusMeters);
  const derived = deriveFullColumns(world, groundSurfaceProbe, grid);
  if (derived.status === "Rejected") return derived;
  const terrainColliders = materializeTerrainColliders(world, {
    ...groundSurfaceProbe.identity,
    regionContentHash: ""
  }, derived.columns);
  if (terrainColliders.length === 0) return rejected(
    "Rigid-body Terrain probe resolved no solid contact surface inside the fixed Tree-Fall patch.",
    grid.groupCount
  );
  return Object.freeze({
    status: "Resolved" as const,
    terrainColliders
  });
};

export const deriveHestiaSurfaceRigidBodyTerrainPatch = (
  input: Readonly<HestiaSurfaceRigidBodyTerrainPatchDerivationInput>
): HestiaSurfaceRigidBodyTerrainPatchDerivationResult => {
  const { world, placement, groundSurfaceProbe, authorityState } = input;
  if (
    !sameWorldProbeIdentity(world, groundSurfaceProbe)
    || !sameAuthorityProbeIdentity(authorityState, groundSurfaceProbe)
    || authorityState.bodyId !== world.identity.bodyId
    || authorityState.regionId !== world.identity.regionId
    || authorityState.surfaceFrameId !== world.identity.surfaceFrameId
    || authorityState.regionRevision !== world.identity.regionRevision
  ) return rejected(
    "Rigid-body Terrain patch authority, World, or probe binding is stale.",
    0
  );
  const grid = derivePatchGrid(placement, input.patchRadiusMeters ?? DEFAULT_PATCH_RADIUS_METERS);
  const derived = deriveFullColumns(world, groundSurfaceProbe, grid);
  if (derived.status === "Rejected") return derived;
  const patch = createPatch(authorityState, grid, derived.columns);
  const terrainColliders = materializeTerrainColliders(world, patch.identity, patch.columns);
  if (terrainColliders.length === 0) return rejected(
    "Rigid-body Terrain probe resolved no solid contact surface inside the fixed Tree-Fall patch.",
    grid.groupCount
  );
  return Object.freeze({ status: "Resolved" as const, patch, terrainColliders });
};

/**
 * Refreshes only ground columns whose ray/interpolation/normal dependencies can
 * overlap one accepted edit. Missing or stale cache/evidence fails closed;
 * startup remains the sole full-patch materialization path.
 */
export const refreshHestiaSurfaceRigidBodyTerrainPatch = (
  input: Readonly<HestiaSurfaceRigidBodyTerrainPatchRefreshInput>
): HestiaSurfaceRigidBodyTerrainPatchDerivationResult => {
  const grid = derivePatchGrid(input.placement, input.patchRadiusMeters ?? input.sourcePatch.patchRadiusMeters);
  if (!validCanonicalPatchColumns(input.sourcePatch, grid, input.world)) return rejected(
    "Incremental rigid-body Terrain source patch is not the canonical Tree-Fall grid.",
    0
  );
  const evidenceIssue = validateRefreshEvidence(input);
  if (evidenceIssue !== null) return rejected(evidenceIssue, 0);

  let columns = input.sourcePatch.columns;
  let attemptedCandidateCount = 0;
  if (input.editResult.status === "Applied") {
    const centerX = input.editIntent.centerGlobalQuantum.x * input.editIntent.quantumMeters;
    const centerZ = input.editIntent.centerGlobalQuantum.z * input.editIntent.quantumMeters;
    const dependencyHaloMeters = input.authorityState.voxelSizeMeters
      + input.authorityState.voxelSizeMeters / 2;
    const influenceRadiusMeters = input.editIntent.radiusMeters + dependencyHaloMeters;
    const minimumGroupX = Math.max(
      grid.minimumGroupX,
      Math.ceil(centerX - influenceRadiusMeters - 0.5)
    );
    const maximumGroupX = Math.min(
      grid.maximumGroupXExclusive - 1,
      Math.floor(centerX + influenceRadiusMeters - 0.5)
    );
    const minimumGroupZ = Math.max(
      grid.minimumGroupZ,
      Math.ceil(centerZ - influenceRadiusMeters - 0.5)
    );
    const maximumGroupZ = Math.min(
      grid.maximumGroupZExclusive - 1,
      Math.floor(centerZ + influenceRadiusMeters - 0.5)
    );
    if (minimumGroupX <= maximumGroupX && minimumGroupZ <= maximumGroupZ) {
      const refreshedColumns = [...columns];
      for (let groupZ = minimumGroupZ; groupZ <= maximumGroupZ; groupZ += 1) {
        for (let groupX = minimumGroupX; groupX <= maximumGroupX; groupX += 1) {
          attemptedCandidateCount += 1;
          const column = sampleColumn(input.world, input.groundSurfaceProbe, groupX, groupZ);
          if ("status" in column) return rejected(column.message, attemptedCandidateCount);
          const index = (groupZ - grid.minimumGroupZ) * (grid.maximumGroupXExclusive - grid.minimumGroupX)
            + groupX - grid.minimumGroupX;
          refreshedColumns[index] = column;
        }
      }
      columns = Object.freeze(refreshedColumns);
    }
  }

  const patch = createPatch(input.authorityState, grid, columns);
  const terrainColliders = materializeTerrainColliders(input.world, patch.identity, patch.columns);
  if (terrainColliders.length === 0) return rejected(
    "Incremental rigid-body Terrain refresh resolved no solid contact surface.",
    attemptedCandidateCount
  );
  return Object.freeze({ status: "Resolved" as const, patch, terrainColliders });
};
