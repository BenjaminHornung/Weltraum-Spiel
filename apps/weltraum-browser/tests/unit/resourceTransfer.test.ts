import { describe, expect, it } from "vitest";
import {
  RESOURCE_TRANSFER_REJECTION_CODES,
  RESOURCE_TRANSFER_VALIDATION_ORDER,
  createResourceContainerDefinition,
  createResourceContainerSnapshot,
  createResourceContainerState,
  extractFromMiningReservoir,
  miningReservoirContainerFixture,
  resourceCatalogFixture,
  resourceDefinitionFixture,
  starterResourceCatalogFixture,
  transferResource,
  type ResourceTransferCommandInput
} from "../../src/resources";

const catalog = starterResourceCatalogFixture();

const ore = (stackId: string, quantity: number, metadata: Record<string, unknown> = {}) => ({
  stackId,
  resourceId: "ore_iron_silicate",
  quantity,
  ...metadata
});

const definition = (containerId: string, overrides: Record<string, unknown> = {}) =>
  createResourceContainerDefinition({
    containerId,
    kind: "ShipCargo",
    maxMassKg: 1000,
    maxVolumeM3: 10,
    maxStackCount: 10,
    ...overrides
  });

const snapshot = (
  containerDefinition: ReturnType<typeof definition>,
  contents: readonly Record<string, unknown>[],
  stateOverrides: Record<string, unknown> = {},
  resourceCatalog = catalog
) =>
  createResourceContainerSnapshot(
    containerDefinition,
    createResourceContainerState(
      { containerId: containerDefinition.containerId, contents, ...stateOverrides },
      resourceCatalog
    ),
    resourceCatalog
  );

const command = (overrides: Partial<ResourceTransferCommandInput> = {}): ResourceTransferCommandInput => ({
  source: { containerId: "source_hold", expectedRevision: 0 },
  target: { containerId: "target_hold", expectedRevision: 0 },
  resourceId: "ore_iron_silicate",
  quantity: 2,
  allowPartial: false,
  context: { actorId: "pilot" },
  ...overrides
});

describe("resource transfer engine", () => {
  it("accepts a full transfer atomically, preserves metadata, and increments both revisions once", () => {
    const source = snapshot(
      definition("source_hold"),
      [ore("source_ore", 5, { grade: "high", ownerId: "pilot", legalStatus: "Restricted", extensions: { "weltraum.fixture": { lot: "a" } } })]
    );
    const target = snapshot(definition("target_hold"), []);

    const result = transferResource(command({ targetStackId: "target_ore" }), catalog, source, target);

    expect(result.status).toBe("Accepted");
    expect(result.acceptedQuantity).toBe(2);
    expect(result.rejectedQuantity).toBe(0);
    expect(result.sourceState.revision).toBe(1);
    expect(result.targetState.revision).toBe(1);
    expect(result.sourceState.contents).toMatchObject([{ stackId: "source_ore", quantity: 3 }]);
    expect(result.targetState.contents).toMatchObject([
      { stackId: "target_ore", quantity: 2, grade: "high", ownerId: "pilot", legalStatus: "Restricted" }
    ]);
    expect(result.targetState.contents[0].extensions).toEqual({ "weltraum.fixture": { lot: "a" } });
    expect(result.delta).toEqual({ sourceQuantity: -2, targetQuantity: 2, massKg: 16, volumeM3: 0.008 });
    expect(source.state.contents[0].quantity).toBe(5);
    expect(target.state.contents).toEqual([]);
    expect(result.source).not.toBe(source);
    expect(result.target).not.toBe(target);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("round-trips a save-safe owner through usable OwnerOnly source and target states", () => {
    const source = snapshot(
      definition("source_hold", { policy: { ownershipPolicy: "OwnerOnly" } }),
      [ore("owned_ore", 2, { ownerId: "owner_one" })],
      { ownerId: "owner_one" }
    );
    const target = snapshot(
      definition("target_hold", { policy: { ownershipPolicy: "OwnerOnly" } }),
      [],
      { ownerId: "owner_one" }
    );

    const result = transferResource(
      command({ context: { actorId: "owner_one" }, targetStackId: "owner_target" }),
      catalog,
      source,
      target
    );

    expect(result.status).toBe("Accepted");
    expect(result.sourceState.ownerId).toBe("owner_one");
    expect(result.targetState.ownerId).toBe("owner_one");
    expect(result.targetState.contents[0]).toMatchObject({ ownerId: "owner_one", stackId: "owner_target" });
  });

  it("applies category restrictions only at the inbound target while retaining source access and port gates", () => {
    const source = snapshot(
      definition("source_hold", {
        policy: { allowedActorIds: ["pilot"], blockedCategoryIds: ["raw_ore"] },
        transferPorts: [{ portId: "source_outbound", direction: "Outbound", allowedActorIds: ["pilot"] }]
      }),
      [ore("source_ore", 2)]
    );
    const target = snapshot(definition("target_hold"), []);
    const sourceEndpoint = { containerId: "source_hold", expectedRevision: 0, portId: "source_outbound" };

    expect(transferResource(command({ source: sourceEndpoint }), catalog, source, target).status).toBe("Accepted");
    expect(
      transferResource(command({ source: sourceEndpoint, context: { actorId: "other" } }), catalog, source, target)
    ).toMatchObject({ status: "Rejected", code: "AccessDenied" });
  });

  it("uses canonical source stack order and merges only compatible metadata", () => {
    const source = snapshot(definition("source_hold"), [ore("ore_b", 2), ore("ore_a", 2)]);
    const target = snapshot(definition("target_hold"), [ore("existing_ore", 1)]);

    const result = transferResource(command({ quantity: 3 }), catalog, source, target);

    expect(result.status).toBe("Accepted");
    expect(result.sourceState.contents).toEqual([expect.objectContaining({ stackId: "ore_b", quantity: 1 })]);
    expect(result.targetState.contents).toEqual([expect.objectContaining({ stackId: "existing_ore", quantity: 4 })]);
    expect(result.sourceStackIds).toEqual(["ore_a", "ore_b"]);
    expect(result.targetStackIds).toEqual(["existing_ore"]);
  });

  it("keeps metadata-incompatible stacks separate and uses an explicitly supplied target id", () => {
    const source = snapshot(
      definition("source_hold"),
      [ore("ore_alpha", 2, { grade: "high", ownerId: "alpha", extensions: { "weltraum.fixture": { lot: "alpha" } } })]
    );
    const target = snapshot(
      definition("target_hold"),
      [ore("ore_beta", 4, { grade: "low", ownerId: "beta", extensions: { "weltraum.fixture": { lot: "beta" } } })]
    );

    const result = transferResource(command({ targetStackId: "ore_alpha_target" }), catalog, source, target);

    expect(result.status).toBe("Accepted");
    expect(result.targetState.contents).toHaveLength(2);
    expect(result.targetState.contents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stackId: "ore_beta", quantity: 4, ownerId: "beta", grade: "low" }),
        expect.objectContaining({ stackId: "ore_alpha_target", quantity: 2, ownerId: "alpha", grade: "high" })
      ])
    );
  });

  it("derives a capacity-limited partial transfer only when command and both policies allow it", () => {
    const source = snapshot(
      definition("source_hold", { policy: { partialTransferPolicy: "Allowed" } }),
      [ore("source_ore", 10)]
    );
    const target = snapshot(
      definition("target_hold", { maxMassKg: 20, maxVolumeM3: 1, policy: { partialTransferPolicy: "Allowed" } }),
      []
    );

    const result = transferResource(
      command({ quantity: 3, allowPartial: true, targetStackId: "partial_target" }),
      catalog,
      source,
      target
    );

    expect(result.status).toBe("PartiallyAccepted");
    expect(result.acceptedQuantity).toBe(2.5);
    expect(result.issues).toEqual(["TargetMassExceeded"]);
    expect(result.sourceState.contents).toEqual([expect.objectContaining({ stackId: "source_ore", quantity: 7.5 })]);
    expect(result.targetState.contents).toEqual([expect.objectContaining({ stackId: "partial_target", quantity: 2.5 })]);
    expect(result.sourceState.revision).toBe(1);
    expect(result.targetState.revision).toBe(1);
  });

  it("rejects atomic shortfalls without changing either input object, revision, signature, or contents", () => {
    const source = snapshot(
      definition("source_hold", { policy: { partialTransferPolicy: "Allowed" } }),
      [ore("source_ore", 10)]
    );
    const target = snapshot(
      definition("target_hold", { maxMassKg: 20, maxVolumeM3: 1, policy: { partialTransferPolicy: "Allowed" } }),
      []
    );

    const result = transferResource(command({ quantity: 3, allowPartial: false }), catalog, source, target);

    expect(result.status).toBe("Rejected");
    expect(result.code).toBe("TargetMassExceeded");
    expect(result.acceptedQuantity).toBe(0);
    expect(result.source).toBe(source);
    expect(result.target).toBe(target);
    expect(result.sourceSignatureAfter).toBe(source.state.signature);
    expect(result.targetSignatureAfter).toBe(target.state.signature);
    expect(result.sourceState.revision).toBe(0);
    expect(result.targetState.revision).toBe(0);
  });

  it("rejects stale replay after an accepted command using the original expected revisions", () => {
    const source = snapshot(definition("source_hold"), [ore("source_ore", 4)]);
    const target = snapshot(definition("target_hold"), []);
    const originalCommand = command({ quantity: 1, targetStackId: "replay_target" });

    const accepted = transferResource(originalCommand, catalog, source, target);
    const replay = transferResource(originalCommand, catalog, accepted.source, accepted.target);

    expect(accepted.status).toBe("Accepted");
    expect(replay).toMatchObject({ status: "Rejected", code: "SourceRevisionConflict", acceptedQuantity: 0 });
    expect(replay.source).toBe(accepted.source);
    expect(replay.target).toBe(accepted.target);
  });

  it("rejects revision overflow with the existing source revision-conflict result instead of throwing", () => {
    const source = snapshot(
      definition("source_hold"),
      [ore("source_ore", 2)],
      { revision: Number.MAX_SAFE_INTEGER }
    );
    const target = snapshot(definition("target_hold"), []);
    const result = transferResource(
      command({ source: { containerId: "source_hold", expectedRevision: Number.MAX_SAFE_INTEGER } }),
      catalog,
      source,
      target
    );

    expect(result).toMatchObject({ status: "Rejected", code: "SourceRevisionConflict", acceptedQuantity: 0 });
    expect(result.source).toBe(source);
    expect(result.target).toBe(target);
    expect(result.sourceState.revision).toBe(Number.MAX_SAFE_INTEGER);
    expect(result.targetState.revision).toBe(0);
  });

  it("permits a non-binary bulk capacity boundary without classifying it as a partial transfer", () => {
    const precisionCatalog = resourceCatalogFixture({
      resources: [
        resourceDefinitionFixture({
          resourceId: "precision_resource",
          massPerUnitKg: 0.1,
          volumePerUnitM3: 0.1,
          stackRule: { kind: "Bulk", maxQuantity: 10, splitAllowed: true }
        })
      ]
    });
    const source = snapshot(
      definition("source_hold"),
      [{ stackId: "precision_source", resourceId: "precision_resource", quantity: 3 }],
      {},
      precisionCatalog
    );
    const target = snapshot(
      definition("target_hold", { maxMassKg: 0.3, maxVolumeM3: 0.3 }),
      [],
      {},
      precisionCatalog
    );
    const result = transferResource(
      command({ resourceId: "precision_resource", quantity: 3, targetStackId: "precision_target" }),
      precisionCatalog,
      source,
      target
    );

    expect(result.status).toBe("Accepted");
    expect(result.acceptedQuantity).toBe(3);
    expect(result.target.currentMassKg).toBe(0.3);
    expect(result.target.currentVolumeM3).toBe(0.3);
    expect(result.target.remainingMassKg).toBe(0);
    expect(result.target.remainingVolumeM3).toBe(0);
  });

  it("rejects mission stack subdivision even when the target can accept the full command, while allowing its whole stack", () => {
    const source = snapshot(
      definition("source_hold"),
      [ore("mission_ore", 2, { missionId: "mission_alpha" })],
      { missionId: "mission_alpha" }
    );
    const target = snapshot(definition("target_hold"), []);
    const missionCommand = command({ quantity: 1, context: { actorId: "pilot", missionId: "mission_alpha" } });

    expect(transferResource(missionCommand, catalog, source, target)).toMatchObject({
      status: "Rejected",
      code: "MissionLocked"
    });
    expect(
      transferResource(command({ quantity: 2, context: { actorId: "pilot", missionId: "mission_alpha" } }), catalog, source, target)
    ).toMatchObject({ status: "Accepted", acceptedQuantity: 2 });
  });

  it("rejects sealed and discrete source-stack subdivision while allowing a whole discrete stack", () => {
    const sealedSource = snapshot(definition("source_hold"), [ore("sealed_ore", 2, { sealed: true })]);
    const sealedTarget = snapshot(definition("target_hold"), []);
    expect(transferResource(command({ quantity: 1 }), catalog, sealedSource, sealedTarget)).toMatchObject({
      status: "Rejected",
      code: "SealedStackCannotSplit"
    });

    const discreteCatalog = resourceCatalogFixture({
      resources: [
        resourceDefinitionFixture({
          resourceId: "discrete_resource",
          stackRule: { kind: "Discrete", maxQuantity: 5, splitAllowed: false }
        })
      ]
    });
    const discreteSource = snapshot(
      definition("source_hold"),
      [{ stackId: "discrete_source", resourceId: "discrete_resource", quantity: 2 }],
      {},
      discreteCatalog
    );
    const discreteTarget = snapshot(definition("target_hold"), [], {}, discreteCatalog);

    expect(
      transferResource(command({ resourceId: "discrete_resource", quantity: 1 }), discreteCatalog, discreteSource, discreteTarget)
    ).toMatchObject({ status: "Rejected", code: "PartialTransferNotAllowed" });
    expect(
      transferResource(command({ resourceId: "discrete_resource", quantity: 2 }), discreteCatalog, discreteSource, discreteTarget)
    ).toMatchObject({ status: "Accepted", acceptedQuantity: 2 });
  });

  it("uses every stable rejection code with deterministic validation precedence", () => {
    const source = snapshot(definition("source_hold"), [ore("source_ore", 2)]);
    const target = snapshot(definition("target_hold"), []);
    const rejectCode = (
      input: ResourceTransferCommandInput,
      sourceSnapshot = source,
      targetSnapshot = target
    ) => transferResource(input, catalog, sourceSnapshot, targetSnapshot).code;

    expect(rejectCode(command({ resourceId: "unknown_resource" }))).toBe("UnknownResource");
    expect(rejectCode(command({ sourceStackId: "missing_stack" }))).toBe("UnknownSourceStack");
    expect(rejectCode(command({ targetStackId: "not a save safe id" }))).toBe("QuantityInvalid");
    expect(rejectCode(command({ quantity: 0 }))).toBe("QuantityInvalid");
    expect(rejectCode(command({ quantity: 3 }))).toBe("InsufficientQuantity");
    expect(rejectCode(command({ source: { containerId: "source_hold", expectedRevision: 1 } }))).toBe("SourceRevisionConflict");
    expect(rejectCode(command({ target: { containerId: "target_hold", expectedRevision: 1 } }))).toBe("TargetRevisionConflict");
    expect(rejectCode(command({ quantity: 1 }), source, snapshot(definition("target_hold", { maxMassKg: 0 }), []))).toBe("TargetMassExceeded");
    expect(rejectCode(command({ quantity: 1 }), source, snapshot(definition("target_hold", { maxVolumeM3: 0 }), []))).toBe("TargetVolumeExceeded");
    expect(rejectCode(command({ quantity: 1 }), source, snapshot(definition("target_hold", { maxStackCount: 0 }), []))).toBe("TargetStackLimitExceeded");
    expect(
      rejectCode(command({ quantity: 1 }), source, snapshot(definition("target_hold", { policy: { blockedCategoryIds: ["raw_ore"] } }), []))
    ).toBe("ResourceCategoryBlocked");
    expect(
      rejectCode(command({ quantity: 1 }), source, snapshot(definition("target_hold", { policy: { blockedTags: ["ore"] } }), []))
    ).toBe("ResourceTagBlocked");
    const volatileSource = snapshot(definition("source_hold"), [{ stackId: "ice_stack", resourceId: "volatile_water_ice", quantity: 1 }]);
    expect(
      rejectCode(command({ resourceId: "volatile_water_ice", quantity: 1 }), volatileSource, snapshot(definition("target_hold", { policy: { blockedHazards: ["volatile"] } }), []))
    ).toBe("HazardBlocked");
    expect(
      rejectCode(
        command({ target: { containerId: "target_hold", expectedRevision: 0, portId: "inbound_port" } }),
        source,
        snapshot(definition("target_hold", { transferPorts: [{ portId: "inbound_port", direction: "Inbound", allowedActorIds: ["captain"] }] }), [])
      )
    ).toBe("AccessDenied");
    const ownedSource = snapshot(
      definition("source_hold", { policy: { ownershipPolicy: "OwnerOnly" } }),
      [ore("owned_ore", 1, { ownerId: "owner" })]
    );
    expect(rejectCode(command({ quantity: 1 }), ownedSource, target)).toBe("OwnershipDenied");
    const missionSource = snapshot(definition("source_hold"), [ore("mission_ore", 1)], { missionId: "mission_alpha" });
    expect(rejectCode(command({ quantity: 1 }), missionSource, target)).toBe("MissionLocked");
    const sealedContainerSource = snapshot(definition("source_hold"), [ore("sealed_container_ore", 1)], { sealed: true });
    expect(rejectCode(command({ quantity: 1 }), sealedContainerSource, target)).toBe("MissionLocked");
    const sealedSource = snapshot(
      definition("source_hold", { policy: { partialTransferPolicy: "Allowed" } }),
      [
        { stackId: "crate_a", resourceId: "cargo_mission_sealed_crate", quantity: 1, sealed: true },
        { stackId: "crate_b", resourceId: "cargo_mission_sealed_crate", quantity: 1, sealed: true }
      ]
    );
    const sealedTarget = snapshot(
      definition("target_hold", { maxMassKg: 75, maxVolumeM3: 1, policy: { partialTransferPolicy: "Allowed" } }),
      []
    );
    expect(
      transferResource(
        command({ resourceId: "cargo_mission_sealed_crate", quantity: 2, allowPartial: true }),
        catalog,
        sealedSource,
        sealedTarget
      )
    ).toMatchObject({ status: "PartiallyAccepted", acceptedQuantity: 1, issues: ["TargetMassExceeded"] });
    const partialForbiddenSource = snapshot(
      definition("source_hold", { policy: { partialTransferPolicy: "Allowed" } }),
      [ore("partial_ore", 3)]
    );
    const partialForbiddenTarget = snapshot(definition("target_hold", { maxMassKg: 20, maxVolumeM3: 1 }), []);
    expect(
      rejectCode(command({ quantity: 3, allowPartial: true }), partialForbiddenSource, partialForbiddenTarget)
    ).toBe("PartialTransferNotAllowed");
    expect(
      rejectCode(
        command({ target: { containerId: "source_hold", expectedRevision: 0 } }),
        source,
        source
      )
    ).toBe("SameContainerTransfer");

    expect(RESOURCE_TRANSFER_REJECTION_CODES).toEqual([
      "UnknownResource",
      "UnknownSourceStack",
      "QuantityInvalid",
      "InsufficientQuantity",
      "SourceRevisionConflict",
      "TargetRevisionConflict",
      "TargetMassExceeded",
      "TargetVolumeExceeded",
      "TargetStackLimitExceeded",
      "ResourceCategoryBlocked",
      "ResourceTagBlocked",
      "HazardBlocked",
      "AccessDenied",
      "OwnershipDenied",
      "MissionLocked",
      "SealedStackCannotSplit",
      "PartialTransferNotAllowed",
      "SameContainerTransfer"
    ]);
    expect(RESOURCE_TRANSFER_VALIDATION_ORDER).toEqual([
      "QuantityInvalid",
      "UnknownResource",
      "SameContainerTransfer",
      "SourceRevisionConflict",
      "TargetRevisionConflict",
      "UnknownSourceStack",
      "InsufficientQuantity",
      "AccessDenied",
      "OwnershipDenied",
      "MissionLocked",
      "ResourceCategoryBlocked",
      "ResourceTagBlocked",
      "HazardBlocked",
      "TargetMassExceeded",
      "TargetVolumeExceeded",
      "TargetStackLimitExceeded",
      "SealedStackCannotSplit",
      "PartialTransferNotAllowed"
    ]);
  });

  it("prioritizes policy failures over capacity and orders simultaneous capacity diagnostics", () => {
    const source = snapshot(definition("source_hold"), [ore("source_ore", 3)]);
    const blockedTarget = snapshot(
      definition("target_hold", { maxMassKg: 0, policy: { blockedCategoryIds: ["raw_ore"] } }),
      []
    );
    const policyResult = transferResource(command({ quantity: 1 }), catalog, source, blockedTarget);

    expect(policyResult).toMatchObject({
      status: "Rejected",
      code: "ResourceCategoryBlocked",
      issues: ["ResourceCategoryBlocked"]
    });

    const capacitySource = snapshot(
      definition("source_hold", { policy: { partialTransferPolicy: "Allowed" } }),
      [ore("source_alpha", 1, { grade: "alpha" }), ore("source_beta", 2, { grade: "beta" })]
    );
    const capacityTarget = snapshot(
      definition("target_hold", {
        maxMassKg: 20,
        maxVolumeM3: 0.01,
        maxStackCount: 2,
        policy: { partialTransferPolicy: "Allowed" }
      }),
      [ore("target_alpha", 1, { grade: "alpha" })]
    );
    const capacityResult = transferResource(command({ quantity: 3, allowPartial: true }), catalog, capacitySource, capacityTarget);

    expect(capacityResult).toMatchObject({ status: "PartiallyAccepted", acceptedQuantity: 1.5 });
    expect(capacityResult.issues).toEqual([
      "TargetMassExceeded",
      "TargetVolumeExceeded",
      "TargetStackLimitExceeded"
    ]);
  });

  it("extracts from a mining reservoir through the same engine and retains deterministic depletion", () => {
    const reservoirDefinition = miningReservoirContainerFixture();
    const reservoir = snapshot(
      reservoirDefinition,
      [ore("ore_reserve", 25)],
      { initialContents: [ore("ore_reserve", 100)] }
    );
    const target = snapshot(definition("target_hold"), []);
    const extractionCommand: ResourceTransferCommandInput = {
      source: { containerId: "mining_node_reservoir", expectedRevision: 0 },
      target: { containerId: "target_hold", expectedRevision: 0 },
      resourceId: "ore_iron_silicate",
      quantity: 10,
      allowPartial: false,
      context: { actorId: "pilot" }
    };

    const first = extractFromMiningReservoir(extractionCommand, catalog, reservoir, target);
    const repeat = extractFromMiningReservoir(extractionCommand, catalog, reservoir, target);

    expect(first.status).toBe("Accepted");
    expect(first.source.state.contents).toEqual([expect.objectContaining({ stackId: "ore_reserve", quantity: 15 })]);
    expect(first.source.depletion).toEqual({ initialQuantity: 100, remainingQuantity: 15, depletedQuantity: 85, fractionDepleted: 0.85 });
    expect(first.target.state.contents[0]).toMatchObject({ resourceId: "ore_iron_silicate", quantity: 10 });
    expect(first.source.signature).toBe(repeat.source.signature);
    expect(first.target.signature).toBe(repeat.target.signature);
    expect(first.targetStackIds).toEqual(repeat.targetStackIds);
  });
});
