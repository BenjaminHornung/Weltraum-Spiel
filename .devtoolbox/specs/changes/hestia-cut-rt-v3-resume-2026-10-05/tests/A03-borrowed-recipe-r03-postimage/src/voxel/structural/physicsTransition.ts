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
  serializeStructuralCellAddress,
  structuralCanonicalHashSteps
} from "./canonical";
import { deriveStructuralComponentMassProperties, deriveStructuralObjectMassProperties,
  deriveStructuralSingleComponentMassesSteps,structuralOwnedSingleComponentMassesSteps } from "./massProperties";
import { structuralAddressForBrickCell } from "./model";
import type {
  StructuralComponent,
  StructuralComponentClassification,
  StructuralComponentId,
  StructuralComponentMassBudgets,
  StructuralFragment,
  StructuralFragmentId,
  StructuralInertiaTensor,
  StructuralMassProperties,
  StructuralObject
} from "./types";
import {STRUCTURAL_FRAGMENT_SCHEMA_VERSION,STRUCTURAL_FRAGMENT_ID_VERSION} from "./types";
import { drainStructuralSteps, normalizeAdaptiveAuthorityError, normalizeAdaptiveAuthorityFunction,
  structuralFail, structuralFreezeArraySteps, structuralPositiveBudget, structuralSortSteps,freezeStructuralProduced,
  type StructuralOwnedReserve } from "./validation";
// Private owned-payload cursor (module export only, not in the adaptive barrel).
import { createOwnedCanonicalHashCursor } from "../adaptive/ownedCanonicalHashSteps";

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
export const mergeGreedyQuantumBoxes = (
  cells: readonly (Readonly<{ x: number; y: number; z: number }>)[],
  path: string
): readonly QuantumBox[] => drainStructuralSteps(greedyQuantumBoxesSteps(cells, path));

/** INACTIVE direct-module form. The producer retains a first-party plain/index-only immutable
 * cell array for the complete generator lifetime and charges it to ONE parent ledger. No
 * structural/recipe/World authority is issued; the parent alone releases the borrowed reserve. */
export function* mergeGreedyQuantumBoxesOwnedSteps(
  cells: readonly (Readonly<{ x: number; y: number; z: number }>)[], path: string, reserve: StructuralOwnedReserve
) {
  return yield* greedyQuantumBoxesSteps(cells, path, reserve);
}

function* greedyQuantumBoxesSteps(
  cells: readonly (Readonly<{ x: number; y: number; z: number }>)[], path: string, reserve?: StructuralOwnedReserve
): Generator<void, readonly QuantumBox[], void> {
  reserve?.(512);
  const remaining = new Map<string, Readonly<{ x: number; y: number; z: number }>>();
  for (const cell of cells) {
    if (!Number.isSafeInteger(cell.x) || !Number.isSafeInteger(cell.y) || !Number.isSafeInteger(cell.z)) {
      return structuralFail("InvalidContract", path, "Greedy merge requires safe-integer quantum cells.");
    }
    reserve?.(256);
    const key = quantumKey(cell.x, cell.y, cell.z);
    if (remaining.has(key)) {
      return structuralFail("InvalidContract", path, "Greedy merge requires unique quantum cells.");
    }
    remaining.set(key, cell);
    if (reserve !== undefined) { yield; }
  }
  reserve?.(64);
  const boxes: QuantumBox[] = [];
  while (remaining.size > 0) {
    let seeds: Readonly<{ x: number; y: number; z: number }>[];
    if (reserve === undefined) { seeds = [...remaining.values()]; }
    else {
      reserve(64 + remaining.size * 128);
      seeds = [];
      for (const cell of remaining.values()) { seeds.push(cell); yield; }
    }
    const seed = (yield* structuralSortSteps(seeds, (a, b) => a.x - b.x || a.y - b.y || a.z - b.z, reserve))[0];
    let maxX = seed.x;
    for (;;) {
      reserve?.(128);
      const present = remaining.has(quantumKey(maxX + 1, seed.y, seed.z));
      if (reserve !== undefined) { yield; }
      if (!present) { break; }
      maxX += 1;
    }
    let maxY = seed.y;
    let rowComplete = true;
    while (rowComplete) {
      for (let x = seed.x; x <= maxX; x += 1) {
        reserve?.(128);
        const present = remaining.has(quantumKey(x, maxY + 1, seed.z));
        if (reserve !== undefined) { yield; }
        if (!present) {
          rowComplete = false;
          break;
        }
      }
      if (rowComplete) { maxY += 1; }
    }
    let maxZ = seed.z;
    let slabComplete = true;
    while (slabComplete) {
      for (let y = seed.y; y <= maxY; y += 1) {
        for (let x = seed.x; x <= maxX; x += 1) {
          reserve?.(128);
          const present = remaining.has(quantumKey(x, y, maxZ + 1));
          if (reserve !== undefined) { yield; }
          if (!present) {
            slabComplete = false;
            break;
          }
        }
        if (!slabComplete) { break; }
      }
      if (slabComplete) { maxZ += 1; }
    }
    for (let z = seed.z; z <= maxZ; z += 1) {
      for (let y = seed.y; y <= maxY; y += 1) {
        for (let x = seed.x; x <= maxX; x += 1) {
          reserve?.(128);
          remaining.delete(quantumKey(x, y, z));
          if (reserve !== undefined) { yield; }
        }
      }
    }
    reserve?.(1_024, true);
    boxes.push(deepFreeze({
      min: deepFreeze({ x: seed.x, y: seed.y, z: seed.z }),
      max: deepFreeze({ x: maxX + 1, y: maxY + 1, z: maxZ + 1 })
    }));
    if (reserve !== undefined) { yield; }
  }
  let covered = 0;
  for (const box of boxes) {
    covered += (box.max.x - box.min.x) * (box.max.y - box.min.y) * (box.max.z - box.min.z);
    if (reserve !== undefined) { yield; }
  }
  if (covered !== cells.length) {
    return structuralFail("InvalidContract", path, "Greedy merge coverage must equal the fragment cell count.");
  }
  yield* structuralSortSteps(boxes, (a, b) => a.min.z - b.min.z || a.min.y - b.min.y || a.min.x - b.min.x, reserve);
  return yield* structuralFreezeArraySteps(boxes, reserve);
}

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

type StructuralTransitionPayload =
  | Omit<StructuralInstalledPhysicsTransition, "contentHash">
  | Omit<StructuralFallbackPhysicsTransition, "contentHash">;

/** One payload algorithm; generic observers keep their native operations, owned work borrows one reserve. */
function* deriveTransitionPayloadSteps(
  object: StructuralObject,
  classification: StructuralComponentClassification,
  parentMotion: StructuralBodyMotion,
  budgets: StructuralPhysicsTransitionBudgets,
  massBudgets: StructuralComponentMassBudgets,
  parentMotionSource: StructuralParentMotionSource,
  objectMass: StructuralMassProperties,
  issuedComponentMass?: StructuralMassProperties,
  reserve?:StructuralOwnedReserve
): Generator<void,StructuralTransitionPayload,void> {
  const parentCenter = objectMass.centerOfMassMeters as MeterPoint;

  function* fragmentWorkSteps(fragment:StructuralFragment,index:number):Generator<void,FragmentWork,void>{
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
    function* cellKeys(addresses:StructuralComponent["occupiedCells"]):Generator<void,string[],void>{
      if(reserve===undefined){return addresses.map(address=>serializeStructuralCellAddress(address));}
      reserve(64+addresses.length*256);
      const result:string[]=[];
      for(let cell=0;cell<addresses.length;cell+=1){result.push(serializeStructuralCellAddress(addresses[cell]!));yield;}
      return result;
    }
    const fragmentCellKeys=yield* cellKeys(fragment.occupiedCells);
    let componentKeyOrder:string[]|undefined;
    let componentCellKeys:string[];
    if(reserve===undefined){fragmentCellKeys.sort();componentCellKeys=boundComponent.occupiedCells.map(address=>serializeStructuralCellAddress(address)).sort();}
    else{
      yield* structuralSortSteps(fragmentCellKeys,(a,b)=>a<b?-1:a>b?1:0,reserve);
      componentKeyOrder=yield* cellKeys(boundComponent.occupiedCells);
      reserve(64+componentKeyOrder.length*8);componentCellKeys=[];
      for(let cell=0;cell<componentKeyOrder.length;cell+=1){componentCellKeys.push(componentKeyOrder[cell]!);yield;}
      yield* structuralSortSteps(componentCellKeys,(a,b)=>a<b?-1:a>b?1:0,reserve);
    }
    let equal=fragmentCellKeys.length===componentCellKeys.length;
    if(equal){
      if(reserve===undefined){equal=!fragmentCellKeys.some((key,keyIndex)=>key!==componentCellKeys[keyIndex]);}
      else{for(let cell=0;cell<fragmentCellKeys.length;cell+=1){if(fragmentCellKeys[cell]!==componentCellKeys[cell]){equal=false;break;}yield;}}
    }
    if (!equal) {
      fail("InvalidStructuralState", path, "Fragment cells must exactly match the bound component cells.");
    }
    // P1: Fragment-Hashes an Component und Objektversion binden.
    reserve?.(2_048);
    const fragmentContent={
      componentId: fragment.componentId,
      sourceContentHash: object.contentHash,
      sourceAdaptiveAuthorityDigest: boundComponent.sourceAdaptiveAuthorityDigest,
      componentContentHash: boundComponent.componentContentHash,
      occupiedCellKeys: reserve===undefined?boundComponent.occupiedCells.map((address) => serializeStructuralCellAddress(address))
        :yield* structuralFreezeArraySteps(componentKeyOrder!,reserve)
    };
    const recomputedFragmentContent=reserve===undefined?hashStructuralFragmentContent(fragmentContent)
      :yield* structuralCanonicalHashSteps(Object.freeze({schemaVersion:STRUCTURAL_FRAGMENT_SCHEMA_VERSION,...fragmentContent}),reserve);
    if (recomputedFragmentContent !== fragment.fragmentContentHash) {
      fail("InvalidStructuralState", path, "Fragment content hash must match the bound component and object version.");
    }
    reserve?.(1_024);
    const fragmentIdentity={
      objectId: object.objectId,
      objectRevision: object.objectRevision,
      componentId: fragment.componentId,
      fragmentContentHash: fragment.fragmentContentHash
    };
    const recomputedFragmentId=reserve===undefined?hashStructuralFragmentId(fragmentIdentity)
      :yield* structuralCanonicalHashSteps(Object.freeze({schemaVersion:STRUCTURAL_FRAGMENT_ID_VERSION,...fragmentIdentity}),reserve);
    if (recomputedFragmentId !== fragment.fragmentId) {
      fail("InvalidStructuralState", path, "Fragment id must match the bound object version and content.");
    }
    const mass = issuedComponentMass ?? deriveStructuralComponentMassProperties(object, boundComponent, massBudgets);
    if (mass.centerOfMassMeters === null) {
      fail("InvalidStructuralState", path, "Fragment mass derivation requires finite center of mass.");
    }
    const center = mass.centerOfMassMeters as MeterPoint;
    let cells:ReturnType<typeof globalQuantumForStructuralCell>[];
    if(reserve===undefined){cells=(fragment.occupiedCells??[]).map(address=>globalQuantumForStructuralCell(address));}
    else{
      reserve(64+fragment.occupiedCells.length*128);cells=[];
      for(let cell=0;cell<fragment.occupiedCells.length;cell+=1){cells.push(globalQuantumForStructuralCell(fragment.occupiedCells[cell]!));yield;}
    }
    if (cells.length === 0) {
      fail("InvalidStructuralState", path, "Fragment must contain at least one occupied cell.");
    }
    const toVoxelCollider=(cell:ReturnType<typeof globalQuantumForStructuralCell>)=>toMetersBox(deepFreeze({
        min: deepFreeze({ x: cell.x, y: cell.y, z: cell.z }),
        max: deepFreeze({ x: cell.x + 1, y: cell.y + 1, z: cell.z + 1 })
      }));
    let voxelColliders:readonly StructuralColliderBoxMeters[],greedyColliders:readonly StructuralColliderBoxMeters[];
    if(reserve===undefined){voxelColliders=deepFreeze(cells.map(toVoxelCollider));greedyColliders=deepFreeze(mergeGreedyQuantumBoxes(cells,path).map(toMetersBox));}
    else{
      reserve(64+cells.length*512,true);const voxel:StructuralColliderBoxMeters[]=[];
      for(const cell of cells){voxel.push(toVoxelCollider(cell));yield;}
      voxelColliders=yield* structuralFreezeArraySteps(voxel,reserve);
      const boxes=yield* mergeGreedyQuantumBoxesOwnedSteps(cells,path,reserve);
      reserve(64+boxes.length*512,true);const greedy:StructuralColliderBoxMeters[]=[];
      for(const box of boxes){greedy.push(toMetersBox(box));yield;}
      greedyColliders=yield* structuralFreezeArraySteps(greedy,reserve);
    }
    reserve?.(2_048,true);
    return freezeStructuralProduced({
      fragment,
      component: boundComponent,
      massKg: mass.totalMassKg,
      center,
      tensor: mass.inertiaTensorKgMetersSquared,
      velocity: deriveStructuralSplitVelocity(parentMotion, parentCenter, center),
      voxelColliders,
      greedyColliders,
      voxelCount: cells.length
    },reserve);
  }
  reserve?.(64+classification.fragments.length*8);
  const works:FragmentWork[]=reserve===undefined?classification.fragments.map((fragment,index)=>drainStructuralSteps(fragmentWorkSteps(fragment,index))):[];
  if(reserve!==undefined){for(let index=0;index<classification.fragments.length;index+=1){works.push(yield* fragmentWorkSteps(classification.fragments[index]!,index));yield;}}

  // P1: exakte Partition — Union(verankert + alle Fragmente) == kanonische
  // Occupancy, keine Doppelbelegung (auch nicht fragmentintern oder zwischen
  // Fragmenten), keine Phantomzellen (verschoben/veraltet/leer). Gezaehlt wird
  // jede behauptete Zelle einzeln; Sets wuerden Duplikate still schlucken.
  const totalOccupied = object.bricks.reduce((sum, brick) => sum + brick.cells.length, 0);
  const canonicalKeys = new Set<string>();
  reserve?.(1_024);
  for (const brick of object.bricks) {
    for (const cell of brick.cells) {
      reserve?.(256);
      canonicalKeys.add(serializeStructuralCellAddress(structuralAddressForBrickCell(brick, cell.localIndex)));
      if(reserve!==undefined){yield;}
    }
  }
  const claimedBy = new Map<string, string>();
  reserve?.(1_024);
  const claimCell = (key: string, path: string): void => {
    if (!canonicalKeys.has(key)) {
      fail("InvalidStructuralState", path, "Claimed cell is not part of the canonical object occupancy (phantom or stale cell).");
    }
    const firstClaim = claimedBy.get(key);
    if (firstClaim !== undefined) {
      fail("InvalidStructuralState", path, `Cell is claimed twice (first claim at ${firstClaim}).`);
    }
    reserve?.(256);claimedBy.set(key, path);
  };
  let anchoredVoxels = 0;
  function* anchoredClaims(component:StructuralComponent,componentIndex:number):Generator<void,void,void>{
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
      if(reserve!==undefined){yield;}
    }
  }
  if(reserve===undefined){classification.anchoredComponents.forEach((component,index)=>drainStructuralSteps(anchoredClaims(component,index)));}
  else{for(let index=0;index<classification.anchoredComponents.length;index+=1){yield* anchoredClaims(classification.anchoredComponents[index]!,index);}}
  let fragmentVoxels = 0;
  function* fragmentClaims(work:FragmentWork,workIndex:number):Generator<void,void,void>{
    const path = `fragments/${workIndex}`;
    for (const address of work.fragment.occupiedCells) {
      claimCell(serializeStructuralCellAddress(address), path);
      fragmentVoxels += 1;
      if(reserve!==undefined){yield;}
    }
  }
  if(reserve===undefined){works.forEach((work,index)=>drainStructuralSteps(fragmentClaims(work,index)));}
  else{for(let index=0;index<works.length;index+=1){yield* fragmentClaims(works[index]!,index);}}
  if (claimedBy.size !== canonicalKeys.size || canonicalKeys.size !== totalOccupied) {
    fail(
      "InvalidStructuralState",
      "occupancyProof",
      "Atomic install requires a disjoint, complete partition: anchored plus fragment cells must equal all occupied cells."
    );
  }
  reserve?.(1_024,true);
  const occupancyProof = freezeStructuralProduced({
    totalOccupiedVoxels: totalOccupied,
    anchoredVoxels,
    fragmentVoxels,
    disjoint: true as const,
    complete: true as const
  },reserve);

  const compareWork=(a:FragmentWork,b:FragmentWork)=>a.fragment.fragmentId<b.fragment.fragmentId?-1:1;
  reserve?.(64+works.length*8);
  const sorted=reserve===undefined?[...works].sort(compareWork):[] as FragmentWork[];
  if(reserve!==undefined){for(const work of works){sorted.push(work);yield;}yield* structuralSortSteps(sorted,compareWork,reserve);}
  reserve?.(128+sorted.length*8);
  const dynamicWorks: FragmentWork[] = [];
  const overflowWorks: FragmentWork[] = [];
  for (const work of sorted) {
    const withinFragmentBudget =
      work.voxelCount <= budgets.maxVoxelsPerFragment &&
      work.greedyColliders.length <= budgets.maxCollidersPerFragment;
    if (dynamicWorks.length < budgets.maxFragments && withinFragmentBudget) dynamicWorks.push(work);
    else overflowWorks.push(work);
    if(reserve!==undefined){yield;}
  }

  const toBodyPlan = (work: FragmentWork): StructuralFragmentBodyPlan => freezeStructuralProduced({
    fragmentId: work.fragment.fragmentId,
    componentId: work.fragment.componentId,
    occupiedVoxelCount: work.voxelCount,
    massKg: work.massKg,
    centerOfMassMeters: work.center,
    inertiaTensorKgMetersSquared: work.tensor,
    initialVelocityMetersPerSecond: work.velocity,
    voxelColliders: work.voxelColliders,
    greedyColliders: work.greedyColliders
  },reserve);
  function* mapWorks<T>(values:readonly FragmentWork[],create:(work:FragmentWork)=>T):Generator<void,readonly T[],void>{
    if(reserve===undefined){return deepFreeze(values.map(create));}
    reserve(64+values.length*2_048,true);const result:T[]=[];
    for(const work of values){result.push(create(work));yield;}
    return yield* structuralFreezeArraySteps(result,reserve);
  }
  const dynamicBodies=yield* mapWorks(dynamicWorks,toBodyPlan);
  const dynamicFragmentIds=yield* mapWorks(dynamicWorks,work=>work.fragment.fragmentId);
  reserve?.(2_048,true);
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
    reserve?.(2_048,true);return freezeStructuralProduced({ ...base, status: "Installed" as const },reserve);
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
  reserve?.(192+overflowWorks.length*8);
  for (const work of overflowWorks) {
    debrisMass = requireFinite(debrisMass + work.massKg, "debris/massKg");
    weightedX = requireFinite(weightedX + work.massKg * work.center.x, "debris/centerX");
    weightedY = requireFinite(weightedY + work.massKg * work.center.y, "debris/centerY");
    weightedZ = requireFinite(weightedZ + work.massKg * work.center.z, "debris/centerZ");
    weightedVx = requireFinite(weightedVx + work.massKg * work.velocity.x, "debris/velocityX");
    weightedVy = requireFinite(weightedVy + work.massKg * work.velocity.y, "debris/velocityY");
    weightedVz = requireFinite(weightedVz + work.massKg * work.velocity.z, "debris/velocityZ");
    debrisVoxels += work.voxelCount;
    if(reserve===undefined){debrisVoxelColliders.push(...work.voxelColliders);debrisGreedyColliders.push(...work.greedyColliders);}
    else{
      reserve((work.voxelColliders.length+work.greedyColliders.length)*8,true);
      for(const box of work.voxelColliders){debrisVoxelColliders.push(box);yield;}
      for(const box of work.greedyColliders){debrisGreedyColliders.push(box);yield;}
    }
    debrisMembers.push(work);
    if(reserve!==undefined){yield;}
  }
  if (!(debrisMass > 0)) {
    fail("InvalidStructuralState", "debris", "Debris fallback requires positive merged mass.");
  }
  const debrisCenter = deepFreeze({
    x: requireFinite(weightedX / debrisMass, "debris/centerX"),
    y: requireFinite(weightedY / debrisMass, "debris/centerY"),
    z: requireFinite(weightedZ / debrisMass, "debris/centerZ")
  });
  const mergedDebrisFragmentIds=yield* mapWorks(overflowWorks,work=>work.fragment.fragmentId);
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
    if(reserve!==undefined){yield;}
  }
  reserve?.(4_096,true);
  const debris = freezeStructuralProduced({
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
    voxelColliders: reserve===undefined?deepFreeze(debrisVoxelColliders.slice()):yield* structuralFreezeArraySteps(debrisVoxelColliders,reserve),
    greedyColliders: reserve===undefined?deepFreeze(debrisGreedyColliders.slice()):yield* structuralFreezeArraySteps(debrisGreedyColliders,reserve),
    exceedsColliderBudget: debrisGreedyColliders.length > budgets.maxCollidersPerFragment
  },reserve);
  reserve?.(2_048,true);return freezeStructuralProduced({
    ...base,
    status: "Fallback" as const,
    fallbackKind: STRUCTURAL_PHYSICS_TRANSITION_FALLBACK_KIND,
    debris,
    mergedDebrisFragmentIds
  },reserve);
}

const deriveTransitionPayload=(...args:Parameters<typeof deriveTransitionPayloadSteps>):StructuralTransitionPayload=>
  drainStructuralSteps(deriveTransitionPayloadSteps(...args));

type TransitionCoreArgs = Parameters<typeof deriveTransitionPayload>;

/** Generic route: the same payload, then the public hash exactly as before. */
const deriveTransitionCore = (...args: TransitionCoreArgs): StructuralPhysicsTransitionResult => {
  const payload = deriveTransitionPayload(...args);
  return deepFreeze({ ...payload, contentHash: hashAdaptiveCanonical(payload) });
};

/** TEMPORARY diagnostic identities of the owner-internal final-hash seam's yields (module exports only). */
export const STRUCTURAL_TRANSITION_PAYLOAD_PHASE = "transitionPayload";
export const STRUCTURAL_TRANSITION_HASH_PHASE = "transitionHash";
export const STRUCTURAL_TRANSITION_PREPARE_PHASE = "transitionPrepare";
// ponytail: Node-measured start value (64 units max ~1.1 ms); calibrate in the real Worker.
const STRUCTURAL_OWNED_HASH_UNITS_PER_STEP = 64;

/**
 * Owner-internal final hash of a payload built above: bounded cursor advances with one yield each.
 * Owned-payload proof (static, from deriveTransitionPayload): every record is a local literal with at
 * most 13 fields (top 13, debris 10, body plan 9, tensor 6, proof 5, box/motion 2, vectors 3); every
 * array is a local map/slice result (dynamicBodies, dynamicFragmentIds, voxel/greedy colliders, merged
 * ids) with no named/symbol own keys and no Proxy; all are deep-frozen before hashing. Cursor errors
 * are translated per advance like the public wrapper; the cursor is released in `finally`.
 */
function* ownedTransitionHashSteps(payload: StructuralTransitionPayload): Generator<string, string, unknown> {
  const cursor = createOwnedCanonicalHashCursor(payload);
  try {
    for (;;) {
      const result = normalizeAdaptiveAuthorityError(() => cursor.advance(STRUCTURAL_OWNED_HASH_UNITS_PER_STEP));
      if (result !== undefined) {
        return result.contentHash;
      }
      yield STRUCTURAL_TRANSITION_HASH_PHASE;
    }
  } finally {
    cursor.dispose();
  }
}

function* deriveTransitionCoreOwnedHashSteps(...args: TransitionCoreArgs): Generator<string, StructuralPhysicsTransitionResult, unknown> {
  const reserve=args[8],steps=deriveTransitionPayloadSteps(...args);
  let payload:StructuralTransitionPayload;
  let payloadFailed=false;
  try{for(;;){const step=steps.next();if(step.done){payload=step.value;break;}yield STRUCTURAL_TRANSITION_PREPARE_PHASE;}}
  catch(error){payloadFailed=true;throw error;}
  finally{try{steps.return(undefined as never);}catch(error){if(!payloadFailed){throw error;}}}
  // The payload build (and its deepFreeze) ends its own step, before the first hash batch.
  yield STRUCTURAL_TRANSITION_PAYLOAD_PHASE;
  let contentHash:string;
  if(reserve===undefined){contentHash=yield* ownedTransitionHashSteps(payload);}
  else{
    const hash=structuralCanonicalHashSteps(payload,reserve);
    let hashFailed=false;
    try{for(;;){const step=hash.next();if(step.done){contentHash=step.value;break;}yield STRUCTURAL_TRANSITION_HASH_PHASE;}}
    catch(error){hashFailed=true;throw error;}
    finally{try{hash.return(undefined as never);}catch(error){if(!hashFailed){throw error;}}}
  }
  reserve?.(2_048,true);return freezeStructuralProduced({ ...payload, contentHash },reserve);
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
  return deriveTransitionCore(object,classification,parentMotion,budgets,massBudgets,parentMotionSource,objectMass);
};

function* singleComponentPhysicsPreparationSteps(
  ownedHash: boolean,
  object: StructuralObject,
  parentMotionValue: StructuralBodyMotion,
  budgetValue: StructuralPhysicsTransitionBudgets,
  massBudgets: StructuralComponentMassBudgets,
  afterObjectMass: (mass: StructuralMassProperties) => void,
  afterClassification: (classification: StructuralComponentClassification) => void,
  reserve?:StructuralOwnedReserve
) {
  const budgets=validateBudgets(budgetValue),motion=validateMotion(parentMotionValue);
  function* massSteps(){
    if(reserve===undefined){return yield* deriveStructuralSingleComponentMassesSteps(object,massBudgets,afterObjectMass,afterClassification);}
    const steps=structuralOwnedSingleComponentMassesSteps(object,massBudgets,reserve,afterObjectMass,afterClassification);
    let failed=false;
    try{for(;;){const step=steps.next();if(step.done){return step.value;}
      yield typeof step.value==="string"?step.value:STRUCTURAL_TRANSITION_PREPARE_PHASE;}}
    catch(error){failed=true;throw error;}
    finally{try{steps.return(undefined as never);}catch(error){if(!failed){throw error;}}}
  }
  const prepared=yield* massSteps();
  const core:TransitionCoreArgs=[object,prepared.classification,motion,budgets,prepared.budgets,
    "explicit",prepared.objectMass,prepared.componentMass,reserve];
  const transition=ownedHash?(yield* deriveTransitionCoreOwnedHashSteps(...core)):deriveTransitionCore(...core);
  const result:Readonly<{objectMass:StructuralMassProperties;classification:StructuralComponentClassification;
    transition:StructuralPhysicsTransitionResult}>=Object.freeze({objectMass:prepared.objectMass,classification:prepared.classification,
    transition});
  return result;
}

/**
 * Step form of deriveStructuralSingleComponentPhysicsPreparation (module export only, not in the
 * structural barrel): same validation order; only the child classification's cell extraction yields.
 * Always the generic public hash.
 */
export function* deriveStructuralSingleComponentPhysicsPreparationSteps(
  object: StructuralObject,
  parentMotionValue: StructuralBodyMotion,
  budgetValue: StructuralPhysicsTransitionBudgets,
  massBudgets: StructuralComponentMassBudgets,
  afterObjectMass: (mass: StructuralMassProperties) => void,
  afterClassification: (classification: StructuralComponentClassification) => void
) {
  return yield* singleComponentPhysicsPreparationSteps(false,object,parentMotionValue,budgetValue,massBudgets,afterObjectMass,afterClassification);
}

/**
 * OWNER-INTERNAL (module export only; reached only by the first-party Physics-Worker body route): the
 * same preparation, but the transition's final hash runs through the bounded owned-payload cursor
 * (yields STRUCTURAL_TRANSITION_PAYLOAD_PHASE once, then STRUCTURAL_TRANSITION_HASH_PHASE per batch).
 * Callers must pass first-party callbacks that cannot patch realm intrinsics.
 */
export function* deriveStructuralSingleComponentPhysicsPreparationOwnedHashSteps(
  object: StructuralObject,
  parentMotionValue: StructuralBodyMotion,
  budgetValue: StructuralPhysicsTransitionBudgets,
  massBudgets: StructuralComponentMassBudgets,
  afterObjectMass: (mass: StructuralMassProperties) => void,
  afterClassification: (classification: StructuralComponentClassification) => void,
  reserve?:StructuralOwnedReserve
) {
  return yield* singleComponentPhysicsPreparationSteps(true,object,parentMotionValue,budgetValue,massBudgets,afterObjectMass,afterClassification,reserve);
}

/** Fresh issued-source derivation; no caller-provided mass or classification is admitted. */
export const deriveStructuralSingleComponentPhysicsPreparation = (
  object: StructuralObject,
  parentMotionValue: StructuralBodyMotion,
  budgetValue: StructuralPhysicsTransitionBudgets,
  massBudgets: StructuralComponentMassBudgets,
  afterObjectMass: (mass: StructuralMassProperties) => void,
  afterClassification: (classification: StructuralComponentClassification) => void
): Readonly<{objectMass:StructuralMassProperties;classification:StructuralComponentClassification;
  transition:StructuralPhysicsTransitionResult}> => {
  // Drains the single step algorithm without pausing.
  const steps=deriveStructuralSingleComponentPhysicsPreparationSteps(object,parentMotionValue,budgetValue,massBudgets,afterObjectMass,afterClassification);
  for(;;){
    const step=steps.next();
    if(step.done){
      return step.value;
    }
  }
};

export const canonicalStructuralTransitionJson = (result: StructuralPhysicsTransitionResult): string =>
  canonicalAdaptiveJson(result);
