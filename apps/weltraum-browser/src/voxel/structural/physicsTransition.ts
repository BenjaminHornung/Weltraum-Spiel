import {
  MICROVOXEL_BASE_QUANTUM_METERS,
  canonicalAdaptiveJson as adaptiveCanonicalJson,
  deepFreeze,
  hashAdaptiveCanonical as adaptiveHashCanonical,
  requireExactKeys as adaptiveRequireExactKeys,
  requireFinite as adaptiveRequireFinite,
  requirePlainRecord as adaptiveRequirePlainRecord,
  type MeterPoint
} from "../adaptive";
import { globalQuantumForStructuralCell } from "./coordinates";
import {
  hashStructuralFragmentContent,
  hashStructuralFragmentId,
  serializeStructuralCellAddress
} from "./canonical";
import { deriveStructuralComponentMassProperties, deriveStructuralObjectMassProperties } from "./massProperties";
import { structuralAddressForBrickCell } from "./model";
import type {
  StructuralComponent,
  StructuralComponentClassification,
  StructuralComponentId,
  StructuralComponentMassBudgets,
  StructuralFragment,
  StructuralFragmentId,
  StructuralInertiaTensor,
  StructuralObject
} from "./types";
import { normalizeAdaptiveAuthorityFunction, structuralFail, structuralPositiveBudget } from "./validation";

const canonicalAdaptiveJson = normalizeAdaptiveAuthorityFunction(adaptiveCanonicalJson);
const hashAdaptiveCanonical = normalizeAdaptiveAuthorityFunction(adaptiveHashCanonical);
const requireExactKeys = normalizeAdaptiveAuthorityFunction(adaptiveRequireExactKeys);
const requireFinite = normalizeAdaptiveAuthorityFunction(adaptiveRequireFinite);
const requirePlainRecord = normalizeAdaptiveAuthorityFunction(adaptiveRequirePlainRecord);

export const STRUCTURAL_PHYSICS_TRANSITION_SCHEMA_VERSION = "structural-microvoxel-physics-transition-v1" as const;
export const STRUCTURAL_PHYSICS_TRANSITION_FALLBACK_KIND =
  "merge-excess-fragments-into-single-debris-body" as const;

export class StructuralPhysicsTransitionError extends Error {
  readonly code: "BudgetExceeded" | "InvalidStructuralState";
  readonly path: string;

  constructor(code: "BudgetExceeded" | "InvalidStructuralState", path: string, message: string) {
    super(message);
    this.name = "StructuralPhysicsTransitionError";
    this.code = code;
    this.path = path;
  }
}

const fail = (
  code: "BudgetExceeded" | "InvalidStructuralState",
  path: string,
  message: string
): never => {
  throw new StructuralPhysicsTransitionError(code, path, message);
};

export interface StructuralPhysicsTransitionBudgets {
  readonly maxFragments: number;
  readonly maxCollidersPerFragment: number;
  readonly maxVoxelsPerFragment: number;
}

export interface StructuralBodyMotion {
  readonly velocityMetersPerSecond: MeterPoint;
  readonly angularVelocityRadPerSecond: MeterPoint;
}

export interface StructuralColliderBoxMeters {
  readonly minMeters: MeterPoint;
  readonly maxMeters: MeterPoint;
}

export interface StructuralFragmentBodyPlan {
  readonly fragmentId: StructuralFragmentId;
  readonly componentId: StructuralComponentId;
  readonly occupiedVoxelCount: number;
  readonly massKg: number;
  readonly centerOfMassMeters: MeterPoint;
  readonly inertiaTensorKgMetersSquared: StructuralInertiaTensor;
  readonly initialVelocityMetersPerSecond: MeterPoint;
  readonly voxelColliders: readonly StructuralColliderBoxMeters[];
  readonly greedyColliders: readonly StructuralColliderBoxMeters[];
}

export interface StructuralDebrisBodyPlan {
  readonly debrisBodyId: string;
  readonly mergedFragmentIds: readonly StructuralFragmentId[];
  readonly occupiedVoxelCount: number;
  readonly massKg: number;
  readonly centerOfMassMeters: MeterPoint;
  readonly inertiaTensorKgMetersSquared: StructuralInertiaTensor;
  readonly initialVelocityMetersPerSecond: MeterPoint;
  readonly voxelColliders: readonly StructuralColliderBoxMeters[];
  readonly greedyColliders: readonly StructuralColliderBoxMeters[];
  readonly exceedsColliderBudget: boolean;
}

export interface StructuralOccupancyProof {
  readonly totalOccupiedVoxels: number;
  readonly anchoredVoxels: number;
  readonly fragmentVoxels: number;
  readonly disjoint: true;
  readonly complete: true;
}

export type StructuralParentMotionSource = "explicit" | "live-parent-body";

interface StructuralTransitionPlanBase {
  readonly schemaVersion: typeof STRUCTURAL_PHYSICS_TRANSITION_SCHEMA_VERSION;
  readonly objectId: StructuralObject["objectId"];
  readonly objectRevision: StructuralObject["objectRevision"];
  readonly sourceContentHash: string;
  readonly parentMotion: StructuralBodyMotion;
  readonly parentMotionSource: StructuralParentMotionSource;
  readonly dynamicBodies: readonly StructuralFragmentBodyPlan[];
  readonly dynamicFragmentIds: readonly StructuralFragmentId[];
  readonly occupancyProof: StructuralOccupancyProof;
  readonly contentHash: string;
}

export interface StructuralInstalledPhysicsTransition extends StructuralTransitionPlanBase {
  readonly status: "Installed";
}

export interface StructuralFallbackPhysicsTransition extends StructuralTransitionPlanBase {
  readonly status: "Fallback";
  readonly fallbackKind: typeof STRUCTURAL_PHYSICS_TRANSITION_FALLBACK_KIND;
  readonly debris: StructuralDebrisBodyPlan;
  readonly mergedDebrisFragmentIds: readonly StructuralFragmentId[];
}

export type StructuralPhysicsTransitionResult =
  | StructuralInstalledPhysicsTransition
  | StructuralFallbackPhysicsTransition;

const validateBudgets = (value: StructuralPhysicsTransitionBudgets): StructuralPhysicsTransitionBudgets =>
  deepFreeze({
    maxFragments: structuralPositiveBudget(value.maxFragments, "transitionBudgets/maxFragments"),
    maxCollidersPerFragment: structuralPositiveBudget(
      value.maxCollidersPerFragment,
      "transitionBudgets/maxCollidersPerFragment"
    ),
    maxVoxelsPerFragment: structuralPositiveBudget(
      value.maxVoxelsPerFragment,
      "transitionBudgets/maxVoxelsPerFragment"
    )
  });

const finiteNumber = (value: unknown, path: string): number => {
  if (typeof value !== "number") {
    return structuralFail("InvalidContract", path, "Expected a finite number.");
  }
  return requireFinite(value, path);
};

const validateVector = (value: unknown, path: string): MeterPoint => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["x", "y", "z"], path);
  return deepFreeze({
    x: finiteNumber(record.x, `${path}/x`),
    y: finiteNumber(record.y, `${path}/y`),
    z: finiteNumber(record.z, `${path}/z`)
  });
};

const validateMotion = (value: StructuralBodyMotion): StructuralBodyMotion => {
  const record = requirePlainRecord(value, "parentMotion");
  requireExactKeys(record, ["velocityMetersPerSecond", "angularVelocityRadPerSecond"], "parentMotion");
  return deepFreeze({
    velocityMetersPerSecond: validateVector(record.velocityMetersPerSecond, "parentMotion/velocityMetersPerSecond"),
    angularVelocityRadPerSecond: validateVector(
      record.angularVelocityRadPerSecond,
      "parentMotion/angularVelocityRadPerSecond"
    )
  });
};

/**
 * Split-Geschwindigkeitsregel: v_f = v + omega x (c_f - c).
 * Impulsfreier Split — das Fragment erbt die Starrkoerpergeschwindigkeit des
 * Elternkoerpers an seinem eigenen Schwerpunkt, es wird kein Impuls gesetzt.
 */
export const deriveStructuralSplitVelocity = (
  motionValue: StructuralBodyMotion,
  parentCenterValue: MeterPoint,
  fragmentCenterValue: MeterPoint
): MeterPoint => {
  const motion = validateMotion(motionValue);
  const parent = validateVector(parentCenterValue, "parentCenterMeters");
  const fragment = validateVector(fragmentCenterValue, "fragmentCenterMeters");
  const rx = requireFinite(fragment.x - parent.x, "splitVelocity/rx");
  const ry = requireFinite(fragment.y - parent.y, "splitVelocity/ry");
  const rz = requireFinite(fragment.z - parent.z, "splitVelocity/rz");
  const omega = motion.angularVelocityRadPerSecond;
  const velocity = motion.velocityMetersPerSecond;
  return deepFreeze({
    x: requireFinite(velocity.x + (omega.y * rz - omega.z * ry), "splitVelocity/x"),
    y: requireFinite(velocity.y + (omega.z * rx - omega.x * rz), "splitVelocity/y"),
    z: requireFinite(velocity.z + (omega.x * ry - omega.y * rx), "splitVelocity/z")
  });
};

interface QuantumBox {
  readonly min: Readonly<{ x: number; y: number; z: number }>;
  readonly max: Readonly<{ x: number; y: number; z: number }>;
}

const quantumKey = (x: number, y: number, z: number): string => `${x},${y},${z}`;

/**
 * Deterministischer Greedy-Cuboid-Merge ueber einer Fragmentzellmenge.
 * Seed ist immer die kleinste freie Zelle (x, y, z); Expansion x, dann y,
 * dann z. Abdeckung wird per Zellvolumen gegen die Eingabemenge geprueft.
 */
const mergeGreedyQuantumBoxes = (
  cells: readonly (Readonly<{ x: number; y: number; z: number }>)[],
  path: string
): readonly QuantumBox[] => {
  const remaining = new Map<string, Readonly<{ x: number; y: number; z: number }>>();
  for (const cell of cells) {
    if (!Number.isSafeInteger(cell.x) || !Number.isSafeInteger(cell.y) || !Number.isSafeInteger(cell.z)) {
      return structuralFail("InvalidContract", path, "Greedy merge requires safe-integer quantum cells.");
    }
    const key = quantumKey(cell.x, cell.y, cell.z);
    if (remaining.has(key)) {
      return structuralFail("InvalidContract", path, "Greedy merge requires unique quantum cells.");
    }
    remaining.set(key, cell);
  }
  const boxes: QuantumBox[] = [];
  while (remaining.size > 0) {
    const seed = [...remaining.values()].sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z)[0];
    let maxX = seed.x;
    while (remaining.has(quantumKey(maxX + 1, seed.y, seed.z))) maxX += 1;
    let maxY = seed.y;
    let rowComplete = true;
    while (rowComplete) {
      for (let x = seed.x; x <= maxX; x += 1) {
        if (!remaining.has(quantumKey(x, maxY + 1, seed.z))) {
          rowComplete = false;
          break;
        }
      }
      if (rowComplete) maxY += 1;
    }
    let maxZ = seed.z;
    let slabComplete = true;
    while (slabComplete) {
      for (let y = seed.y; y <= maxY; y += 1) {
        for (let x = seed.x; x <= maxX; x += 1) {
          if (!remaining.has(quantumKey(x, y, maxZ + 1))) {
            slabComplete = false;
            break;
          }
        }
        if (!slabComplete) break;
      }
      if (slabComplete) maxZ += 1;
    }
    for (let z = seed.z; z <= maxZ; z += 1) {
      for (let y = seed.y; y <= maxY; y += 1) {
        for (let x = seed.x; x <= maxX; x += 1) {
          remaining.delete(quantumKey(x, y, z));
        }
      }
    }
    boxes.push(deepFreeze({
      min: deepFreeze({ x: seed.x, y: seed.y, z: seed.z }),
      max: deepFreeze({ x: maxX + 1, y: maxY + 1, z: maxZ + 1 })
    }));
  }
  let covered = 0;
  for (const box of boxes) {
    covered += (box.max.x - box.min.x) * (box.max.y - box.min.y) * (box.max.z - box.min.z);
  }
  if (covered !== cells.length) {
    return structuralFail("InvalidContract", path, "Greedy merge coverage must equal the fragment cell count.");
  }
  boxes.sort((a, b) => a.min.z - b.min.z || a.min.y - b.min.y || a.min.x - b.min.x);
  return deepFreeze(boxes);
};

const toMetersBox = (box: QuantumBox): StructuralColliderBoxMeters => {
  const side = MICROVOXEL_BASE_QUANTUM_METERS;
  const minMeters = deepFreeze({ x: box.min.x * side, y: box.min.y * side, z: box.min.z * side });
  const maxMeters = deepFreeze({ x: box.max.x * side, y: box.max.y * side, z: box.max.z * side });
  for (const value of [minMeters.x, minMeters.y, minMeters.z, maxMeters.x, maxMeters.y, maxMeters.z]) {
    requireFinite(value, "colliderBoxMeters");
  }
  return deepFreeze({ minMeters, maxMeters });
};

interface FragmentWork {
  readonly fragment: StructuralFragment;
  readonly component: StructuralComponent;
  readonly massKg: number;
  readonly center: MeterPoint;
  readonly tensor: StructuralInertiaTensor;
  readonly velocity: MeterPoint;
  readonly voxelColliders: readonly StructuralColliderBoxMeters[];
  readonly greedyColliders: readonly StructuralColliderBoxMeters[];
  readonly voxelCount: number;
}

export const deriveStructuralPhysicsTransition = (
  object: StructuralObject,
  classification: StructuralComponentClassification,
  parentMotionValue: StructuralBodyMotion,
  budgetValue: StructuralPhysicsTransitionBudgets,
  massBudgets: StructuralComponentMassBudgets,
  parentMotionSourceValue: StructuralParentMotionSource = "explicit"
): StructuralPhysicsTransitionResult => {
  const budgets = validateBudgets(budgetValue);
  const parentMotion = validateMotion(parentMotionValue);
  const parentMotionSource: StructuralParentMotionSource =
    parentMotionSourceValue === "explicit" || parentMotionSourceValue === "live-parent-body"
      ? parentMotionSourceValue
      : fail("InvalidStructuralState", "parentMotionSource", "Parent motion source must be explicit or live-parent-body.");
  if (classification.fragments.length !== classification.detachedComponents.length) {
    fail("InvalidStructuralState", "classification", "Fragment count must match detached-component count.");
  }
  const objectMass = deriveStructuralObjectMassProperties(object, { maxVisitedCells: massBudgets.maxVisitedCells });
  if (objectMass.centerOfMassMeters === null) {
    fail("InvalidStructuralState", "objectMass", "Physics transition requires a nonempty object with finite center of mass.");
  }
  const parentCenter = objectMass.centerOfMassMeters as MeterPoint;

  const works: FragmentWork[] = classification.fragments.map((fragment, index) => {
    const path = `fragments/${index}`;
    const component = classification.detachedComponents.find((entry) => entry.componentId === fragment.componentId);
    if (component === undefined) {
      fail("InvalidStructuralState", path, "Fragment has no matching detached component.");
    }
    // P1: Fragment und Component an dieselbe Objektversion binden.
    // Veraltete (stale) Klassifikationen gegen ein neueres Objekt werden hier
    // abgewiesen, bevor irgendeine Masseneigenschaft oder ein Collider entsteht.
    const boundComponent = component as StructuralComponent;
    if (
      fragment.objectId !== object.objectId ||
      fragment.objectRevision !== object.objectRevision ||
      fragment.sourceContentHash !== object.contentHash ||
      boundComponent.objectId !== object.objectId ||
      boundComponent.objectRevision !== object.objectRevision ||
      boundComponent.sourceContentHash !== object.contentHash ||
      fragment.sourceAdaptiveAuthorityDigest !== boundComponent.sourceAdaptiveAuthorityDigest
    ) {
      fail("InvalidStructuralState", path, "Fragment and component must bind the same object version and content hash.");
    }
    // P1: exakte Zellmengenbindung Fragment <-> Component (keine verschobenen Zellen).
    const fragmentCellKeys = fragment.occupiedCells.map((address) => serializeStructuralCellAddress(address)).sort();
    const componentCellKeys = boundComponent.occupiedCells.map((address) => serializeStructuralCellAddress(address)).sort();
    if (
      fragmentCellKeys.length !== componentCellKeys.length ||
      fragmentCellKeys.some((key, keyIndex) => key !== componentCellKeys[keyIndex])
    ) {
      fail("InvalidStructuralState", path, "Fragment cells must exactly match the bound component cells.");
    }
    // P1: Fragment-Hashes an Component und Objektversion binden.
    const recomputedFragmentContent = hashStructuralFragmentContent({
      componentId: fragment.componentId,
      sourceContentHash: object.contentHash,
      sourceAdaptiveAuthorityDigest: boundComponent.sourceAdaptiveAuthorityDigest,
      componentContentHash: boundComponent.componentContentHash,
      occupiedCellKeys: boundComponent.occupiedCells.map((address) => serializeStructuralCellAddress(address))
    });
    if (recomputedFragmentContent !== fragment.fragmentContentHash) {
      fail("InvalidStructuralState", path, "Fragment content hash must match the bound component and object version.");
    }
    const recomputedFragmentId = hashStructuralFragmentId({
      objectId: object.objectId,
      objectRevision: object.objectRevision,
      componentId: fragment.componentId,
      fragmentContentHash: fragment.fragmentContentHash
    });
    if (recomputedFragmentId !== fragment.fragmentId) {
      fail("InvalidStructuralState", path, "Fragment id must match the bound object version and content.");
    }
    const mass = deriveStructuralComponentMassProperties(object, boundComponent, massBudgets);
    if (mass.centerOfMassMeters === null) {
      fail("InvalidStructuralState", path, "Fragment mass derivation requires finite center of mass.");
    }
    const center = mass.centerOfMassMeters as MeterPoint;
    const cells = (fragment.occupiedCells ?? []).map((address) => globalQuantumForStructuralCell(address));
    if (cells.length === 0) {
      fail("InvalidStructuralState", path, "Fragment must contain at least one occupied cell.");
    }
    const voxelColliders = deepFreeze(
      cells.map((cell) => toMetersBox(deepFreeze({
        min: deepFreeze({ x: cell.x, y: cell.y, z: cell.z }),
        max: deepFreeze({ x: cell.x + 1, y: cell.y + 1, z: cell.z + 1 })
      })))
    );
    const greedyColliders = deepFreeze(mergeGreedyQuantumBoxes(cells, path).map(toMetersBox));
    return deepFreeze({
      fragment,
      component: boundComponent,
      massKg: mass.totalMassKg,
      center,
      tensor: mass.inertiaTensorKgMetersSquared,
      velocity: deriveStructuralSplitVelocity(parentMotion, parentCenter, center),
      voxelColliders,
      greedyColliders,
      voxelCount: cells.length
    });
  });

  // P1: exakte Partition — Union(verankert + alle Fragmente) == kanonische
  // Occupancy, keine Doppelbelegung (auch nicht fragmentintern oder zwischen
  // Fragmenten), keine Phantomzellen (verschoben/veraltet/leer). Gezaehlt wird
  // jede behauptete Zelle einzeln; Sets wuerden Duplikate still schlucken.
  const totalOccupied = object.bricks.reduce((sum, brick) => sum + brick.cells.length, 0);
  const canonicalKeys = new Set<string>();
  for (const brick of object.bricks) {
    for (const cell of brick.cells) {
      canonicalKeys.add(serializeStructuralCellAddress(structuralAddressForBrickCell(brick, cell.localIndex)));
    }
  }
  const claimedBy = new Map<string, string>();
  const claimCell = (key: string, path: string): void => {
    if (!canonicalKeys.has(key)) {
      fail("InvalidStructuralState", path, "Claimed cell is not part of the canonical object occupancy (phantom or stale cell).");
    }
    const firstClaim = claimedBy.get(key);
    if (firstClaim !== undefined) {
      fail("InvalidStructuralState", path, `Cell is claimed twice (first claim at ${firstClaim}).`);
    }
    claimedBy.set(key, path);
  };
  let anchoredVoxels = 0;
  classification.anchoredComponents.forEach((component, componentIndex) => {
    const path = `anchored/${componentIndex}`;
    if (
      component.objectId !== object.objectId ||
      component.objectRevision !== object.objectRevision ||
      component.sourceContentHash !== object.contentHash
    ) {
      fail("InvalidStructuralState", path, "Anchored component must bind the same object version and content hash.");
    }
    for (const address of component.occupiedCells) {
      claimCell(serializeStructuralCellAddress(address), path);
      anchoredVoxels += 1;
    }
  });
  let fragmentVoxels = 0;
  works.forEach((work, workIndex) => {
    const path = `fragments/${workIndex}`;
    for (const address of work.fragment.occupiedCells) {
      claimCell(serializeStructuralCellAddress(address), path);
      fragmentVoxels += 1;
    }
  });
  if (claimedBy.size !== canonicalKeys.size || canonicalKeys.size !== totalOccupied) {
    fail(
      "InvalidStructuralState",
      "occupancyProof",
      "Atomic install requires a disjoint, complete partition: anchored plus fragment cells must equal all occupied cells."
    );
  }
  const occupancyProof = deepFreeze({
    totalOccupiedVoxels: totalOccupied,
    anchoredVoxels,
    fragmentVoxels,
    disjoint: true as const,
    complete: true as const
  });

  const sorted = [...works].sort((a, b) => (a.fragment.fragmentId < b.fragment.fragmentId ? -1 : 1));
  const dynamicWorks: FragmentWork[] = [];
  const overflowWorks: FragmentWork[] = [];
  for (const work of sorted) {
    const withinFragmentBudget =
      work.voxelCount <= budgets.maxVoxelsPerFragment &&
      work.greedyColliders.length <= budgets.maxCollidersPerFragment;
    if (dynamicWorks.length < budgets.maxFragments && withinFragmentBudget) dynamicWorks.push(work);
    else overflowWorks.push(work);
  }

  const toBodyPlan = (work: FragmentWork): StructuralFragmentBodyPlan => deepFreeze({
    fragmentId: work.fragment.fragmentId,
    componentId: work.fragment.componentId,
    occupiedVoxelCount: work.voxelCount,
    massKg: work.massKg,
    centerOfMassMeters: work.center,
    inertiaTensorKgMetersSquared: work.tensor,
    initialVelocityMetersPerSecond: work.velocity,
    voxelColliders: work.voxelColliders,
    greedyColliders: work.greedyColliders
  });
  const dynamicBodies = deepFreeze(dynamicWorks.map(toBodyPlan));
  const dynamicFragmentIds = deepFreeze(dynamicWorks.map((work) => work.fragment.fragmentId));
  const base = {
    schemaVersion: STRUCTURAL_PHYSICS_TRANSITION_SCHEMA_VERSION,
    objectId: object.objectId,
    objectRevision: object.objectRevision,
    sourceContentHash: object.contentHash,
    parentMotion,
    parentMotionSource,
    dynamicBodies,
    dynamicFragmentIds,
    occupancyProof
  };

  if (overflowWorks.length === 0) {
    const payload = deepFreeze({ ...base, status: "Installed" as const });
    return deepFreeze({ ...payload, contentHash: hashAdaptiveCanonical(payload) });
  }

  // Semantischer Fallback: kein stilles Loeschen. Ueberzaehlige Fragmente werden
  // in EINEN expliziten Debris-Body verschmolzen; jede Fragment-ID bleibt
  // entweder dynamisch oder im Debris nachweisbar.
  let debrisMass = 0;
  let weightedX = 0;
  let weightedY = 0;
  let weightedZ = 0;
  let weightedVx = 0;
  let weightedVy = 0;
  let weightedVz = 0;
  let debrisVoxels = 0;
  const debrisVoxelColliders: StructuralColliderBoxMeters[] = [];
  const debrisGreedyColliders: StructuralColliderBoxMeters[] = [];
  const debrisMembers: FragmentWork[] = [];
  for (const work of overflowWorks) {
    debrisMass = requireFinite(debrisMass + work.massKg, "debris/massKg");
    weightedX = requireFinite(weightedX + work.massKg * work.center.x, "debris/centerX");
    weightedY = requireFinite(weightedY + work.massKg * work.center.y, "debris/centerY");
    weightedZ = requireFinite(weightedZ + work.massKg * work.center.z, "debris/centerZ");
    weightedVx = requireFinite(weightedVx + work.massKg * work.velocity.x, "debris/velocityX");
    weightedVy = requireFinite(weightedVy + work.massKg * work.velocity.y, "debris/velocityY");
    weightedVz = requireFinite(weightedVz + work.massKg * work.velocity.z, "debris/velocityZ");
    debrisVoxels += work.voxelCount;
    debrisVoxelColliders.push(...work.voxelColliders);
    debrisGreedyColliders.push(...work.greedyColliders);
    debrisMembers.push(work);
  }
  if (!(debrisMass > 0)) {
    fail("InvalidStructuralState", "debris", "Debris fallback requires positive merged mass.");
  }
  const debrisCenter = deepFreeze({
    x: requireFinite(weightedX / debrisMass, "debris/centerX"),
    y: requireFinite(weightedY / debrisMass, "debris/centerY"),
    z: requireFinite(weightedZ / debrisMass, "debris/centerZ")
  });
  const mergedDebrisFragmentIds = deepFreeze(overflowWorks.map((work) => work.fragment.fragmentId));
  // Debris-Traegheit per Satz von Steiner um den Debris-Schwerpunkt:
  // I = Summe(I_eigen + m * (|d|^2 * E - d * d^T)) mit d = c_fragment - c_debris.
  let debrisXx = 0;
  let debrisYy = 0;
  let debrisZz = 0;
  let debrisXy = 0;
  let debrisXz = 0;
  let debrisYz = 0;
  for (const work of debrisMembers) {
    const dx = requireFinite(work.center.x - debrisCenter.x, "debris/inertiaDx");
    const dy = requireFinite(work.center.y - debrisCenter.y, "debris/inertiaDy");
    const dz = requireFinite(work.center.z - debrisCenter.z, "debris/inertiaDz");
    debrisXx = requireFinite(debrisXx + work.tensor.xx + work.massKg * (dy * dy + dz * dz), "debris/inertiaXx");
    debrisYy = requireFinite(debrisYy + work.tensor.yy + work.massKg * (dx * dx + dz * dz), "debris/inertiaYy");
    debrisZz = requireFinite(debrisZz + work.tensor.zz + work.massKg * (dx * dx + dy * dy), "debris/inertiaZz");
    debrisXy = requireFinite(debrisXy + work.tensor.xy - work.massKg * dx * dy, "debris/inertiaXy");
    debrisXz = requireFinite(debrisXz + work.tensor.xz - work.massKg * dx * dz, "debris/inertiaXz");
    debrisYz = requireFinite(debrisYz + work.tensor.yz - work.massKg * dy * dz, "debris/inertiaYz");
  }
  const debris = deepFreeze({
    debrisBodyId: `debris.${object.objectId}.r${object.objectRevision}.overflow`,
    mergedFragmentIds: mergedDebrisFragmentIds,
    occupiedVoxelCount: debrisVoxels,
    massKg: debrisMass,
    centerOfMassMeters: debrisCenter,
    inertiaTensorKgMetersSquared: deepFreeze({
      xx: debrisXx,
      yy: debrisYy,
      zz: debrisZz,
      xy: debrisXy,
      xz: debrisXz,
      yz: debrisYz
    }),
    initialVelocityMetersPerSecond: deepFreeze({
      x: requireFinite(weightedVx / debrisMass, "debris/velocityX"),
      y: requireFinite(weightedVy / debrisMass, "debris/velocityY"),
      z: requireFinite(weightedVz / debrisMass, "debris/velocityZ")
    }),
    voxelColliders: deepFreeze(debrisVoxelColliders.slice()),
    greedyColliders: deepFreeze(debrisGreedyColliders.slice()),
    exceedsColliderBudget: debrisGreedyColliders.length > budgets.maxCollidersPerFragment
  });
  const payload = deepFreeze({
    ...base,
    status: "Fallback" as const,
    fallbackKind: STRUCTURAL_PHYSICS_TRANSITION_FALLBACK_KIND,
    debris,
    mergedDebrisFragmentIds
  });
  return deepFreeze({ ...payload, contentHash: hashAdaptiveCanonical(payload) });
};

export const canonicalStructuralTransitionJson = (result: StructuralPhysicsTransitionResult): string =>
  canonicalAdaptiveJson(result);
