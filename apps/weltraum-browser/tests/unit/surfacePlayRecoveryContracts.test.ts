import { describe, expect, it } from "vitest";
import {
  SURFACE_FIRE_REJECTION_CODES,
  SurfacePlayContractError,
  createSurfaceCombatSnapshot,
  createSurfaceDynamicBodySnapshot,
  createSurfaceImpactPresentationSnapshot,
  createSurfacePhysicsFailureSnapshot,
  createSurfacePlayHudSnapshot,
  createSurfaceStructuralPresentationSnapshot,
  createSurfaceStructuralTransitionSnapshot
} from "../../src/surface-play/contracts";

const readiness = {
  kind: "EnergyInsufficient",
  currentEnergyJoules: 6,
  requiredEnergyJoules: 12,
  recoveryDelayRemainingSeconds: 2,
  recoveryRateJoulesPerSecond: 12,
  nextShotReadyInSeconds: 2.5
} as const;

const previousHash = "fnv1a64-v1:0000000000000001";
const currentHash = "fnv1a64-v1:0000000000000002";
const transferredHash = "fnv1a64-v1:0000000000000003";
const emptyPreviousHash = "fnv1a64-v1:0000000000000004";
const emptyHash = "fnv1a64-v1:0000000000000005";

const appliedTransition = {
  status: "Applied",
  fireCommandId: "surface.fire.120",
  structuralCommandId: "structural.cut.120",
  objectId: "structural.tree.1",
  previousObjectRevision: 1,
  resultingObjectRevision: 2,
  previousEditRevision: 1,
  resultingEditRevision: 2,
  previousContentHash: previousHash,
  resultingContentHash: currentHash,
  changedCellCount: 4,
  changedBrickIds: ["brick.tree.1"],
  supportResult: "Detached",
  detachedComponentIds: ["component.tree.1.detached"],
  authorityTransfer: {
    transferCommandId: "structural.transfer.120",
    previousObjectRevision: 2,
    resultingObjectRevision: 3,
    previousEditRevision: 2,
    resultingEditRevision: 3,
    previousContentHash: currentHash,
    resultingContentHash: transferredHash,
    transferredCellCount: 64,
    changedBrickIds: ["brick.tree.1"],
    sourceFragmentIds: ["fragment.tree.1.detached"]
  },
  simulationTick: 120
} as const;

const appliedEmptyTransition = {
  status: "Applied",
  fireCommandId: "surface.fire.121",
  structuralCommandId: "structural.cut.121",
  objectId: "structural.tree.2",
  previousObjectRevision: 2,
  resultingObjectRevision: 3,
  previousEditRevision: 2,
  resultingEditRevision: 3,
  previousContentHash: emptyPreviousHash,
  resultingContentHash: emptyHash,
  changedCellCount: 4,
  changedBrickIds: ["brick.tree.2"],
  supportResult: "Empty",
  detachedComponentIds: [],
  authorityTransfer: null,
  simulationTick: 121
} as const;

const noChangeAnchoredTransition = {
  status: "NoChange",
  fireCommandId: "surface.fire.123",
  structuralCommandId: "structural.cut.123",
  objectId: "structural.tree.3",
  previousObjectRevision: 4,
  resultingObjectRevision: 5,
  previousEditRevision: 4,
  resultingEditRevision: 4,
  previousContentHash: emptyPreviousHash,
  resultingContentHash: emptyPreviousHash,
  changedCellCount: 0,
  changedBrickIds: [],
  supportResult: "Anchored",
  detachedComponentIds: [],
  authorityTransfer: null,
  simulationTick: 123
} as const;

const dynamicBodyInput = {
  bodyId: "body.tree.1.detached",
  componentId: "component.tree.1.detached",
  objectId: "structural.tree.1",
  sourceObjectRevision: 2,
  sourceContentHash: currentHash,
  lifecycle: "Falling",
  positionMeters: { x: 2, y: 4, z: 6 },
  orientation: { x: 0, y: 0, z: 0, w: -2 },
  linearVelocityMetersPerSecond: { x: 0, y: -1, z: 0 },
  angularVelocityRadiansPerSecond: { x: 0.1, y: 0, z: 0 },
  colliderRevision: 2,
  simulationTick: 121
} as const;

const structuralPresentationInput = {
  bodyId: "body.hestia",
  regionId: "region.hestia.landing",
  surfaceFrameId: "frame.surface.hestia.landing",
  regionRevision: 8,
  objects: [{
    objectId: "structural.tree.1",
    treeInstanceId: "tree.hestia.1",
    speciesId: "species.umbrella.tree",
    objectRevision: 3,
    editRevision: 3,
    contentHash: transferredHash,
    componentIds: ["component.tree.1.anchored"],
    meshArtifactId: "mesh.structural.tree.1"
  }],
  components: [{
    componentId: "component.tree.1.anchored",
    objectId: "structural.tree.1",
    sourceObjectRevision: 3,
    sourceContentHash: transferredHash,
    anchored: true,
    bodyId: null,
    meshArtifactId: "mesh.component.tree.1.anchored"
  }],
  bodySources: [{
    componentId: "component.tree.1.detached",
    sourceFragmentId: "fragment.tree.1.detached",
    bodyId: "body.tree.1.detached",
    objectId: "structural.tree.1",
    sourceObjectRevision: 2,
    sourceContentHash: currentHash,
    colliderRevision: 2,
    meshArtifactId: "mesh.component.tree.1.detached"
  }],
  dynamicBodies: [dynamicBodyInput],
  latestTransition: appliedTransition,
  physicsFailure: null,
  simulationTick: 121
} as const;

describe("surface-play recovery contract delta", () => {
  it("adds only the approved Structural combat variants and typed readiness", () => {
    expect(SURFACE_FIRE_REJECTION_CODES).toEqual([
      "Cooldown",
      "InsufficientEnergy",
      "Overheated",
      "InvalidTarget",
      "FrameMismatch",
      "StaleRevision",
      "AuthorityRefused",
      "BodyCapacityExceeded",
      "ColliderBudgetExceeded",
      "DetachedBodyImmutable"
    ]);

    const combat = createSurfaceCombatSnapshot({
      activeWeaponId: "weapon.pulse.cutter",
      energyJoules: 6,
      maximumEnergyJoules: 240,
      heatJoules: 18,
      maximumHeatJoules: 54,
      cooldownSeconds: 0,
      readiness,
      target: null,
      latestFireResult: {
        status: "Accepted",
        commandId: "surface_command:0123456789abcdef",
        hit: "Structural"
      },
      events: [
        { sequence: 1, eventId: "event.structural.hit.1", kind: "StructuralHit", simulationTick: 120 },
        { sequence: 2, eventId: "event.structural.damage.1", kind: "StructuralDamaged", simulationTick: 120 },
        { sequence: 3, eventId: "event.structural.detached.1", kind: "StructuralDetached", simulationTick: 120 }
      ],
      simulationTick: 120
    });

    expect(combat.readiness).toEqual(readiness);
    expect(combat.latestFireResult).toMatchObject({ status: "Accepted", hit: "Structural" });
    expect(combat.events.map((event) => event.kind)).toEqual([
      "StructuralHit",
      "StructuralDamaged",
      "StructuralDetached"
    ]);
    expect(Object.isFrozen(combat.readiness)).toBe(true);
  });

  it("projects the same required readiness through HUD and accepts Structural impacts", () => {
    const hud = createSurfacePlayHudSnapshot({
      mode: "SurfaceFirstPerson",
      movementMode: "Walk",
      grounded: true,
      energyJoules: 6,
      maximumEnergyJoules: 240,
      heatJoules: 18,
      maximumHeatJoules: 54,
      cooldownSeconds: 0,
      weaponReadiness: readiness,
      targetCondition: "Operational",
      latestAction: null,
      latestBlock: "Not enough Energy."
    });
    const impact = createSurfaceImpactPresentationSnapshot({
      impactId: "impact.structural.120",
      surfaceFrameId: "frame.surface.hestia.landing",
      positionMeters: { x: 1, y: 2, z: 3 },
      normal: { x: 0, y: 1, z: 0 },
      kind: "Structural",
      simulationTick: 120
    });

    expect(hud.weaponReadiness).toEqual(readiness);
    expect(impact.kind).toBe("Structural");
    expect(Object.isFrozen(hud.weaponReadiness)).toBe(true);
  });

  it("validates exact Structural transition discriminants, revision semantics, and support consistency", () => {
    const applied = createSurfaceStructuralTransitionSnapshot(appliedTransition);
    const appliedEmpty = createSurfaceStructuralTransitionSnapshot(appliedEmptyTransition);
    const noChangeAnchored = createSurfaceStructuralTransitionSnapshot(noChangeAnchoredTransition);
    const rejected = createSurfaceStructuralTransitionSnapshot({
      status: "Rejected",
      fireCommandId: "surface.fire.122",
      structuralCommandId: null,
      objectId: "structural.tree.1",
      currentObjectRevision: 2,
      currentEditRevision: 2,
      currentContentHash: currentHash,
      code: "BodyCapacityExceeded",
      authorityTransfer: null,
      simulationTick: 122
    });

    expect(applied).toMatchObject({ status: "Applied", supportResult: "Detached" });
    expect(appliedEmpty).toMatchObject({ status: "Applied", supportResult: "Empty", authorityTransfer: null });
    expect(noChangeAnchored).toMatchObject({
      status: "NoChange",
      supportResult: "Anchored",
      authorityTransfer: null
    });
    expect(rejected).toMatchObject({ status: "Rejected", code: "BodyCapacityExceeded" });
    expect("changedBrickIds" in rejected).toBe(false);
    if (applied.status === "Rejected") throw new Error("Expected an applied Structural transition.");
    expect(Object.isFrozen(applied.changedBrickIds)).toBe(true);
    expect(applied.authorityTransfer).toMatchObject({
      previousObjectRevision: applied.resultingObjectRevision,
      previousEditRevision: applied.resultingEditRevision,
      previousContentHash: applied.resultingContentHash,
      resultingObjectRevision: 3,
      resultingEditRevision: 3,
      resultingContentHash: transferredHash
    });
    expect(Object.isFrozen(applied.authorityTransfer)).toBe(true);
    expect(Object.isFrozen(applied.authorityTransfer?.sourceFragmentIds)).toBe(true);

    const anchored = {
      ...appliedTransition,
      supportResult: "Anchored" as const,
      detachedComponentIds: [],
      authorityTransfer: null
    };
    expect(createSurfaceStructuralTransitionSnapshot(anchored).authorityTransfer).toBeNull();
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...appliedTransition,
      supportResult: "Detached",
      detachedComponentIds: []
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...appliedEmpty,
      detachedComponentIds: ["component.tree.2.detached"]
    } as never)).toThrow(SurfacePlayContractError);
  });

  it("rejects missing, stale, non-canonical, or non-atomic authority transfers", () => {
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...appliedTransition,
      authorityTransfer: undefined
    } as never)).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...appliedTransition,
      authorityTransfer: {
        ...appliedTransition.authorityTransfer,
        sourceFragmentIds: undefined
      }
    } as never)).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...appliedTransition,
      authorityTransfer: null
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...noChangeAnchoredTransition,
      authorityTransfer: appliedTransition.authorityTransfer
    } as never)).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...appliedTransition,
      authorityTransfer: {
        ...appliedTransition.authorityTransfer,
        previousObjectRevision: 1
      }
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...appliedTransition,
      authorityTransfer: {
        ...appliedTransition.authorityTransfer,
        resultingEditRevision: 4
      }
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...appliedTransition,
      authorityTransfer: {
        ...appliedTransition.authorityTransfer,
        previousContentHash: previousHash
      }
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...appliedTransition,
      authorityTransfer: {
        ...appliedTransition.authorityTransfer,
        transferCommandId: appliedTransition.structuralCommandId
      }
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...appliedTransition,
      authorityTransfer: {
        ...appliedTransition.authorityTransfer,
        transferredCellCount: 0
      }
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...appliedTransition,
      authorityTransfer: {
        ...appliedTransition.authorityTransfer,
        changedBrickIds: ["brick.tree.2", "brick.tree.1"]
      }
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...appliedTransition,
      authorityTransfer: {
        ...appliedTransition.authorityTransfer,
        changedBrickIds: ["brick.tree.1", "brick.tree.1"]
      }
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...appliedTransition,
      authorityTransfer: {
        ...appliedTransition.authorityTransfer,
        changedBrickIds: new Array(4097).fill(null).map((_, index) => `brick.tree.${index}`)
      }
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...appliedTransition,
      authorityTransfer: {
        ...appliedTransition.authorityTransfer,
        sourceFragmentIds: ["fragment.tree.2.detached", "fragment.tree.1.detached"]
      },
      detachedComponentIds: ["component.tree.1.detached", "component.tree.2.detached"]
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...appliedTransition,
      authorityTransfer: {
        ...appliedTransition.authorityTransfer,
        sourceFragmentIds: ["fragment.tree.1.detached", "fragment.tree.1.detached"]
      },
      detachedComponentIds: ["component.tree.1.detached", "component.tree.2.detached"]
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...appliedTransition,
      authorityTransfer: {
        ...appliedTransition.authorityTransfer,
        sourceFragmentIds: new Array(9).fill(null).map((_, index) => `fragment.tree.${index}.detached`)
      },
      detachedComponentIds: new Array(9).fill(null).map((_, index) => `component.tree.${index}.detached`)
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralTransitionSnapshot({
      status: "Rejected",
      fireCommandId: "surface.fire.122",
      structuralCommandId: null,
      objectId: "structural.tree.1",
      currentObjectRevision: 2,
      currentEditRevision: 2,
      currentContentHash: currentHash,
      code: "StructuralAuthorityRefused",
      simulationTick: 122
    } as never)).toThrow(SurfacePlayContractError);
  });

  it("creates canonical immutable dynamic bodies and bounded typed physics failures", () => {
    const body = createSurfaceDynamicBodySnapshot(dynamicBodyInput);
    const failure = createSurfacePhysicsFailureSnapshot({
      code: "ContactBudgetExceeded",
      simulationTick: 121,
      bodyIds: ["body.tree.1.detached", "body.tree.2.detached"]
    });

    expect(body.orientation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    expect(Object.isFrozen(body.orientation)).toBe(true);
    expect(failure.bodyIds).toEqual(["body.tree.1.detached", "body.tree.2.detached"]);
    expect(Object.isFrozen(failure.bodyIds)).toBe(true);

    expect(() => createSurfaceDynamicBodySnapshot({
      ...dynamicBodyInput,
      orientation: { x: Number.NaN, y: 0, z: 0, w: 1 }
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfacePhysicsFailureSnapshot({
      code: "MotionBudgetExceeded",
      simulationTick: 121,
      bodyIds: ["body.tree.2.detached", "body.tree.1.detached"]
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfacePhysicsFailureSnapshot({
      code: "NonFiniteState",
      simulationTick: 121,
      bodyIds: ["body.tree.1.detached", "body.tree.1.detached"]
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfacePhysicsFailureSnapshot({
      code: "NonFiniteState",
      simulationTick: 121,
      bodyIds: new Array(9).fill(null).map((_, index) => `body.tree.${index}.detached`)
    })).toThrow(SurfacePlayContractError);
  });

  it("binds immutable Structural presentation facts to object revision and content hash", () => {
    const snapshot = createSurfaceStructuralPresentationSnapshot(structuralPresentationInput);
    const emptyPresentation = {
      ...structuralPresentationInput,
      objects: [{
        objectId: "structural.tree.2",
        treeInstanceId: "tree.hestia.2",
        speciesId: "species.umbrella.tree",
        objectRevision: 3,
        editRevision: 3,
        contentHash: emptyHash,
        componentIds: [],
        meshArtifactId: "mesh.structural.tree.2"
      }],
      components: [],
      bodySources: [],
      dynamicBodies: [],
      latestTransition: appliedEmptyTransition
    } as const;
    const empty = createSurfaceStructuralPresentationSnapshot(emptyPresentation);

    expect(snapshot.objects[0].componentIds).toEqual(["component.tree.1.anchored"]);
    expect(snapshot.components).toHaveLength(1);
    expect(snapshot.components[0]).toMatchObject({ anchored: true, bodyId: null });
    expect(snapshot.bodySources).toHaveLength(1);
    expect(snapshot.bodySources[0].meshArtifactId).toBe(
      structuralPresentationInput.bodySources[0].meshArtifactId
    );
    expect(Object.keys(snapshot.bodySources[0])).toEqual([
      "bodyId",
      "colliderRevision",
      "componentId",
      "meshArtifactId",
      "objectId",
      "sourceContentHash",
      "sourceFragmentId",
      "sourceObjectRevision"
    ]);
    expect(snapshot.dynamicBodies[0].componentId).toBe("component.tree.1.detached");
    expect(snapshot.latestTransition).toMatchObject({ status: "Applied", supportResult: "Detached" });
    expect(snapshot.physicsFailure).toBeNull();
    expect(empty.latestTransition).toMatchObject({ status: "Applied", supportResult: "Empty" });
    expect(empty.components).toEqual([]);
    expect(empty.bodySources).toEqual([]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.objects)).toBe(true);
    expect(Object.isFrozen(snapshot.components[0])).toBe(true);
    expect(Object.isFrozen(snapshot.bodySources)).toBe(true);
    expect(Object.isFrozen(snapshot.bodySources[0])).toBe(true);
    expect(Object.isFrozen(snapshot.dynamicBodies[0].positionMeters)).toBe(true);

    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      components: [{
        ...structuralPresentationInput.components[0],
        sourceObjectRevision: 1
      }]
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      dynamicBodies: [{ ...dynamicBodyInput, sourceContentHash: previousHash }]
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      dynamicBodies: [{ ...dynamicBodyInput, colliderRevision: 3 }]
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      bodySources: [{
        ...structuralPresentationInput.bodySources[0],
        sourceFragmentId: "fragment.tree.1.tampered"
      }]
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      components: [{
        ...structuralPresentationInput.components[0],
        anchored: false,
        bodyId: "body.tree.1.detached"
      }]
    } as never)).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      bodySources: undefined
    } as never)).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      bodySources: [{
        ...structuralPresentationInput.bodySources[0],
        meshArtifactId: undefined
      }]
    } as never)).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...emptyPresentation,
      latestTransition: { ...appliedEmptyTransition, supportResult: "Anchored" }
    } as never)).toThrow(SurfacePlayContractError);
  });

  it("binds Rejected and Detached presentations to the exact current authority state", () => {
    const rejectedTransition = {
      status: "Rejected",
      fireCommandId: "surface.fire.124",
      structuralCommandId: "structural.cut.124",
      objectId: "structural.tree.1",
      currentObjectRevision: 3,
      currentEditRevision: 3,
      currentContentHash: transferredHash,
      code: "StructuralAuthorityRefused",
      authorityTransfer: null,
      simulationTick: 124
    } as const;
    const rejectedPresentation = {
      ...structuralPresentationInput,
      latestTransition: rejectedTransition
    } as const;

    expect(createSurfaceStructuralPresentationSnapshot(rejectedPresentation).latestTransition)
      .toMatchObject({ status: "Rejected", authorityTransfer: null });
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...rejectedPresentation,
      latestTransition: { ...rejectedTransition, currentObjectRevision: 2 }
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...rejectedPresentation,
      latestTransition: { ...rejectedTransition, currentEditRevision: 2 }
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...rejectedPresentation,
      latestTransition: { ...rejectedTransition, currentContentHash: currentHash }
    })).toThrow(SurfacePlayContractError);

    const preTransferPresentation = {
      ...structuralPresentationInput,
      objects: [{
        ...structuralPresentationInput.objects[0],
        objectRevision: 2,
        editRevision: 2,
        contentHash: currentHash
      }],
      components: [{
        ...structuralPresentationInput.components[0],
        sourceObjectRevision: 2,
        sourceContentHash: currentHash
      }],
      bodySources: [],
      dynamicBodies: []
    } as const;
    expect(() => createSurfaceStructuralPresentationSnapshot(preTransferPresentation))
      .toThrow(SurfacePlayContractError);
  });

  it("rejects duplicate Fragment provenance, orphan bodies/sources, and current/archive overlap", () => {
    const secondBodySource = {
      ...structuralPresentationInput.bodySources[0],
      componentId: "component.tree.1.detached.b",
      bodyId: "body.tree.1.detached.b",
      meshArtifactId: "mesh.component.tree.1.detached.b"
    } as const;
    const firstBodySource = {
      ...structuralPresentationInput.bodySources[0],
      componentId: "component.tree.1.detached.a",
      bodyId: "body.tree.1.detached.a",
      meshArtifactId: "mesh.component.tree.1.detached.a"
    } as const;
    const firstBody = {
      ...dynamicBodyInput,
      componentId: firstBodySource.componentId,
      bodyId: firstBodySource.bodyId
    } as const;
    const secondBody = {
      ...dynamicBodyInput,
      componentId: secondBodySource.componentId,
      bodyId: secondBodySource.bodyId
    } as const;

    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      bodySources: [firstBodySource, secondBodySource],
      dynamicBodies: [firstBody, secondBody],
      latestTransition: null
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      dynamicBodies: [],
      latestTransition: null
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      bodySources: [],
      latestTransition: null
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      objects: [{
        ...structuralPresentationInput.objects[0],
        componentIds: ["component.tree.1.detached"]
      }],
      components: [{
        ...structuralPresentationInput.components[0],
        componentId: "component.tree.1.detached"
      }],
      latestTransition: null
    })).toThrow(SurfacePlayContractError);
  });

  it("keeps an older immutable Body Source alive when Damage empties current authority", () => {
    const archivedBodySource = {
      componentId: "component.tree.2.detached",
      sourceFragmentId: "fragment.tree.2.detached",
      bodyId: "body.tree.2.detached",
      objectId: "structural.tree.2",
      sourceObjectRevision: 2,
      sourceContentHash: emptyPreviousHash,
      colliderRevision: 2,
      meshArtifactId: "mesh.component.tree.2.detached"
    } as const;
    const archivedBody = {
      ...dynamicBodyInput,
      bodyId: archivedBodySource.bodyId,
      componentId: archivedBodySource.componentId,
      objectId: archivedBodySource.objectId,
      sourceObjectRevision: archivedBodySource.sourceObjectRevision,
      sourceContentHash: archivedBodySource.sourceContentHash,
      colliderRevision: archivedBodySource.colliderRevision
    } as const;
    const emptyWithArchive = createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      objects: [{
        objectId: "structural.tree.2",
        treeInstanceId: "tree.hestia.2",
        speciesId: "species.umbrella.tree",
        objectRevision: 3,
        editRevision: 3,
        contentHash: emptyHash,
        componentIds: [],
        meshArtifactId: "mesh.structural.tree.2"
      }],
      components: [],
      bodySources: [archivedBodySource],
      dynamicBodies: [archivedBody],
      latestTransition: appliedEmptyTransition
    });

    expect(emptyWithArchive.components).toEqual([]);
    expect(emptyWithArchive.bodySources).toHaveLength(1);
    expect(emptyWithArchive.bodySources[0].meshArtifactId).toBe(
      archivedBodySource.meshArtifactId
    );
    expect(emptyWithArchive.dynamicBodies[0].bodyId).toBe(archivedBodySource.bodyId);
  });

  it("rejects non-canonical Structural IDs, cap overflow, and accessor-backed records", () => {
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...appliedTransition,
      changedBrickIds: ["brick.tree.2", "brick.tree.1"]
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...appliedTransition,
      changedBrickIds: new Array(4097).fill("brick.tree.1")
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralTransitionSnapshot({
      ...appliedTransition,
      detachedComponentIds: new Array(9).fill(null).map((_, index) => `component.tree.${index}.detached`)
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      objects: new Array(129).fill(structuralPresentationInput.objects[0])
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      components: new Array(129).fill(structuralPresentationInput.components[0])
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      bodySources: new Array(9).fill(structuralPresentationInput.bodySources[0])
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      bodySources: [{
        ...structuralPresentationInput.bodySources[0],
        componentId: "component.tree.2.detached",
        sourceFragmentId: "fragment.tree.2.detached",
        bodyId: "body.tree.2.detached"
      }, structuralPresentationInput.bodySources[0]]
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      bodySources: [
        structuralPresentationInput.bodySources[0],
        structuralPresentationInput.bodySources[0]
      ]
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      dynamicBodies: new Array(9).fill(dynamicBodyInput)
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      objects: [structuralPresentationInput.objects[0], structuralPresentationInput.objects[0]]
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      components: [structuralPresentationInput.components[0], structuralPresentationInput.components[0]]
    })).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceStructuralPresentationSnapshot({
      ...structuralPresentationInput,
      dynamicBodies: [dynamicBodyInput, dynamicBodyInput]
    })).toThrow(SurfacePlayContractError);

    let getterInvoked = false;
    const accessorBody = {};
    Object.defineProperty(accessorBody, "bodyId", {
      enumerable: true,
      get: () => {
        getterInvoked = true;
        return "body.must.not.read";
      }
    });
    expect(() => createSurfaceDynamicBodySnapshot(accessorBody as never)).toThrow(SurfacePlayContractError);
    expect(getterInvoked).toBe(false);
  });
});
