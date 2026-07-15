import {
  materialRegistryVersion,
  validateVoxelMaterialId,
  validateVoxelStableId,
  voxelMaterialId,
  voxelMaterialKey,
  type VoxelMaterialId
} from "./ids";
import {
  invalidVoxelResult,
  throwIfVoxelInvalid,
  validVoxelResult,
  voxelIssue,
  type VoxelMaterialDefinition,
  type VoxelMaterialRegistry,
  type VoxelMaterialSemantic,
  type VoxelValidationIssue,
  type VoxelValidationResult
} from "./types";

const MATERIAL_SEMANTICS = new Set<VoxelMaterialSemantic>([
  "SolidRock",
  "WetSoil",
  "MossCover",
  "DenseBiologicalSurface",
  "ShallowWaterBoundary"
]);

const HESTIA_MATERIAL_REGISTRY_VERSION = "hestia.materials.v1";
const APPROVED_MATERIAL_DEFINITIONS_V1 = [
  { id: 0, key: "dark_rock", semantic: "SolidRock" },
  { id: 1, key: "wet_soil", semantic: "WetSoil" },
  { id: 2, key: "moss", semantic: "MossCover" },
  { id: 3, key: "dense_biological_surface", semantic: "DenseBiologicalSurface" },
  { id: 4, key: "shallow_water_boundary", semantic: "ShallowWaterBoundary" }
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const validateVoxelMaterialRegistry = (value: unknown): VoxelValidationResult => {
  const issues: VoxelValidationIssue[] = [];
  if (!isRecord(value)) {
    return invalidVoxelResult([voxelIssue("InvalidMaterialRegistry", "materialRegistry", "must be an object")]);
  }
  const versionValidation = validateVoxelStableId(value.version, "materialRegistry.version");
  if (!versionValidation.valid) issues.push(...versionValidation.issues);
  if (value.version !== HESTIA_MATERIAL_REGISTRY_VERSION) {
    issues.push(voxelIssue("InvalidMaterialRegistry", "materialRegistry.version", `must equal ${HESTIA_MATERIAL_REGISTRY_VERSION} for V1`));
  }
  if (!Array.isArray(value.definitions) || value.definitions.length !== APPROVED_MATERIAL_DEFINITIONS_V1.length) {
    issues.push(voxelIssue(
      "InvalidMaterialRegistry",
      "materialRegistry.definitions",
      `must contain the ${APPROVED_MATERIAL_DEFINITIONS_V1.length} approved V1 definitions`
    ));
    return invalidVoxelResult(issues);
  }

  for (let index = 0; index < value.definitions.length; index += 1) {
    if (!Object.hasOwn(value.definitions, index)) {
      issues.push(voxelIssue("InvalidMaterialRegistry", `materialRegistry.definitions[${index}]`, "must not be sparse"));
    }
  }

  const ids = new Set<number>();
  const keys = new Set<string>();
  value.definitions.forEach((definition, index) => {
    const path = `materialRegistry.definitions[${index}]`;
    if (!isRecord(definition)) {
      issues.push(voxelIssue("InvalidMaterialRegistry", path, "must be an object"));
      return;
    }
    const idValidation = validateVoxelMaterialId(definition.id, `${path}.id`);
    if (!idValidation.valid) issues.push(...idValidation.issues);
    const keyValidation = validateVoxelStableId(definition.key, `${path}.key`);
    if (!keyValidation.valid) issues.push(...keyValidation.issues);
    if (!MATERIAL_SEMANTICS.has(definition.semantic as VoxelMaterialSemantic)) {
      issues.push(voxelIssue("InvalidMaterialRegistry", `${path}.semantic`, "must use a documented VoxelBrick V1 semantic"));
    }
    const approved = APPROVED_MATERIAL_DEFINITIONS_V1.find((candidate) => candidate.id === definition.id);
    if (approved === undefined || approved.key !== definition.key || approved.semantic !== definition.semantic) {
      issues.push(voxelIssue("InvalidMaterialRegistry", path, "must match an approved VoxelBrick V1 ID, key, and semantic"));
    }
    if (typeof definition.id === "number") {
      if (ids.has(definition.id)) issues.push(voxelIssue("DuplicateMaterialId", `${path}.id`, "must be unique"));
      ids.add(definition.id);
    }
    if (typeof definition.key === "string") {
      if (keys.has(definition.key)) issues.push(voxelIssue("DuplicateMaterialKey", `${path}.key`, "must be unique"));
      keys.add(definition.key);
    }
  });
  return issues.length === 0 ? validVoxelResult() : invalidVoxelResult(issues);
};

export const createVoxelMaterialRegistry = (value: unknown): VoxelMaterialRegistry => {
  const validation = validateVoxelMaterialRegistry(value);
  throwIfVoxelInvalid("VoxelMaterialRegistry", validation);
  const input = value as { readonly version: string; readonly definitions: readonly {
    readonly id: number;
    readonly key: string;
    readonly semantic: VoxelMaterialSemantic;
  }[] };
  const definitions = input.definitions
    .map((definition): VoxelMaterialDefinition => Object.freeze({
      id: voxelMaterialId(definition.id),
      key: voxelMaterialKey(definition.key),
      semantic: definition.semantic
    }))
    .sort((left, right) => left.id - right.id || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
  return Object.freeze({
    version: materialRegistryVersion(input.version),
    definitions: Object.freeze(definitions)
  });
};

export const HESTIA_MATERIAL_REGISTRY_VERSION_V1 = materialRegistryVersion(HESTIA_MATERIAL_REGISTRY_VERSION);

/** Stable byte IDs and renderer-neutral meanings approved for Hestia V1. */
export const HESTIA_MATERIAL_REGISTRY_V1 = createVoxelMaterialRegistry({
  version: HESTIA_MATERIAL_REGISTRY_VERSION_V1,
  definitions: APPROVED_MATERIAL_DEFINITIONS_V1
});

export const voxelMaterialDefinition = (
  registry: VoxelMaterialRegistry,
  id: VoxelMaterialId
): VoxelMaterialDefinition | undefined => {
  throwIfVoxelInvalid("VoxelMaterialRegistry", validateVoxelMaterialRegistry(registry));
  throwIfVoxelInvalid("VoxelMaterialId", validateVoxelMaterialId(id));
  return HESTIA_MATERIAL_REGISTRY_V1.definitions.find((definition) => definition.id === id);
};

export const validateMaterialChannel = (
  value: unknown,
  expectedLength: number,
  registry: VoxelMaterialRegistry = HESTIA_MATERIAL_REGISTRY_V1
): VoxelValidationResult => {
  const registryValidation = validateVoxelMaterialRegistry(registry);
  if (!registryValidation.valid) return registryValidation;
  if (!(value instanceof Uint8Array)) {
    return invalidVoxelResult([voxelIssue("InvalidChannelType", "materialBuffer", "must be a Uint8Array")]);
  }
  const issues: VoxelValidationIssue[] = [];
  if (value.length !== expectedLength) {
    issues.push(voxelIssue("InvalidChannelLength", "materialBuffer", `must contain exactly ${expectedLength} samples`));
  }
  const validIds = new Set<number>(HESTIA_MATERIAL_REGISTRY_V1.definitions.map((definition) => definition.id));
  for (let index = 0; index < value.length; index += 1) {
    if (!validIds.has(value[index])) {
      issues.push(voxelIssue("InvalidMaterialId", `materialBuffer[${index}]`, `is not defined by ${registry.version}`));
      break;
    }
  }
  return issues.length === 0 ? validVoxelResult() : invalidVoxelResult(issues);
};
