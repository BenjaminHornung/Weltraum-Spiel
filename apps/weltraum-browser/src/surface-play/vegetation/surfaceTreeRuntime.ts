import {
  deepFreeze,
  hashAdaptiveCanonical,
  MICROVOXEL_BASE_QUANTUM_METERS,
  serializeAdaptiveKey,
  type AdaptiveBrickKey
} from "../../voxel/adaptive";
import {
  extractStructuralMeshData,
  localCellIndexFromOffset,
  transferStructuralMeshDerivationStats,
  type StructuralComponent,
  type StructuralFragment,
  type StructuralMassProperties,
  type StructuralMeshProduct,
  type StructuralObject
} from "../../voxel/structural";
import {
  createSurfaceStructuralPresentationSnapshot,
  type SurfaceStructuralPresentationSnapshot,
  type SurfaceStructuralTransitionSnapshot
} from "../contracts";
import {
  stepSurfaceRigidBodyWorld,
  surfaceRigidBodySnapshots,
  type SurfaceRigidBodyCandidate,
  type SurfaceRigidBodyWorld
} from "../physics";
import { quantizeSurfaceHitCoordinateMeters } from "../surfacePlayQuantization";
import type { HestiaUmbrellaTree } from "./hestiaUmbrellaTree";
import {
  createSurfaceTreeAuthority,
  projectSurfaceTreeAuthoritySnapshotTransport,
  type SurfaceTreeAuthoritySnapshot
} from "./surfaceTreeAuthority";
import {
  createSurfaceTreeCollisionSnapshot,
  type SurfaceTreeCollisionHit,
  type SurfaceTreeCollisionSnapshot
} from "./surfaceTreeCollision";
import {
  assertSurfaceTreePreparedBodySourceLifecycle,
  prepareSurfaceTreeFire,
  type SurfaceTreePreparedBodySourcePlan,
  type SurfaceTreePreparedExistingBodySourceFacts
} from "./surfaceTreePreparedFire";
import {
  createPreparedStructuralFireCanonicalItemSource,
  createPreparedStructuralFireCommand,
  createPreparedStructuralFireLogicalViewDescriptor,
  createPreparedStructuralFireLogicalViewFacts,
  createPreparedStructuralFirePageEnvelope,
  createPreparedStructuralFirePhysicalPageFacts,
  createPreparedStructuralFireRequest,
  createPreparedStructuralFireSeedManifest,
  preparedStructuralFireSeedHash,
  streamPreparedStructuralFireLogicalView,
  streamPreparedStructuralFirePages
} from "../workers/preparedStructuralFireWireCodec";
import type {
  PreparedStructuralFireCanonicalItem,
  PreparedStructuralFireHash,
  PreparedStructuralFireLogicalViewName,
  PreparedStructuralFireSeedManifest
} from "../workers/preparedStructuralFireWire";
import type { PreparedStructuralFireWorkerClientInput } from "../workers/preparedStructuralFireWorkerClient";

const componentMeshArtifactId = (
  componentId: string,
  objectRevision: number
): string => ["surface-tree-component-mesh", componentId, objectRevision].join(":");

export interface SurfaceTreeRuntimeState {
  readonly authority: Readonly<SurfaceTreeAuthoritySnapshot>;
  readonly collision: Readonly<SurfaceTreeCollisionSnapshot>;
  readonly physicsWorld: Readonly<SurfaceRigidBodyWorld>;
  readonly bodySources: readonly Readonly<SurfaceTreeBodySourceArchive>[];
  readonly latestTransition: Readonly<SurfaceStructuralTransitionSnapshot> | null;
}

export interface SurfaceTreeStructuralMeshArtifact {
  readonly meshArtifactId: string;
  readonly space: "World" | "BodyLocal";
  readonly mesh: Readonly<StructuralMeshProduct>;
}

export interface SurfaceTreeBodySourceArchive {
  readonly sourceObject: Readonly<StructuralObject>;
  readonly component: Readonly<StructuralComponent>;
  readonly fragment: Readonly<StructuralFragment>;
  readonly massProperties: Readonly<StructuralMassProperties>;
  readonly candidate: Readonly<SurfaceRigidBodyCandidate>;
  readonly meshArtifact: Readonly<SurfaceTreeStructuralMeshArtifact>;
}

export type SurfaceTreeFirePreflight =
  | Readonly<{
      readonly status: "Ready";
      readonly state: Readonly<SurfaceTreeRuntimeState>;
      readonly structuralCommandId: string;
      readonly supportResult: "Anchored" | "Detached" | "Empty";
      readonly suggestedEditRadiusMeters: number;
    }>
  | Readonly<{
      readonly status: "Rejected";
      readonly state: Readonly<SurfaceTreeRuntimeState>;
      readonly code:
        | "BodyCapacityExceeded"
        | "ColliderBudgetExceeded"
        | "StructuralAuthorityRefused";
    }>;

export const createSurfaceTreeRuntimeState = (
  tree: Readonly<HestiaUmbrellaTree>,
  physicsWorld: Readonly<SurfaceRigidBodyWorld>
): Readonly<SurfaceTreeRuntimeState> =>
  createSurfaceTreeRuntimeStateFromAuthority(createSurfaceTreeAuthority(tree), physicsWorld);

export const createSurfaceTreeRuntimeStateFromAuthority = (
  authority: Readonly<SurfaceTreeAuthoritySnapshot>,
  physicsWorld: Readonly<SurfaceRigidBodyWorld>
): Readonly<SurfaceTreeRuntimeState> => {
  if (authority.classification.detachedComponents.length !== 0) {
    throw new TypeError("Initial Surface Tree authority must contain only attached current components.");
  }
  if (physicsWorld.bodies.length !== 0) {
    throw new TypeError("Initial Surface Tree runtime cannot adopt bodies without immutable body sources.");
  }
  return Object.freeze({
    authority,
    collision: createSurfaceTreeCollisionSnapshot(authority),
    physicsWorld,
    bodySources: Object.freeze([]),
    latestTransition: null
  });
};

const componentObject = (
  object: Readonly<StructuralObject>,
  component: Readonly<StructuralComponent>
): StructuralObject => {
  if (!Object.isFrozen(object) || !Object.isFrozen(component) || !Object.isFrozen(component.occupiedCells)) {
    throw new TypeError("Structural component isolation requires immutable authority identity and membership.");
  }
  const serializedKeys = new Map<Readonly<AdaptiveBrickKey>, string>();
  const cellsByBrick = new Map<string, Set<number>>();
  for (const address of component.occupiedCells) {
    let brickKey = serializedKeys.get(address.brickKey);
    if (brickKey === undefined) {
      brickKey = serializeAdaptiveKey(address.brickKey);
      serializedKeys.set(address.brickKey, brickKey);
    }
    const localIndex = localCellIndexFromOffset(address.local);
    const cells = cellsByBrick.get(brickKey);
    if (cells === undefined) cellsByBrick.set(brickKey, new Set([localIndex]));
    else cells.add(localIndex);
  }
  const bricks = Object.freeze(object.bricks.map((brick) => {
    const brickKey = serializedKeys.get(brick.key) ?? serializeAdaptiveKey(brick.key);
    const selected = cellsByBrick.get(brickKey);
    if (
      selected !== undefined
      && selected.size === brick.cells.length
      && brick.cells.every((cell) => selected.has(cell.localIndex))
    ) {
      return brick;
    }
    if (selected === undefined && brick.cells.length === 0) return brick;
    return Object.freeze({
      ...brick,
      cells: Object.freeze(selected === undefined
        ? []
        : brick.cells.filter((cell) => selected.has(cell.localIndex)))
    });
  }));
  return Object.freeze({
    ...object,
    bricks
  }) as StructuralObject;
};

const translatedMesh = (
  product: Readonly<StructuralMeshProduct>,
  offsetMeters: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>
): Readonly<StructuralMeshProduct> => {
  const positions = product.positions.map((value, index) => {
    const axis = index % 3;
    return value + (axis === 0 ? offsetMeters.x : axis === 1 ? offsetMeters.y : offsetMeters.z);
  });
  const boundsMeters = product.boundsMeters === null
    ? null
    : {
        min: {
          x: product.boundsMeters.min.x + offsetMeters.x,
          y: product.boundsMeters.min.y + offsetMeters.y,
          z: product.boundsMeters.min.z + offsetMeters.z
        },
        max: {
          x: product.boundsMeters.max.x + offsetMeters.x,
          y: product.boundsMeters.max.y + offsetMeters.y,
          z: product.boundsMeters.max.z + offsetMeters.z
        }
      };
  const payload = deepFreeze({
    schemaVersion: product.schemaVersion,
    algorithmVersion: product.algorithmVersion,
    positions,
    normals: product.normals,
    indices: product.indices,
    materialRanges: product.materialRanges,
    boundsMeters,
    sourceRevision: product.sourceRevision,
    sourceContentHash: product.sourceContentHash
  });
  const translated = deepFreeze({
    ...payload,
    contentHash: hashAdaptiveCanonical(payload)
  });
  transferStructuralMeshDerivationStats(product, translated);
  return translated;
};

const createComponentMeshArtifact = (
  object: Readonly<StructuralObject>,
  component: Readonly<StructuralComponent>,
  space: SurfaceTreeStructuralMeshArtifact["space"],
  centerOfMassMeters: Readonly<{ readonly x: number; readonly y: number; readonly z: number }> | null
): Readonly<SurfaceTreeStructuralMeshArtifact> => {
  if (space === "BodyLocal" && centerOfMassMeters === null) {
    throw new TypeError("Detached Structural component has no center of mass for BodyLocal meshing.");
  }
  const occupiedCellCount = component.occupiedCells.length;
  const isolatedObject = componentObject(object, component);
  const meshResult = extractStructuralMeshData(
    isolatedObject,
    {
      maxVisitedCells: occupiedCellCount,
      maxQuads: occupiedCellCount * 6,
      maxVertices: occupiedCellCount * 24,
      maxIndices: occupiedCellCount * 36
    }
  );
  if (meshResult.status === "Rejected") {
    throw new Error("Structural component mesh extraction failed: " + meshResult.code);
  }
  const objectOriginMeters = {
    x: object.frame.objectOriginQuantum.x * MICROVOXEL_BASE_QUANTUM_METERS,
    y: object.frame.objectOriginQuantum.y * MICROVOXEL_BASE_QUANTUM_METERS,
    z: object.frame.objectOriginQuantum.z * MICROVOXEL_BASE_QUANTUM_METERS
  };
  const offsetMeters = space === "World"
    ? objectOriginMeters
    : {
        x: objectOriginMeters.x - centerOfMassMeters!.x,
        y: objectOriginMeters.y - centerOfMassMeters!.y,
        z: objectOriginMeters.z - centerOfMassMeters!.z
      };
  const result = deepFreeze({
    meshArtifactId: componentMeshArtifactId(component.componentId, component.objectRevision),
    space,
    mesh: translatedMesh(meshResult.product, offsetMeters)
  });
  return result;
};

export const resolveSurfaceTreeStructuralMeshArtifact = (
  state: Readonly<SurfaceTreeRuntimeState>,
  meshArtifactId: string
): Readonly<SurfaceTreeStructuralMeshArtifact> | undefined => {
  const component = state.authority.classification.anchoredComponents.find((candidate) =>
    componentMeshArtifactId(candidate.componentId, candidate.objectRevision) === meshArtifactId);
  if (component !== undefined) {
    return createComponentMeshArtifact(state.authority.object, component, "World", null);
  }
  const bodySource = state.bodySources.find((candidate) =>
    componentMeshArtifactId(
      candidate.component.componentId,
      candidate.component.objectRevision
    ) === meshArtifactId);
  return bodySource?.meshArtifact;
};

const createBodySourceArchive = (
  plan: Readonly<SurfaceTreePreparedBodySourcePlan>
): Readonly<SurfaceTreeBodySourceArchive> => {
  const centerOfMassMeters = plan.massProperties.centerOfMassMeters;
  if (centerOfMassMeters === null) {
    throw new TypeError("Detached Structural component has no center of mass.");
  }
  let meshArtifact: Readonly<SurfaceTreeStructuralMeshArtifact> | undefined;
  return deepFreeze({
    sourceObject: plan.sourceObject,
    component: plan.component,
    fragment: plan.fragment,
    massProperties: plan.massProperties,
    candidate: plan.candidate,
    get meshArtifact(): Readonly<SurfaceTreeStructuralMeshArtifact> {
      meshArtifact ??= createComponentMeshArtifact(
        plan.sourceObject,
        plan.component,
        "BodyLocal",
        centerOfMassMeters
      );
      return meshArtifact;
    }
  });
};

const canonicalBodySources = (
  values: readonly Readonly<SurfaceTreeBodySourceArchive>[]
): readonly Readonly<SurfaceTreeBodySourceArchive>[] => deepFreeze([...values].sort((left, right) =>
  left.component.componentId < right.component.componentId
    ? -1
    : left.component.componentId > right.component.componentId
      ? 1
      : 0));

const preparedBodySourceFacts = (
  bodySources: readonly Readonly<SurfaceTreeBodySourceArchive>[]
): readonly Readonly<SurfaceTreePreparedExistingBodySourceFacts>[] => bodySources.map((bodySource) => ({
  sourceObject: bodySource.sourceObject,
  component: bodySource.component,
  fragment: bodySource.fragment,
  massProperties: bodySource.massProperties,
  candidate: bodySource.candidate,
  meshArtifactIsLazy:
    Object.getOwnPropertyDescriptor(bodySource, "meshArtifact")?.get !== undefined
}));

const preparedWorkerSeedView = (
  logicalViewName: PreparedStructuralFireLogicalViewName,
  items: readonly Readonly<PreparedStructuralFireCanonicalItem>[],
  viewOrdinal: number
) => {
  const openItems = () => items.map((item) =>
    createPreparedStructuralFireCanonicalItemSource(logicalViewName, item));
  const logical = createPreparedStructuralFireLogicalViewFacts(logicalViewName, openItems);
  const openBytes = () => streamPreparedStructuralFireLogicalView(logicalViewName, openItems);
  const physical = createPreparedStructuralFirePhysicalPageFacts(logical, "Seed", openBytes);
  return Object.freeze({
    logical,
    openBytes,
    descriptor: createPreparedStructuralFireLogicalViewDescriptor(
      viewOrdinal,
      logical,
      "Seed",
      physical
    )
  });
};

const preparedCallerNonce = (
  state: Readonly<SurfaceTreeRuntimeState>,
  fireCommandId: string,
  simulationTick: number
): string => ["a", "b"].map((part) => hashAdaptiveCanonical({
  schemaVersion: "surface-tree-prepared-caller-nonce-v1",
  part,
  fireCommandId,
  objectId: state.authority.objectId,
  objectRevision: state.authority.objectRevision,
  editRevision: state.authority.editRevision,
  simulationTick
}).slice("fnv1a64-v1:".length)).join("");

export const deriveSurfaceTreePreparedStructuralCommandId = (
  state: Readonly<SurfaceTreeRuntimeState>,
  fireCommandId: string
): string => [
  "surface-tree-edit",
  fireCommandId,
  state.authority.objectRevision,
  state.authority.editRevision
].join(":");

export const createSurfaceTreePreparedFireWorkerInput = (
  state: Readonly<SurfaceTreeRuntimeState>,
  input: Readonly<{
    readonly fireCommandId: string;
    readonly hit: Readonly<SurfaceTreeCollisionHit>;
    readonly simulationTick: number;
  }>
): Readonly<PreparedStructuralFireWorkerClientInput> => {
  if (state.bodySources.length !== 0 || state.physicsWorld.bodies.length !== 0) {
    throw new RangeError("Phase 5A preparation supports the initial body-free Structural Tree only.");
  }
  const globalQuantum = Object.freeze({
    x: quantizeSurfaceHitCoordinateMeters(input.hit.pointMeters.x) / MICROVOXEL_BASE_QUANTUM_METERS,
    y: quantizeSurfaceHitCoordinateMeters(input.hit.pointMeters.y) / MICROVOXEL_BASE_QUANTUM_METERS,
    z: quantizeSurfaceHitCoordinateMeters(input.hit.pointMeters.z) / MICROVOXEL_BASE_QUANTUM_METERS
  });
  const hit = Object.freeze({
    address: input.hit.address,
    globalQuantum,
    pointMeters: input.hit.pointMeters,
    normal: input.hit.normal,
    materialId: input.hit.materialId
  });
  const seedViews = Object.freeze([
    preparedWorkerSeedView("seed.authority", [{
      key: "@",
      payload: projectSurfaceTreeAuthoritySnapshotTransport(state.authority)
    }], 0),
    preparedWorkerSeedView("seed.collision", [{ key: "@", payload: state.collision }], 1),
    preparedWorkerSeedView("seed.existingBodySourceFacts", [], 2),
    preparedWorkerSeedView("seed.physicsImmutable", [], 3),
    preparedWorkerSeedView("seed.physicsDynamicState", [{
      key: "0:world",
      payload: {
        kind: "World",
        simulationTick: state.physicsWorld.simulationTick,
        gravityMetersPerSecondSquared: state.physicsWorld.gravityMetersPerSecondSquared,
        terrainColliders: state.physicsWorld.terrainColliders,
        physicsFailure: state.physicsWorld.physicsFailure
      }
    }], 4)
  ]);
  const manifest = createPreparedStructuralFireSeedManifest(
    seedViews.map((view) => view.descriptor)
  );
  const seedHash = preparedStructuralFireSeedHash(manifest);
  const structuralCommandId = deriveSurfaceTreePreparedStructuralCommandId(state, input.fireCommandId);
  const command = createPreparedStructuralFireCommand({
    seedHash,
    fireCommandId: input.fireCommandId,
    structuralCommandId,
    hit,
    simulationTick: input.simulationTick
  });
  const request = createPreparedStructuralFireRequest({
    seedHash,
    commandHash: command.commandHash,
    callerNonce: preparedCallerNonce(state, input.fireCommandId, input.simulationTick),
    source: {
      objectId: state.authority.objectId,
      objectRevision: state.authority.objectRevision,
      editRevision: state.authority.editRevision,
      contentHash: state.authority.objectContentHash as PreparedStructuralFireHash
    },
    activationTick: input.simulationTick,
    deadlineTick: input.simulationTick + 600
  });
  return Object.freeze({
    request,
    command,
    previousChainHash: hashAdaptiveCanonical({
      schemaVersion: "surface-tree-prepared-previous-chain-v1",
      objectId: state.authority.objectId,
      objectRevision: state.authority.objectRevision,
      editRevision: state.authority.editRevision,
      fireCommandId: input.fireCommandId
    }) as PreparedStructuralFireHash,
    seed: Object.freeze({
      manifest,
      openPages: function* (workerEpoch: number) {
        for (const view of seedViews) {
          for (const page of streamPreparedStructuralFirePages(view.logical, "Seed", view.openBytes)) {
            yield createPreparedStructuralFirePageEnvelope(
              request,
              workerEpoch,
              page.header,
              page.bytes
            );
          }
        }
      }
    })
  });
};

/**
 * Builds only the command/request envelope for a seed already retained by the worker.
 * Collision/physics projections stay on the one-time PrepareSeed path.
 */
export const createSurfaceTreePreparedFireWorkerRunInput = (
  state: Readonly<SurfaceTreeRuntimeState>,
  input: Readonly<{
    readonly fireCommandId: string;
    readonly hit: Readonly<SurfaceTreeCollisionHit>;
    readonly simulationTick: number;
  }>,
  seedManifest: Readonly<PreparedStructuralFireSeedManifest>
): Readonly<PreparedStructuralFireWorkerClientInput> => {
  const globalQuantum = Object.freeze({
    x: quantizeSurfaceHitCoordinateMeters(input.hit.pointMeters.x) / MICROVOXEL_BASE_QUANTUM_METERS,
    y: quantizeSurfaceHitCoordinateMeters(input.hit.pointMeters.y) / MICROVOXEL_BASE_QUANTUM_METERS,
    z: quantizeSurfaceHitCoordinateMeters(input.hit.pointMeters.z) / MICROVOXEL_BASE_QUANTUM_METERS
  });
  const hit = Object.freeze({
    address: input.hit.address,
    globalQuantum,
    pointMeters: input.hit.pointMeters,
    normal: input.hit.normal,
    materialId: input.hit.materialId
  });
  const seedHash = preparedStructuralFireSeedHash(seedManifest);
  const command = createPreparedStructuralFireCommand({
    seedHash,
    fireCommandId: input.fireCommandId,
    structuralCommandId: deriveSurfaceTreePreparedStructuralCommandId(state, input.fireCommandId),
    hit,
    simulationTick: input.simulationTick
  });
  const request = createPreparedStructuralFireRequest({
    seedHash,
    commandHash: command.commandHash,
    callerNonce: preparedCallerNonce(state, input.fireCommandId, input.simulationTick),
    source: {
      objectId: state.authority.objectId,
      objectRevision: state.authority.objectRevision,
      editRevision: state.authority.editRevision,
      contentHash: state.authority.objectContentHash as PreparedStructuralFireHash
    },
    activationTick: input.simulationTick,
    deadlineTick: input.simulationTick + 600
  });
  return Object.freeze({
    request,
    command,
    previousChainHash: hashAdaptiveCanonical({
      schemaVersion: "surface-tree-prepared-previous-chain-v1",
      objectId: state.authority.objectId,
      objectRevision: state.authority.objectRevision,
      editRevision: state.authority.editRevision,
      fireCommandId: input.fireCommandId
    }) as PreparedStructuralFireHash,
    seedManifest
  });
};

export const preflightSurfaceTreeFire = (
  state: Readonly<SurfaceTreeRuntimeState>,
  input: Readonly<{
    readonly fireCommandId: string;
    readonly hit: Readonly<SurfaceTreeCollisionHit>;
    readonly simulationTick: number;
  }>
): SurfaceTreeFirePreflight => {
  const globalQuantum = Object.freeze({
    x: quantizeSurfaceHitCoordinateMeters(input.hit.pointMeters.x)
      / MICROVOXEL_BASE_QUANTUM_METERS,
    y: quantizeSurfaceHitCoordinateMeters(input.hit.pointMeters.y)
      / MICROVOXEL_BASE_QUANTUM_METERS,
    z: quantizeSurfaceHitCoordinateMeters(input.hit.pointMeters.z)
      / MICROVOXEL_BASE_QUANTUM_METERS
  });
  const prepared = prepareSurfaceTreeFire({
    authority: state.authority,
    collision: state.collision,
    physicsWorld: state.physicsWorld,
    bodySources: preparedBodySourceFacts(state.bodySources),
    fireCommandId: input.fireCommandId,
    hit: {
      address: input.hit.address,
      globalQuantum,
      pointMeters: input.hit.pointMeters,
      normal: input.hit.normal,
      materialId: input.hit.materialId
    },
    simulationTick: input.simulationTick
  });
  if (prepared.status === "Rejected") {
    return Object.freeze({
      status: "Rejected" as const,
      state: Object.freeze({ ...state, latestTransition: prepared.transition }),
      code: prepared.code
    });
  }
  const bodySources = canonicalBodySources([
    ...state.bodySources,
    ...prepared.newBodySourcePlans.map(createBodySourceArchive)
  ]);
  const nextState = Object.freeze({
    authority: prepared.finalAuthority,
    collision: prepared.collision,
    physicsWorld: prepared.physicsWorld,
    bodySources,
    latestTransition: prepared.transition
  });
  return Object.freeze({
    status: "Ready" as const,
    state: nextState,
    structuralCommandId: prepared.structuralCommandId,
    supportResult: prepared.supportResult,
    suggestedEditRadiusMeters: prepared.suggestedEditRadiusMeters
  });
};

export const advanceSurfaceTreePhysics = (
  state: Readonly<SurfaceTreeRuntimeState>
): Readonly<SurfaceTreeRuntimeState> => {
  const stepped = stepSurfaceRigidBodyWorld(state.physicsWorld);
  return Object.freeze({ ...state, physicsWorld: stepped.world });
};

export const createSurfaceTreePresentationSnapshot = (
  state: Readonly<SurfaceTreeRuntimeState>,
  input: Readonly<{
    readonly bodyId: string;
    readonly regionId: string;
    readonly surfaceFrameId: string;
    readonly regionRevision: number;
    readonly simulationTick: number;
  }>
): Readonly<SurfaceStructuralPresentationSnapshot> => {
  const bodies = surfaceRigidBodySnapshots(state.physicsWorld);
  assertSurfaceTreePreparedBodySourceLifecycle(
    preparedBodySourceFacts(state.bodySources),
    state.physicsWorld,
    preparedBodySourceFacts(state.bodySources)
  );
  const components = [...state.authority.classification.anchoredComponents]
    .sort((left, right) => left.componentId < right.componentId ? -1 : left.componentId > right.componentId ? 1 : 0)
    .map((component) => ({
      componentId: component.componentId,
      objectId: component.objectId,
      sourceObjectRevision: component.objectRevision,
      sourceContentHash: component.sourceContentHash,
      anchored: true as const,
      bodyId: null,
      meshArtifactId: componentMeshArtifactId(component.componentId, component.objectRevision)
    }));
  const bodySources = state.bodySources.map((bodySource) => ({
    componentId: bodySource.component.componentId,
    sourceFragmentId: bodySource.fragment.fragmentId,
    bodyId: bodySource.candidate.bodyId,
    objectId: bodySource.component.objectId,
    sourceObjectRevision: bodySource.component.objectRevision,
    sourceContentHash: bodySource.component.sourceContentHash,
    colliderRevision: bodySource.candidate.colliderRevision,
    meshArtifactId: componentMeshArtifactId(
      bodySource.component.componentId,
      bodySource.component.objectRevision
    )
  }));
  return createSurfaceStructuralPresentationSnapshot({
    ...input,
    objects: [{
      objectId: state.authority.objectId,
      treeInstanceId: state.authority.tree.instanceId,
      speciesId: state.authority.tree.speciesId,
      objectRevision: state.authority.objectRevision,
      editRevision: state.authority.editRevision,
      contentHash: state.authority.objectContentHash,
      componentIds: components.map((component) => component.componentId),
      meshArtifactId: [
        "surface-tree-object-mesh",
        state.authority.objectId,
        state.authority.objectRevision
      ].join(":")
    }],
    components,
    bodySources,
    dynamicBodies: bodies,
    latestTransition: state.latestTransition,
    physicsFailure: state.physicsWorld.physicsFailure,
    simulationTick: input.simulationTick
  });
};
