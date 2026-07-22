import {
  MICROVOXEL_BASE_QUANTUM_METERS,
  canonicalAdaptiveJson as adaptiveCanonicalJson,
  deepFreeze,
  hashAdaptiveCanonical as adaptiveHashCanonical,
  requireExactKeys as adaptiveRequireExactKeys,
  requireFinite as adaptiveRequireFinite,
  requirePlainRecord as adaptiveRequirePlainRecord,
  stableAuthorityId as adaptiveStableAuthorityId
} from "../adaptive";
import {
  compareStructuralCellAddresses,
  globalQuantumForStructuralCell,
  validateStructuralCellAddress
} from "./coordinates";
import { serializeStructuralCellAddress } from "./canonical";
import { deriveStructuralComponentClassification } from "./connectivity";
import { getStructuralVoxel, structuralAddressForBrickCell } from "./model";
import {
  STRUCTURAL_COMPONENT_ID_VERSION,
  STRUCTURAL_COMPONENT_SCHEMA_VERSION,
  STRUCTURAL_MASS_ALGORITHM_VERSION,
  STRUCTURAL_MASS_PROPERTIES_SCHEMA_VERSION,
  type StructuralCellAddress,
  type StructuralComponentMassBudgets,
  type StructuralComponent,
  type StructuralInertiaTensor,
  type StructuralMassBudgets,
  type StructuralMassProperties,
  type StructuralObject
} from "./types";
import {
  normalizeAdaptiveAuthorityFunction,
  requireStructuralHash,
  structuralCanonicalString,
  structuralDenseArray,
  structuralFail,
  structuralPositiveBudget,
  structuralRevision
} from "./validation";

const canonicalAdaptiveJson = normalizeAdaptiveAuthorityFunction(adaptiveCanonicalJson);
const hashAdaptiveCanonical = normalizeAdaptiveAuthorityFunction(adaptiveHashCanonical);
const requireExactKeys = normalizeAdaptiveAuthorityFunction(adaptiveRequireExactKeys);
const requireFinite = normalizeAdaptiveAuthorityFunction(adaptiveRequireFinite);
const requirePlainRecord = normalizeAdaptiveAuthorityFunction(adaptiveRequirePlainRecord);
const stableAuthorityId = normalizeAdaptiveAuthorityFunction(adaptiveStableAuthorityId);

export class StructuralMassError extends Error {
  readonly code: "BudgetExceeded" | "InvalidStructuralState";
  readonly path: string;

  constructor(code: "BudgetExceeded" | "InvalidStructuralState", path: string, message: string) {
    super(message);
    this.name = "StructuralMassError";
    this.code = code;
    this.path = path;
  }
}

interface MassCell {
  readonly address: StructuralCellAddress;
  readonly massKg: number;
  readonly center: Readonly<{ x: number; y: number; z: number }>;
  readonly min: Readonly<{ x: number; y: number; z: number }>;
  readonly max: Readonly<{ x: number; y: number; z: number }>;
}

const zeroTensor = (): StructuralInertiaTensor => deepFreeze({ xx: 0, yy: 0, zz: 0, xy: 0, xz: 0, yz: 0 });

const finite = (value: number, path: string): number => requireFinite(value, path);

const canonicalAddresses = (
  object: StructuralObject,
  addresses: readonly StructuralCellAddress[] | null,
  maxVisitedCells: number
): readonly StructuralCellAddress[] => {
  if (addresses === null) {
    const copied: StructuralCellAddress[] = [];
    for (let brickIndex = 0; brickIndex < object.bricks.length; brickIndex += 1) {
      const brick = object.bricks[brickIndex];
      for (let cellIndex = 0; cellIndex < brick.cells.length; cellIndex += 1) {
        if (copied.length >= maxVisitedCells) {
          throw new StructuralMassError("BudgetExceeded", "massBudgets/maxVisitedCells", "Occupied-cell traversal exceeded the explicit mass budget.");
        }
        const cell = brick.cells[cellIndex];
        copied.push(structuralAddressForBrickCell(brick, cell.localIndex));
      }
    }
    return deepFreeze(copied);
  }
  const copied = structuralDenseArray(addresses, "occupiedCells", maxVisitedCells)
    .map((address, index) => validateStructuralCellAddress(address, `occupiedCells/${index}`))
    .sort(compareStructuralCellAddresses);
  for (let index = 1; index < copied.length; index += 1) {
    if (serializeStructuralCellAddress(copied[index - 1]) === serializeStructuralCellAddress(copied[index])) {
      return structuralFail("InvalidContract", "occupiedCells", "Mass input cell addresses must be unique.");
    }
  }
  return deepFreeze(copied);
};

const projectComponentForComparison = (
  value: unknown,
  maxConnectivityCells: number,
  maxConnectivityFacts: number
): StructuralComponent => {
  const record = requirePlainRecord(value, "component");
  requireExactKeys(record, [
    "schemaVersion", "componentIdVersion", "componentId", "objectId", "objectRevision",
    "sourceContentHash", "sourceAdaptiveAuthorityDigest", "occupiedCells", "smallestOccupiedCellKey",
    "activeAnchors", "activeJoints", "anchored", "componentContentHash"
  ], "component");
  if (record.schemaVersion !== STRUCTURAL_COMPONENT_SCHEMA_VERSION || record.componentIdVersion !== STRUCTURAL_COMPONENT_ID_VERSION) {
    return structuralFail("InvalidContract", "component", "Unsupported Structural Component schema or identity version.");
  }
  const occupiedCells = structuralDenseArray(record.occupiedCells, "component/occupiedCells", maxConnectivityCells)
    .map((address, index) => validateStructuralCellAddress(address, `component/occupiedCells/${index}`));
  if (occupiedCells.length === 0) {
    return structuralFail("InvalidContract", "component/occupiedCells", "A Structural Component must contain at least one occupied cell.");
  }
  const smallestOccupiedCellKey = serializeStructuralCellAddress(occupiedCells[0]);
  if (record.smallestOccupiedCellKey !== smallestOccupiedCellKey) {
    return structuralFail("InvalidContract", "component/smallestOccupiedCellKey", "Component smallest-cell identity must match its first canonical occupied cell.");
  }
  const activeAnchors = structuralDenseArray(record.activeAnchors, "component/activeAnchors", maxConnectivityFacts)
    .map((value, index) => {
      const path = `component/activeAnchors/${index}`;
      const fact = requirePlainRecord(value, path);
      requireExactKeys(fact, ["anchorId", "cell"], path);
      return deepFreeze({
        anchorId: stableAuthorityId(fact.anchorId as string, `${path}/anchorId`),
        cell: validateStructuralCellAddress(fact.cell, `${path}/cell`)
      });
    });
  const activeJoints = structuralDenseArray(record.activeJoints, "component/activeJoints", maxConnectivityFacts)
    .map((value, index) => {
      const path = `component/activeJoints/${index}`;
      const fact = requirePlainRecord(value, path);
      requireExactKeys(fact, ["jointId", "endpoint", "cell", "role"], path);
      const endpoint = fact.endpoint;
      if (endpoint !== "A" && endpoint !== "B") {
        return structuralFail("InvalidContract", `${path}/endpoint`, "Active Joint endpoint must be A or B.");
      }
      return deepFreeze({
        jointId: stableAuthorityId(fact.jointId as string, `${path}/jointId`),
        endpoint: endpoint as StructuralComponent["activeJoints"][number]["endpoint"],
        cell: validateStructuralCellAddress(fact.cell, `${path}/cell`),
        role: structuralCanonicalString<string>(fact.role, `${path}/role`)
      });
    });
  if (activeAnchors.length + activeJoints.length > maxConnectivityFacts) {
    return structuralFail("InvalidContract", "component", "Active Component facts exceed the explicit connectivity fact budget.");
  }
  if (typeof record.anchored !== "boolean") {
    return structuralFail("InvalidContract", "component/anchored", "Component anchored must be boolean.");
  }
  return deepFreeze({
    schemaVersion: STRUCTURAL_COMPONENT_SCHEMA_VERSION,
    componentIdVersion: STRUCTURAL_COMPONENT_ID_VERSION,
    componentId: requireStructuralHash(record.componentId, "component/componentId") as StructuralComponent["componentId"],
    objectId: stableAuthorityId(record.objectId as string, "component/objectId"),
    objectRevision: structuralRevision(record.objectRevision, "component/objectRevision"),
    sourceContentHash: requireStructuralHash(record.sourceContentHash, "component/sourceContentHash"),
    sourceAdaptiveAuthorityDigest: requireStructuralHash(record.sourceAdaptiveAuthorityDigest, "component/sourceAdaptiveAuthorityDigest"),
    occupiedCells: deepFreeze(occupiedCells),
    smallestOccupiedCellKey,
    activeAnchors: deepFreeze(activeAnchors),
    activeJoints: deepFreeze(activeJoints),
    anchored: record.anchored,
    componentContentHash: requireStructuralHash(record.componentContentHash, "component/componentContentHash")
  });
};
const derive = (
  object: StructuralObject,
  budgetValue: StructuralMassBudgets,
  addressValues: readonly StructuralCellAddress[] | null
): StructuralMassProperties => {
  const maxVisitedCells = structuralPositiveBudget(budgetValue.maxVisitedCells, "massBudgets/maxVisitedCells");
  const addresses = canonicalAddresses(object, addressValues, maxVisitedCells);
  const materials = new Map(object.materials.map((material) => [material.materialId, material]));
  const side = MICROVOXEL_BASE_QUANTUM_METERS;
  const cellVolume = side * side * side;
  const cells: MassCell[] = [];
  let totalMassKg = 0;
  let weightedX = 0;
  let weightedY = 0;
  let weightedZ = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < addresses.length; index += 1) {
    const address = addresses[index];
    const state = getStructuralVoxel(object, address);
    if (state === undefined || state === null) {
      throw new StructuralMassError("InvalidStructuralState", `occupiedCells/${index}`, "Mass derivation requires currently occupied cells in present bricks.");
    }
    const material = materials.get(state.materialId);
    if (material === undefined) {
      throw new StructuralMassError("InvalidStructuralState", `occupiedCells/${index}/materialId`, "Occupied cell material has no density definition.");
    }
    const massKg = finite(material.densityKgPerCubicMeter * cellVolume, `mass/${index}`);
    if (massKg <= 0) throw new StructuralMassError("InvalidStructuralState", `mass/${index}`, "Occupied cell mass must be positive and finite.");
    const global = globalQuantumForStructuralCell(address);
    const min = deepFreeze({ x: global.x * side, y: global.y * side, z: global.z * side });
    const max = deepFreeze({ x: (global.x + 1) * side, y: (global.y + 1) * side, z: (global.z + 1) * side });
    const center = deepFreeze({ x: (global.x + 0.5) * side, y: (global.y + 0.5) * side, z: (global.z + 0.5) * side });
    for (const [name, value] of Object.entries({ minX: min.x, minY: min.y, minZ: min.z, maxX: max.x, maxY: max.y, maxZ: max.z, centerX: center.x, centerY: center.y, centerZ: center.z })) finite(value, `mass/${index}/${name}`);
    totalMassKg = finite(totalMassKg + massKg, "totalMassKg");
    weightedX = finite(weightedX + massKg * center.x, "weightedCenter/x");
    weightedY = finite(weightedY + massKg * center.y, "weightedCenter/y");
    weightedZ = finite(weightedZ + massKg * center.z, "weightedCenter/z");
    minX = Math.min(minX, min.x);
    minY = Math.min(minY, min.y);
    minZ = Math.min(minZ, min.z);
    maxX = Math.max(maxX, max.x);
    maxY = Math.max(maxY, max.y);
    maxZ = Math.max(maxZ, max.z);
    cells.push(deepFreeze({ address, massKg, center, min, max }));
  }

  if (cells.length === 0) {
    const payload = deepFreeze({
      schemaVersion: STRUCTURAL_MASS_PROPERTIES_SCHEMA_VERSION,
      algorithmVersion: STRUCTURAL_MASS_ALGORITHM_VERSION,
      totalMassKg: 0,
      centerOfMassMeters: null,
      boundsMeters: null,
      inertiaTensorKgMetersSquared: zeroTensor(),
      occupiedVoxelCount: 0,
      sourceRevision: object.objectRevision,
      sourceContentHash: object.contentHash
    });
    return deepFreeze({ ...payload, contentHash: hashAdaptiveCanonical(payload) });
  }

  if (!(totalMassKg > 0) || !Number.isFinite(totalMassKg)) {
    throw new StructuralMassError("InvalidStructuralState", "totalMassKg", "Nonempty mass input requires positive finite total mass.");
  }
  const centerOfMassMeters = deepFreeze({
    x: finite(weightedX / totalMassKg, "centerOfMassMeters/x"),
    y: finite(weightedY / totalMassKg, "centerOfMassMeters/y"),
    z: finite(weightedZ / totalMassKg, "centerOfMassMeters/z")
  });
  const boundsMeters = deepFreeze({
    min: deepFreeze({ x: minX, y: minY, z: minZ }),
    max: deepFreeze({ x: maxX, y: maxY, z: maxZ })
  });
  if (
    centerOfMassMeters.x < minX || centerOfMassMeters.x > maxX ||
    centerOfMassMeters.y < minY || centerOfMassMeters.y > maxY ||
    centerOfMassMeters.z < minZ || centerOfMassMeters.z > maxZ
  ) throw new StructuralMassError("InvalidStructuralState", "centerOfMassMeters", "Center of mass lies outside occupied-cell bounds.");

  let xx = 0;
  let yy = 0;
  let zz = 0;
  let xy = 0;
  let xz = 0;
  let yz = 0;
  for (const cell of cells) {
    const dx = cell.center.x - centerOfMassMeters.x;
    const dy = cell.center.y - centerOfMassMeters.y;
    const dz = cell.center.z - centerOfMassMeters.z;
    const cube = cell.massKg * side * side / 6;
    xx += cube + cell.massKg * (dy * dy + dz * dz);
    yy += cube + cell.massKg * (dx * dx + dz * dz);
    zz += cube + cell.massKg * (dx * dx + dy * dy);
    xy -= cell.massKg * dx * dy;
    xz -= cell.massKg * dx * dz;
    yz -= cell.massKg * dy * dz;
  }
  const inertiaTensorKgMetersSquared = deepFreeze({
    xx: finite(xx, "inertiaTensor/xx"),
    yy: finite(yy, "inertiaTensor/yy"),
    zz: finite(zz, "inertiaTensor/zz"),
    xy: finite(xy, "inertiaTensor/xy"),
    xz: finite(xz, "inertiaTensor/xz"),
    yz: finite(yz, "inertiaTensor/yz")
  });
  if (xx < 0 || yy < 0 || zz < 0) {
    throw new StructuralMassError("InvalidStructuralState", "inertiaTensor", "Inertia diagonal values must be non-negative.");
  }
  const payload = deepFreeze({
    schemaVersion: STRUCTURAL_MASS_PROPERTIES_SCHEMA_VERSION,
    algorithmVersion: STRUCTURAL_MASS_ALGORITHM_VERSION,
    totalMassKg,
    centerOfMassMeters,
    boundsMeters,
    inertiaTensorKgMetersSquared,
    occupiedVoxelCount: cells.length,
    sourceRevision: object.objectRevision,
    sourceContentHash: object.contentHash
  });
  return deepFreeze({ ...payload, contentHash: hashAdaptiveCanonical(payload) });
};

export const deriveStructuralObjectMassProperties = (
  object: StructuralObject,
  budgets: StructuralMassBudgets
): StructuralMassProperties => derive(object, budgets, null);

export const deriveStructuralComponentMassProperties = (
  object: StructuralObject,
  component: StructuralComponent,
  budgets: StructuralComponentMassBudgets
): StructuralMassProperties => {
  const maxConnectivityCells = structuralPositiveBudget(budgets.maxConnectivityCells, "componentMassBudgets/maxConnectivityCells");
  const maxComponents = structuralPositiveBudget(budgets.maxComponents, "componentMassBudgets/maxComponents");
  const maxConnectivityFacts = structuralPositiveBudget(budgets.maxConnectivityFacts, "componentMassBudgets/maxConnectivityFacts");
  const projectedComponent = projectComponentForComparison(component, maxConnectivityCells, maxConnectivityFacts);
  const classification = deriveStructuralComponentClassification(object, {
    maxVisitedCells: maxConnectivityCells,
    maxComponents,
    maxIndexedFacts: maxConnectivityFacts
  });
  const expected = classification.components.find((entry) => entry.componentId === projectedComponent.componentId);
  if (expected === undefined || canonicalAdaptiveJson(expected) !== canonicalAdaptiveJson(projectedComponent)) {
    throw new StructuralMassError(
      "InvalidStructuralState",
      "component",
      "Component ID, membership, content, object revision, and Adaptive authority binding must match a freshly derived canonical Component."
    );
  }
  return derive(object, budgets, expected.occupiedCells);
};
