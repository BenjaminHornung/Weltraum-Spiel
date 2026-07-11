import { describe, expect, it } from "vitest";
import {
  ResourceValidationError,
  createResourceContainerDefinition,
  createResourceContainerSnapshot,
  createResourceContainerState,
  evaluateContainerEligibility,
  miningReservoirContainerFixture,
  missionCargoContainerFixture,
  shipHoldContainerFixture,
  starterResourceCatalogFixture,
  suitContainerFixture
} from "../../src/resources";

const catalog = starterResourceCatalogFixture();
const ore = (stackId: string, quantity: number) => ({ stackId, resourceId: "ore_iron_silicate", quantity });

const expectResourceValidation = (action: () => unknown, code: ResourceValidationError["code"]): void => {
  try {
    action();
    throw new Error(`Expected ResourceValidationError ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(ResourceValidationError);
    expect((error as ResourceValidationError).code).toBe(code);
  }
};

describe("resource container model", () => {
  it("supports each required generic container kind", () => {
    const kinds = ["Suit", "ShipCargo", "DroneCargo", "OutpostStorage", "CargoModule", "ExternalRack", "MissionCargo", "MiningNodeReservoir"] as const;
    expect(kinds.map((kind, index) => createResourceContainerDefinition({ containerId: `container_${index}`, kind, maxMassKg: 1, maxVolumeM3: 1, maxStackCount: 1 }).kind)).toEqual(kinds);
  });

  it("canonicalizes stack order, omits normalized zero stacks, and leaves inputs unchanged", () => {
    const stacks = [ore("ore_b", 2), ore("ore_zero", 0), ore("ore_a", 1)];
    const forward = createResourceContainerState({ containerId: "suit_pack", contents: stacks }, catalog);
    const reverse = createResourceContainerState({ containerId: "suit_pack", contents: [...stacks].reverse() }, catalog);
    expect(forward.contents.map((stack) => stack.stackId)).toEqual(["ore_a", "ore_b"]);
    expect(forward.signature).toBe(reverse.signature);
    expect(stacks.map((stack) => stack.stackId)).toEqual(["ore_b", "ore_zero", "ore_a"]);
  });

  it("validates zero-quantity stacks against the catalog and sealed rule before omitting them", () => {
    expectResourceValidation(
      () => createResourceContainerState({ containerId: "suit_pack", contents: [{ stackId: "unknown_zero", resourceId: "unknown_resource", quantity: 0 }] }, catalog),
      "UNKNOWN_RESOURCE"
    );
    expectResourceValidation(
      () => createResourceContainerState({ containerId: "suit_pack", contents: [{ stackId: "unsealed_zero", resourceId: "cargo_mission_sealed_crate", quantity: 0, sealed: false }] }, catalog),
      "INVALID_STACK"
    );
  });

  it("uses the shared save-safe identity contract for stack and container owners", () => {
    const state = createResourceContainerState(
      { containerId: "owner_hold", ownerId: "owner_one", contents: [{ ...ore("owned_ore", 1), ownerId: "owner_one" }] },
      catalog
    );

    expect(state.ownerId).toBe("owner_one");
    expect(state.contents[0].ownerId).toBe("owner_one");
    expectResourceValidation(
      () => createResourceContainerState({ containerId: "owner_hold", ownerId: "owner-one", contents: [] }, catalog),
      "INVALID_CATALOG"
    );
    expectResourceValidation(
      () => createResourceContainerState({ containerId: "owner_hold", contents: [{ ...ore("invalid_owner", 1), ownerId: "owner-one" }] }, catalog),
      "INVALID_STACK"
    );
  });

  it("derives capacity, totals, hazards, legal summary, and signatures without mutable fields", () => {
    const state = createResourceContainerState({ containerId: "ship_hold", contents: [ore("ore_stack", 3), { stackId: "fuel_stack", resourceId: "fuel_refined_propellant", quantity: 2 }] }, catalog);
    const snapshot = createResourceContainerSnapshot(shipHoldContainerFixture(), state, catalog);
    expect(snapshot.currentMassKg).toBe(26);
    expect(snapshot.currentVolumeM3).toBe(0.0146);
    expect(snapshot.remainingMassKg).toBe(4974);
    expect(snapshot.stackCount).toBe(2);
    expect(snapshot.resourceTotals).toEqual([{ resourceId: "fuel_refined_propellant", quantity: 2 }, { resourceId: "ore_iron_silicate", quantity: 3 }]);
    expect(snapshot.hazardSummary.length).toBeGreaterThan(0);
    expect(Object.isFrozen(snapshot.resourceTotals)).toBe(true);
  });

  it("exposes generic policy and transfer-port seams without mutating transfers", () => {
    const definition = createResourceContainerDefinition({ containerId: "policy_hold", kind: "ShipCargo", maxMassKg: 1, maxVolumeM3: 1, maxStackCount: 1, policy: { blockedCategoryIds: ["raw_ore"], allowedActorIds: ["pilot"], allowedOwnerIds: ["pilot"], partialTransferPolicy: "Allowed" }, transferPorts: [{ portId: "cargo_port", direction: "Bidirectional", allowedActorIds: ["pilot"] }] });
    const state = createResourceContainerState({ containerId: "policy_hold", contents: [] }, catalog);
    const result = evaluateContainerEligibility(definition, catalog, createResourceContainerState({ containerId: "suit_pack", contents: [{ ...ore("ore_stack", 1), ownerId: "pilot" }] }, catalog).contents[0], "pilot");
    expect(result).toMatchObject({ eligible: false, issues: ["ResourceCategoryBlocked"] });
    expect(definition.policy.partialTransferPolicy).toBe("Allowed");
    expect(definition.transferPorts[0].portId).toBe("cargo_port");
    expect(state.contents).toEqual([]);
  });

  it("preserves mission, ownership, sealed, legal, and extension metadata", () => {
    const state = createResourceContainerState({ containerId: "mission_cargo_bay", ownerId: "mission_cargo_bay", missionId: "mission_alpha", sealed: true, legalStatus: "Restricted", extensions: { "weltraum.fixture": { purpose: "mission" } }, contents: [{ stackId: "crate_stack", resourceId: "cargo_mission_sealed_crate", quantity: 1, sealed: true, ownerId: "mission_cargo_bay", missionId: "mission_alpha", legalStatus: "Restricted" }] }, catalog);
    const snapshot = createResourceContainerSnapshot(missionCargoContainerFixture(), state, catalog);
    expect(snapshot.state).toMatchObject({ ownerId: "mission_cargo_bay", missionId: "mission_alpha", sealed: true, legalStatus: "Restricted" });
    expect(snapshot.state.contents[0]).toMatchObject({ sealed: true, missionId: "mission_alpha", ownerId: "mission_cargo_bay" });
  });

  it("derives deterministic mining depletion from initial and remaining contents", () => {
    const state = createResourceContainerState({ containerId: "mining_node_reservoir", contents: [ore("ore_reserve", 25)], initialContents: [ore("ore_reserve", 100)] }, catalog);
    const snapshot = createResourceContainerSnapshot(miningReservoirContainerFixture(), state, catalog);
    expect(snapshot.depletion).toEqual({ initialQuantity: 100, remainingQuantity: 25, depletedQuantity: 75, fractionDepleted: 0.75 });
  });

  it("provides the suit fixture for a minimal container snapshot", () => {
    const state = createResourceContainerState({ containerId: "suit_pack", contents: [] }, catalog);
    expect(createResourceContainerSnapshot(suitContainerFixture(), state, catalog).remainingMassKg).toBe(30);
  });
});
