import {
  MICROVOXEL_BASE_QUANTUM_METERS,
  deepFreeze,
  hashAdaptiveCanonical as adaptiveHashCanonical,
  requireFinite as adaptiveRequireFinite
} from "../adaptive";
import {
  compareStructuralCellAddresses,
  globalQuantumForStructuralCell,
  validateStructuralCellAddress
} from "./coordinates";
import { serializeStructuralCellAddress } from "./canonical";
import { getStructuralVoxel, structuralAddressForBrickCell } from "./model";
import {
  STRUCTURAL_MASS_ALGORITHM_VERSION,
  STRUCTURAL_MASS_PROPERTIES_SCHEMA_VERSION,
  type StructuralCellAddress,
  type StructuralComponent,
  type StructuralInertiaTensor,
  type StructuralMassBudgets,
  type StructuralMassProperties,
  type StructuralObject
} from "./types";
import { normalizeAdaptiveAuthorityFunction, structuralFail, structuralPositiveBudget } from "./validation";

const hashAdaptiveCanonical = normalizeAdaptiveAuthorityFunction(adaptiveHashCanonical);
const requireFinite = normalizeAdaptiveAuthorityFunction(adaptiveRequireFinite);

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
  addresses: readonly StructuralCellAddress[] | null
): readonly StructuralCellAddress[] => {
  if (addresses === null) {
    return deepFreeze(object.bricks.flatMap((brick) => brick.cells.map((cell) => structuralAddressForBrickCell(brick, cell.localIndex))));
  }
  const copied = addresses.map((address, index) => validateStructuralCellAddress(address, `occupiedCells/${index}`))
    .sort(compareStructuralCellAddresses);
  for (let index = 1; index < copied.length; index += 1) {
    if (serializeStructuralCellAddress(copied[index - 1]) === serializeStructuralCellAddress(copied[index])) {
      return structuralFail("InvalidContract", "occupiedCells", "Mass input cell addresses must be unique.");
    }
  }
  return deepFreeze(copied);
};

const derive = (
  object: StructuralObject,
  budgetValue: StructuralMassBudgets,
  addressValues: readonly StructuralCellAddress[] | null
): StructuralMassProperties => {
  const maxVisitedCells = structuralPositiveBudget(budgetValue.maxVisitedCells, "massBudgets/maxVisitedCells");
  const addresses = canonicalAddresses(object, addressValues);
  if (addresses.length > maxVisitedCells) {
    throw new StructuralMassError("BudgetExceeded", "massBudgets/maxVisitedCells", "Occupied-cell traversal exceeded the explicit mass budget.");
  }
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
  budgets: StructuralMassBudgets
): StructuralMassProperties => {
  if (component.objectId !== object.objectId || component.objectRevision !== object.objectRevision) {
    throw new StructuralMassError("InvalidStructuralState", "component", "Component identity and revision must match the Structural object.");
  }
  return derive(object, budgets, component.occupiedCells);
};
