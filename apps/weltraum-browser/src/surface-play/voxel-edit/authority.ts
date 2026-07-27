import {
  HESTIA_GENERATOR_VERSION_V1,
  HESTIA_SOURCE_REVISION_V1,
  generateHestiaVoxelBrick
} from "../../world-generation/hestia";
import {
  VOXEL_BRICK_APRON_WIDTH,
  VOXEL_BRICK_CELL_DIMENSIONS,
  VOXEL_BRICK_SAMPLE_DIMENSIONS,
  createVoxelBrick,
  storedSampleToGlobalCoordinate,
  surfaceFrameId,
  voxelBodyId,
  voxelRegionId,
  voxelSampleIndex,
  type VoxelBrick
} from "../../voxel";
import {
  cloneCoordinate,
  compareSurfaceVoxelCoordinates,
  freezePlain,
  hashSurfaceVoxelValue,
  surfaceVoxelBrickKey
} from "./canonical";
import {
  SURFACE_REGION_VOXEL_SCHEMA_VERSION,
  SURFACE_VOXEL_AIR_CHANNEL_VALUE,
  SURFACE_VOXEL_EDIT_QUANTUM_METERS,
  SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
  type SurfaceRegionMaterializedVoxelBrick,
  type SurfaceRegionVoxelAuthority,
  type SurfaceRegionVoxelAuthorityInput,
  type SurfaceRegionVoxelState,
  type SurfaceVector3,
  type SurfaceVoxelCoordinate,
  type SurfaceVoxelEditIntent,
  type SurfaceVoxelEditRecord,
  type SurfaceVoxelEditRejectionReason,
  type SurfaceVoxelEditResult,
  type SurfaceVoxelEditTransition
} from "./types";

const AUTHORITY_INPUT_KEYS = [
  "schemaVersion", "bodyId", "surfaceFrameId", "regionId", "generatorVersion", "seed", "voxelSizeMeters",
  "sourceRevision", "brickBounds", "residentBrickCoordinates", "maxSubtractRadiusMeters", "maxChangedSamplesPerEdit"
] as const;
const EDIT_INTENT_KEYS = [
  "schemaVersion", "editId", "expectedRegionRevision", "tick", "actorId", "sourceId", "sourceImpactIntentId",
  "bodyId", "surfaceFrameId", "regionId", "operation", "centerGlobalQuantum", "quantumMeters", "radiusMeters"
] as const;
const COORDINATE_KEYS = ["x", "y", "z"] as const;
const BOUNDS_KEYS = ["minInclusive", "maxExclusive"] as const;

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const isSafeNonNegativeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && !Object.is(value, -0);

const isSafeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && !Object.is(value, -0);

const isStableId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 256 && value.trim() === value;

const validCoordinate = (value: unknown): value is Readonly<SurfaceVoxelCoordinate> =>
  isPlainRecord(value)
  && hasExactKeys(value, COORDINATE_KEYS)
  && isSafeInteger(value.x)
  && isSafeInteger(value.y)
  && isSafeInteger(value.z);

const requireAuthorityInput = (value: unknown): SurfaceRegionVoxelAuthorityInput => {
  if (!isPlainRecord(value) || !hasExactKeys(value, AUTHORITY_INPUT_KEYS)) {
    throw new TypeError("SurfaceRegionVoxelAuthorityInput must contain only the exact V1 fields.");
  }
  if (
    value.schemaVersion !== SURFACE_REGION_VOXEL_SCHEMA_VERSION
    || !isStableId(value.bodyId)
    || !isStableId(value.surfaceFrameId)
    || !isStableId(value.regionId)
    || value.generatorVersion !== HESTIA_GENERATOR_VERSION_V1
    || !isStableId(value.seed)
    || (value.voxelSizeMeters !== 0.25 && value.voxelSizeMeters !== 0.5)
    || value.sourceRevision !== HESTIA_SOURCE_REVISION_V1
    || typeof value.maxSubtractRadiusMeters !== "number"
    || !Number.isFinite(value.maxSubtractRadiusMeters)
    || value.maxSubtractRadiusMeters <= 0
    || !isSafeNonNegativeInteger(value.maxChangedSamplesPerEdit)
    || value.maxChangedSamplesPerEdit === 0
  ) {
    throw new TypeError("SurfaceRegionVoxelAuthorityInput contains invalid identity, generation, radius, or budget values.");
  }
  if (!isPlainRecord(value.brickBounds) || !hasExactKeys(value.brickBounds, BOUNDS_KEYS)) {
    throw new TypeError("brickBounds must contain exact minInclusive and maxExclusive coordinates.");
  }
  if (!validCoordinate(value.brickBounds.minInclusive) || !validCoordinate(value.brickBounds.maxExclusive)) {
    throw new TypeError("brickBounds coordinates must be safe integers.");
  }
  for (const axis of COORDINATE_KEYS) {
    if (value.brickBounds.minInclusive[axis] >= value.brickBounds.maxExclusive[axis]) {
      throw new RangeError("brickBounds must be non-empty and half-open.");
    }
  }
  if (!Array.isArray(value.residentBrickCoordinates)) {
    throw new TypeError("residentBrickCoordinates must be a dense coordinate array.");
  }
  for (let index = 0; index < value.residentBrickCoordinates.length; index += 1) {
    if (!Object.hasOwn(value.residentBrickCoordinates, index) || !validCoordinate(value.residentBrickCoordinates[index])) {
      throw new TypeError("residentBrickCoordinates must contain only dense safe-integer coordinates.");
    }
  }
  return value as unknown as SurfaceRegionVoxelAuthorityInput;
};

const coordinateInsideBounds = (
  coordinate: Readonly<SurfaceVoxelCoordinate>,
  bounds: SurfaceRegionVoxelAuthorityInput["brickBounds"]
): boolean => COORDINATE_KEYS.every(
  (axis) => coordinate[axis] >= bounds.minInclusive[axis] && coordinate[axis] < bounds.maxExclusive[axis]
);

const cloneBounds = (bounds: SurfaceRegionVoxelAuthorityInput["brickBounds"]) => Object.freeze({
  minInclusive: cloneCoordinate(bounds.minInclusive),
  maxExclusive: cloneCoordinate(bounds.maxExclusive)
});

const cloneInput = (input: SurfaceRegionVoxelAuthorityInput): SurfaceRegionVoxelAuthorityInput => {
  const coordinates = input.residentBrickCoordinates.map(cloneCoordinate).sort(compareSurfaceVoxelCoordinates);
  const keys = new Set<string>();
  for (const coordinate of coordinates) {
    if (!coordinateInsideBounds(coordinate, input.brickBounds)) {
      throw new RangeError("Every resident brick coordinate must lie inside brickBounds.");
    }
    const key = surfaceVoxelBrickKey(coordinate);
    if (keys.has(key)) throw new TypeError("residentBrickCoordinates must be unique.");
    keys.add(key);
  }
  return Object.freeze({
    schemaVersion: SURFACE_REGION_VOXEL_SCHEMA_VERSION,
    bodyId: input.bodyId,
    surfaceFrameId: input.surfaceFrameId,
    regionId: input.regionId,
    generatorVersion: input.generatorVersion,
    seed: input.seed,
    voxelSizeMeters: input.voxelSizeMeters,
    sourceRevision: input.sourceRevision,
    brickBounds: cloneBounds(input.brickBounds),
    residentBrickCoordinates: Object.freeze(coordinates),
    maxSubtractRadiusMeters: input.maxSubtractRadiusMeters,
    maxChangedSamplesPerEdit: input.maxChangedSamplesPerEdit
  });
};

const copyBrick = (brick: VoxelBrick): VoxelBrick => createVoxelBrick({
  schemaVersion: brick.schemaVersion,
  layoutVersion: brick.layoutVersion,
  indexOrder: brick.indexOrder,
  bodyId: brick.bodyId,
  surfaceFrameId: brick.surfaceFrameId,
  regionId: brick.regionId,
  brickCoordinate: brick.brickCoordinate,
  voxelSizeMeters: brick.voxelSizeMeters,
  cellDimensions: brick.cellDimensions,
  sampleDimensions: brick.sampleDimensions,
  apronWidth: brick.apronWidth,
  generatorVersion: brick.generatorVersion,
  materialRegistryVersion: brick.materialRegistryVersion,
  sourceRevision: brick.sourceRevision,
  editRevision: brick.editRevision,
  densityBuffer: brick.densityBuffer,
  materialBuffer: brick.materialBuffer
});

const createEditedBrick = (
  brick: VoxelBrick,
  densityBuffer: Float32Array,
  materialBuffer: Uint8Array
): VoxelBrick => createVoxelBrick({
  schemaVersion: brick.schemaVersion,
  layoutVersion: brick.layoutVersion,
  indexOrder: brick.indexOrder,
  bodyId: brick.bodyId,
  surfaceFrameId: brick.surfaceFrameId,
  regionId: brick.regionId,
  brickCoordinate: brick.brickCoordinate,
  voxelSizeMeters: brick.voxelSizeMeters,
  cellDimensions: brick.cellDimensions,
  sampleDimensions: brick.sampleDimensions,
  apronWidth: brick.apronWidth,
  generatorVersion: brick.generatorVersion,
  materialRegistryVersion: brick.materialRegistryVersion,
  sourceRevision: brick.sourceRevision,
  editRevision: brick.editRevision,
  densityBuffer,
  materialBuffer
});

const journalProjection = (journal: readonly Readonly<SurfaceVoxelEditRecord>[]) => journal.map((record) => ({
  schemaVersion: record.schemaVersion,
  editId: record.editId,
  sequence: record.sequence,
  expectedRegionRevision: record.expectedRegionRevision,
  resultingRegionRevision: record.resultingRegionRevision,
  resultingEditRevision: record.resultingEditRevision,
  tick: record.tick,
  actorId: record.actorId,
  sourceId: record.sourceId,
  sourceImpactIntentId: record.sourceImpactIntentId,
  operation: record.operation,
  centerGlobalQuantum: record.centerGlobalQuantum,
  ownerBrickCoordinate: record.ownerBrickCoordinate,
  ownerBrickLocalQuantum: record.ownerBrickLocalQuantum,
  quantumMeters: record.quantumMeters,
  radiusMeters: record.radiusMeters,
  outcome: record.outcome,
  changedBrickKeys: record.changedBrickKeys
}));

const calculateVoxelContentHash = (bricks: ReadonlyMap<string, VoxelBrick>): string =>
  hashSurfaceVoxelValue([...bricks.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, brick]) => ({ key, contentHash: brick.contentHash })));

const calculateRegionContentHash = (
  input: SurfaceRegionVoxelAuthorityInput,
  regionRevision: number,
  editRevision: number,
  planningRevision: number,
  materializationRevision: number,
  journal: readonly Readonly<SurfaceVoxelEditRecord>[],
  voxelContentHash: string
): string => hashSurfaceVoxelValue({
  schemaVersion: input.schemaVersion,
  bodyId: input.bodyId,
  surfaceFrameId: input.surfaceFrameId,
  regionId: input.regionId,
  generatorVersion: input.generatorVersion,
  seed: input.seed,
  voxelSizeMeters: input.voxelSizeMeters,
  sourceRevision: input.sourceRevision,
  regionRevision,
  editRevision,
  planningRevision,
  materializationRevision,
  brickBounds: input.brickBounds,
  residentBrickCoordinates: input.residentBrickCoordinates,
  journal: journalProjection(journal),
  voxelContentHash
});

const coordinateRange = (minimum: number, maximum: number): readonly number[] =>
  Array.from({ length: maximum - minimum }, (_, index) => minimum + index);

const sphereIntersectsExpandedBrick = (
  center: Readonly<SurfaceVector3>,
  radius: number,
  coordinate: Readonly<SurfaceVoxelCoordinate>,
  voxelSize: number
): boolean => {
  const dimensions = VOXEL_BRICK_CELL_DIMENSIONS;
  let distanceSquared = 0;
  for (const axis of COORDINATE_KEYS) {
    const coreMinimum = coordinate[axis] * dimensions[axis] * voxelSize;
    const minimum = coreMinimum - VOXEL_BRICK_APRON_WIDTH * voxelSize;
    const maximum = coreMinimum + (dimensions[axis] + VOXEL_BRICK_APRON_WIDTH) * voxelSize;
    const delta = center[axis] < minimum ? minimum - center[axis] : center[axis] > maximum ? center[axis] - maximum : 0;
    distanceSquared += delta * delta;
  }
  return distanceSquared <= radius * radius;
};

const regionMeterBounds = (input: SurfaceRegionVoxelAuthorityInput) => Object.freeze({
  minInclusive: Object.freeze({
    x: input.brickBounds.minInclusive.x * VOXEL_BRICK_CELL_DIMENSIONS.x * input.voxelSizeMeters,
    y: input.brickBounds.minInclusive.y * VOXEL_BRICK_CELL_DIMENSIONS.y * input.voxelSizeMeters,
    z: input.brickBounds.minInclusive.z * VOXEL_BRICK_CELL_DIMENSIONS.z * input.voxelSizeMeters
  }),
  maxExclusive: Object.freeze({
    x: input.brickBounds.maxExclusive.x * VOXEL_BRICK_CELL_DIMENSIONS.x * input.voxelSizeMeters,
    y: input.brickBounds.maxExclusive.y * VOXEL_BRICK_CELL_DIMENSIONS.y * input.voxelSizeMeters,
    z: input.brickBounds.maxExclusive.z * VOXEL_BRICK_CELL_DIMENSIONS.z * input.voxelSizeMeters
  })
});

const neighborCoordinate = (
  coordinate: Readonly<SurfaceVoxelCoordinate>,
  axis: "x" | "y" | "z",
  delta: -1 | 1
): Readonly<SurfaceVoxelCoordinate> => cloneCoordinate({ ...coordinate, [axis]: coordinate[axis] + delta });

interface AuthorityRevisions {
  readonly regionRevision: number;
  readonly editRevision: number;
  readonly planningRevision: number;
  readonly materializationRevision: number;
}

export interface SurfaceRegionVoxelAuthorityInternal {
  readonly state: Readonly<SurfaceRegionVoxelState>;
  readonly meterBounds: ReturnType<typeof regionMeterBounds>;
  sampleLattice(global: Readonly<SurfaceVoxelCoordinate>): Readonly<{ density: number; materialValue: number }> | undefined;
}

class SurfaceRegionVoxelAuthorityImpl implements SurfaceRegionVoxelAuthority, SurfaceRegionVoxelAuthorityInternal {
  readonly #input: SurfaceRegionVoxelAuthorityInput;
  readonly #bricks: ReadonlyMap<string, VoxelBrick>;
  readonly #journal: readonly Readonly<SurfaceVoxelEditRecord>[];
  readonly state: Readonly<SurfaceRegionVoxelState>;
  readonly meterBounds: ReturnType<typeof regionMeterBounds>;

  public constructor(
    input: SurfaceRegionVoxelAuthorityInput,
    bricks: ReadonlyMap<string, VoxelBrick>,
    journal: readonly Readonly<SurfaceVoxelEditRecord>[],
    revisions: AuthorityRevisions
  ) {
    this.#input = input;
    this.#bricks = new Map(bricks);
    this.#journal = Object.freeze([...journal]);
    const voxelHash = calculateVoxelContentHash(this.#bricks);
    const regionHash = calculateRegionContentHash(
      input,
      revisions.regionRevision,
      revisions.editRevision,
      revisions.planningRevision,
      revisions.materializationRevision,
      this.#journal,
      voxelHash
    );
    const descriptors = [...this.#bricks.entries()]
      .map(([key, brick]) => Object.freeze({
        key,
        coordinate: cloneCoordinate(brick.brickCoordinate),
        contentHash: brick.contentHash,
        regionRevision: revisions.regionRevision,
        editRevision: revisions.editRevision
      }))
      .sort((left, right) => compareSurfaceVoxelCoordinates(left.coordinate, right.coordinate));
    this.state = freezePlain({
      schemaVersion: SURFACE_REGION_VOXEL_SCHEMA_VERSION,
      bodyId: input.bodyId,
      surfaceFrameId: input.surfaceFrameId,
      regionId: input.regionId,
      generatorVersion: input.generatorVersion,
      seed: input.seed,
      voxelSizeMeters: input.voxelSizeMeters,
      sourceRevision: input.sourceRevision,
      regionRevision: revisions.regionRevision,
      editRevision: revisions.editRevision,
      planningRevision: revisions.planningRevision,
      materializationRevision: revisions.materializationRevision,
      brickBounds: cloneBounds(input.brickBounds),
      residentBrickCoordinates: input.residentBrickCoordinates.map(cloneCoordinate),
      maxSubtractRadiusMeters: input.maxSubtractRadiusMeters,
      maxChangedSamplesPerEdit: input.maxChangedSamplesPerEdit,
      editJournal: this.#journal,
      materializedBricks: descriptors,
      currentVoxelContentHash: voxelHash,
      currentRegionContentHash: regionHash
    });
    this.meterBounds = regionMeterBounds(input);
    Object.freeze(this);
  }

  public materializeBrick(key: string): Readonly<SurfaceRegionMaterializedVoxelBrick> | undefined {
    const brick = this.#bricks.get(key);
    if (brick === undefined) return undefined;
    return Object.freeze({
      key,
      coordinate: cloneCoordinate(brick.brickCoordinate),
      regionRevision: this.state.regionRevision,
      editRevision: this.state.editRevision,
      voxelBrick: copyBrick(brick)
    });
  }

  public sampleLattice(global: Readonly<SurfaceVoxelCoordinate>): Readonly<{ density: number; materialValue: number }> | undefined {
    const owner = {
      x: Math.floor(global.x / VOXEL_BRICK_CELL_DIMENSIONS.x),
      y: Math.floor(global.y / VOXEL_BRICK_CELL_DIMENSIONS.y),
      z: Math.floor(global.z / VOXEL_BRICK_CELL_DIMENSIONS.z)
    };
    let candidates = [owner];
    for (const axis of COORDINATE_KEYS) {
      if (global[axis] % VOXEL_BRICK_CELL_DIMENSIONS[axis] === 0) {
        const negativeSide = candidates.map((coordinate) => ({ ...coordinate, [axis]: coordinate[axis] - 1 }));
        candidates = [...candidates, ...negativeSide];
      }
    }
    for (const coordinate of candidates) {
      const brick = this.#bricks.get(surfaceVoxelBrickKey(coordinate));
      if (brick === undefined) continue;
      const stored = {
        x: global.x - coordinate.x * VOXEL_BRICK_CELL_DIMENSIONS.x + VOXEL_BRICK_APRON_WIDTH,
        y: global.y - coordinate.y * VOXEL_BRICK_CELL_DIMENSIONS.y + VOXEL_BRICK_APRON_WIDTH,
        z: global.z - coordinate.z * VOXEL_BRICK_CELL_DIMENSIONS.z + VOXEL_BRICK_APRON_WIDTH
      };
      if (COORDINATE_KEYS.some((axis) => stored[axis] < 0 || stored[axis] >= VOXEL_BRICK_SAMPLE_DIMENSIONS[axis])) continue;
      const index = voxelSampleIndex(stored);
      return Object.freeze({ density: brick.densityBuffer[index], materialValue: brick.materialBuffer[index] });
    }
    return undefined;
  }

  public apply(intent: SurfaceVoxelEditIntent): SurfaceVoxelEditTransition {
    const invalid = validateEditIntent(intent);
    if (invalid !== null) return this.reject(invalid.reason, invalid.message);
    if (intent.bodyId !== this.state.bodyId) return this.reject("BodyMismatch", "Edit bodyId does not match the active region.");
    if (intent.regionId !== this.state.regionId) return this.reject("RegionMismatch", "Edit regionId does not match the active region.");
    if (intent.surfaceFrameId !== this.state.surfaceFrameId) return this.reject("FrameMismatch", "Edit surfaceFrameId does not match the active region.");
    if (intent.expectedRegionRevision !== this.state.regionRevision) return this.reject("StaleRevision", "Edit expectedRegionRevision is stale.");
    if (this.#journal.some((record) => record.editId === intent.editId)) return this.reject("DuplicateEditId", "Edit ID was already consumed.");
    if (intent.radiusMeters > this.state.maxSubtractRadiusMeters) return this.reject("InvalidRadius", "Edit radius exceeds the authority limit.");

    const center = freezePlain({
      x: intent.centerGlobalQuantum.x * SURFACE_VOXEL_EDIT_QUANTUM_METERS,
      y: intent.centerGlobalQuantum.y * SURFACE_VOXEL_EDIT_QUANTUM_METERS,
      z: intent.centerGlobalQuantum.z * SURFACE_VOXEL_EDIT_QUANTUM_METERS
    });
    if (COORDINATE_KEYS.some((axis) => center[axis] < this.meterBounds.minInclusive[axis] || center[axis] >= this.meterBounds.maxExclusive[axis])) {
      return this.reject("OutsideRegion", "Edit center lies outside the active SurfaceRegion.");
    }
    if (COORDINATE_KEYS.some((axis) =>
      center[axis] - intent.radiusMeters < this.meterBounds.minInclusive[axis]
      || center[axis] + intent.radiusMeters > this.meterBounds.maxExclusive[axis]
    )) {
      return this.reject("RegionBoundaryClipping", "SubtractSphere would clip across the SurfaceRegion boundary.");
    }

    const requiredCoordinates: SurfaceVoxelCoordinate[] = [];
    for (const z of coordinateRange(this.#input.brickBounds.minInclusive.z, this.#input.brickBounds.maxExclusive.z)) {
      for (const y of coordinateRange(this.#input.brickBounds.minInclusive.y, this.#input.brickBounds.maxExclusive.y)) {
        for (const x of coordinateRange(this.#input.brickBounds.minInclusive.x, this.#input.brickBounds.maxExclusive.x)) {
          const coordinate = { x, y, z };
          if (sphereIntersectsExpandedBrick(center, intent.radiusMeters, coordinate, this.state.voxelSizeMeters)) {
            requiredCoordinates.push(coordinate);
          }
        }
      }
    }
    for (const coordinate of requiredCoordinates) {
      if (!this.#bricks.has(surfaceVoxelBrickKey(coordinate))) {
        return this.reject("MissingCoverage", `Required brick ${surfaceVoxelBrickKey(coordinate)} is not resident.`);
      }
    }

    const replacements = new Map<string, VoxelBrick>();
    const changedKeys = new Set<string>();
    const seamKeys = new Set<string>();
    let selectedSampleCount = 0;
    for (const coordinate of requiredCoordinates) {
      const key = surfaceVoxelBrickKey(coordinate);
      const brick = this.#bricks.get(key)!;
      const density = new Float32Array(brick.densityBuffer);
      const material = new Uint8Array(brick.materialBuffer);
      let changed = false;
      for (let z = 0; z < VOXEL_BRICK_SAMPLE_DIMENSIONS.z; z += 1) {
        for (let y = 0; y < VOXEL_BRICK_SAMPLE_DIMENSIONS.y; y += 1) {
          for (let x = 0; x < VOXEL_BRICK_SAMPLE_DIMENSIONS.x; x += 1) {
            const stored = { x, y, z };
            const global = storedSampleToGlobalCoordinate(brick.brickCoordinate, stored);
            const positionX = global.x * brick.voxelSizeMeters;
            const positionY = global.y * brick.voxelSizeMeters;
            const positionZ = global.z * brick.voxelSizeMeters;
            const distance = Math.hypot(positionX - center.x, positionY - center.y, positionZ - center.z);
            if (distance > intent.radiusMeters) continue;
            selectedSampleCount += 1;
            if (selectedSampleCount > this.state.maxChangedSamplesPerEdit) {
              return this.reject("BudgetExceeded", "SubtractSphere selected-sample budget was exceeded.");
            }
            const index = voxelSampleIndex(stored);
            const previousDensity = density[index];
            const nextDensity = Math.fround(Math.max(previousDensity, intent.radiusMeters - distance));
            let sampleChanged = false;
            if (!Object.is(nextDensity, previousDensity)) {
              density[index] = nextDensity;
              changed = true;
              sampleChanged = true;
            }
            if (previousDensity <= 0 && nextDensity > 0 && material[index] !== SURFACE_VOXEL_AIR_CHANNEL_VALUE) {
              material[index] = SURFACE_VOXEL_AIR_CHANNEL_VALUE;
              changed = true;
            }
              sampleChanged = true;
            if (sampleChanged) {
              for (const axis of COORDINATE_KEYS) {
                if (stored[axis] <= VOXEL_BRICK_APRON_WIDTH) {
                  const neighbor = neighborCoordinate(coordinate, axis, -1);
                  if (coordinateInsideBounds(neighbor, this.#input.brickBounds)) seamKeys.add(surfaceVoxelBrickKey(neighbor));
                }
                if (stored[axis] >= VOXEL_BRICK_CELL_DIMENSIONS[axis] + VOXEL_BRICK_APRON_WIDTH) {
                  const neighbor = neighborCoordinate(coordinate, axis, 1);
                  if (coordinateInsideBounds(neighbor, this.#input.brickBounds)) seamKeys.add(surfaceVoxelBrickKey(neighbor));
                }
              }
            }
          }
        }
      }
      if (changed) {
        replacements.set(key, createEditedBrick(brick, density, material));
        changedKeys.add(key);
      }
    }

    const orderedChangedKeys = [...changedKeys].sort();
    const candidateBricks = new Map(this.#bricks);
    for (const [key, brick] of replacements) candidateBricks.set(key, brick);
    const outcome = orderedChangedKeys.length > 0 ? "Applied" as const : "NoChange" as const;
    const nextRegionRevision = this.state.regionRevision + 1;
    const nextEditRevision = this.state.editRevision + (outcome === "Applied" ? 1 : 0);
    const nextMaterializationRevision = this.state.materializationRevision + (outcome === "Applied" ? 1 : 0);
    if (![nextRegionRevision, nextEditRevision, nextMaterializationRevision].every(Number.isSafeInteger)) {
      return this.reject("BudgetExceeded", "Authority revision overflow was prevented.");
    }
    const ownerBrickCoordinate = cloneCoordinate({
      x: Math.floor(center.x / (VOXEL_BRICK_CELL_DIMENSIONS.x * this.state.voxelSizeMeters)),
      y: Math.floor(center.y / (VOXEL_BRICK_CELL_DIMENSIONS.y * this.state.voxelSizeMeters)),
      z: Math.floor(center.z / (VOXEL_BRICK_CELL_DIMENSIONS.z * this.state.voxelSizeMeters))
    });
    const brickSizeQuantum = {
      x: VOXEL_BRICK_CELL_DIMENSIONS.x * this.state.voxelSizeMeters / SURFACE_VOXEL_EDIT_QUANTUM_METERS,
      y: VOXEL_BRICK_CELL_DIMENSIONS.y * this.state.voxelSizeMeters / SURFACE_VOXEL_EDIT_QUANTUM_METERS,
      z: VOXEL_BRICK_CELL_DIMENSIONS.z * this.state.voxelSizeMeters / SURFACE_VOXEL_EDIT_QUANTUM_METERS
    };
    const recordWithoutResultHash = {
      schemaVersion: SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
      editId: intent.editId,
      sequence: this.#journal.length,
      expectedRegionRevision: intent.expectedRegionRevision,
      resultingRegionRevision: nextRegionRevision,
      resultingEditRevision: nextEditRevision,
      tick: intent.tick,
      actorId: intent.actorId,
      sourceId: intent.sourceId,
      sourceImpactIntentId: intent.sourceImpactIntentId,
      operation: "SubtractSphere" as const,
      centerSurfaceLocalMeters: center,
      centerGlobalQuantum: cloneCoordinate(intent.centerGlobalQuantum),
      ownerBrickCoordinate,
      ownerBrickLocalQuantum: cloneCoordinate({
        x: intent.centerGlobalQuantum.x - ownerBrickCoordinate.x * brickSizeQuantum.x,
        y: intent.centerGlobalQuantum.y - ownerBrickCoordinate.y * brickSizeQuantum.y,
        z: intent.centerGlobalQuantum.z - ownerBrickCoordinate.z * brickSizeQuantum.z
      }),
      quantumMeters: SURFACE_VOXEL_EDIT_QUANTUM_METERS,
      radiusMeters: intent.radiusMeters,
      outcome,
      priorRegionHash: this.state.currentRegionContentHash,
      changedBrickKeys: Object.freeze(orderedChangedKeys)
    };
    const provisionalRecord = freezePlain({ ...recordWithoutResultHash, resultingRegionHash: "" });
    const provisionalJournal = [...this.#journal, provisionalRecord];
    const nextVoxelHash = calculateVoxelContentHash(candidateBricks);
    const nextRegionHash = calculateRegionContentHash(
      this.#input,
      nextRegionRevision,
      nextEditRevision,
      nextRegionRevision,
      nextMaterializationRevision,
      provisionalJournal,
      nextVoxelHash
    );
    const record = freezePlain({ ...recordWithoutResultHash, resultingRegionHash: nextRegionHash });
    const nextAuthority = new SurfaceRegionVoxelAuthorityImpl(
      this.#input,
      candidateBricks,
      [...this.#journal, record],
      {
        regionRevision: nextRegionRevision,
        editRevision: nextEditRevision,
        planningRevision: nextRegionRevision,
        materializationRevision: nextMaterializationRevision
      }
    );
    if (nextAuthority.state.currentRegionContentHash !== nextRegionHash) {
      throw new TypeError("SurfaceRegionVoxelAuthority hash publication mismatch.");
    }
    const requiredRemeshKeys = [...new Set([...orderedChangedKeys, ...seamKeys])].sort();
    const seamNeighborKeys = [...seamKeys].sort();
    const result = freezePlain({
      status: outcome,
      reason: null,
      priorRegionRevision: this.state.regionRevision,
      resultingRegionRevision: nextRegionRevision,
      priorEditRevision: this.state.editRevision,
      resultingEditRevision: nextEditRevision,
      priorRegionHash: this.state.currentRegionContentHash,
      resultingRegionHash: nextRegionHash,
      changedBrickKeys: orderedChangedKeys,
      requiredRemeshKeys,
      seamNeighborKeys,
      requiredCollisionRefreshKeys: orderedChangedKeys
    }) as Readonly<SurfaceVoxelEditResult>;
    return Object.freeze({ authority: nextAuthority, state: nextAuthority.state, result });
  }

  private reject(reason: SurfaceVoxelEditRejectionReason, message: string): SurfaceVoxelEditTransition {
    const result = freezePlain({
      status: "Rejected" as const,
      reason,
      message,
      priorRegionRevision: this.state.regionRevision,
      resultingRegionRevision: this.state.regionRevision,
      priorEditRevision: this.state.editRevision,
      resultingEditRevision: this.state.editRevision,
      priorRegionHash: this.state.currentRegionContentHash,
      resultingRegionHash: this.state.currentRegionContentHash,
      changedBrickKeys: [],
      requiredRemeshKeys: [],
      seamNeighborKeys: [],
      requiredCollisionRefreshKeys: []
    });
    return Object.freeze({ authority: this, state: this.state, result });
  }
}

const validateEditIntent = (
  value: unknown
): Readonly<{ reason: SurfaceVoxelEditRejectionReason; message: string }> | null => {
  if (!isPlainRecord(value) || !hasExactKeys(value, EDIT_INTENT_KEYS)) {
    return Object.freeze({ reason: "InvalidInput", message: "Edit intent must contain only the exact V1 fields." });
  }
  if (
    value.schemaVersion !== SURFACE_VOXEL_EDIT_SCHEMA_VERSION
    || !isStableId(value.editId)
    || !isSafeNonNegativeInteger(value.expectedRegionRevision)
    || !isSafeNonNegativeInteger(value.tick)
    || !isStableId(value.actorId)
    || !isStableId(value.sourceId)
    || !isStableId(value.sourceImpactIntentId)
    || !isStableId(value.bodyId)
    || !isStableId(value.surfaceFrameId)
    || !isStableId(value.regionId)
    || value.operation !== "SubtractSphere"
    || !validCoordinate(value.centerGlobalQuantum)
    || value.quantumMeters !== SURFACE_VOXEL_EDIT_QUANTUM_METERS
  ) {
    return Object.freeze({ reason: "InvalidInput", message: "Edit intent identity, revision, operation, or quantum is invalid." });
  }
  if (typeof value.radiusMeters !== "number" || !Number.isFinite(value.radiusMeters) || value.radiusMeters <= 0) {
    return Object.freeze({ reason: "InvalidRadius", message: "Edit radius must be positive and finite." });
  }
  return null;
};

export const createSurfaceRegionVoxelAuthority = (
  value: SurfaceRegionVoxelAuthorityInput
): SurfaceRegionVoxelAuthority => {
  const input = cloneInput(requireAuthorityInput(value));
  const bricks = new Map<string, VoxelBrick>();
  for (const coordinate of input.residentBrickCoordinates) {
    const brick = generateHestiaVoxelBrick({
      rootSeed: input.seed,
      bodyId: voxelBodyId(input.bodyId),
      surfaceFrameId: surfaceFrameId(input.surfaceFrameId),
      regionId: voxelRegionId(input.regionId),
      brickCoordinate: coordinate,
      voxelSizeMeters: input.voxelSizeMeters
    });
    bricks.set(surfaceVoxelBrickKey(coordinate), brick);
  }
  return new SurfaceRegionVoxelAuthorityImpl(input, bricks, [], {
    regionRevision: 0,
    editRevision: 0,
    planningRevision: 0,
    materializationRevision: 0
  });
};

export const applySurfaceVoxelEdit = (
  authority: SurfaceRegionVoxelAuthority,
  intent: SurfaceVoxelEditIntent
): SurfaceVoxelEditTransition => {
  if (!(authority instanceof SurfaceRegionVoxelAuthorityImpl)) {
    throw new TypeError("authority must be a SurfaceRegionVoxelAuthority created by this module.");
  }
  return authority.apply(intent);
};

export const reconstructSurfaceRegionVoxelAuthority = (
  state: Readonly<SurfaceRegionVoxelState>
): SurfaceRegionVoxelAuthority => {
  let authority = createSurfaceRegionVoxelAuthority({
    schemaVersion: state.schemaVersion,
    bodyId: state.bodyId,
    surfaceFrameId: state.surfaceFrameId,
    regionId: state.regionId,
    generatorVersion: state.generatorVersion,
    seed: state.seed,
    voxelSizeMeters: state.voxelSizeMeters,
    sourceRevision: state.sourceRevision,
    brickBounds: state.brickBounds,
    residentBrickCoordinates: state.residentBrickCoordinates,
    maxSubtractRadiusMeters: state.maxSubtractRadiusMeters,
    maxChangedSamplesPerEdit: state.maxChangedSamplesPerEdit
  });
  for (const record of state.editJournal) {
    const transition = applySurfaceVoxelEdit(authority, {
      schemaVersion: record.schemaVersion,
      editId: record.editId,
      expectedRegionRevision: record.expectedRegionRevision,
      tick: record.tick,
      actorId: record.actorId,
      sourceId: record.sourceId,
      sourceImpactIntentId: record.sourceImpactIntentId,
      bodyId: state.bodyId,
      surfaceFrameId: state.surfaceFrameId,
      regionId: state.regionId,
      operation: record.operation,
      centerGlobalQuantum: record.centerGlobalQuantum,
      quantumMeters: record.quantumMeters,
      radiusMeters: record.radiusMeters
    });
    if (transition.result.status !== record.outcome) throw new TypeError("Edit journal replay outcome mismatch.");
    authority = transition.authority;
  }
  if (
    authority.state.currentRegionContentHash !== state.currentRegionContentHash
    || authority.state.currentVoxelContentHash !== state.currentVoxelContentHash
    || authority.state.regionRevision !== state.regionRevision
    || authority.state.editRevision !== state.editRevision
  ) {
    throw new TypeError("Reconstructed SurfaceRegionVoxelAuthority does not match the supplied state.");
  }
  return authority;
};

export const getSurfaceRegionVoxelAuthorityInternal = (
  authority: SurfaceRegionVoxelAuthority
): SurfaceRegionVoxelAuthorityInternal => {
  if (!(authority instanceof SurfaceRegionVoxelAuthorityImpl)) {
    throw new TypeError("authority must be a SurfaceRegionVoxelAuthority created by this module.");
  }
  return authority;
};
