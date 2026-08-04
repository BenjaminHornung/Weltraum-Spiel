import { beforeAll, describe, expect, it } from "vitest";
import {
  MICROVOXEL_BASE_QUANTUM_METERS,
  deepFreeze,
  hashAdaptiveCanonical,
  serializeAdaptiveKey
} from "../../src/voxel/adaptive";
import {
  encodeStructuralResult,
  getStructuralVoxel,
  globalQuantumForStructuralCell,
  hashStructuralObjectContent,
  serializeStructuralCellAddress,
  structuralAddressForBrickCell,
  type StructuralObject
} from "../../src/voxel/structural";
import { createSurfaceRigidBodyWorld } from "../../src/surface-play/physics";
import { quantizeSurfaceHitCoordinateMeters } from "../../src/surface-play/surfacePlayQuantization";
import { createHestiaUmbrellaTree } from "../../src/surface-play/vegetation/hestiaUmbrellaTree";
import {
  createSurfaceTreeAuthority,
  deriveSurfaceTreeAuthority,
  deriveSurfaceTreeCanonicalHit,
  projectSurfaceTreeAuthoritySnapshotTransport,
  validateSurfaceTreeAuthoritySnapshotTransport,
  type SurfaceTreeAuthoritySnapshot
} from "../../src/surface-play/vegetation/surfaceTreeAuthority";
import {
  prepareSurfaceTreeFire,
  type SurfaceTreePreparedFire,
  type SurfaceTreePreparedSetCommitment
} from "../../src/surface-play/vegetation/surfaceTreePreparedFire";
import {
  createSurfaceTreePresentationSnapshot,
  createSurfaceTreeRuntimeStateFromAuthority,
  preflightSurfaceTreeFire,
  resolveSurfaceTreeStructuralMeshArtifact,
  type SurfaceTreeFirePreflight,
  type SurfaceTreeRuntimeState
} from "../../src/surface-play/vegetation/surfaceTreeRuntime";
import {
  PREPARED_STRUCTURAL_FIRE_RESULT_VIEW_NAMES,
  type PreparedStructuralFireCanonicalItem,
  type PreparedStructuralFireHash,
  type PreparedStructuralFireLogicalViewName
} from "../../src/surface-play/workers/preparedStructuralFireWire";
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
} from "../../src/surface-play/workers/preparedStructuralFireWireCodec";
import {
  PREPARED_STRUCTURAL_FIRE_PRIVATE_WORKER_CONTROL_SCHEMA_VERSION
} from "../../src/surface-play/workers/preparedStructuralFireProtocol";
import {
  PreparedStructuralFirePrivateWorkerRuntimeV2
} from "../../src/surface-play/workers/preparedStructuralFireWorker";

let initial: SurfaceTreeAuthoritySnapshot;

beforeAll(() => {
  initial = createSurfaceTreeAuthority(createHestiaUmbrellaTree());
}, 120_000);

const physicsWorld = () => createSurfaceRigidBodyWorld({
  simulationTick: 0,
  gravityMetersPerSecondSquared: 9.81,
  terrainColliders: []
});

const runtimeState = (authority = initial) =>
  createSurfaceTreeRuntimeStateFromAuthority(authority, physicsWorld());

type FireInput = Parameters<typeof preflightSurfaceTreeFire>[1];

const hitInput = (
  state: Readonly<SurfaceTreeRuntimeState>,
  ordinal: number,
  fireCommandId: string,
  simulationTick: number
): FireInput => {
  const hit = deriveSurfaceTreeCanonicalHit(state.authority, ordinal);
  const voxel = getStructuralVoxel(state.authority.object, hit.address);
  return Object.freeze({
    fireCommandId,
    hit: Object.freeze({
      address: hit.address,
      materialId: hit.materialId,
      semanticKey: voxel?.semanticKey ?? null,
      pointMeters: hit.pointMeters,
      normal: Object.freeze({ x: -1, y: 0, z: 0 })
    }),
    simulationTick
  });
};

const prepare = (
  state: Readonly<SurfaceTreeRuntimeState>,
  input: FireInput
): SurfaceTreePreparedFire => prepareSurfaceTreeFire(preparedInput(state, input));

const preparedInput = (
  state: Readonly<SurfaceTreeRuntimeState>,
  input: FireInput
) => ({
  authority: state.authority,
  collision: state.collision,
  physicsWorld: state.physicsWorld,
  bodySources: state.bodySources.map((bodySource) => ({
    sourceObject: bodySource.sourceObject,
    component: bodySource.component,
    fragment: bodySource.fragment,
    massProperties: bodySource.massProperties,
    candidate: bodySource.candidate,
    meshArtifactIsLazy:
      Object.getOwnPropertyDescriptor(bodySource, "meshArtifact")?.get !== undefined
  })),
  fireCommandId: input.fireCommandId,
  hit: {
    address: input.hit.address,
    globalQuantum: {
      x: quantizeSurfaceHitCoordinateMeters(input.hit.pointMeters.x)
        / MICROVOXEL_BASE_QUANTUM_METERS,
      y: quantizeSurfaceHitCoordinateMeters(input.hit.pointMeters.y)
        / MICROVOXEL_BASE_QUANTUM_METERS,
      z: quantizeSurfaceHitCoordinateMeters(input.hit.pointMeters.z)
        / MICROVOXEL_BASE_QUANTUM_METERS
    },
    pointMeters: input.hit.pointMeters,
    normal: input.hit.normal,
    materialId: input.hit.materialId
  },
  simulationTick: input.simulationTick
});

const privateWorkerView = (
  logicalViewName: PreparedStructuralFireLogicalViewName,
  items: readonly Readonly<PreparedStructuralFireCanonicalItem>[],
  viewOrdinal: number
) => {
  const openItems = () => items.map((item) =>
    createPreparedStructuralFireCanonicalItemSource(logicalViewName, item));
  const logical = createPreparedStructuralFireLogicalViewFacts(logicalViewName, openItems);
  const direction = logicalViewName.startsWith("seed.") ? "Seed" as const : "PreparedResult" as const;
  const openBytes = () => streamPreparedStructuralFireLogicalView(logicalViewName, openItems);
  const physical = createPreparedStructuralFirePhysicalPageFacts(logical, direction, openBytes);
  return Object.freeze({
    logical,
    openBytes,
    descriptor: createPreparedStructuralFireLogicalViewDescriptor(
      viewOrdinal,
      logical,
      direction,
      physical
    )
  });
};

const expectPrivateWorkerDetachedParity = (
  state: Readonly<SurfaceTreeRuntimeState>,
  input: FireInput,
  prepared: Extract<SurfaceTreePreparedFire, { readonly status: "Ready" }>
): void => {
  expect(state.bodySources).toHaveLength(0);
  expect(state.physicsWorld.bodies).toHaveLength(0);
  const seedDefinitions = [
    ["seed.authority", [{
      key: "@",
      payload: projectSurfaceTreeAuthoritySnapshotTransport(state.authority)
    }]],
    ["seed.collision", [{ key: "@", payload: state.collision }]],
    ["seed.existingBodySourceFacts", []],
    ["seed.physicsImmutable", []],
    ["seed.physicsDynamicState", [{
      key: "0:world",
      payload: {
        kind: "World",
        simulationTick: state.physicsWorld.simulationTick,
        gravityMetersPerSecondSquared: state.physicsWorld.gravityMetersPerSecondSquared,
        terrainColliders: state.physicsWorld.terrainColliders,
        physicsFailure: state.physicsWorld.physicsFailure
      }
    }]]
  ] as const;
  const seedViews = seedDefinitions.map(([name, items], viewOrdinal) =>
    privateWorkerView(name, items, viewOrdinal));
  const seedManifest = createPreparedStructuralFireSeedManifest(
    seedViews.map((view) => view.descriptor)
  );
  const seedHash = preparedStructuralFireSeedHash(seedManifest);
  const command = createPreparedStructuralFireCommand({
    seedHash,
    fireCommandId: input.fireCommandId,
    structuralCommandId: prepared.structuralCommandId,
    hit: preparedInput(state, input).hit,
    simulationTick: input.simulationTick
  });
  const request = createPreparedStructuralFireRequest({
    seedHash,
    commandHash: command.commandHash,
    callerNonce: "0123456789abcdef0123456789abcdef",
    source: {
      objectId: state.authority.objectId,
      objectRevision: state.authority.objectRevision,
      editRevision: state.authority.editRevision,
      contentHash: state.authority.objectContentHash as PreparedStructuralFireHash
    },
    activationTick: input.simulationTick,
    deadlineTick: input.simulationTick + 60
  });
  const outputs: unknown[] = [];
  const worker = new PreparedStructuralFirePrivateWorkerRuntimeV2(
    7,
    (output) => outputs.push(output)
  );
  for (const view of seedViews) {
    for (const page of streamPreparedStructuralFirePages(
      view.logical,
      "Seed",
      view.openBytes
    )) {
      expect(worker.acceptSeedPage(
        request,
        createPreparedStructuralFirePageEnvelope(request, 7, page.header, page.bytes)
      ).kind).toBe("Accepted");
    }
  }
  const bindSeed = {
    schemaVersion: PREPARED_STRUCTURAL_FIRE_PRIVATE_WORKER_CONTROL_SCHEMA_VERSION,
    kind: "BindSeed",
    workerEpoch: 7,
    request,
    manifest: seedManifest
  } as const;
  const normalSeeded = worker.bindSeed(bindSeed);
  expect(normalSeeded.kind).toBe("Seeded");

  const throwingDiagnostics = {
    start() { throw new Error("diagnostic start failed"); },
    finish() { throw new Error("diagnostic finish failed"); },
    startView() { throw new Error("diagnostic view start failed"); },
    finishView() { throw new Error("diagnostic view finish failed"); }
  };
  const throwingWorker = new PreparedStructuralFirePrivateWorkerRuntimeV2(7, () => undefined);
  for (const view of seedViews) {
    for (const page of streamPreparedStructuralFirePages(
      view.logical,
      "Seed",
      view.openBytes
    )) {
      expect(throwingWorker.acceptSeedPage(
        request,
        createPreparedStructuralFirePageEnvelope(request, 7, page.header, page.bytes)
      ).kind).toBe("Accepted");
    }
  }
  expect(throwingWorker.bindSeed(bindSeed, throwingDiagnostics)).toEqual(normalSeeded);
  expect(throwingWorker.readState()).toEqual(worker.readState());

  const missingSeedError = (diagnostics?: typeof throwingDiagnostics): string => {
    const invalidWorker = new PreparedStructuralFirePrivateWorkerRuntimeV2(7, () => undefined);
    try {
      invalidWorker.bindSeed(bindSeed, diagnostics);
      return "no error";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };
  expect(missingSeedError(throwingDiagnostics)).toBe(missingSeedError());
  expect(missingSeedError(throwingDiagnostics)).toMatch(/Missing seed page/);

  for (const view of seedViews) {
    for (const page of streamPreparedStructuralFirePages(
      view.logical,
      "Seed",
      view.openBytes
    )) {
      expect(worker.acceptSeedPage(
        request,
        createPreparedStructuralFirePageEnvelope(request, 7, page.header, page.bytes)
      ).kind).toBe("Accepted");
    }
  }
  expect(worker.readState().retainedInputPageCount).toBeGreaterThan(0);
  expect(worker.bindSeed(bindSeed).kind).toBe("AlreadyPresent");
  expect(worker.readState()).toMatchObject({
    replicaCount: 1,
    retainedInputPageCount: 0,
    retainedInputBytes: 0
  });
  const executeControl = {
    schemaVersion: PREPARED_STRUCTURAL_FIRE_PRIVATE_WORKER_CONTROL_SCHEMA_VERSION,
    kind: "ExecuteCommand",
    workerEpoch: 7,
    request,
    command,
    dispatchIndex: 0,
    attemptIndex: 0,
    previousChainHash: hashAdaptiveCanonical({
      schemaVersion: "prepared-fire-private-previous-chain-v1",
      value: "detached"
    }) as PreparedStructuralFireHash
  } as const;
  const ready = worker.executeCommand(executeControl);
  expect(throwingWorker.executeCommand(executeControl)).toEqual(ready);
  expect(Object.keys(ready).sort()).toEqual(["manifest", "receipt", "schemaVersion", "type"]);
  expect(ready.manifest.views.map((view) => view.logicalViewName)).toEqual(
    PREPARED_STRUCTURAL_FIRE_RESULT_VIEW_NAMES
  );
  expect(ready.manifest.views[1].itemCount).toBe(prepared.detachedFacts.length);
  expect(ready.manifest.views[2].itemCount).toBe(prepared.newBodySourcePlans.length);
  const emittedPageNames = outputs
    .filter((output): output is { kind: "PreparedResultPage"; envelope: { header: { logicalViewName: PreparedStructuralFireLogicalViewName } } } =>
      typeof output === "object" && output !== null && "kind" in output
      && output.kind === "PreparedResultPage")
    .map((output) => output.envelope.header.logicalViewName)
    .filter((name, index, names) => index === 0 || name !== names[index - 1]);
  expect(emittedPageNames).toEqual(PREPARED_STRUCTURAL_FIRE_RESULT_VIEW_NAMES);
  expect(outputs.at(-1)).toEqual({ kind: "Ready", ready });
  expect(worker.readState()).toMatchObject({
    replicaCount: 1,
    replicaSeedCount: 1,
    activeResultCount: 0,
    retainedInputPageCount: 0,
    retainedInputBytes: 0
  });

  const cancelledRequest = createPreparedStructuralFireRequest({
    seedHash,
    commandHash: command.commandHash,
    callerNonce: "fedcba9876543210fedcba9876543210",
    source: request.source,
    activationTick: request.activationTick,
    deadlineTick: request.deadlineTick
  });
  worker.cancel(cancelledRequest.rootJobId);
  expect(() => worker.executeCommand({
    schemaVersion: PREPARED_STRUCTURAL_FIRE_PRIVATE_WORKER_CONTROL_SCHEMA_VERSION,
    kind: "ExecuteCommand",
    workerEpoch: 7,
    request: cancelledRequest,
    command,
    dispatchIndex: 0,
    attemptIndex: 0,
    previousChainHash: ready.receipt.receiptHash
  })).toThrow();
  expect(worker.readState()).toMatchObject({ replicaCount: 1, activeResultCount: 0 });
  worker.releaseResult(cancelledRequest.rootJobId);
  expect(worker.releaseSeed({
    schemaVersion: PREPARED_STRUCTURAL_FIRE_PRIVATE_WORKER_CONTROL_SCHEMA_VERSION,
    kind: "ReleaseSeed",
    workerEpoch: 7,
    seedHash
  })).toBe(true);
  expect(worker.readState().replicaCount).toBe(0);
};

const preparedOracleProjection = (
  prepared: Extract<SurfaceTreePreparedFire, { readonly status: "Ready" }>
) => deepFreeze({
  structuralCommandId: prepared.structuralCommandId,
  supportResult: prepared.supportResult,
  damage: {
    status: prepared.damageResult.status,
    objectRevision: prepared.damageResult.object.objectRevision,
    editRevision: prepared.damageResult.object.editRevision,
    contentHash: prepared.damageResult.object.contentHash,
    resultHash: prepared.damageResult.resultHash,
    changedBrickCount: prepared.damageResult.changedBrickKeys.length,
    changedCellCount: prepared.damageResult.changedVoxelCount
  },
  finalAuthority: {
    objectRevision: prepared.finalAuthority.objectRevision,
    editRevision: prepared.finalAuthority.editRevision,
    contentHash: prepared.finalAuthority.objectContentHash,
    occupiedCellCount: prepared.finalAuthority.occupiedCellCount
  },
  transfer: prepared.transferResult === null ? null : {
    commandId: prepared.transferResult.commandId,
    objectRevision: prepared.transferResult.object.objectRevision,
    editRevision: prepared.transferResult.object.editRevision,
    contentHash: prepared.transferResult.object.contentHash,
    resultHash: prepared.transferResult.resultHash,
    changedBrickCount: prepared.transferResult.changedBrickKeys.length,
    changedCellCount: prepared.transferResult.changedVoxelCount
  },
  collision: {
    contentHash: prepared.collision.contentHash,
    objectRevision: prepared.collision.binding.objectRevision,
    objectContentHash: prepared.collision.binding.objectContentHash,
    cellCount: prepared.collision.cells.length
  },
  bodies: prepared.physicsWorld.bodies.map((body) => ({
    bodyId: body.bodyId,
    componentId: body.componentId,
    sourceObjectRevision: body.sourceObjectRevision,
    sourceContentHash: body.sourceContentHash,
    massKg: body.massKg,
    colliderRevision: body.colliderRevision,
    representationHash: body.colliderRepresentation.representationHash,
    colliderCount: body.colliders.length,
    activationSimulationTick: body.activationSimulationTick
  })),
  transition: prepared.transition,
  commitments: {
    detachedComponents: prepared.setCommitments.detachedComponents,
    sourceFragments: prepared.setCommitments.sourceFragments,
    newBodies: prepared.setCommitments.newBodies,
    resultingBodies: prepared.setCommitments.resultingBodies
  }
});

// Frozen, independently captured mature-fixture oracles prevent a shared direct/wrapper
// implementation regression from blessing itself. The hit API has no NoChange route:
// NoChange remains structural-command coverage and is intentionally not forced here.
const PREPARED_ORACLE_BYTES = deepFreeze({
  anchored: `{"structuralCommandId":"surface-tree-edit:fire:prepared-parity:anchored:0:0","supportResult":"Anchored","damage":{"status":"Applied","objectRevision":1,"editRevision":1,"contentHash":"fnv1a64-v1:4a9808e4c38cee14","resultHash":"fnv1a64-v1:926703ac88425a4f","changedBrickCount":1,"changedCellCount":90},"finalAuthority":{"objectRevision":1,"editRevision":1,"contentHash":"fnv1a64-v1:4a9808e4c38cee14","occupiedCellCount":3400},"transfer":null,"collision":{"contentHash":"fnv1a64-v1:8d52be04a6f4adb1","objectRevision":1,"objectContentHash":"fnv1a64-v1:4a9808e4c38cee14","cellCount":3400},"bodies":[],"transition":{"authorityTransfer":null,"changedBrickIds":["surface-tree-brick:l-4:x-0:y-16:z-0"],"changedCellCount":90,"detachedComponentIds":[],"fireCommandId":"fire:prepared-parity:anchored","objectId":"hestia.surface-play.tree-object.v1:5e8290c05a346cb8","previousContentHash":"fnv1a64-v1:dc5c694367b6250d","previousEditRevision":0,"previousObjectRevision":0,"resultingContentHash":"fnv1a64-v1:4a9808e4c38cee14","resultingEditRevision":1,"resultingObjectRevision":1,"simulationTick":1,"status":"Applied","structuralCommandId":"surface-tree-edit:fire:prepared-parity:anchored:0:0","supportResult":"Anchored"},"commitments":{"detachedComponents":{"count":0,"orderedIds":[],"rootHash":"fnv1a64-v1:eeb176d8a7592edd"},"sourceFragments":{"count":0,"orderedIds":[],"rootHash":"fnv1a64-v1:eeb176d8a7592edd"},"newBodies":{"count":0,"orderedIds":[],"rootHash":"fnv1a64-v1:eeb176d8a7592edd"},"resultingBodies":{"count":0,"orderedIds":[],"rootHash":"fnv1a64-v1:eeb176d8a7592edd"}}}`,
  detached: `{"structuralCommandId":"surface-tree-edit:fire:prepared-parity:detached:2:2","supportResult":"Detached","damage":{"status":"Applied","objectRevision":3,"editRevision":3,"contentHash":"fnv1a64-v1:330df5fa6cebfb1a","resultHash":"fnv1a64-v1:0d471746c1b8f13e","changedBrickCount":1,"changedCellCount":26},"finalAuthority":{"objectRevision":4,"editRevision":4,"contentHash":"fnv1a64-v1:32946f26196674b5","occupiedCellCount":644},"transfer":{"commandId":"surface-tree-transfer:fire:prepared-parity:detached:3:3","objectRevision":4,"editRevision":4,"contentHash":"fnv1a64-v1:32946f26196674b5","resultHash":"fnv1a64-v1:496febf5c8e591d8","changedBrickCount":10,"changedCellCount":2710},"collision":{"contentHash":"fnv1a64-v1:f5e2e292673a9570","objectRevision":4,"objectContentHash":"fnv1a64-v1:32946f26196674b5","cellCount":644},"bodies":[{"bodyId":"surface-tree-body:fnv1a64-v1:3b29f214b5206633","componentId":"fnv1a64-v1:3b29f214b5206633","sourceObjectRevision":3,"sourceContentHash":"fnv1a64-v1:330df5fa6cebfb1a","massKg":1481.9140625,"colliderRevision":3,"representationHash":"fnv1a64-v1:f2e511b8196f6dbd","colliderCount":55,"activationSimulationTick":4}],"transition":{"authorityTransfer":{"changedBrickIds":["surface-tree-brick:l-4:x-0:y-16:z-0","surface-tree-brick:l-4:x-0:y-32:z-0","surface-tree-brick:l-4:x-0:y-48:z-0","surface-tree-brick:l-4:x-0:y-48:z-16","surface-tree-brick:l-4:x-0:y-48:z-n16","surface-tree-brick:l-4:x-16:y-48:z-0","surface-tree-brick:l-4:x-16:y-48:z-16","surface-tree-brick:l-4:x-16:y-48:z-n16","surface-tree-brick:l-4:x-n16:y-48:z-0","surface-tree-brick:l-4:x-n16:y-48:z-16"],"previousContentHash":"fnv1a64-v1:330df5fa6cebfb1a","previousEditRevision":3,"previousObjectRevision":3,"resultingContentHash":"fnv1a64-v1:32946f26196674b5","resultingEditRevision":4,"resultingObjectRevision":4,"sourceFragmentIds":["fnv1a64-v1:b6219dbab1a1afc4"],"transferCommandId":"surface-tree-transfer:fire:prepared-parity:detached:3:3","transferredCellCount":2710},"changedBrickIds":["surface-tree-brick:l-4:x-0:y-16:z-0"],"changedCellCount":26,"detachedComponentIds":["fnv1a64-v1:3b29f214b5206633"],"fireCommandId":"fire:prepared-parity:detached","objectId":"hestia.surface-play.tree-object.v1:5e8290c05a346cb8","previousContentHash":"fnv1a64-v1:7d4ea997e7997a08","previousEditRevision":2,"previousObjectRevision":2,"resultingContentHash":"fnv1a64-v1:330df5fa6cebfb1a","resultingEditRevision":3,"resultingObjectRevision":3,"simulationTick":3,"status":"Applied","structuralCommandId":"surface-tree-edit:fire:prepared-parity:detached:2:2","supportResult":"Detached"},"commitments":{"detachedComponents":{"count":1,"orderedIds":["fnv1a64-v1:3b29f214b5206633"],"rootHash":"fnv1a64-v1:06069349d591af4e"},"sourceFragments":{"count":1,"orderedIds":["fnv1a64-v1:b6219dbab1a1afc4"],"rootHash":"fnv1a64-v1:e9a4aae7d9d8649c"},"newBodies":{"count":1,"orderedIds":["surface-tree-body:fnv1a64-v1:3b29f214b5206633"],"rootHash":"fnv1a64-v1:08ca5a44ac4153d3"},"resultingBodies":{"count":1,"orderedIds":["surface-tree-body:fnv1a64-v1:3b29f214b5206633"],"rootHash":"fnv1a64-v1:08ca5a44ac4153d3"}}}`,
  empty: `{"structuralCommandId":"surface-tree-edit:fire:prepared-parity:empty:0:0","supportResult":"Empty","damage":{"status":"Applied","objectRevision":1,"editRevision":1,"contentHash":"fnv1a64-v1:14b9ede98c9d8254","resultHash":"fnv1a64-v1:fef713c078b8d6aa","changedBrickCount":1,"changedCellCount":1},"finalAuthority":{"objectRevision":1,"editRevision":1,"contentHash":"fnv1a64-v1:14b9ede98c9d8254","occupiedCellCount":0},"transfer":null,"collision":{"contentHash":"fnv1a64-v1:32355eff46fd6f3b","objectRevision":1,"objectContentHash":"fnv1a64-v1:14b9ede98c9d8254","cellCount":0},"bodies":[],"transition":{"authorityTransfer":null,"changedBrickIds":["surface-tree-brick:l-4:x-0:y-0:z-0"],"changedCellCount":1,"detachedComponentIds":[],"fireCommandId":"fire:prepared-parity:empty","objectId":"hestia.surface-play.tree-object.v1:5e8290c05a346cb8","previousContentHash":"fnv1a64-v1:dfc24c78a936a471","previousEditRevision":0,"previousObjectRevision":0,"resultingContentHash":"fnv1a64-v1:14b9ede98c9d8254","resultingEditRevision":1,"resultingObjectRevision":1,"simulationTick":1,"status":"Applied","structuralCommandId":"surface-tree-edit:fire:prepared-parity:empty:0:0","supportResult":"Empty"},"commitments":{"detachedComponents":{"count":0,"orderedIds":[],"rootHash":"fnv1a64-v1:eeb176d8a7592edd"},"sourceFragments":{"count":0,"orderedIds":[],"rootHash":"fnv1a64-v1:eeb176d8a7592edd"},"newBodies":{"count":0,"orderedIds":[],"rootHash":"fnv1a64-v1:eeb176d8a7592edd"},"resultingBodies":{"count":0,"orderedIds":[],"rootHash":"fnv1a64-v1:eeb176d8a7592edd"}}}`
});

const ready = (
  prepared: SurfaceTreePreparedFire,
  wrapped: SurfaceTreeFirePreflight
) => {
  expect(prepared.status).toBe("Ready");
  expect(wrapped.status).toBe("Ready");
  if (prepared.status !== "Ready" || wrapped.status !== "Ready") {
    throw new Error("Surface Tree prepared parity fixture was rejected.");
  }
  expect(wrapped).toMatchObject({
    structuralCommandId: prepared.structuralCommandId,
    supportResult: prepared.supportResult,
    suggestedEditRadiusMeters: prepared.suggestedEditRadiusMeters
  });
  expect(wrapped.state.authority).toEqual(prepared.finalAuthority);
  expect(wrapped.state.collision).toEqual(prepared.collision);
  expect(wrapped.state.physicsWorld).toEqual(prepared.physicsWorld);
  expect(wrapped.state.latestTransition).toEqual(prepared.transition);
  expect(prepared.damageResult.object).not.toBe(wrapped.state.authority.object);
  return { prepared, wrapped };
};

const expectCommitment = (
  commitment: Readonly<SurfaceTreePreparedSetCommitment>,
  ids: readonly string[]
): void => {
  const orderedIds = [...ids].sort();
  expect(commitment).toEqual({
    count: orderedIds.length,
    orderedIds,
    rootHash: hashAdaptiveCanonical({ count: orderedIds.length, orderedIds })
  });
};

const expectDamageAndWork = (
  prepared: Extract<SurfaceTreePreparedFire, { readonly status: "Ready" }>,
  repeated: Extract<SurfaceTreePreparedFire, { readonly status: "Ready" }>
): void => {
  expect(new TextEncoder().encode(encodeStructuralResult(prepared.damageResult)))
    .toEqual(new TextEncoder().encode(encodeStructuralResult(repeated.damageResult)));
  expect(repeated).toEqual(prepared);
  expect(prepared.damageResult.object).toMatchObject({
    objectId: prepared.finalAuthority.objectId,
    contentHash: prepared.damageResult.object.contentHash,
    evidenceHash: prepared.damageResult.object.evidenceHash
  });
  expect(prepared.damageResult.resultHash).toMatch(/^fnv1a64-v1:[0-9a-f]{16}$/);
  expect(prepared.work.damage).toMatchObject({
    changedBrickCount: prepared.damageResult.changedBrickKeys.length,
    changedCellCount: prepared.damageResult.changedVoxelCount
  });
  expect(prepared.work.detached).toEqual({
    componentCount: prepared.detachedFacts.length,
    massCellCount: prepared.detachedFacts.reduce(
      (count, facts) => count + facts.component.occupiedCells.length,
      0
    )
  });
  expect(prepared.work.bodyPlanning.bodyCount).toBe(prepared.newBodySourcePlans.length);
  expect(prepared.work.physics).toEqual({
    predecessorBodyCount: prepared.physicsWorld.bodies.length - prepared.newBodySourcePlans.length,
    admittedBodyCount: prepared.newBodySourcePlans.length,
    resultingBodyCount: prepared.physicsWorld.bodies.length
  });
  expect(prepared.work.accounting).toMatchObject({
    schemaVersion: "surface-tree-prepared-work-accounting-v1",
    completeness: "Partial",
    phases: {
      damage: "Partial",
      collision: "Partial",
      finalization: "Unavailable"
    }
  });
};

const advance = (
  state: Readonly<SurfaceTreeRuntimeState>,
  ordinal: number
): Readonly<SurfaceTreeRuntimeState> => {
  const preflight = preflightSurfaceTreeFire(
    state,
    hitInput(state, ordinal, `fire:prepared-parity:${ordinal + 1}`, ordinal + 1)
  );
  if (preflight.status !== "Ready") {
    throw new Error(`Canonical Surface Tree hit ${ordinal + 1} was rejected: ${preflight.code}.`);
  }
  return preflight.state;
};

const objectWithCells = (
  source: Readonly<StructuralObject>,
  retainedCellKeys: ReadonlySet<string>
): StructuralObject => {
  const candidate = deepFreeze({
    ...source,
    bricks: source.bricks.map((brick) => ({
      ...brick,
      cells: brick.cells.filter((cell) => retainedCellKeys.has(serializeStructuralCellAddress(
        structuralAddressForBrickCell(brick, cell.localIndex)
      )))
    })),
    contentHash: ""
  }) as StructuralObject;
  return deepFreeze({ ...candidate, contentHash: hashStructuralObjectContent(candidate) }) as StructuralObject;
};

describe("prepared Surface Tree fire parity", () => {
  it("matches the synchronous wrapper for an anchored canonical hit", () => {
    const directState = runtimeState();
    const wrappedState = runtimeState();
    expect(directState).not.toBe(wrappedState);
    const directInput = hitInput(directState, 0, "fire:prepared-parity:anchored", 1);
    const wrappedInput = hitInput(wrappedState, 0, "fire:prepared-parity:anchored", 1);
    expect(directInput).toEqual(wrappedInput);

    const prepared = prepare(directState, directInput);
    const repeated = prepare(directState, directInput);
    const parity = ready(prepared, preflightSurfaceTreeFire(wrappedState, wrappedInput));
    expect(parity.prepared.supportResult).toBe("Anchored");
    expectDamageAndWork(parity.prepared, repeated as typeof parity.prepared);
    expect(parity.prepared.authorityTransfer).toBeNull();
    expect(parity.prepared.transferResult).toBeNull();
    expect(parity.prepared.newBodySourcePlans).toEqual([]);
    expect(parity.prepared.physicsWorld.bodies).toEqual([]);
    expect(parity.prepared.transition).toMatchObject({
      status: "Applied",
      supportResult: "Anchored",
      authorityTransfer: null,
      resultingObjectRevision: parity.prepared.damageResult.object.objectRevision,
      resultingEditRevision: parity.prepared.damageResult.object.editRevision,
      resultingContentHash: parity.prepared.damageResult.object.contentHash
    });
    expectCommitment(parity.prepared.setCommitments.detachedComponents, []);
    expectCommitment(parity.prepared.setCommitments.sourceFragments, []);
    expectCommitment(parity.prepared.setCommitments.newBodies, []);
    expectCommitment(parity.prepared.setCommitments.resultingBodies, []);
    expect(parity.prepared.work).toMatchObject({
      detached: { componentCount: 0, massCellCount: 0 },
      bodyPlanning: { bodyCount: 0, colliderWork: [] },
      transfer: { status: "NotRequired", changedBrickCount: 0, changedCellCount: 0 },
      physics: { predecessorBodyCount: 0, admittedBodyCount: 0, resultingBodyCount: 0 }
    });
    expect(parity.prepared.work.accounting.phases).toEqual({
      damage: "Partial",
      detached: "Complete",
      bodyPlanning: "Complete",
      transfer: "Complete",
      collision: "Partial",
      physics: "Complete",
      finalization: "Unavailable"
    });
    expect(JSON.stringify(preparedOracleProjection(parity.prepared)))
      .toBe(PREPARED_ORACLE_BYTES.anchored);
  }, 180_000);

  it("matches the synchronous wrapper through detached transfer without warming BodyLocal mesh", () => {
    let directState = runtimeState();
    let wrappedState = runtimeState();
    for (const ordinal of [0, 1] as const) {
      directState = advance(directState, ordinal);
      wrappedState = advance(wrappedState, ordinal);
    }
    expect(directState).toEqual(wrappedState);
    expect(directState).not.toBe(wrappedState);
    const directInput = hitInput(directState, 2, "fire:prepared-parity:detached", 3);
    const wrappedInput = hitInput(wrappedState, 2, "fire:prepared-parity:detached", 3);
    expect(directInput).toEqual(wrappedInput);

    const prepared = prepare(directState, directInput);
    const repeated = prepare(directState, directInput);
    const transportedInput = deepFreeze(structuredClone(preparedInput(directState, directInput)));
    const transported = prepareSurfaceTreeFire(transportedInput);
    const parity = ready(prepared, preflightSurfaceTreeFire(wrappedState, wrappedInput));
    expect(parity.prepared.supportResult).toBe("Detached");
    expectDamageAndWork(parity.prepared, repeated as typeof parity.prepared);
    expect(transported.status).toBe("Ready");
    if (transported.status !== "Ready") {
      throw new Error(`Transported Surface Tree preparation was rejected: ${transported.code}.`);
    }
    expect(transportedInput.authority).not.toBe(directState.authority);
    expect(transportedInput.collision).not.toBe(directState.collision);
    expect(transported.supportResult).toBe("Detached");
    expect(transported.collision).toEqual(parity.prepared.collision);
    expect(transported.collision.contentHash).toBe(parity.prepared.collision.contentHash);
    expect(preparedOracleProjection(transported)).toEqual(preparedOracleProjection(parity.prepared));
    expect(parity.prepared.detachedFacts).toHaveLength(1);
    expect(parity.prepared.newBodySourcePlans).toHaveLength(1);
    expectPrivateWorkerDetachedParity(directState, directInput, parity.prepared);
    expect(parity.wrapped.state.bodySources).toHaveLength(1);
    expect(parity.prepared.newBodySourcePlans[0]).not.toHaveProperty("meshArtifact");

    const source = parity.wrapped.state.bodySources[0];
    const descriptor = Object.getOwnPropertyDescriptor(source, "meshArtifact");
    expect(descriptor?.get).toBeTypeOf("function");
    expect(descriptor).not.toHaveProperty("value");
    expect(parity.prepared.newBodySourcePlans[0].candidate).toEqual(source.candidate);
    expect(parity.prepared.physicsWorld.bodies.map((body) => body.bodyId))
      .toEqual(parity.prepared.newBodySourcePlans.map((plan) => plan.candidate.bodyId));
    expect(parity.prepared.physicsWorld.bodies[0]).toMatchObject({
      bodyId: source.candidate.bodyId,
      componentId: source.candidate.componentId,
      objectId: source.candidate.objectId,
      sourceObjectRevision: source.candidate.sourceObjectRevision,
      sourceContentHash: source.candidate.sourceContentHash,
      colliderRevision: source.candidate.colliderRevision,
      positionMeters: source.candidate.positionMeters,
      orientation: source.candidate.orientation,
      linearVelocityMetersPerSecond: source.candidate.linearVelocityMetersPerSecond,
      angularVelocityRadiansPerSecond: source.candidate.angularVelocityRadiansPerSecond,
      colliders: source.candidate.colliders
    });
    expect(parity.prepared.authorityTransfer).toEqual(parity.prepared.transition.authorityTransfer);
    expect(parity.prepared.transferResult?.object).toBe(parity.prepared.finalAuthority.object);
    expect(parity.prepared.transition).toMatchObject({
      status: "Applied",
      supportResult: "Detached",
      resultingObjectRevision: parity.prepared.damageResult.object.objectRevision,
      resultingEditRevision: parity.prepared.damageResult.object.editRevision,
      resultingContentHash: parity.prepared.damageResult.object.contentHash,
      authorityTransfer: {
        previousObjectRevision: parity.prepared.damageResult.object.objectRevision,
        resultingObjectRevision: parity.prepared.finalAuthority.objectRevision,
        previousEditRevision: parity.prepared.damageResult.object.editRevision,
        resultingEditRevision: parity.prepared.finalAuthority.editRevision,
        previousContentHash: parity.prepared.damageResult.object.contentHash,
        resultingContentHash: parity.prepared.finalAuthority.objectContentHash
      }
    });
    expect(parity.prepared.finalAuthority.objectRevision)
      .toBe(parity.prepared.damageResult.object.objectRevision + 1);
    expect(parity.prepared.finalAuthority.object.contentHash).toBe("fnv1a64-v1:32946f26196674b5");
    expect(parity.prepared.damageResult.object.contentHash).toBe("fnv1a64-v1:330df5fa6cebfb1a");
    expect(parity.prepared.collision.contentHash).toBe(parity.wrapped.state.collision.contentHash);

    expectCommitment(
      parity.prepared.setCommitments.detachedComponents,
      parity.prepared.detachedFacts.map((facts) => facts.component.componentId)
    );
    expectCommitment(
      parity.prepared.setCommitments.sourceFragments,
      parity.prepared.detachedFacts.map((facts) => facts.fragment.fragmentId)
    );
    expectCommitment(
      parity.prepared.setCommitments.newBodies,
      parity.prepared.newBodySourcePlans.map((plan) => plan.candidate.bodyId)
    );
    expectCommitment(
      parity.prepared.setCommitments.resultingBodies,
      parity.prepared.physicsWorld.bodies.map((body) => body.bodyId)
    );
    expect(parity.prepared.work).toMatchObject({
      detached: { componentCount: 1, massCellCount: 2_710 },
      bodyPlanning: { bodyCount: 1 },
      transfer: { status: "Applied" },
      physics: { predecessorBodyCount: 0, admittedBodyCount: 1, resultingBodyCount: 1 }
    });
    expect(parity.prepared.work.bodyPlanning.colliderWork[0]).toEqual({
      bodyId: source.candidate.bodyId,
      counters: source.candidate.colliderRepresentation.workCounters
    });
    expect(parity.prepared.work.accounting.phases).toEqual({
      damage: "Partial",
      detached: "Partial",
      bodyPlanning: "Partial",
      transfer: "Unavailable",
      collision: "Partial",
      physics: "Partial",
      finalization: "Unavailable"
    });
    expect(JSON.stringify(preparedOracleProjection(parity.prepared)))
      .toBe(PREPARED_ORACLE_BYTES.detached);

    let meshArtifactReads = 0;
    const observedSource = Object.freeze({
      sourceObject: source.sourceObject,
      component: source.component,
      fragment: source.fragment,
      massProperties: source.massProperties,
      candidate: source.candidate,
      get meshArtifact() {
        meshArtifactReads += 1;
        return source.meshArtifact;
      }
    });
    const observedState = Object.freeze({
      ...parity.wrapped.state,
      bodySources: Object.freeze([observedSource])
    });
    const continuationInput = hitInput(
      observedState,
      3,
      "fire:prepared-parity:cold-existing-body",
      4
    );
    const coldPreflight = preflightSurfaceTreeFire(observedState, continuationInput);
    expect(coldPreflight.status).toBe("Ready");
    expect(meshArtifactReads).toBe(0);
    if (coldPreflight.status !== "Ready") {
      throw new Error(`Cold existing-body preparation was rejected: ${coldPreflight.code}.`);
    }
    const descriptorBeforeResolution = Object.getOwnPropertyDescriptor(
      coldPreflight.state.bodySources[0],
      "meshArtifact"
    );
    expect(descriptorBeforeResolution?.get).toBeTypeOf("function");
    expect(descriptorBeforeResolution).not.toHaveProperty("value");
    const presentation = createSurfaceTreePresentationSnapshot(coldPreflight.state, {
      bodyId: initial.object.frame.bodyId,
      regionId: initial.object.frame.regionId,
      surfaceFrameId: initial.object.frame.surfaceFrameId,
      regionRevision: 0,
      simulationTick: 4
    });
    expect(meshArtifactReads).toBe(0);
    const meshArtifactId = presentation.bodySources[0].meshArtifactId;
    const artifact = resolveSurfaceTreeStructuralMeshArtifact(coldPreflight.state, meshArtifactId);
    expect(artifact?.space).toBe("BodyLocal");
    expect(meshArtifactReads).toBe(1);
    const descriptorAfterResolution = Object.getOwnPropertyDescriptor(
      coldPreflight.state.bodySources[0],
      "meshArtifact"
    );
    expect(descriptorAfterResolution?.get).toBe(descriptorBeforeResolution?.get);
    expect(descriptorAfterResolution).not.toHaveProperty("value");

    const validExistingBodyInput = preparedInput(parity.wrapped.state, hitInput(
      parity.wrapped.state,
      3,
      "fire:prepared-parity:body-binding",
      4
    ));
    const malformedMassInput = deepFreeze({
      ...validExistingBodyInput,
      bodySources: validExistingBodyInput.bodySources.map((bodySource) => ({
        ...bodySource,
        massProperties: {
          ...bodySource.massProperties,
          totalMassKg: bodySource.massProperties.totalMassKg + 1
        }
      }))
    });
    const malformedRepresentationInput = deepFreeze({
      ...validExistingBodyInput,
      physicsWorld: {
        ...validExistingBodyInput.physicsWorld,
        bodies: validExistingBodyInput.physicsWorld.bodies.map((body) => ({
          ...body,
          colliderRepresentation: {
            ...body.colliderRepresentation,
            representationHash: "fnv1a64-v1:0000000000000000"
          }
        }))
      }
    });
    const malformedGeometryInput = deepFreeze({
      ...validExistingBodyInput,
      physicsWorld: {
        ...validExistingBodyInput.physicsWorld,
        bodies: validExistingBodyInput.physicsWorld.bodies.map((body) => ({
          ...body,
          colliders: body.colliders.map((collider, colliderIndex) => colliderIndex === 0 ? {
            ...collider,
            centerMeters: {
              ...collider.centerMeters,
              x: collider.centerMeters.x + MICROVOXEL_BASE_QUANTUM_METERS
            }
          } : collider)
        }))
      }
    });
    for (const malformedInput of [
      malformedMassInput,
      malformedRepresentationInput,
      malformedGeometryInput
    ]) {
      const rejected = prepareSurfaceTreeFire(malformedInput);
      expect(rejected).toMatchObject({
        status: "Rejected",
        code: "StructuralAuthorityRefused",
        transition: {
          status: "Rejected",
          currentObjectRevision: parity.wrapped.state.authority.objectRevision,
          currentEditRevision: parity.wrapped.state.authority.editRevision,
          currentContentHash: parity.wrapped.state.authority.objectContentHash,
          authorityTransfer: null
        }
      });
    }

    const evolvedPoseInput = deepFreeze({
      ...validExistingBodyInput,
      physicsWorld: {
        ...validExistingBodyInput.physicsWorld,
        bodies: validExistingBodyInput.physicsWorld.bodies.map((body) => ({
          ...body,
          positionMeters: { ...body.positionMeters, x: body.positionMeters.x + 1 },
          linearVelocityMetersPerSecond: {
            ...body.linearVelocityMetersPerSecond,
            y: body.linearVelocityMetersPerSecond.y + 1
          }
        }))
      }
    });
    expect(prepareSurfaceTreeFire(evolvedPoseInput).status).toBe("Ready");
  }, 180_000);

  it("matches the synchronous wrapper for the mature single-anchor Empty fixture", () => {
    const anchorAddress = initial.object.anchors[0].cell;
    const object = objectWithCells(
      initial.object,
      new Set([serializeStructuralCellAddress(anchorAddress)])
    );
    const authority = deriveSurfaceTreeAuthority(initial.tree, object);
    const directState = runtimeState(authority);
    const wrappedState = runtimeState(authority);
    const global = globalQuantumForStructuralCell(anchorAddress);
    const voxel = getStructuralVoxel(object, anchorAddress);
    if (voxel === undefined || voxel === null) throw new Error("Single-anchor fixture lost its voxel.");
    const directInput = Object.freeze({
      fireCommandId: "fire:prepared-parity:empty",
      hit: Object.freeze({
        address: anchorAddress,
        materialId: voxel.materialId,
        semanticKey: voxel.semanticKey,
        pointMeters: Object.freeze({
          x: (global.x + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS,
          y: (global.y + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS,
          z: (global.z + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS
        }),
        normal: Object.freeze({ x: 0, y: 1, z: 0 })
      }),
      simulationTick: 1
    });
    const wrappedInput = deepFreeze({ ...directInput });
    expect(directInput).toEqual(wrappedInput);

    const prepared = prepare(directState, directInput);
    const repeated = prepare(directState, directInput);
    const parity = ready(prepared, preflightSurfaceTreeFire(wrappedState, wrappedInput));
    expect(parity.prepared.supportResult).toBe("Empty");
    expectDamageAndWork(parity.prepared, repeated as typeof parity.prepared);
    expect(parity.prepared.finalAuthority.classification.components).toEqual([]);
    expect(parity.prepared.finalAuthority.object.bricks.map((brick) => serializeAdaptiveKey(brick.key)))
      .toEqual(object.bricks.map((brick) => serializeAdaptiveKey(brick.key)));
    expect(parity.prepared.authorityTransfer).toBeNull();
    expect(parity.prepared.transferResult).toBeNull();
    expect(parity.prepared.newBodySourcePlans).toEqual([]);
    expect(parity.prepared.physicsWorld.bodies).toEqual([]);
    expect(parity.prepared.transition).toMatchObject({
      status: "Applied",
      supportResult: "Empty",
      authorityTransfer: null,
      resultingObjectRevision: parity.prepared.damageResult.object.objectRevision,
      resultingEditRevision: parity.prepared.damageResult.object.editRevision,
      resultingContentHash: parity.prepared.damageResult.object.contentHash
    });
    expectCommitment(parity.prepared.setCommitments.detachedComponents, []);
    expectCommitment(parity.prepared.setCommitments.sourceFragments, []);
    expectCommitment(parity.prepared.setCommitments.newBodies, []);
    expectCommitment(parity.prepared.setCommitments.resultingBodies, []);
    expect(parity.prepared.work).toMatchObject({
      detached: { componentCount: 0, massCellCount: 0 },
      bodyPlanning: { bodyCount: 0, colliderWork: [] },
      transfer: { status: "NotRequired", changedBrickCount: 0, changedCellCount: 0 },
      physics: { predecessorBodyCount: 0, admittedBodyCount: 0, resultingBodyCount: 0 }
    });
    expect(parity.prepared.work.accounting.phases).toEqual({
      damage: "Partial",
      detached: "Complete",
      bodyPlanning: "Complete",
      transfer: "Complete",
      collision: "Partial",
      physics: "Complete",
      finalization: "Unavailable"
    });
    expect(JSON.stringify(preparedOracleProjection(parity.prepared)))
      .toBe(PREPARED_ORACLE_BYTES.empty);
  }, 60_000);

  it("keeps authority results and validation errors unchanged when diagnostics throw", () => {
    const throwingDiagnostics = {
      start() { throw new Error("diagnostic start failed"); },
      finish() { throw new Error("diagnostic finish failed"); },
      startView() { throw new Error("diagnostic view start failed"); },
      finishView() { throw new Error("diagnostic view finish failed"); }
    };
    expect(validateSurfaceTreeAuthoritySnapshotTransport(
      projectSurfaceTreeAuthoritySnapshotTransport(initial),
      throwingDiagnostics
    )).toEqual(initial);

    const invalid = { ...projectSurfaceTreeAuthoritySnapshotTransport(initial), objectId: "wrong" };
    const errorMessage = (diagnostics?: typeof throwingDiagnostics): string => {
      try {
        validateSurfaceTreeAuthoritySnapshotTransport(invalid, diagnostics);
        return "no error";
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    };
    expect(errorMessage(throwingDiagnostics)).toBe(errorMessage());
  });
});
