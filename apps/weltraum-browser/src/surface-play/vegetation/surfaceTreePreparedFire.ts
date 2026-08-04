import {
  canonicalAdaptiveJson,
  deepFreeze,
  hashAdaptiveCanonical,
  MICROVOXEL_BASE_QUANTUM_METERS,
  requireExactKeys,
  requirePlainRecord,
  type AdaptiveBrickKey
} from "../../voxel/adaptive";
import {
  createSpatialVector3,
  normalizeSpatialVector
} from "../../spatial/quaternion";
import type { SpatialVector3 } from "../../spatial/types";
import {
  STRUCTURAL_TRANSFER_COMMAND_SCHEMA_VERSION,
  applyStructuralDetachedComponentTransfer,
  globalQuantumForStructuralCell,
  projectStructuralObject,
  validateStructuralTransferDetachedComponentsCommand,
  type StructuralAcceptedCommandResult,
  type StructuralComponent,
  type StructuralDestructionCommand,
  type StructuralFragment,
  type StructuralMassProperties,
  type StructuralObject,
  type StructuralTransferDetachedComponentsCommand
} from "../../voxel/structural";
import { validateStructuralObjectProjection } from "../../voxel/structural/model";
import { readStructuralConnectivityWork } from "../../voxel/structural/connectivityDiagnostics";
import {
  createSurfaceStructuralTransitionSnapshot,
  type SurfaceStructuralAuthorityTransferSnapshotInput,
  type SurfaceStructuralTransitionSnapshot
} from "../contracts";
import {
  SURFACE_RIGID_BODY_MAX_BODIES,
  admitSurfaceRigidBodyBatch,
  createSurfaceRigidBodyCandidate,
  validateSurfaceRigidBodyColliderRepresentation,
  type SurfaceRigidBodyCandidate,
  type SurfaceRigidBodyColliderWorkCounters,
  type SurfaceRigidBodyWorld
} from "../physics";
import {
  SURFACE_TREE_CANONICAL_HIT_SCHEMA_VERSION,
  deriveSurfaceTreeAuthority,
  deriveSurfaceTreeDetachedComponents,
  previewSurfaceTreeHit,
  type SurfaceTreeAuthoritySnapshot,
  type SurfaceTreeDetachedComponentFacts
} from "./surfaceTreeAuthority";
import {
  createSurfaceTreeCollisionSnapshotFromAcceptedChanges,
  readSurfaceTreeCollisionDerivationStats,
  type SurfaceTreeCollisionDerivationStats,
  type SurfaceTreeCollisionSnapshot
} from "./surfaceTreeCollision";
import { deriveSurfaceTreeReleaseVelocity } from "./surfaceTreeRelease";

const ordered = (values: readonly string[]): readonly string[] =>
  Object.freeze([...values].sort((left, right) => left < right ? -1 : left > right ? 1 : 0));

const bodyIdFor = (componentId: string): string => "surface-tree-body:" + componentId;

const structuralTransitionBrickId = (key: Readonly<AdaptiveBrickKey>): string => {
  const coordinate = (value: number): string => value < 0 ? "n" + (-value) : String(value);
  return [
    "surface-tree-brick",
    "l-" + key.level,
    "x-" + coordinate(key.originQuantum.x),
    "y-" + coordinate(key.originQuantum.y),
    "z-" + coordinate(key.originQuantum.z)
  ].join(":");
};

export interface SurfaceTreePreparedBodySourcePlan {
  readonly sourceObject: Readonly<StructuralObject>;
  readonly component: Readonly<StructuralComponent>;
  readonly fragment: Readonly<StructuralFragment>;
  readonly massProperties: Readonly<StructuralMassProperties>;
  readonly candidate: Readonly<SurfaceRigidBodyCandidate>;
}

export interface SurfaceTreePreparedExistingBodySourceFacts
  extends SurfaceTreePreparedBodySourcePlan {
  readonly meshArtifactIsLazy: boolean;
}

export interface SurfaceTreePreparedExistingBodySourceTransportFacts {
  readonly schemaVersion: "surface-tree-prepared-existing-body-source-v1";
  readonly bodyId: string;
  readonly sourceObject: unknown;
  readonly component: Readonly<StructuralComponent>;
  readonly fragment: Readonly<StructuralFragment>;
  readonly massProperties: Readonly<StructuralMassProperties>;
  readonly meshArtifactIsLazy: true;
}

export const projectSurfaceTreePreparedExistingBodySourceTransport = (
  value: Readonly<SurfaceTreePreparedExistingBodySourceFacts>
): Readonly<SurfaceTreePreparedExistingBodySourceTransportFacts> => deepFreeze({
  schemaVersion: "surface-tree-prepared-existing-body-source-v1" as const,
  bodyId: value.candidate.bodyId,
  sourceObject: projectStructuralObject(value.sourceObject),
  component: value.component,
  fragment: value.fragment,
  massProperties: value.massProperties,
  meshArtifactIsLazy: true as const
});

export const validateSurfaceTreePreparedExistingBodySourceTransport = (
  tree: Readonly<SurfaceTreeAuthoritySnapshot>["tree"],
  value: unknown
): Readonly<Omit<SurfaceTreePreparedExistingBodySourceFacts, "candidate"> & { readonly bodyId: string }> => {
  const record = requirePlainRecord(value, "existingBodySourceFacts");
  requireExactKeys(record, [
    "schemaVersion", "bodyId", "sourceObject", "component", "fragment", "massProperties",
    "meshArtifactIsLazy"
  ], "existingBodySourceFacts");
  const sourceObject = validateStructuralObjectProjection(record.sourceObject);
  const authority = deriveSurfaceTreeAuthority(tree, sourceObject);
  const component = requirePlainRecord(record.component, "existingBodySourceFacts/component");
  const derived = deriveSurfaceTreeDetachedComponents(authority)
    .find((facts) => facts.component.componentId === component.componentId);
  if (derived === undefined) {
    throw new TypeError("Existing body-source transport does not bind a detached component.");
  }
  const bodyId = bodyIdFor(derived.component.componentId);
  const expected = deepFreeze({
    schemaVersion: "surface-tree-prepared-existing-body-source-v1" as const,
    bodyId,
    sourceObject: projectStructuralObject(sourceObject),
    component: derived.component,
    fragment: derived.fragment,
    massProperties: derived.massProperties,
    meshArtifactIsLazy: true as const
  });
  if (canonicalAdaptiveJson(expected) !== canonicalAdaptiveJson(value)) {
    throw new TypeError("Existing body-source transport is noncanonical or stale.");
  }
  return deepFreeze({
    bodyId,
    sourceObject,
    component: derived.component,
    fragment: derived.fragment,
    massProperties: derived.massProperties,
    meshArtifactIsLazy: true
  });
};

export const deriveSurfaceTreePreparedExistingBodyCandidate = (
  source: Readonly<Omit<SurfaceTreePreparedExistingBodySourceFacts, "candidate"> & { readonly bodyId: string }>,
  immutableValue: unknown,
  initialDynamicValue: unknown
): Readonly<SurfaceRigidBodyCandidate> => {
  const immutable = requirePlainRecord(immutableValue, "physicsImmutable");
  requireExactKeys(immutable, [
    "schemaVersion", "bodyId", "componentId", "objectId", "sourceObjectRevision",
    "sourceContentHash", "massKg", "inverseMassPerKg", "centerOfMassMeters",
    "inertiaTensorKgMetersSquared", "inverseInertiaTensorPerKgMetersSquared",
    "colliderRepresentation", "colliderRevision", "detachedAtSimulationTick",
    "activationSimulationTick"
  ], "physicsImmutable");
  const initial = requirePlainRecord(initialDynamicValue, "candidateInitial");
  requireExactKeys(initial, [
    "positionMeters", "orientation", "linearVelocityMetersPerSecond",
    "angularVelocityRadiansPerSecond"
  ], "candidateInitial");
  const centerOfMassMeters = source.massProperties.centerOfMassMeters;
  if (centerOfMassMeters === null) {
    throw new TypeError("Existing body source has no center of mass.");
  }
  const candidate = createSurfaceRigidBodyCandidate({
    bodyId: source.bodyId,
    componentId: source.component.componentId,
    objectId: source.component.objectId,
    sourceObjectRevision: source.component.objectRevision,
    sourceContentHash: source.component.sourceContentHash,
    occupiedCells: source.component.occupiedCells.map(globalQuantumForStructuralCell),
    cellSizeMeters: MICROVOXEL_BASE_QUANTUM_METERS,
    massKg: source.massProperties.totalMassKg,
    centerOfMassMeters,
    inertiaTensorKgMetersSquared: source.massProperties.inertiaTensorKgMetersSquared,
    positionMeters: initial.positionMeters as SpatialVector3,
    orientation: initial.orientation as SurfaceRigidBodyCandidate["orientation"],
    linearVelocityMetersPerSecond: initial.linearVelocityMetersPerSecond as SpatialVector3,
    angularVelocityRadiansPerSecond: initial.angularVelocityRadiansPerSecond as SpatialVector3,
    colliderRevision: source.component.objectRevision,
    detachedAtSimulationTick: immutable.detachedAtSimulationTick as number
  });
  const projectedImmutable = {
    schemaVersion: "prepared-structural-fire-physics-immutable-v1",
    bodyId: candidate.bodyId,
    componentId: candidate.componentId,
    objectId: candidate.objectId,
    sourceObjectRevision: candidate.sourceObjectRevision,
    sourceContentHash: candidate.sourceContentHash,
    massKg: candidate.massKg,
    inverseMassPerKg: candidate.inverseMassPerKg,
    centerOfMassMeters: candidate.centerOfMassMeters,
    inertiaTensorKgMetersSquared: candidate.inertiaTensorKgMetersSquared,
    inverseInertiaTensorPerKgMetersSquared: candidate.inverseInertiaTensorPerKgMetersSquared,
    colliderRepresentation: candidate.colliderRepresentation,
    colliderRevision: candidate.colliderRevision,
    detachedAtSimulationTick: candidate.detachedAtSimulationTick,
    activationSimulationTick: candidate.activationSimulationTick
  };
  if (canonicalAdaptiveJson(projectedImmutable) !== canonicalAdaptiveJson(immutableValue)) {
    throw new TypeError("Physics immutable facts are not derived from their body source.");
  }
  return candidate;
};

export interface SurfaceTreePreparedFireInput {
  readonly authority: Readonly<SurfaceTreeAuthoritySnapshot>;
  readonly collision: Readonly<SurfaceTreeCollisionSnapshot>;
  readonly physicsWorld: Readonly<SurfaceRigidBodyWorld>;
  readonly bodySources: readonly Readonly<SurfaceTreePreparedExistingBodySourceFacts>[];
  readonly fireCommandId: string;
  readonly hit: Readonly<{
    readonly address: Parameters<typeof previewSurfaceTreeHit>[1]["address"];
    readonly globalQuantum: Parameters<typeof previewSurfaceTreeHit>[1]["globalQuantum"];
    readonly pointMeters: SpatialVector3;
    readonly normal: SpatialVector3;
    readonly materialId: number;
  }>;
  readonly simulationTick: number;
}

export interface SurfaceTreePreparedSetCommitment {
  readonly count: number;
  readonly orderedIds: readonly string[];
  readonly rootHash: string;
}

export const SURFACE_TREE_PREPARED_WORK_ACCOUNTING_SCHEMA_VERSION =
  "surface-tree-prepared-work-accounting-v1" as const;

export type SurfaceTreePreparedWorkCompleteness = "Complete" | "Partial" | "Unavailable";

export interface SurfaceTreePreparedWorkAccounting {
  readonly schemaVersion: typeof SURFACE_TREE_PREPARED_WORK_ACCOUNTING_SCHEMA_VERSION;
  readonly completeness: "Partial";
  readonly phases: Readonly<{
    readonly damage: SurfaceTreePreparedWorkCompleteness;
    readonly detached: SurfaceTreePreparedWorkCompleteness;
    readonly bodyPlanning: SurfaceTreePreparedWorkCompleteness;
    readonly transfer: SurfaceTreePreparedWorkCompleteness;
    readonly collision: SurfaceTreePreparedWorkCompleteness;
    readonly physics: SurfaceTreePreparedWorkCompleteness;
    readonly finalization: "Unavailable";
  }>;
}

export interface SurfaceTreePreparedFireWork {
  readonly accounting: Readonly<SurfaceTreePreparedWorkAccounting>;
  readonly damage: Readonly<{
    readonly changedBrickCount: number;
    readonly changedCellCount: number;
    readonly connectivity: ReturnType<typeof readStructuralConnectivityWork>;
  }>;
  readonly detached: Readonly<{
    readonly componentCount: number;
    readonly massCellCount: number;
  }>;
  readonly bodyPlanning: Readonly<{
    readonly bodyCount: number;
    readonly colliderWork: readonly Readonly<{
      readonly bodyId: string;
      readonly counters: Readonly<SurfaceRigidBodyColliderWorkCounters>;
    }>[];
  }>;
  readonly transfer: Readonly<{
    readonly status: "NotRequired" | "Applied";
    readonly changedBrickCount: number;
    readonly changedCellCount: number;
  }>;
  readonly collision: Readonly<SurfaceTreeCollisionDerivationStats> | null;
  readonly physics: Readonly<{
    readonly predecessorBodyCount: number;
    readonly admittedBodyCount: number;
    readonly resultingBodyCount: number;
  }>;
}

export type SurfaceTreePreparedFire =
  | Readonly<{
      readonly status: "Ready";
      readonly structuralCommandId: string;
      readonly damageResult: Readonly<StructuralAcceptedCommandResult>;
      readonly supportResult: "Anchored" | "Detached" | "Empty";
      readonly detachedFacts: readonly Readonly<SurfaceTreeDetachedComponentFacts>[];
      readonly newBodySourcePlans: readonly Readonly<SurfaceTreePreparedBodySourcePlan>[];
      readonly transferResult: Readonly<StructuralAcceptedCommandResult> | null;
      readonly finalAuthority: Readonly<SurfaceTreeAuthoritySnapshot>;
      readonly authorityTransfer: Readonly<SurfaceStructuralAuthorityTransferSnapshotInput> | null;
      readonly collision: Readonly<SurfaceTreeCollisionSnapshot>;
      readonly physicsWorld: Readonly<SurfaceRigidBodyWorld>;
      readonly transition: Readonly<SurfaceStructuralTransitionSnapshot>;
      readonly setCommitments: Readonly<{
        readonly detachedComponents: Readonly<SurfaceTreePreparedSetCommitment>;
        readonly sourceFragments: Readonly<SurfaceTreePreparedSetCommitment>;
        readonly newBodies: Readonly<SurfaceTreePreparedSetCommitment>;
        readonly resultingBodies: Readonly<SurfaceTreePreparedSetCommitment>;
      }>;
      readonly work: Readonly<SurfaceTreePreparedFireWork>;
      readonly suggestedEditRadiusMeters: number;
    }>
  | Readonly<{
      readonly status: "Rejected";
      readonly structuralCommandId: string | null;
      readonly code:
        | "BodyCapacityExceeded"
        | "ColliderBudgetExceeded"
        | "StructuralAuthorityRefused";
      readonly transition: Readonly<SurfaceStructuralTransitionSnapshot>;
    }>;

const setCommitment = (values: readonly string[]): Readonly<SurfaceTreePreparedSetCommitment> => {
  const orderedIds = ordered(values);
  return Object.freeze({
    count: orderedIds.length,
    orderedIds,
    rootHash: hashAdaptiveCanonical({ count: orderedIds.length, orderedIds })
  });
};

const canonicalBodySourcePlans = (
  values: readonly Readonly<SurfaceTreePreparedBodySourcePlan>[]
): readonly Readonly<SurfaceTreePreparedBodySourcePlan>[] => deepFreeze([...values].sort((left, right) =>
  left.component.componentId < right.component.componentId
    ? -1
    : left.component.componentId > right.component.componentId
      ? 1
      : 0));

const sameVector = (
  left: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>,
  right: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>
): boolean => left.x === right.x && left.y === right.y && left.z === right.z;

const sameTensor = (
  left: Readonly<StructuralMassProperties["inertiaTensorKgMetersSquared"]>,
  right: Readonly<StructuralMassProperties["inertiaTensorKgMetersSquared"]>
): boolean => left.xx === right.xx
  && left.yy === right.yy
  && left.zz === right.zz
  && left.xy === right.xy
  && left.xz === right.xz
  && left.yz === right.yz;

const sameCanonicalFacts = (left: unknown, right: unknown): boolean =>
  left === right || hashAdaptiveCanonical(left) === hashAdaptiveCanonical(right);

export const assertSurfaceTreePreparedBodySourceLifecycle = (
  bodySources: readonly Readonly<SurfaceTreePreparedBodySourcePlan>[],
  physicsWorld: Readonly<SurfaceRigidBodyWorld>,
  existingBodySources: readonly Readonly<SurfaceTreePreparedExistingBodySourceFacts>[] = []
): void => {
  if (
    bodySources.length > SURFACE_RIGID_BODY_MAX_BODIES
    || bodySources.length !== physicsWorld.bodies.length
    || existingBodySources.some((source) => !source.meshArtifactIsLazy)
  ) {
    throw new TypeError("Surface Tree body sources and Dynamic Bodies must share one capped lifecycle.");
  }
  const bodyById = new Map(physicsWorld.bodies.map((body) => [body.bodyId, body] as const));
  const componentIds = new Set<string>();
  const fragmentIds = new Set<string>();
  const bodyIds = new Set<string>();
  for (let index = 0; index < bodySources.length; index += 1) {
    const bodySource = bodySources[index];
    if (index > 0 && bodySources[index - 1].component.componentId >= bodySource.component.componentId) {
      throw new TypeError("Surface Tree body sources must use unique canonical Component order.");
    }
    const { component, fragment, massProperties, candidate, sourceObject } = bodySource;
    const body = bodyById.get(candidate.bodyId);
    validateSurfaceRigidBodyColliderRepresentation(candidate);
    const centerOfMassMeters = massProperties.centerOfMassMeters;
    if (
      componentIds.has(component.componentId)
      || fragmentIds.has(fragment.fragmentId)
      || bodyIds.has(candidate.bodyId)
      || fragment.componentId !== component.componentId
      || fragment.objectId !== component.objectId
      || fragment.objectRevision !== component.objectRevision
      || fragment.sourceContentHash !== component.sourceContentHash
      || sourceObject.objectId !== component.objectId
      || sourceObject.objectRevision !== component.objectRevision
      || sourceObject.contentHash !== component.sourceContentHash
      || massProperties.sourceRevision !== component.objectRevision
      || massProperties.sourceContentHash !== component.sourceContentHash
      || centerOfMassMeters === null
      || massProperties.totalMassKg !== candidate.massKg
      || !sameVector(centerOfMassMeters, candidate.centerOfMassMeters)
      || !sameTensor(massProperties.inertiaTensorKgMetersSquared, candidate.inertiaTensorKgMetersSquared)
      || candidate.componentId !== component.componentId
      || candidate.objectId !== component.objectId
      || candidate.sourceObjectRevision !== component.objectRevision
      || candidate.sourceContentHash !== component.sourceContentHash
      || candidate.colliderRevision !== component.objectRevision
      || candidate.colliderRepresentation.sourceObjectRevision !== component.objectRevision
      || candidate.colliderRepresentation.sourceContentHash !== component.sourceContentHash
      || body === undefined
      || body.componentId !== candidate.componentId
      || body.objectId !== candidate.objectId
      || body.sourceObjectRevision !== candidate.sourceObjectRevision
      || body.sourceContentHash !== candidate.sourceContentHash
      || body.colliderRevision !== candidate.colliderRevision
      || body.massKg !== candidate.massKg
      || body.inverseMassPerKg !== candidate.inverseMassPerKg
      || !sameTensor(
        body.inverseInertiaTensorPerKgMetersSquared,
        candidate.inverseInertiaTensorPerKgMetersSquared
      )
      || body.colliderRepresentation.sourceObjectRevision !== candidate.sourceObjectRevision
      || body.colliderRepresentation.sourceContentHash !== candidate.sourceContentHash
      || body.colliderRepresentation.representationHash
        !== candidate.colliderRepresentation.representationHash
      || !sameCanonicalFacts(body.colliderRepresentation, candidate.colliderRepresentation)
      || !sameCanonicalFacts(body.colliders, candidate.colliders)
      || body.activationSimulationTick !== candidate.activationSimulationTick
    ) {
      throw new TypeError("Surface Tree body source plan is not bijective with its immutable source and body.");
    }
    componentIds.add(component.componentId);
    fragmentIds.add(fragment.fragmentId);
    bodyIds.add(candidate.bodyId);
  }
};

const createBodySourcePlan = (
  sourceObject: Readonly<StructuralObject>,
  facts: Readonly<SurfaceTreeDetachedComponentFacts>,
  detachedAtSimulationTick: number,
  releaseHit: Readonly<{ readonly pointMeters: SpatialVector3; readonly normal: SpatialVector3 }>,
  gravityMetersPerSecondSquared: number
): Readonly<SurfaceTreePreparedBodySourcePlan> => {
  const centerOfMassMeters = facts.massProperties.centerOfMassMeters;
  if (centerOfMassMeters === null) {
    throw new TypeError("Detached Structural component has no center of mass.");
  }
  const candidateWithoutReleaseImpulse = createSurfaceRigidBodyCandidate({
    bodyId: bodyIdFor(facts.component.componentId),
    componentId: facts.component.componentId,
    objectId: facts.component.objectId,
    sourceObjectRevision: facts.component.objectRevision,
    sourceContentHash: facts.component.sourceContentHash,
    occupiedCells: facts.component.occupiedCells.map(globalQuantumForStructuralCell),
    cellSizeMeters: MICROVOXEL_BASE_QUANTUM_METERS,
    massKg: facts.massProperties.totalMassKg,
    centerOfMassMeters,
    inertiaTensorKgMetersSquared: facts.massProperties.inertiaTensorKgMetersSquared,
    colliderRevision: facts.component.objectRevision,
    detachedAtSimulationTick
  });
  const releaseVelocity = deriveSurfaceTreeReleaseVelocity({
    pointMeters: releaseHit.pointMeters,
    normal: releaseHit.normal,
    positionMeters: candidateWithoutReleaseImpulse.positionMeters,
    inverseMassPerKg: candidateWithoutReleaseImpulse.inverseMassPerKg,
    inverseInertiaTensorPerKgMetersSquared:
      candidateWithoutReleaseImpulse.inverseInertiaTensorPerKgMetersSquared,
    gravityMetersPerSecondSquared
  });
  return deepFreeze({
    sourceObject,
    component: facts.component,
    fragment: facts.fragment,
    massProperties: facts.massProperties,
    candidate: {
      ...candidateWithoutReleaseImpulse,
      linearVelocityMetersPerSecond: releaseVelocity.linearVelocityMetersPerSecond,
      angularVelocityRadiansPerSecond: releaseVelocity.angularVelocityRadiansPerSecond
    }
  });
};

const createSurfaceTreeTransferCommand = (
  damageAuthority: Readonly<SurfaceTreeAuthoritySnapshot>,
  damageCommand: Readonly<StructuralDestructionCommand>,
  detached: readonly Readonly<SurfaceTreeDetachedComponentFacts>[],
  fireCommandId: string
): StructuralTransferDetachedComponentsCommand =>
  validateStructuralTransferDetachedComponentsCommand({
    schemaVersion: STRUCTURAL_TRANSFER_COMMAND_SCHEMA_VERSION,
    kind: "TransferDetachedComponents",
    commandId: [
      "surface-tree-transfer",
      fireCommandId,
      damageAuthority.objectRevision,
      damageAuthority.editRevision
    ].join(":"),
    targetObjectId: damageAuthority.objectId,
    expectedObjectRevision: damageAuthority.objectRevision,
    resultingObjectRevision: damageAuthority.objectRevision + 1,
    expectedAdaptiveSource: damageAuthority.object.source,
    sourceFragmentIds: ordered(detached.map((facts) => facts.fragment.fragmentId)),
    actor: damageCommand.actor,
    source: damageCommand.source,
    sequence: damageAuthority.object.commandEvidence.length + 1,
    budgets: damageCommand.budgets
  });

const rejectedTransition = (
  input: Readonly<SurfaceTreePreparedFireInput>,
  structuralCommandId: string | null,
  code: "BodyCapacityExceeded" | "ColliderBudgetExceeded" | "StructuralAuthorityRefused"
): Readonly<SurfaceStructuralTransitionSnapshot> =>
  createSurfaceStructuralTransitionSnapshot({
    status: "Rejected",
    fireCommandId: input.fireCommandId,
    structuralCommandId,
    objectId: input.authority.objectId,
    currentObjectRevision: input.authority.objectRevision,
    currentEditRevision: input.authority.editRevision,
    currentContentHash: input.authority.objectContentHash,
    code,
    authorityTransfer: null,
    simulationTick: input.simulationTick
  });

const reject = (
  input: Readonly<SurfaceTreePreparedFireInput>,
  structuralCommandId: string | null,
  code: "BodyCapacityExceeded" | "ColliderBudgetExceeded" | "StructuralAuthorityRefused"
): SurfaceTreePreparedFire => Object.freeze({
  status: "Rejected" as const,
  structuralCommandId,
  code,
  transition: rejectedTransition(input, structuralCommandId, code)
});

export const prepareSurfaceTreeFire = (
  input: Readonly<SurfaceTreePreparedFireInput>
): SurfaceTreePreparedFire => {
  const structuralCommandId = [
    "surface-tree-edit",
    input.fireCommandId,
    input.authority.objectRevision,
    input.authority.editRevision
  ].join(":");
  let preview: ReturnType<typeof previewSurfaceTreeHit>;
  try {
    preview = previewSurfaceTreeHit(input.authority, Object.freeze({
      schemaVersion: SURFACE_TREE_CANONICAL_HIT_SCHEMA_VERSION,
      ordinal: input.authority.object.commandEvidence.length,
      address: input.hit.address,
      globalQuantum: input.hit.globalQuantum,
      pointMeters: input.hit.pointMeters,
      materialId: input.hit.materialId
    }), structuralCommandId);
  } catch {
    return reject(input, structuralCommandId, "StructuralAuthorityRefused");
  }
  if (preview.status === "Rejected") {
    return reject(input, preview.command.commandId, "StructuralAuthorityRefused");
  }
  const releaseHit = Object.freeze({
    pointMeters: createSpatialVector3(preview.hit.pointMeters, "/surfaceTreeRelease/pointMeters"),
    normal: normalizeSpatialVector(
      createSpatialVector3(input.hit.normal, "/surfaceTreeRelease/normal"),
      "/surfaceTreeRelease/normal"
    )
  });
  const acceptedCollisionChanges: StructuralAcceptedCommandResult[] = [preview.result];
  const supportResult = preview.authority.classification.components.length === 0
    ? "Empty" as const
    : preview.authority.classification.detachedComponents.length > 0
      ? "Detached" as const
      : "Anchored" as const;
  const detachedComponentIds = ordered(
    preview.authority.classification.detachedComponents.map((component) => component.componentId)
  );
  let detachedFacts: readonly Readonly<SurfaceTreeDetachedComponentFacts>[] = Object.freeze([]);
  let finalAuthority = preview.authority;
  let authorityTransfer: Readonly<SurfaceStructuralAuthorityTransferSnapshotInput> | null = null;
  let transferResult: Readonly<StructuralAcceptedCommandResult> | null = null;
  let newBodySourcePlans: readonly Readonly<SurfaceTreePreparedBodySourcePlan>[] = Object.freeze([]);
  try {
    assertSurfaceTreePreparedBodySourceLifecycle(
      input.bodySources,
      input.physicsWorld,
      input.bodySources
    );
    if (supportResult === "Detached") {
      detachedFacts = deriveSurfaceTreeDetachedComponents(preview.authority);
      if (
        detachedFacts.length !== detachedComponentIds.length
        || detachedFacts.some((facts, index) =>
          facts.component.componentId !== detachedComponentIds[index])
      ) {
        throw new TypeError("Detached Structural facts must exactly bind the Damage classification.");
      }
      newBodySourcePlans = canonicalBodySourcePlans(detachedFacts.map((facts) =>
        createBodySourcePlan(
          preview.authority.object,
          facts,
          input.simulationTick,
          releaseHit,
          input.physicsWorld.gravityMetersPerSecondSquared
        )));
      const transferCommand = createSurfaceTreeTransferCommand(
        preview.authority,
        preview.command,
        detachedFacts,
        input.fireCommandId
      );
      const appliedTransfer = applyStructuralDetachedComponentTransfer(
        preview.authority.object,
        transferCommand
      );
      if (appliedTransfer.status !== "Applied") {
        throw new TypeError("Structural detached-component transfer was not applied.");
      }
      transferResult = appliedTransfer;
      acceptedCollisionChanges.push(appliedTransfer);
      finalAuthority = deriveSurfaceTreeAuthority(preview.authority.tree, appliedTransfer.object);
      if (
        finalAuthority.classification.detachedComponents.length !== 0
        || finalAuthority.classification.fragments.length !== 0
        || finalAuthority.classification.components.some((component) => !component.anchored)
      ) {
        throw new TypeError("Final Structural Tree authority must contain only attached current components.");
      }
      authorityTransfer = Object.freeze({
        transferCommandId: transferCommand.commandId,
        previousObjectRevision: preview.authority.objectRevision,
        resultingObjectRevision: finalAuthority.objectRevision,
        previousEditRevision: preview.authority.editRevision,
        resultingEditRevision: finalAuthority.editRevision,
        previousContentHash: preview.authority.objectContentHash,
        resultingContentHash: finalAuthority.objectContentHash,
        transferredCellCount: appliedTransfer.changedVoxelCount,
        changedBrickIds: ordered(appliedTransfer.changedBrickKeys.map(structuralTransitionBrickId)),
        sourceFragmentIds: transferCommand.sourceFragmentIds
      });
    }
  } catch {
    return reject(input, preview.command.commandId, "StructuralAuthorityRefused");
  }

  let physicsWorld = input.physicsWorld;
  if (newBodySourcePlans.length > 0) {
    let admission;
    try {
      admission = admitSurfaceRigidBodyBatch(
        input.physicsWorld,
        newBodySourcePlans.map((bodySource) => bodySource.candidate)
      );
    } catch {
      return reject(input, preview.command.commandId, "StructuralAuthorityRefused");
    }
    if (admission.status === "Rejected") {
      return reject(input, preview.command.commandId, admission.code);
    }
    physicsWorld = admission.world;
  }

  let transition: Readonly<SurfaceStructuralTransitionSnapshot>;
  try {
    const allBodySourcePlans = canonicalBodySourcePlans([...input.bodySources, ...newBodySourcePlans]);
    assertSurfaceTreePreparedBodySourceLifecycle(allBodySourcePlans, physicsWorld);
    transition = createSurfaceStructuralTransitionSnapshot({
      status: preview.result.status,
      fireCommandId: input.fireCommandId,
      structuralCommandId: preview.command.commandId,
      objectId: preview.authority.objectId,
      previousObjectRevision: input.authority.objectRevision,
      resultingObjectRevision: preview.authority.objectRevision,
      previousEditRevision: input.authority.editRevision,
      resultingEditRevision: preview.authority.editRevision,
      previousContentHash: input.authority.objectContentHash,
      resultingContentHash: preview.authority.objectContentHash,
      changedCellCount: preview.result.changedVoxelCount,
      changedBrickIds: ordered(preview.result.changedBrickKeys.map(structuralTransitionBrickId)),
      supportResult,
      detachedComponentIds,
      authorityTransfer,
      simulationTick: input.simulationTick
    });
  } catch {
    return reject(input, preview.command.commandId, "StructuralAuthorityRefused");
  }

  let collision: Readonly<SurfaceTreeCollisionSnapshot>;
  try {
    collision = createSurfaceTreeCollisionSnapshotFromAcceptedChanges(
      input.authority,
      input.collision,
      finalAuthority,
      Object.freeze(acceptedCollisionChanges)
    );
  } catch {
    return reject(input, preview.command.commandId, "StructuralAuthorityRefused");
  }

  const resultingBodyIds = physicsWorld.bodies.map((body) => body.bodyId);
  const transferChangedBrickCount = transferResult?.changedBrickKeys.length ?? 0;
  const transferChangedCellCount = transferResult?.changedVoxelCount ?? 0;
  const damageConnectivityWork = readStructuralConnectivityWork(preview.result.object);
  const collisionWork = readSurfaceTreeCollisionDerivationStats(collision) ?? null;
  return deepFreeze({
    status: "Ready" as const,
    structuralCommandId: preview.command.commandId,
    damageResult: preview.result,
    supportResult,
    detachedFacts,
    newBodySourcePlans,
    transferResult,
    finalAuthority,
    authorityTransfer,
    collision,
    physicsWorld,
    transition,
    setCommitments: {
      detachedComponents: setCommitment(detachedComponentIds),
      sourceFragments: setCommitment(detachedFacts.map((facts) => facts.fragment.fragmentId)),
      newBodies: setCommitment(newBodySourcePlans.map((source) => source.candidate.bodyId)),
      resultingBodies: setCommitment(resultingBodyIds)
    },
    work: {
      accounting: {
        schemaVersion: SURFACE_TREE_PREPARED_WORK_ACCOUNTING_SCHEMA_VERSION,
        completeness: "Partial" as const,
        phases: {
          damage: damageConnectivityWork === undefined ? "Unavailable" as const : "Partial" as const,
          detached: detachedFacts.length === 0 ? "Complete" as const : "Partial" as const,
          bodyPlanning: newBodySourcePlans.length === 0 ? "Complete" as const : "Partial" as const,
          transfer: transferResult === null ? "Complete" as const : "Unavailable" as const,
          collision: collisionWork === null ? "Unavailable" as const : "Partial" as const,
          physics: newBodySourcePlans.length === 0 ? "Complete" as const : "Partial" as const,
          finalization: "Unavailable" as const
        }
      },
      damage: {
        changedBrickCount: preview.result.changedBrickKeys.length,
        changedCellCount: preview.result.changedVoxelCount,
        connectivity: damageConnectivityWork
      },
      detached: {
        componentCount: detachedFacts.length,
        massCellCount: detachedFacts.reduce(
          (count, facts) => count + facts.component.occupiedCells.length,
          0
        )
      },
      bodyPlanning: {
        bodyCount: newBodySourcePlans.length,
        colliderWork: newBodySourcePlans.map((source) => ({
          bodyId: source.candidate.bodyId,
          counters: source.candidate.colliderRepresentation.workCounters
        }))
      },
      transfer: {
        status: transferResult === null ? "NotRequired" as const : "Applied" as const,
        changedBrickCount: transferChangedBrickCount,
        changedCellCount: transferChangedCellCount
      },
      collision: collisionWork,
      physics: {
        predecessorBodyCount: input.physicsWorld.bodies.length,
        admittedBodyCount: newBodySourcePlans.length,
        resultingBodyCount: physicsWorld.bodies.length
      }
    },
    suggestedEditRadiusMeters: MICROVOXEL_BASE_QUANTUM_METERS * 3
  });
};
