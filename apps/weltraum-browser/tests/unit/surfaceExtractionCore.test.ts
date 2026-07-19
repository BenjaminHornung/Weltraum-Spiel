import { describe, expect, it } from "vitest";
import { createInteractionActorContext } from "../../src/interaction/index";
import {
  createSurfaceExtractionEquipmentFixtures,
  createSurfaceExtractionFixtures,
  createSurfaceExtractionSuitFixture,
  createSurfaceResourceNodeDefinition,
  createSurfaceResourceNodeState,
  createUnscannedSurfaceResourceNodeView,
  prepareExtractionSession,
  scanSurfaceResourceNode
} from "../../src/surface-extraction/index";

const preparationInput = (
  fixtures: ReturnType<typeof createSurfaceExtractionFixtures>,
  node = fixtures.ironSilicateVein.state,
  overrides: Record<string, unknown> = {}
) => ({
  sessionId: "extraction-session:unit",
  actorId: fixtures.suit.state.actorId,
  expectedNodeRevision: node.revision,
  targetContainerId: fixtures.miningDroneContainer.definition.containerId,
  startedUniverseTick: 100,
  actorContext: fixtures.equipment.cutter.actorContext,
  blueprint: fixtures.equipment.cutter.fixture.blueprint,
  equipmentStats: fixtures.equipment.cutter.stats,
  equipmentReadiness: fixtures.equipment.cutter.readiness,
  equipmentProjection: fixtures.equipment.cutter.projection,
  suitState: fixtures.suit.state,
  suitInterface: fixtures.suit.equipmentInterface,
  environment: fixtures.environments.earth,
  target: fixtures.miningDroneContainer,
  catalog: fixtures.catalog,
  ...overrides
});

describe("surface extraction scanning and readiness", () => {
  it("keeps composition hidden until a deterministic confidence-bearing scan succeeds", () => {
    const fixtures = createSurfaceExtractionFixtures();
    const hidden = createUnscannedSurfaceResourceNodeView(fixtures.ironSilicateVein.state);
    expect(hidden).not.toHaveProperty("resourceId");
    expect(hidden).not.toHaveProperty("grade");
    expect(hidden).not.toHaveProperty("quantity");

    const first = scanSurfaceResourceNode(fixtures.ironSilicateVein.definition, fixtures.ironSilicateVein.state, {
      actorContext: fixtures.equipment.scanner.actorContext,
      equipment: fixtures.equipment.scanner.projection,
      environment: fixtures.environments.earth,
      scanSkillBasisPoints: 9_000,
      distanceMeters: 2
    });
    const second = scanSurfaceResourceNode(fixtures.ironSilicateVein.definition, fixtures.ironSilicateVein.state, {
      actorContext: fixtures.equipment.scanner.actorContext,
      equipment: fixtures.equipment.scanner.projection,
      environment: fixtures.environments.earth,
      scanSkillBasisPoints: 9_000,
      distanceMeters: 2
    });
    expect(first.status, first.status === "Blocked" ? first.reason : undefined).toBe("Scanned");
    expect(second).toEqual(first);
    if (first.status !== "Scanned") throw new Error("Expected scan fixture to succeed.");
    expect(first.result.confidence).toBeGreaterThan(0.8);
    expect(first.result.resourceId).toBe("ore_iron_silicate");
    expect(first.result.estimatedQuantity).toBeGreaterThan(0);
  });

  it("blocks missing tools and capabilities before preparation", () => {
    const fixtures = createSurfaceExtractionFixtures();
    const base = fixtures.equipment.cutter.actorContext;
    const noTool = createInteractionActorContext({ ...base, tools: [] });
    const noCapability = createInteractionActorContext({
      ...base,
      capabilities: ["capability.access"]
    });
    const incapacitatedScanner = createInteractionActorContext({
      ...fixtures.equipment.scanner.actorContext,
      incapacitated: true
    });
    expect(prepareExtractionSession(
      fixtures.ironSilicateVein.definition,
      fixtures.ironSilicateVein.state,
      preparationInput(fixtures, undefined, { actorContext: noTool })
    ).blockReasons).toContain("ToolMissing");
    expect(prepareExtractionSession(
      fixtures.ironSilicateVein.definition,
      fixtures.ironSilicateVein.state,
      preparationInput(fixtures, undefined, { actorContext: noCapability })
    ).blockReasons).toContain("CapabilityMissing");
    expect(scanSurfaceResourceNode(fixtures.ironSilicateVein.definition, fixtures.ironSilicateVein.state, {
      actorContext: incapacitatedScanner,
      equipment: fixtures.equipment.scanner.projection,
      environment: fixtures.environments.earth,
      scanSkillBasisPoints: 10_000,
      distanceMeters: 2
    })).toEqual({ status: "Blocked", reason: "SuitNotReady" });
  });

  it("uses suit and equipment readiness plus explicit environment restrictions", () => {
    const fixtures = createSurfaceExtractionFixtures();
    const unsafeSuit = createSurfaceExtractionSuitFixture({ actorIncapacitated: true });
    const unsafeEquipment = createSurfaceExtractionEquipmentFixtures(unsafeSuit);
    const suitBlocked = prepareExtractionSession(
      fixtures.ironSilicateVein.definition,
      fixtures.ironSilicateVein.state,
      preparationInput(fixtures, undefined, {
        actorId: unsafeSuit.state.actorId,
        actorContext: unsafeEquipment.cutter.actorContext,
        blueprint: unsafeEquipment.cutter.fixture.blueprint,
        equipmentStats: unsafeEquipment.cutter.stats,
        equipmentReadiness: unsafeEquipment.cutter.readiness,
        equipmentProjection: unsafeEquipment.cutter.projection,
        suitState: unsafeSuit.state,
        suitInterface: unsafeSuit.equipmentInterface
      })
    );
    expect(suitBlocked.blockReasons).toContain("EquipmentNotReady");
    expect(suitBlocked.blockReasons).toContain("SuitNotReady");

    const restrictedDefinition = createSurfaceResourceNodeDefinition({
      definitionId: "resource-node-definition:spore-restricted",
      resourceId: "ore_iron_silicate",
      extractionMethod: "Cutting",
      requiredCapability: "capability.extract",
      hardnessBasisPoints: 900,
      grade: "industrial",
      gradeBasisPoints: 10_000,
      pulseYieldRange: { minimum: 1, maximum: 1 },
      contaminationFactor: 0,
      dustFactor: 0,
      legality: { legalStatus: "Legal", ownershipPolicy: "Unclaimed" },
      environmentRestrictions: { allowedModelStates: ["Valid"], maximumSporeLoad: 0 }
    });
    const restrictedNode = createSurfaceResourceNodeState(restrictedDefinition, {
      nodeId: "resource-node:spore-restricted",
      surfaceFrameId: fixtures.ironSilicateVein.state.surfaceFrameId,
      localPosition: fixtures.ironSilicateVein.state.localPosition,
      reservoir: fixtures.ironSilicateVein.state.reservoir,
      exposureState: "Exposed"
    });
    const environmentBlocked = prepareExtractionSession(
      restrictedDefinition,
      restrictedNode,
      preparationInput(fixtures, restrictedNode, { environment: fixtures.environments.hestia })
    );
    expect(environmentBlocked.blockReasons).toContain("EnvironmentUnsafe");
  });

  it("enforces legality, ownership, active-session, depletion, capacity, and hazard policy", () => {
    const fixtures = createSurfaceExtractionFixtures();
    const illegal = prepareExtractionSession(
      fixtures.claimedIllegalNode.definition,
      fixtures.claimedIllegalNode.state,
      preparationInput(fixtures, fixtures.claimedIllegalNode.state)
    );
    expect(illegal.blockReasons).toContain("IllegalExtraction");
    expect(illegal.blockReasons).toContain("OwnershipDenied");
    const legalOverrideActor = createInteractionActorContext({
      ...fixtures.equipment.cutter.actorContext,
      legalOverride: true
    });
    const overridden = prepareExtractionSession(
      fixtures.claimedIllegalNode.definition,
      fixtures.claimedIllegalNode.state,
      preparationInput(fixtures, fixtures.claimedIllegalNode.state, { actorContext: legalOverrideActor })
    );
    expect(overridden.blockReasons).not.toContain("IllegalExtraction");
    expect(overridden.blockReasons).toContain("OwnershipDenied");

    const actorMismatch = prepareExtractionSession(
      fixtures.ironSilicateVein.definition,
      fixtures.ironSilicateVein.state,
      preparationInput(fixtures, undefined, { actorId: "actor_mismatch" })
    );
    expect(actorMismatch.blockReasons).toContain("InvalidPulse");

    const depleted = prepareExtractionSession(
      fixtures.depletedNode.definition,
      fixtures.depletedNode.state,
      preparationInput(fixtures, fixtures.depletedNode.state)
    );
    expect(depleted.blockReasons).toContain("NodeDepleted");

    const busyState = createSurfaceResourceNodeState(fixtures.ironSilicateVein.definition, {
      nodeId: fixtures.ironSilicateVein.state.nodeId,
      surfaceFrameId: fixtures.ironSilicateVein.state.surfaceFrameId,
      localPosition: fixtures.ironSilicateVein.state.localPosition,
      revision: fixtures.ironSilicateVein.state.revision,
      reservoir: fixtures.ironSilicateVein.state.reservoir,
      exposureState: fixtures.ironSilicateVein.state.exposureState,
      activeSessionId: "extraction-session:other"
    });
    expect(prepareExtractionSession(
      fixtures.ironSilicateVein.definition,
      busyState,
      preparationInput(fixtures, busyState)
    ).blockReasons).toContain("ActiveSessionConflict");

    const capacity = prepareExtractionSession(
      fixtures.geologicalSampleCore.definition,
      fixtures.geologicalSampleCore.state,
      preparationInput(fixtures, fixtures.geologicalSampleCore.state, {
        targetContainerId: fixtures.insufficientSuitContainer.definition.containerId,
        target: fixtures.insufficientSuitContainer
      })
    );
    expect(capacity.blockReasons).toContain("TargetCapacityExceeded");

    const hazardous = prepareExtractionSession(
      fixtures.hestiaContaminatedBiologicalSample.definition,
      fixtures.hestiaContaminatedBiologicalSample.state,
      preparationInput(fixtures, fixtures.hestiaContaminatedBiologicalSample.state, {
        targetContainerId: fixtures.biologicalHazardRejectedContainer.definition.containerId,
        target: fixtures.biologicalHazardRejectedContainer,
        environment: fixtures.environments.hestia
      })
    );
    expect(hazardous.blockReasons).toContain("HazardContainerRequired");
  });

  it("exposes all eight requested reusable fixtures", () => {
    const fixtures = createSurfaceExtractionFixtures();
    expect(fixtures.ironSilicateVein.definition.resourceId).toBe("ore_iron_silicate");
    expect(fixtures.waterIceDeposit.definition.resourceId).toBe("volatile_water_ice");
    expect(fixtures.geologicalSampleCore.definition.resourceId).toBe("sample_geology_core");
    expect(fixtures.hestiaContaminatedBiologicalSample.definition.resourceId).toBe("sample_hestia_biological");
    expect(fixtures.claimedIllegalNode.definition.legality.legalStatus).toBe("Illegal");
    expect(fixtures.depletedNode.state.depletionState).toBe("Depleted");
    expect(fixtures.insufficientSuitContainer.definition.kind).toBe("Suit");
    expect(fixtures.miningDroneContainer.definition.kind).toBe("DroneCargo");
  });
});
