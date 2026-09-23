import {
  evaluateAdaptiveBaseFieldDescriptor,
  hashAdaptiveBaseFieldDescriptor,
  hashAdaptiveCanonical,
  validateAdaptiveBaseFieldDescriptor
} from "./canonical";
import {
  cellSizeMetersForLevel,
  cellSizeQuantumForLevel,
  parentOf,
  validateAdaptiveBrickKey
} from "./coordinates";
import { validateAdaptiveEditJournal } from "./edits";
import {
  ADAPTIVE_BRICK_CELL_COUNT,
  ADAPTIVE_BRICK_CELLS_PER_AXIS,
  ADAPTIVE_BRICK_SCHEMA_VERSION,
  ADAPTIVE_MATERIALIZATION_VERSION,
  type AdaptiveBaseFieldDescriptor,
  type AdaptiveBrickKey,
  type AdaptiveBrickProvenance,
  type AdaptiveEditJournal,
  type AdaptiveEditRecord,
  type MaterializedAdaptiveBrick,
  type QuantumBounds,
  type QuantumSphere,
  type StableAuthorityId
} from "./types";
import {
  authorityRevision,
  deepFreeze,
  fail,
  requireDenseDataPropertyArray,
  requireExactKeys,
  requireFinite,
  requirePlainRecord,
  stableAuthorityId
} from "./validation";

const hashPattern = /^fnv1a64-v1:[0-9a-f]{16}$/;

const validateDenseChannel = (value: unknown, name: string): readonly unknown[] =>
  requireDenseDataPropertyArray(value, `brick/${name}`, "InvalidBaseField", {
    exactLength: ADAPTIVE_BRICK_CELL_COUNT
  });

const finiteChannelValue = (value: unknown, path: string): number => {
  if (typeof value !== "number") return fail("InvalidBaseField", path, "Materialized numeric channels must contain numbers.");
  return requireFinite(value, path);
};

const authorityChannelValue = (value: unknown, path: string): StableAuthorityId | null => {
  if (value === null) return null;
  if (typeof value !== "string") return fail("InvalidBaseField", path, "Materialized authority channels must contain IDs or null.");
  return stableAuthorityId(value, path);
};

const hashValue = (value: unknown, path: string): string => {
  if (typeof value !== "string" || !hashPattern.test(value)) {
    return fail("InvalidBaseField", path, "Expected a canonical adaptive hash.");
  }
  return value;
};

const overlapsBox = (left: QuantumBounds, right: QuantumBounds): boolean =>
  (["x", "y", "z"] as const).every((axis) => left.min[axis] < right.max[axis] && left.max[axis] > right.min[axis]);

// Conservative brick-level prefilter: skip only strictly separated spheres.
// Touching bounds are kept; the exact per-cell predicate still decides.
// ponytail: bbox test, exact sphere math stays per-cell if it can matter.
const sphereReachesBrick = (brick: QuantumBounds, sphere: QuantumSphere): boolean =>
  (["x", "y", "z"] as const).every((axis) => sphere.center[axis] - sphere.radiusQuantum <= brick.max[axis]
    && sphere.center[axis] + sphere.radiusQuantum >= brick.min[axis]);

const INTEGER_LIMB_BASE = 0x8000;

const safeIntegerLimbs = (value: number): number[] => {
  const result: number[] = [];
  let remaining = value;
  do {
    result.push(remaining % INTEGER_LIMB_BASE);
    remaining = Math.floor(remaining / INTEGER_LIMB_BASE);
  } while (remaining > 0);
  return result;
};

const squareSafeInteger = (value: number): number[] => {
  const input = safeIntegerLimbs(value);
  const result = new Array(input.length * 2).fill(0) as number[];
  for (let left = 0; left < input.length; left += 1) {
    for (let right = 0; right < input.length; right += 1) {
      result[left + right] += input[left] * input[right];
    }
  }
  for (let index = 0; index < result.length; index += 1) {
    const carry = Math.floor(result[index] / INTEGER_LIMB_BASE);
    result[index] %= INTEGER_LIMB_BASE;
    if (carry > 0) result[index + 1] = (result[index + 1] ?? 0) + carry;
  }
  while (result.length > 1 && result[result.length - 1] === 0) result.pop();
  return result;
};

const addIntegerLimbs = (values: readonly number[][]): number[] => {
  const result: number[] = [];
  const length = Math.max(...values.map((value) => value.length));
  let carry = 0;
  for (let index = 0; index < length || carry > 0; index += 1) {
    let sum = carry;
    for (const value of values) sum += value[index] ?? 0;
    result.push(sum % INTEGER_LIMB_BASE);
    carry = Math.floor(sum / INTEGER_LIMB_BASE);
  }
  return result;
};

const compareIntegerLimbs = (left: readonly number[], right: readonly number[]): number => {
  if (left.length !== right.length) return left.length - right.length;
  for (let index = left.length - 1; index >= 0; index -= 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
};

const overlapsSphere = (cell: QuantumBounds, edit: AdaptiveEditRecord): boolean => {
  const sphere = edit.sphere;
  if (sphere === undefined) return false;
  const squaredDistances: number[][] = [];
  let tangentPointIsIncluded = true;
  for (const axis of ["x", "y", "z"] as const) {
    const coordinate = sphere.center[axis];
    const nearest = coordinate < cell.min[axis] ? cell.min[axis] : coordinate > cell.max[axis] ? cell.max[axis] : coordinate;
    if (nearest === cell.max[axis] && coordinate >= cell.max[axis]) tangentPointIsIncluded = false;
    const delta = Math.abs(coordinate - nearest);
    if (!Number.isSafeInteger(delta) || delta > sphere.radiusQuantum) return false;
    squaredDistances.push(squareSafeInteger(delta));
  }
  const comparison = compareIntegerLimbs(
    addIntegerLimbs(squaredDistances),
    squareSafeInteger(sphere.radiusQuantum)
  );
  return comparison < 0 || (comparison === 0 && tangentPointIsIncluded);
};

const appliesToFootprint = (footprint: QuantumBounds, edit: AdaptiveEditRecord): boolean =>
  edit.box === undefined ? overlapsSphere(footprint, edit) : overlapsBox(footprint, edit.box);

interface MutableSample {
  density: number;
  occupancy: number;
  materialId: StableAuthorityId | null;
  semanticId: StableAuthorityId | null;
}

const applyEdit = (sample: MutableSample, edit: AdaptiveEditRecord): void => {
  switch (edit.operation) {
    case "SubtractSphere":
    case "SubtractBox":
      sample.occupancy = 0;
      sample.density = Math.max(Math.abs(sample.density), 1);
      break;
    case "AddSphere":
    case "AddBox":
      sample.occupancy = 1;
      sample.density = -Math.max(Math.abs(sample.density), 1);
      if (edit.materialId !== undefined) sample.materialId = edit.materialId;
      if (edit.semanticId !== undefined) sample.semanticId = edit.semanticId;
      break;
    case "SetMaterialBox":
      sample.materialId = edit.materialId ?? fail("InvalidEditJournal", "materialId", "SetMaterialBox requires material.");
      if (edit.semanticId !== undefined) sample.semanticId = edit.semanticId;
      break;
  }
};

interface AuthorityInputMetadata {
  readonly baseFieldIdentity: StableAuthorityId;
  readonly baseFieldVersion: StableAuthorityId;
  readonly baseFieldDescriptorDigest: string;
  readonly sourceRevision: number;
  readonly editRevision: number;
  readonly journalDigest: string;
}

const authorityInputDigest = (key: AdaptiveBrickKey, metadata: AuthorityInputMetadata): string =>
  hashAdaptiveCanonical({
    schemaVersion: "adaptive-microvoxel-authority-input-v1",
    brickSchemaVersion: ADAPTIVE_BRICK_SCHEMA_VERSION,
    materializationVersion: ADAPTIVE_MATERIALIZATION_VERSION,
    key,
    ...metadata
  });

const expectedParentProvenanceHash = (key: AdaptiveBrickKey, metadata: AuthorityInputMetadata): string | null => {
  const parent = parentOf(key);
  return parent === null
    ? null
    : hashAdaptiveCanonical({
        schemaVersion: "adaptive-microvoxel-parent-provenance-v1",
        brickSchemaVersion: ADAPTIVE_BRICK_SCHEMA_VERSION,
        materializationVersion: ADAPTIVE_MATERIALIZATION_VERSION,
        key: parent,
        ...metadata
      });
};

const contentHashFor = (
  key: AdaptiveBrickKey,
  metadata: AuthorityInputMetadata,
  channels: Readonly<{
    density: readonly number[];
    occupancy: readonly number[];
    material: readonly (StableAuthorityId | null)[];
    semantic: readonly (StableAuthorityId | null)[];
  }>
): string => hashAdaptiveCanonical({
  schemaVersion: "adaptive-microvoxel-content-hash-input-v1",
  authorityInputDigest: authorityInputDigest(key, metadata),
  cellSizeQuantum: cellSizeQuantumForLevel(key.level),
  cellSizeMeters: cellSizeMetersForLevel(key.level),
  cellCount: ADAPTIVE_BRICK_CELL_COUNT,
  ...channels
});

export interface MaterializeAdaptiveBrickInput {
  readonly key: AdaptiveBrickKey;
  readonly baseField: AdaptiveBaseFieldDescriptor;
  readonly editJournal: AdaptiveEditJournal;
}

export const materializeAdaptiveBrick = ({
  key: keyValue,
  baseField,
  editJournal: journalValue
}: MaterializeAdaptiveBrickInput): MaterializedAdaptiveBrick => {
  const key = validateAdaptiveBrickKey(keyValue);
  const validatedBaseField = validateAdaptiveBaseFieldDescriptor(baseField);
  const identity = validatedBaseField.identity;
  const version = validatedBaseField.version;
  const sourceRevision = validatedBaseField.sourceRevision;
  const baseFieldDescriptorDigest = hashAdaptiveBaseFieldDescriptor(validatedBaseField);
  const baseSample = evaluateAdaptiveBaseFieldDescriptor(validatedBaseField);
  const journal = validateAdaptiveEditJournal(journalValue);
  const cellSizeQuantum = cellSizeQuantumForLevel(key.level);
  const cellSizeMeters = cellSizeMetersForLevel(key.level);
  // Journal order is preserved: skipped edits provably touch no cell of this
  // brick (box: exact brick-level overlap; sphere: strictly-separated bbox).
  // Per-cell results, canonical bytes and hashes are unchanged.
  const brickOrigin = key.originQuantum;
  const brickExtent = ADAPTIVE_BRICK_CELLS_PER_AXIS * cellSizeQuantum;
  const brickBounds = { min: brickOrigin, max: { x: brickOrigin.x + brickExtent, y: brickOrigin.y + brickExtent, z: brickOrigin.z + brickExtent } } as QuantumBounds;
  const overlappingEdits = journal.records.filter((edit) => edit.box !== undefined
    ? overlapsBox(brickBounds, edit.box)
    : edit.sphere !== undefined && sphereReachesBrick(brickBounds, edit.sphere));
  const density: number[] = new Array(ADAPTIVE_BRICK_CELL_COUNT).fill(baseSample.density);
  const occupancy: number[] = new Array(ADAPTIVE_BRICK_CELL_COUNT).fill(baseSample.occupancy);
  const material: (StableAuthorityId | null)[] = new Array(ADAPTIVE_BRICK_CELL_COUNT).fill(baseSample.materialId);
  const semantic: (StableAuthorityId | null)[] = new Array(ADAPTIVE_BRICK_CELL_COUNT).fill(baseSample.semanticId ?? null);
  // Private scratch only: predicates synchronously read it, never retain it.
  // Public inputs and the complete output still receive their original validation/freeze.
  const footprint = {min:{x:0,y:0,z:0},max:{x:0,y:0,z:0}};
  const footprintQuantum = footprint as QuantumBounds;
  const sample: MutableSample = { density: 0, occupancy: 0, materialId: null, semanticId: null };
  const edge = ADAPTIVE_BRICK_CELLS_PER_AXIS;
  const axes = ["x", "y", "z"] as const;
  const applyAt = (x: number, y: number, z: number, edit: AdaptiveEditRecord): void => {
    const index = x + edge * (y + edge * z);
    sample.density = density[index]!;
    sample.occupancy = occupancy[index]!;
    sample.materialId = material[index]!;
    sample.semanticId = semantic[index]!;
    applyEdit(sample, edit);
    density[index] = sample.density;
    occupancy[index] = sample.occupancy;
    material[index] = sample.materialId;
    semantic[index] = sample.semanticId;
  };

  for (const edit of overlappingEdits) {
    let lo: number[] | undefined;
    let hi: number[] | undefined;
    const box = edit.box;
    if (box !== undefined) {
      const minimum = axes.map(axis => box.min[axis] - brickOrigin[axis]);
      const maximum = axes.map(axis => box.max[axis] - brickOrigin[axis]);
      // Valid global coordinates can still have an unsafe local difference.
      if (minimum.every(Number.isSafeInteger) && maximum.every(Number.isSafeInteger)) {
        lo = minimum.map(value => Math.max(0, Math.floor(value / cellSizeQuantum)));
        hi = maximum.map(value => Math.min(edge, Math.ceil(value / cellSizeQuantum)));
      }
    }
    if (lo !== undefined && hi !== undefined) {
      for (let z = lo[2]!; z < hi[2]!; z += 1) {
        for (let y = lo[1]!; y < hi[1]!; y += 1) {
          for (let x = lo[0]!; x < hi[0]!; x += 1) {
            applyAt(x, y, z, edit);
          }
        }
      }
      continue;
    }
    // Spheres and unsafe differences retain the original exact footprint rule.
    for (let z = 0; z < edge; z += 1) {
      for (let y = 0; y < edge; y += 1) {
        for (let x = 0; x < edge; x += 1) {
          footprint.min.x = brickOrigin.x + x * cellSizeQuantum;
          footprint.min.y = brickOrigin.y + y * cellSizeQuantum;
          footprint.min.z = brickOrigin.z + z * cellSizeQuantum;
          footprint.max.x = footprint.min.x + cellSizeQuantum;
          footprint.max.y = footprint.min.y + cellSizeQuantum;
          footprint.max.z = footprint.min.z + cellSizeQuantum;
          if (appliesToFootprint(footprintQuantum, edit)) {
            applyAt(x, y, z, edit);
          }
        }
      }
    }
  }
  for (let index = 0; index < ADAPTIVE_BRICK_CELL_COUNT; index += 1) {
    density[index] = requireFinite(density[index]!, `density/${index}`);
    occupancy[index] = requireFinite(occupancy[index]!, `occupancy/${index}`);
  }

  const channels = deepFreeze({
    density: deepFreeze(density),
    occupancy: deepFreeze(occupancy),
    material: deepFreeze(material),
    semantic: deepFreeze(semantic)
  });
  const hierarchyKeyHash = hashAdaptiveCanonical(key);
  const authorityMetadata = {
    baseFieldIdentity: identity,
    baseFieldVersion: version,
    baseFieldDescriptorDigest,
    sourceRevision,
    editRevision: journal.revision,
    journalDigest: journal.digest
  };
  const contentPayload = {
    schemaVersion: ADAPTIVE_BRICK_SCHEMA_VERSION,
    materializationVersion: ADAPTIVE_MATERIALIZATION_VERSION,
    key,
    cellSizeQuantum,
    cellSizeMeters,
    cellCount: ADAPTIVE_BRICK_CELL_COUNT,
    ...channels,
    baseFieldDescriptorDigest,
    sourceRevision,
    editRevision: journal.revision
  };
  const contentHash = contentHashFor(key, authorityMetadata, channels);
  const parentHash = expectedParentProvenanceHash(key, authorityMetadata);
  const provenancePayload = {
    schemaVersion: "adaptive-microvoxel-provenance-v1" as const,
    ...authorityMetadata,
    hierarchyKeyHash,
    materializationVersion: ADAPTIVE_MATERIALIZATION_VERSION,
    parentProvenanceHash: parentHash
  };
  const provenance = deepFreeze({
    ...provenancePayload,
    provenanceHash: hashAdaptiveCanonical(provenancePayload)
  });
  return deepFreeze({
    ...contentPayload,
    originQuantum: key.originQuantum,
    level: key.level,
    contentHash,
    provenance
  });
};

export const validateMaterializedAdaptiveBrick = (brick: MaterializedAdaptiveBrick): MaterializedAdaptiveBrick => {
  const record = requirePlainRecord(brick, "brick");
  requireExactKeys(
    record,
    [
      "schemaVersion",
      "materializationVersion",
      "key",
      "originQuantum",
      "level",
      "cellSizeQuantum",
      "cellSizeMeters",
      "cellCount",
      "density",
      "occupancy",
      "material",
      "semantic",
      "baseFieldDescriptorDigest",
      "sourceRevision",
      "editRevision",
      "contentHash",
      "provenance"
    ],
    "brick"
  );
  const key = validateAdaptiveBrickKey(record.key);
  const originRecord = requirePlainRecord(record.originQuantum, "brick/originQuantum");
  requireExactKeys(originRecord, ["x", "y", "z"], "brick/originQuantum");
  if (
    record.schemaVersion !== ADAPTIVE_BRICK_SCHEMA_VERSION ||
    record.materializationVersion !== ADAPTIVE_MATERIALIZATION_VERSION ||
    record.cellCount !== ADAPTIVE_BRICK_CELL_COUNT ||
    record.level !== key.level ||
    originRecord.x !== key.originQuantum.x ||
    originRecord.y !== key.originQuantum.y ||
    originRecord.z !== key.originQuantum.z ||
    record.cellSizeQuantum !== cellSizeQuantumForLevel(key.level) ||
    record.cellSizeMeters !== cellSizeMetersForLevel(key.level)
  ) {
    return fail("InvalidKey", "brick", "Materialized brick metadata is inconsistent.");
  }
  const density = validateDenseChannel(record.density, "density");
  const occupancy = validateDenseChannel(record.occupancy, "occupancy");
  const material = validateDenseChannel(record.material, "material");
  const semantic = validateDenseChannel(record.semantic, "semantic");
  const validatedDensity: number[] = [];
  const validatedOccupancy: number[] = [];
  const validatedMaterial: (StableAuthorityId | null)[] = [];
  const validatedSemantic: (StableAuthorityId | null)[] = [];
  for (let index = 0; index < density.length; index += 1) {
    validatedDensity.push(finiteChannelValue(density[index], `brick/density/${index}`));
    const occupied = finiteChannelValue(occupancy[index], `brick/occupancy/${index}`);
    if (occupied < 0 || occupied > 1) return fail("InvalidBaseField", `brick/occupancy/${index}`, "Occupancy must be in [0, 1].");
    validatedOccupancy.push(occupied);
    validatedMaterial.push(authorityChannelValue(material[index], `brick/material/${index}`));
    validatedSemantic.push(authorityChannelValue(semantic[index], `brick/semantic/${index}`));
  }
  const sourceRevision = authorityRevision(record.sourceRevision as number);
  const editRevision = authorityRevision(record.editRevision as number);
  const channels = {
    density: validatedDensity,
    occupancy: validatedOccupancy,
    material: validatedMaterial,
    semantic: validatedSemantic
  };
  const payload = {
    schemaVersion: ADAPTIVE_BRICK_SCHEMA_VERSION,
    materializationVersion: ADAPTIVE_MATERIALIZATION_VERSION,
    key,
    cellSizeQuantum: cellSizeQuantumForLevel(key.level),
    cellSizeMeters: cellSizeMetersForLevel(key.level),
    cellCount: ADAPTIVE_BRICK_CELL_COUNT,
    ...channels,
    baseFieldDescriptorDigest: hashValue(record.baseFieldDescriptorDigest, "brick/baseFieldDescriptorDigest"),
    sourceRevision,
    editRevision
  };
  const provenanceRecord = requirePlainRecord(record.provenance, "brick/provenance");
  requireExactKeys(
    provenanceRecord,
    [
      "schemaVersion",
      "baseFieldIdentity",
      "baseFieldVersion",
      "baseFieldDescriptorDigest",
      "sourceRevision",
      "editRevision",
      "journalDigest",
      "hierarchyKeyHash",
      "materializationVersion",
      "parentProvenanceHash",
      "provenanceHash"
    ],
    "brick/provenance"
  );
  if (provenanceRecord.schemaVersion !== "adaptive-microvoxel-provenance-v1") {
    return fail("InvalidBaseField", "brick/provenance/schemaVersion", "Unsupported provenance schema.");
  }
  if (provenanceRecord.materializationVersion !== ADAPTIVE_MATERIALIZATION_VERSION) {
    return fail("InvalidBaseField", "brick/provenance/materializationVersion", "Unsupported provenance materialization version.");
  }
  if (typeof provenanceRecord.baseFieldIdentity !== "string" || typeof provenanceRecord.baseFieldVersion !== "string") {
    return fail("InvalidBaseField", "brick/provenance", "Provenance base-field identities must be strings.");
  }
  if (typeof provenanceRecord.sourceRevision !== "number" || typeof provenanceRecord.editRevision !== "number") {
    return fail("InvalidBaseField", "brick/provenance", "Provenance revisions must be numbers.");
  }
  const parentProvenanceHash = provenanceRecord.parentProvenanceHash === null
    ? null
    : hashValue(provenanceRecord.parentProvenanceHash, "brick/provenance/parentProvenanceHash");
  const provenancePayload: Omit<AdaptiveBrickProvenance, "provenanceHash"> = {
    schemaVersion: "adaptive-microvoxel-provenance-v1",
    baseFieldIdentity: stableAuthorityId(provenanceRecord.baseFieldIdentity, "brick/provenance/baseFieldIdentity"),
    baseFieldVersion: stableAuthorityId(provenanceRecord.baseFieldVersion, "brick/provenance/baseFieldVersion"),
    baseFieldDescriptorDigest: hashValue(provenanceRecord.baseFieldDescriptorDigest, "brick/provenance/baseFieldDescriptorDigest"),
    sourceRevision: authorityRevision(provenanceRecord.sourceRevision),
    editRevision: authorityRevision(provenanceRecord.editRevision),
    journalDigest: hashValue(provenanceRecord.journalDigest, "brick/provenance/journalDigest"),
    hierarchyKeyHash: hashValue(provenanceRecord.hierarchyKeyHash, "brick/provenance/hierarchyKeyHash"),
    materializationVersion: ADAPTIVE_MATERIALIZATION_VERSION,
    parentProvenanceHash
  };
  const provenanceHash = hashValue(provenanceRecord.provenanceHash, "brick/provenance/provenanceHash");
  const authorityMetadata: AuthorityInputMetadata = {
    baseFieldIdentity: provenancePayload.baseFieldIdentity,
    baseFieldVersion: provenancePayload.baseFieldVersion,
    baseFieldDescriptorDigest: provenancePayload.baseFieldDescriptorDigest,
    sourceRevision: provenancePayload.sourceRevision,
    editRevision: provenancePayload.editRevision,
    journalDigest: provenancePayload.journalDigest
  };
  const expectedParentHash = expectedParentProvenanceHash(key, authorityMetadata);
  if (
    provenancePayload.schemaVersion !== provenanceRecord.schemaVersion ||
    provenancePayload.sourceRevision !== sourceRevision ||
    provenancePayload.editRevision !== editRevision ||
    provenancePayload.baseFieldDescriptorDigest !== payload.baseFieldDescriptorDigest ||
    provenancePayload.hierarchyKeyHash !== hashAdaptiveCanonical(key) ||
    provenancePayload.parentProvenanceHash !== expectedParentHash ||
    hashAdaptiveCanonical(provenancePayload) !== provenanceHash
  ) {
    return fail("InvalidBaseField", "brick/provenance", "Materialized provenance is inconsistent.");
  }
  if (
    typeof record.contentHash !== "string" ||
    !hashPattern.test(record.contentHash) ||
    contentHashFor(key, authorityMetadata, channels) !== record.contentHash
  ) {
    return fail("InvalidBaseField", "brick/contentHash", "Materialized content hash mismatch.");
  }
  return deepFreeze({
    ...payload,
    originQuantum: key.originQuantum,
    level: key.level,
    contentHash: record.contentHash,
    provenance: { ...provenancePayload, provenanceHash }
  });
};
