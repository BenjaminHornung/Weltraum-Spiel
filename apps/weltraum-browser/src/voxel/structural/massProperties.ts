import {
  MICROVOXEL_BASE_QUANTUM_METERS,
  canonicalAdaptiveJson as adaptiveCanonicalJson,
  deepFreeze,
  hashAdaptiveCanonical as adaptiveHashCanonical,
  requireExactKeys as adaptiveRequireExactKeys,
  requireFinite as adaptiveRequireFinite,
  requirePlainRecord as adaptiveRequirePlainRecord,
  serializeAdaptiveKey,
  stableAuthorityId as adaptiveStableAuthorityId
} from "../adaptive";
import {
  compareStructuralCellAddresses,
  globalQuantumForStructuralCell,
  validateStructuralCellAddress
} from "./coordinates";
import { serializeStructuralCellAddress } from "./canonical";
import {
  deriveStructuralComponentClassification,
  isStructuralCanonicalComponentMembership
} from "./connectivity";
import { structuralAddressForBrickCell } from "./model";
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
  type StructuralObject,
  type StructuralVoxelState
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
  readonly massKg: number;
  readonly center: Readonly<{ x: number; y: number; z: number }>;
}

interface MassInputCell {
  readonly address: StructuralCellAddress;
  readonly state: StructuralVoxelState;
  readonly global: Readonly<{ x: number; y: number; z: number }>;
  readonly cellIdentity: string;
}

interface CachedStructuralMassProperties {
  readonly massProperties: StructuralMassProperties;
  readonly inputsByCellIdentity: ReadonlyMap<string, MassInputCell>;
  readonly inputsByGlobalIdentity: ReadonlyMap<string, MassInputCell>;
}

const zeroTensor = (): StructuralInertiaTensor => deepFreeze({ xx: 0, yy: 0, zz: 0, xy: 0, xz: 0, yz: 0 });

const finite = (value: number, path: string): number => requireFinite(value, path);
const massPropertiesByObject = new WeakMap<StructuralObject, CachedStructuralMassProperties>();
const massInputIdentity = (brickKey: string, localIndex: number): string =>
  brickKey + "/" + localIndex;

const occupiedVoxelCount = (object: StructuralObject): number =>
  object.bricks.reduce((count, brick) => count + brick.cells.length, 0);

const cacheStructuralObjectMassProperties = (
  object: StructuralObject,
  massProperties: StructuralMassProperties,
  inputs: readonly MassInputCell[]
): void => {
  if (!Object.isFrozen(object) || !Object.isFrozen(massProperties)) {
    throw new TypeError("Cached Structural mass properties require immutable object identity and properties.");
  }
  if (
    massProperties.sourceRevision !== object.objectRevision
    || massProperties.sourceContentHash !== object.contentHash
    || massProperties.occupiedVoxelCount !== occupiedVoxelCount(object)
    || inputs.length !== massProperties.occupiedVoxelCount
  ) {
    throw new TypeError("Cached Structural mass properties do not bind the immutable object identity.");
  }
  const inputsByCellIdentity = new Map<string, MassInputCell>();
  const inputsByGlobalIdentity = new Map<string, MassInputCell>();
  for (const input of inputs) {
    const globalIdentity = `${input.global.x}:${input.global.y}:${input.global.z}`;
    if (
      input.cellIdentity.length === 0
      || inputsByCellIdentity.has(input.cellIdentity)
      || inputsByGlobalIdentity.has(globalIdentity)
    ) {
      throw new TypeError("Cached Structural mass inputs require unique immutable cell identities.");
    }
    inputsByCellIdentity.set(input.cellIdentity, input);
    inputsByGlobalIdentity.set(globalIdentity, input);
  }
  massPropertiesByObject.set(object, { massProperties, inputsByCellIdentity, inputsByGlobalIdentity });
};

const occupiedAddressKey = (address: StructuralCellAddress): string => {
  const global = globalQuantumForStructuralCell(address);
  return global.x + ":" + global.y + ":" + global.z;
};

const canonicalAddresses = (
  object: StructuralObject,
  addresses: readonly StructuralCellAddress[] | null,
  maxVisitedCells: number,
  trustedCanonical: boolean
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
  if (trustedCanonical) {
    if (!isStructuralCanonicalComponentMembership(object, addresses)) {
      throw new StructuralMassError(
        "InvalidStructuralState",
        "occupiedCells",
        "Trusted canonical mass input must use identity-bound Structural Component membership from the current object."
      );
    }
    if (addresses.length > maxVisitedCells) {
      throw new StructuralMassError(
        "BudgetExceeded",
        "massBudgets/maxVisitedCells",
        "Occupied-cell traversal exceeded the explicit mass budget."
      );
    }
    return addresses;
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
  addressValues: readonly StructuralCellAddress[] | null,
  trustedCanonical = false,
  reusedInputs: readonly MassInputCell[] | null = null
): StructuralMassProperties => {
  const maxVisitedCells = structuralPositiveBudget(budgetValue.maxVisitedCells, "massBudgets/maxVisitedCells");
  if (addressValues === null && reusedInputs === null) {
    const cached = massPropertiesByObject.get(object);
    if (cached !== undefined) {
      if (cached.massProperties.occupiedVoxelCount > maxVisitedCells) {
        throw new StructuralMassError(
          "BudgetExceeded",
          "massBudgets/maxVisitedCells",
          "Occupied-cell traversal exceeded the explicit mass budget."
        );
      }
      return cached.massProperties;
    }
  }
  const addresses = addressValues === null
    ? null
    : canonicalAddresses(object, addressValues, maxVisitedCells, trustedCanonical);
  const materials = new Map(object.materials.map((material) => [material.materialId, material]));
  const trustedInputs = addresses !== null && trustedCanonical
    ? (() => {
        const cached = massPropertiesByObject.get(object);
        if (cached === undefined) return null;
        return addresses.map((address, index) => {
          const globalIdentity = [
            address.brickKey.originQuantum.x + address.local.x,
            address.brickKey.originQuantum.y + address.local.y,
            address.brickKey.originQuantum.z + address.local.z
          ].join(":");
          const input = cached.inputsByGlobalIdentity.get(globalIdentity);
          if (input === undefined) {
            throw new StructuralMassError(
              "InvalidStructuralState",
              `occupiedCells/${index}`,
              "Canonical Component membership is absent from current cached Structural mass inputs."
            );
          }
          return input;
        });
      })()
    : null;
  const inputs: MassInputCell[] = reusedInputs !== null
    ? [...reusedInputs]
    : trustedInputs !== null
      ? [...trustedInputs]
      : [];
  const statesByAddress = addresses === null || trustedInputs !== null
    ? null
    : new Map<string, StructuralVoxelState>();
  const seenObjectAddresses = addresses === null ? new Set<string>() : null;
  let visitedStateCells = 0;
  if (reusedInputs === null && trustedInputs === null) {
    for (let brickIndex = 0; brickIndex < object.bricks.length; brickIndex += 1) {
      const brick = object.bricks[brickIndex];
      const brickKey = serializeAdaptiveKey(brick.key);
      for (let cellIndex = 0; cellIndex < brick.cells.length; cellIndex += 1) {
        if (visitedStateCells >= maxVisitedCells) {
          throw new StructuralMassError(
            "BudgetExceeded",
            "massBudgets/maxVisitedCells",
            "Occupied-cell traversal exceeded the explicit mass budget."
          );
        }
        const cell = brick.cells[cellIndex];
        visitedStateCells += 1;
        const address = structuralAddressForBrickCell(brick, cell.localIndex);
        const addressKey = occupiedAddressKey(address);
        const addressAlreadySeen = statesByAddress === null
          ? seenObjectAddresses!.has(addressKey)
          : statesByAddress.has(addressKey);
        if (addressAlreadySeen) {
          throw new StructuralMassError(
            "InvalidStructuralState",
            "object/bricks/cells",
            "Mass derivation requires unique occupied-cell addresses."
          );
        }
        if (statesByAddress === null) {
          seenObjectAddresses!.add(addressKey);
          inputs.push({
            address,
            state: cell.state,
            global: globalQuantumForStructuralCell(address),
            cellIdentity: massInputIdentity(brickKey, cell.localIndex)
          });
        } else {
          statesByAddress.set(addressKey, cell.state);
        }
      }
    }
  }
  if (addresses !== null && statesByAddress !== null) {
    for (let index = 0; index < addresses.length; index += 1) {
      const address = addresses[index];
      const state = statesByAddress.get(occupiedAddressKey(address));
      if (state === undefined) {
        throw new StructuralMassError(
          "InvalidStructuralState",
          `occupiedCells/${index}`,
          "Mass derivation requires currently occupied cells in present bricks."
        );
      }
      inputs.push({
        address,
        state,
        global: globalQuantumForStructuralCell(address),
        cellIdentity: ""
      });
    }
  }
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

  for (let index = 0; index < inputs.length; index += 1) {
    const { state, global } = inputs[index];
    const material = materials.get(state.materialId);
    if (material === undefined) {
      throw new StructuralMassError("InvalidStructuralState", `occupiedCells/${index}/materialId`, "Occupied cell material has no density definition.");
    }
    const massKg = finite(material.densityKgPerCubicMeter * cellVolume, `mass/${index}`);
    if (massKg <= 0) throw new StructuralMassError("InvalidStructuralState", `mass/${index}`, "Occupied cell mass must be positive and finite.");
    const cellMinX = global.x * side;
    const cellMinY = global.y * side;
    const cellMinZ = global.z * side;
    const cellMaxX = (global.x + 1) * side;
    const cellMaxY = (global.y + 1) * side;
    const cellMaxZ = (global.z + 1) * side;
    const center = {
      x: (global.x + 0.5) * side,
      y: (global.y + 0.5) * side,
      z: (global.z + 0.5) * side
    };
    finite(cellMinX, `mass/${index}/minX`);
    finite(cellMinY, `mass/${index}/minY`);
    finite(cellMinZ, `mass/${index}/minZ`);
    finite(cellMaxX, `mass/${index}/maxX`);
    finite(cellMaxY, `mass/${index}/maxY`);
    finite(cellMaxZ, `mass/${index}/maxZ`);
    finite(center.x, `mass/${index}/centerX`);
    finite(center.y, `mass/${index}/centerY`);
    finite(center.z, `mass/${index}/centerZ`);
    totalMassKg = finite(totalMassKg + massKg, "totalMassKg");
    weightedX = finite(weightedX + massKg * center.x, "weightedCenter/x");
    weightedY = finite(weightedY + massKg * center.y, "weightedCenter/y");
    weightedZ = finite(weightedZ + massKg * center.z, "weightedCenter/z");
    minX = Math.min(minX, cellMinX);
    minY = Math.min(minY, cellMinY);
    minZ = Math.min(minZ, cellMinZ);
    maxX = Math.max(maxX, cellMaxX);
    maxY = Math.max(maxY, cellMaxY);
    maxZ = Math.max(maxZ, cellMaxZ);
    cells.push({ massKg, center });
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
    const result = deepFreeze({ ...payload, contentHash: hashAdaptiveCanonical(payload) });
    if (addressValues === null && Object.isFrozen(object)) {
      cacheStructuralObjectMassProperties(object, result, inputs);
    }
    return result;
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
  const result = deepFreeze({ ...payload, contentHash: hashAdaptiveCanonical(payload) });
  if (addressValues === null && Object.isFrozen(object)) {
    cacheStructuralObjectMassProperties(object, result, inputs);
  }
  return result;
};

export const deriveStructuralObjectMassProperties = (
  object: StructuralObject,
  budgets: StructuralMassBudgets
): StructuralMassProperties => derive(object, budgets, null);

const deriveStructuralObjectMassPropertiesFromPreviousObject = (
  previous: StructuralObject,
  object: StructuralObject,
  budgets: StructuralMassBudgets
): StructuralMassProperties => {
  const maxVisitedCells = structuralPositiveBudget(budgets.maxVisitedCells, "massBudgets/maxVisitedCells");
  const previousCached = massPropertiesByObject.get(previous);
  if (
    previousCached === undefined
    || !Object.isFrozen(previous)
    || !Object.isFrozen(object)
    || previous.objectId !== object.objectId
    || previous.frame !== object.frame
    || previous.source !== object.source
    || previous.materials !== object.materials
    || previous.bricks.length !== object.bricks.length
  ) return derive(object, budgets, null);
  const reused: MassInputCell[] = [];
  const seen = new Set<string>();
  for (let brickIndex = 0; brickIndex < object.bricks.length; brickIndex += 1) {
    const brick = object.bricks[brickIndex];
    const brickKey = serializeAdaptiveKey(brick.key);
    if (brickKey !== serializeAdaptiveKey(previous.bricks[brickIndex].key)) {
      return derive(object, budgets, null);
    }
    for (const cell of brick.cells) {
      if (reused.length >= maxVisitedCells) {
        throw new StructuralMassError(
          "BudgetExceeded",
          "massBudgets/maxVisitedCells",
          "Occupied-cell traversal exceeded the explicit mass budget."
        );
      }
      const cellIdentity = massInputIdentity(brickKey, cell.localIndex);
      const input = previousCached.inputsByCellIdentity.get(cellIdentity);
      if (input === undefined || input.state !== cell.state || seen.has(cellIdentity)) {
        return derive(object, budgets, null);
      }
      seen.add(cellIdentity);
      reused.push(input);
    }
  }
  return derive(object, budgets, null, false, reused);
};

export const deriveStructuralOccupiedCellMassProperties = (
  object: StructuralObject,
  occupiedCells: readonly StructuralCellAddress[],
  budgets: StructuralMassBudgets
): StructuralMassProperties => derive(object, budgets, occupiedCells);

export const deriveStructuralCanonicalOccupiedCellMassProperties = (
  object: StructuralObject,
  occupiedCells: readonly StructuralCellAddress[],
  budgets: StructuralMassBudgets
): StructuralMassProperties => derive(object, budgets, occupiedCells, true);

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

export default deriveStructuralObjectMassPropertiesFromPreviousObject;
