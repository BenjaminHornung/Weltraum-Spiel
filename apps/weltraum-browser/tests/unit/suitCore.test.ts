import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SUIT_LIFE_SUPPORT_MODES,
  SUIT_SCHEMA_VERSION,
  SUIT_SIMULATION_HZ,
  SUIT_SUBSYSTEM_ROLES,
  SUIT_WORKLOADS,
  SuitTransitionError,
  SuitValidationError,
  advanceSuitState,
  applySuitCommand,
  canonicalSuitCommandResultsJson,
  canonicalSuitJson,
  createCanonicalSuitEventSequence,
  createSuitActorId,
  createSuitAlertId,
  createSuitCommand,
  createSuitCommandId,
  createSuitDefinition,
  createSuitEnvironmentExposure,
  createSuitEquipmentInterfaceSnapshot,
  createSuitRevision,
  createSuitSourceId,
  createSuitStateId,
  createSuitStateSnapshot,
  createSuitStepCount,
  createSuitSubsystemId,
  createSuitTick,
  sortSuitAlerts,
  type SuitCommand,
  type SuitCommandResult,
  type SuitDefinition,
  type SuitEnvironmentExposure,
  type SuitStateSnapshot,
  type SuitSubsystemStatus,
  type SuitWorkload
} from "../../src/suit";

const interfaceDefinitions = () => [{
  interfaceId: "interface:primary",
  continuousPowerBudgetMilliwatts: 2_000,
  pulseEnergyReserveMillijoules: 3_000,
  thermalDissipationBudgetMilliwatts: 4_000,
  revision: 0
}];

const subsystemDefinitions = () => SUIT_SUBSYSTEM_ROLES.map((role, index) => ({
  subsystemId: `subsystem:${role}`,
  role,
  continuousPowerDrawMilliwatts: 10,
  oxygenConsumptionReductionMilligramsPerSecond: role === "oxygen-regulator" ? 2 : 0,
  thermalDeltaMilliKelvinPerSecond: role === "thermal-control" ? -10 : 0,
  contaminationFilterBasisPoints: role === "contamination-filter" ? 5_000 : 0,
  priority: 100 - index * 10,
  requiredInterfaceId: "interface:primary",
  revision: 0
}));

const workloadProfiles = () => [
  ["Rest", 1, 1, 0], ["Walk", 10, 10, 10], ["Sprint", 20, 20, 20],
  ["HeavyWork", 30, 30, 30], ["Incapacitated", 0, 0, 0]
].map(([workload, oxygen, energy, thermal]) => ({
  workload,
  oxygenConsumptionMilligramsPerSecond: oxygen,
  energyConsumptionMillijoulesPerSecond: energy,
  temperatureDeltaMilliKelvinPerSecond: thermal
}));

const modeProfiles = () => SUIT_LIFE_SUPPORT_MODES.map((mode) => ({
  mode,
  oxygenConsumptionAdjustmentMilligramsPerSecond: 0,
  energyConsumptionAdjustmentMillijoulesPerSecond: 0,
  temperatureDeltaAdjustmentMilliKelvinPerSecond: 0
}));

const definitionInput = () => ({
  schemaVersion: SUIT_SCHEMA_VERSION,
  definitionId: "suit-definition:eva-v1",
  healthMaximumMilliPoints: 10_000,
  oxygenCapacityMilligrams: 10_000,
  energyCapacityMillijoules: 10_000,
  sealIntegrityMaximumBasisPoints: 10_000,
  temperature: {
    nominalMinimumMilliKelvin: 290_000, nominalMaximumMilliKelvin: 310_000,
    safeMinimumMilliKelvin: 280_000, safeMaximumMilliKelvin: 320_000,
    warningLowMilliKelvin: 275_000, warningHighMilliKelvin: 325_000,
    criticalLowMilliKelvin: 270_000, criticalHighMilliKelvin: 330_000
  },
  alerts: {
    oxygenLowMilligrams: 3_000, oxygenCriticalMilligrams: 1_000,
    energyLowMillijoules: 3_000, energyCriticalMillijoules: 1_000,
    sealDamagedBasisPoints: 8_000, sealCriticalBasisPoints: 4_000,
    radiationElevatedMicrosieverts: 100, radiationCriticalMicrosieverts: 200,
    contaminationElevatedMicroUnits: 100, contaminationCriticalMicroUnits: 200
  },
  damageRules: {
    damagedSealLeakMilligramsPerSecondAtZeroIntegrity: 1_000,
    oxygenDepletedHealthDamageMilliPointsPerSecond: 100,
    temperatureCriticalHealthDamageMilliPointsPerSecond: 100,
    radiationCriticalHealthDamageMilliPointsPerSecond: 50,
    contaminationCriticalHealthDamageMilliPointsPerSecond: 50
  },
  recoveryRules: {
    healthRepairLimitMilliPointsPerCommand: 10_000,
    sealRepairLimitBasisPointsPerCommand: 10_000
  },
  workloadProfiles: workloadProfiles(), modeProfiles: modeProfiles(),
  allowedModes: [...SUIT_LIFE_SUPPORT_MODES],
  subsystemDefinitions: subsystemDefinitions(), interfaceDefinitions: interfaceDefinitions(),
  failSafeModeOnEquipmentBusLoss: "Emergency",
  registryVersion: "suit-registry:v1", algorithmVersion: "suit-algorithm:v1"
});

const definition = (mutate?: (input: ReturnType<typeof definitionInput>) => void): SuitDefinition => {
  const input = definitionInput();
  mutate?.(input);
  return createSuitDefinition(input);
};

interface StateOptions {
  readonly stateId?: string;
  readonly actorId?: string;
  readonly tick?: number;
  readonly revision?: number;
  readonly health?: number;
  readonly healthCeiling?: number;
  readonly oxygen?: number;
  readonly energy?: number;
  readonly seal?: number;
  readonly sealCeiling?: number;
  readonly temperature?: number;
  readonly radiation?: number;
  readonly contamination?: number;
  readonly workload?: SuitWorkload;
  readonly mode?: "Nominal" | "Conserve" | "Emergency" | "Offline";
  readonly statusById?: Readonly<Record<string, SuitSubsystemStatus>>;
  readonly subsystemOrder?: "forward" | "reverse";
}

const state = (suitDefinition: SuitDefinition, options: StateOptions = {}): SuitStateSnapshot => {
  const health = options.health ?? 10_000;
  const subsystemStates = suitDefinition.subsystemDefinitions.map((entry) => ({
    subsystemId: entry.subsystemId,
    status: options.statusById?.[entry.subsystemId] ?? "Enabled",
    powerState: "Unpowered",
    revision: 0
  }));
  if (options.subsystemOrder === "reverse") subsystemStates.reverse();
  return createSuitStateSnapshot({
    schemaVersion: SUIT_SCHEMA_VERSION,
    stateId: options.stateId ?? "suit-state:player", actorId: options.actorId ?? "actor:player", definitionId: suitDefinition.definitionId,
    revision: options.revision ?? 0, tick: options.tick ?? 0,
    healthMilliPoints: health,
    healthRepairCeilingMilliPoints: options.healthCeiling ?? health,
    oxygenMilligrams: options.oxygen ?? 10_000,
    energyMillijoules: options.energy ?? 10_000,
    sealIntegrityBasisPoints: options.seal ?? 10_000,
    sealRepairCeilingBasisPoints: options.sealCeiling ?? options.seal ?? 10_000,
    internalTemperatureMilliKelvin: options.temperature ?? 300_000,
    radiationMicrosieverts: options.radiation ?? 0,
    contaminationMicroUnits: options.contamination ?? 0,
    mode: options.mode ?? "Nominal",
    workload: health === 0 ? "Incapacitated" : options.workload ?? "Rest",
    subsystemStates, rateRemainders: [], actorIncapacitated: health === 0,
    acceptedCommandIds: []
  }, suitDefinition);
};

const exposure = (overrides: Partial<Record<keyof SuitEnvironmentExposure, unknown>> = {}): SuitEnvironmentExposure => createSuitEnvironmentExposure({
  oxygenLossMilligramsPerTick: 0, energyDrawMillijoulesPerTick: 0, energyGainMillijoulesPerTick: 0,
  temperatureDeltaMilliKelvinPerTick: 0, sealDamageBasisPointsPerTick: 0,
  radiationMicrosievertsPerTick: 0, contaminationMicroUnitsPerTick: 0,
  healthDamageMilliPointsPerTick: 0, hazardTags: [], sourceId: "exposure:test", sourceRevision: 0,
  ...overrides
});

let commandSequence = 0;
const command = (
  suitState: SuitStateSnapshot,
  kind: SuitCommand["kind"],
  payload: Readonly<Record<string, unknown>>,
  overrides: Partial<Record<"commandId" | "expectedRevision" | "resultingRevision" | "tick" | "sourceId", unknown>> = {}
): SuitCommand => {
  commandSequence += 1;
  return createSuitCommand({
    kind, commandId: `command:test-${commandSequence}`, actorId: suitState.actorId, stateId: suitState.stateId,
    expectedRevision: suitState.revision, resultingRevision: suitState.revision + 1, tick: suitState.tick,
    payload, sourceId: "source:test", ...overrides
  });
};

describe("Suit Survival State Core V1", () => {
  it("1 validates every branded stable ID exactly without normalization", () => {
    expect(createSuitStateId("state:valid.v1")).toBe("state:valid.v1");
    expect(createSuitActorId("actor_valid-1")).toBe("actor_valid-1");
    expect(createSuitSubsystemId("subsystem:valid")).toBe("subsystem:valid");
    expect(createSuitCommandId("command:valid")).toBe("command:valid");
    expect(createSuitSourceId("source:valid")).toBe("source:valid");
    for (const invalid of [" Upper", "upper ", "UPPER", "", "é", `a${"b".repeat(128)}`]) {
      expect(() => createSuitStateId(invalid)).toThrow(SuitValidationError);
    }
  });

  it("2 rejects non-safe, fractional, and out-of-range authoritative scalars", () => {
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => createSuitTick(invalid)).toThrow(SuitValidationError);
    }
    expect(() => createSuitTick(-1)).toThrow(SuitValidationError);
    expect(() => createSuitStepCount(0)).toThrow(SuitValidationError);
    expect(createSuitTick(0)).toBe(0);
    expect(SUIT_SIMULATION_HZ).toBe(10);
  });

  it("3 rejects negative zero in scalar and canonical boundaries", () => {
    expect(() => createSuitRevision(-0)).toThrow(SuitValidationError);
    expect(() => canonicalSuitJson({ value: -0 })).toThrow(SuitValidationError);
  });

  it("4 defensive-copies and recursively freezes all canonical publications", () => {
    const input = definitionInput();
    const created = createSuitDefinition(input);
    input.interfaceDefinitions[0]!.continuousPowerBudgetMilliwatts = 999_999;
    input.subsystemDefinitions.reverse();
    expect(created.interfaceDefinitions[0]!.continuousPowerBudgetMilliwatts).toBe(2_000);
    expect(Object.isFrozen(created)).toBe(true);
    expect(Object.isFrozen(created.subsystemDefinitions)).toBe(true);
    expect(Object.isFrozen(created.temperature)).toBe(true);
  });

  it("rejects sparse arrays at public suit factory, sorter, and schedule boundaries", () => {
    const expectSparseFailure = (action: () => unknown, expectedPath: string): void => {
      try {
        action();
        throw new Error("Expected sparse suit array validation to fail.");
      } catch (error) {
        expect(error).toBeInstanceOf(SuitValidationError);
        if (error instanceof SuitValidationError) {
          expect(error.code).toBe("InvalidShape");
          expect(error.path).toBe(expectedPath);
        }
      }
    };
    const suitDefinition = definition();
    const start = state(suitDefinition);
  const sparse = new Array<unknown>(1);
  const sparseCommandResults = new Array<SuitCommandResult>(1);

    expectSparseFailure(() => createSuitEnvironmentExposure({
      ...exposure(),
      hazardTags: sparse
    }), "/exposure/hazardTags/0");
    expectSparseFailure(() => createSuitCommand({
      kind: "ApplyExternalDamage", commandId: "command:sparse-damage", actorId: start.actorId,
      stateId: start.stateId, expectedRevision: 0, resultingRevision: 1, tick: 0,
      sourceId: "source:test", payload: {
        healthDamageMilliPoints: 0, sealDamageBasisPoints: 0, faultSubsystemIds: sparse
      }
    }), "/command/payload/faultSubsystemIds/0");
    expectSparseFailure(() => createSuitCommand({
      kind: "ApplyRepair", commandId: "command:sparse-repair", actorId: start.actorId,
      stateId: start.stateId, expectedRevision: 0, resultingRevision: 1, tick: 0,
      sourceId: "source:test", payload: {
        healthRepairMilliPoints: 0, sealRepairBasisPoints: 0, repairSubsystemIds: sparse
      }
    }), "/command/payload/repairSubsystemIds/0");

    const sparseDefinition = definitionInput() as Record<string, unknown>;
    sparseDefinition.interfaceDefinitions = sparse;
    expectSparseFailure(() => createSuitDefinition(sparseDefinition), "/definition/interfaceDefinitions/0");
    const sparseState = JSON.parse(JSON.stringify(start)) as Record<string, unknown>;
    sparseState.acceptedCommandIds = sparse;
    expectSparseFailure(() => createSuitStateSnapshot(sparseState, suitDefinition), "/state/acceptedCommandIds/0");
    expectSparseFailure(() => advanceSuitState(start, {
      definition: suitDefinition,
      commands: sparse as readonly SuitCommand[]
    }), "/input/commands/0");
    expectSparseFailure(() => sortSuitAlerts(sparse as never), "/alerts/0");
    expectSparseFailure(() => createCanonicalSuitEventSequence(sparse as never), "/events/0");
    expectSparseFailure(
      () => canonicalSuitCommandResultsJson(sparseCommandResults),
      "/commandResults/0"
    );
  });

  it("sorts cloned canonical alerts without freezing or mutating caller-owned alerts", () => {
    const suitDefinition = definition();
    const canonicalAlerts = state(suitDefinition, { oxygen: 500 }).activeAlerts;
    const callerAlerts = canonicalAlerts.map((entry) => ({ ...entry })).reverse();
    const callerAlertIds = callerAlerts.map((entry) => entry.alertId);
    const firstCallerAlert = callerAlerts[0]!;
    const sorted = sortSuitAlerts(callerAlerts);
    const sortedBeforeCallerMutation = canonicalSuitJson(sorted);

    expect(Object.isFrozen(callerAlerts)).toBe(false);
    expect(Object.isFrozen(firstCallerAlert)).toBe(false);
    expect(Object.isFrozen(sorted)).toBe(true);
    expect(Object.isFrozen(sorted[0])).toBe(true);
    expect(sorted.every((entry) => !callerAlerts.includes(entry))).toBe(true);
    expect(callerAlerts.map((entry) => entry.alertId)).toEqual(callerAlertIds);

    firstCallerAlert.measurement += 1;
    callerAlerts.reverse();
    expect(canonicalSuitJson(sorted)).toBe(sortedBeforeCallerMutation);
  });

  it("5 gives identical definitions, states, and exposures identical signatures/JSON", () => {
    const leftDefinition = definition();
    const rightDefinition = definition();
    expect(leftDefinition.contentSignature).toBe(rightDefinition.contentSignature);
    expect(state(leftDefinition).contentSignature).toBe(state(rightDefinition).contentSignature);
    expect(canonicalSuitJson(exposure())).toBe(canonicalSuitJson(exposure()));
  });

  it("6 canonical sorts make caller input order signature-invariant", () => {
    const forward = definition();
    const reverse = definition((input) => {
      input.interfaceDefinitions.reverse();
      input.subsystemDefinitions.reverse();
      input.allowedModes.reverse();
      input.workloadProfiles.reverse();
      input.modeProfiles.reverse();
    });
    expect(reverse.contentSignature).toBe(forward.contentSignature);
    expect(state(forward, { subsystemOrder: "forward" }).contentSignature)
      .toBe(state(reverse, { subsystemOrder: "reverse" }).contentSignature);
    expect(exposure({ hazardTags: ["vacuum", "cold", "vacuum"] })).toEqual(exposure({ hazardTags: ["cold", "vacuum"] }));
  });

  it("7 replays 100 aggregated ticks exactly like 100 single ticks including semantic events", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition, { workload: "Walk" });
    const tickExposure = exposure({ oxygenLossMilligramsPerTick: 1, radiationMicrosievertsPerTick: 3, contaminationMicroUnitsPerTick: 1 });
    const aggregated = advanceSuitState(start, { definition: suitDefinition, exposure: tickExposure }, 100);
    let current = start;
    const events = [];
    for (let index = 0; index < 100; index += 1) {
      const next = advanceSuitState(current, { definition: suitDefinition, exposure: tickExposure });
      current = next.state;
      events.push(...next.events);
    }
    expect(current.contentSignature).toBe(aggregated.state.contentSignature);
    const singleSequence = createCanonicalSuitEventSequence(events);
    expect(singleSequence.signature).toBe(aggregated.eventSignature);
    expect(singleSequence.events).toEqual(aggregated.events);
  });

  it("8 applies configured deterministic rates for all five workloads", () => {
    const suitDefinition = definition();
    const oxygenByWorkload = new Map<string, number>();
    for (const workload of SUIT_WORKLOADS) {
      const result = advanceSuitState(state(suitDefinition, { workload }), { definition: suitDefinition }, 10);
      oxygenByWorkload.set(workload, result.state.oxygenMilligrams);
    }
    expect(oxygenByWorkload.get("HeavyWork")).toBeLessThan(oxygenByWorkload.get("Sprint")!);
    expect(oxygenByWorkload.get("Sprint")).toBeLessThan(oxygenByWorkload.get("Walk")!);
    expect(oxygenByWorkload.get("Incapacitated")).toBe(10_000);
    expect(oxygenByWorkload.get("Rest")).toBe(10_000);
  });

  it("9 enforces exact CAS and increments revision once for mode commands", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition);
    const accepted = applySuitCommand(start, suitDefinition, command(start, "SetLifeSupportMode", { mode: "Conserve" }));
    expect(accepted.status).toBe("Accepted");
    expect(accepted.state.revision).toBe(1);
    expect(accepted.state.mode).toBe("Conserve");
    const bad = command(start, "SetLifeSupportMode", { mode: "Emergency" }, { expectedRevision: 2, resultingRevision: 3 });
    const rejected = applySuitCommand(start, suitDefinition, bad);
    expect(rejected.status).toBe("Rejected");
    expect(rejected.state).toEqual(start);
    expect(rejected.state).not.toBe(start);
  });

  it("10 rejects duplicate accepted command IDs without mutating state", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition);
    const firstCommand = command(start, "SetWorkload", { workload: "Walk" });
    const first = applySuitCommand(start, suitDefinition, firstCommand);
    const duplicate = createSuitCommand({ ...firstCommand, expectedRevision: first.state.revision, resultingRevision: first.state.revision + 1 });
    const second = applySuitCommand(first.state, suitDefinition, duplicate);
    expect(second.status).toBe("Rejected");
    expect(second.state).toEqual(first.state);
    expect(second.state).not.toBe(first.state);
    if (second.status === "Rejected") expect(second.error.code).toBe("DuplicateCommand");
  });

  it("rejects every same-batch duplicate command ID before mutation independent of caller order", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition);
    const duplicateId = "command:batch-duplicate";
    const walk = command(start, "SetWorkload", { workload: "Walk" }, { commandId: duplicateId });
    const sprint = command(start, "SetWorkload", { workload: "Sprint" }, { commandId: duplicateId });
    const forward = advanceSuitState(start, { definition: suitDefinition, commands: [walk, sprint] });
    const reverse = advanceSuitState(start, { definition: suitDefinition, commands: [sprint, walk] });
    expect(forward.commandResults).toHaveLength(2);
    expect(forward.commandResults.every((entry) => entry.status === "Rejected" && entry.error.code === "DuplicateCommand")).toBe(true);
    expect(forward.state.revision).toBe(0);
    expect(forward.state.workload).toBe("Rest");
    expect(forward.state.contentSignature).toBe(reverse.state.contentSignature);
    expect(forward.eventSignature).toBe(reverse.eventSignature);
    expect(forward.commandResults).toEqual(reverse.commandResults);
  });

  it("11 rejects backward command ticks immutably", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition, { tick: 5 });
    const result = applySuitCommand(start, suitDefinition, command(start, "SetWorkload", { workload: "Walk" }, { tick: 4 }));
    expect(result.status).toBe("Rejected");
    if (result.status === "Rejected") expect(result.error.code).toBe("BackwardTick");
    expect(result.state).toEqual(start);
    expect(result.state).not.toBe(start);
  });

  it("12 clamps oxygen and energy at zero under overdraw", () => {
    const suitDefinition = definition();
    const result = advanceSuitState(state(suitDefinition, { oxygen: 5, energy: 5 }), {
      definition: suitDefinition,
      exposure: exposure({ oxygenLossMilligramsPerTick: 50, energyDrawMillijoulesPerTick: 50 })
    });
    expect(result.state.oxygenMilligrams).toBe(0);
    expect(result.state.energyMillijoules).toBe(0);
  });

  it("13 rejects capacity excess and reports actual accepted resupply/recharge", () => {
    const suitDefinition = definition();
    expect(() => state(suitDefinition, { oxygen: 10_001 })).toThrow(SuitValidationError);
    const start = state(suitDefinition, { oxygen: 9_990, energy: 9_980 });
    const oxygenResult = applySuitCommand(start, suitDefinition, command(start, "ResupplyOxygen", { requestedMilligrams: 100 }));
    expect(oxygenResult.status).toBe("Accepted");
    if (oxygenResult.status === "Accepted") expect(oxygenResult.detail.actualAcceptedMilligrams).toBe(10);
    const energyCommand = command(oxygenResult.state, "RechargeEnergy", { requestedMillijoules: 100 });
    const energyResult = applySuitCommand(oxygenResult.state, suitDefinition, energyCommand);
    if (energyResult.status === "Accepted") expect(energyResult.detail.actualAcceptedMillijoules).toBe(20);
    expect(energyResult.state.energyMillijoules).toBe(10_000);
  });

  it("14 starves by priority then stable subsystem ID without proportional draw", () => {
    const suitDefinition = definition((input) => {
      input.subsystemDefinitions = [
        { ...input.subsystemDefinitions[0]!, subsystemId: "subsystem:zeta", role: "equipment-bus", continuousPowerDrawMilliwatts: 1_000, priority: 50 },
        { ...input.subsystemDefinitions[1]!, subsystemId: "subsystem:alpha", role: "oxygen-regulator", continuousPowerDrawMilliwatts: 1_000, priority: 50 }
      ];
    });
    const result = advanceSuitState(state(suitDefinition, { energy: 100 }), { definition: suitDefinition });
    const alpha = result.state.subsystemStates.find((entry) => entry.subsystemId === "subsystem:alpha")!;
    const zeta = result.state.subsystemStates.find((entry) => entry.subsystemId === "subsystem:zeta")!;
    expect(alpha.powerState).toBe("Powered");
    expect(zeta.powerState).toBe("PowerStarved");
    expect(result.state.energyMillijoules).toBe(0);
    expect(result.events.some((entry) => entry.kind === "SuitPowerStarved" && entry.sourceId === "subsystem:zeta")).toBe(true);
  });

  it("15 publishes a read-only bus-offline equipment snapshot without energy authority", () => {
    const suitDefinition = definition();
    const offState = state(suitDefinition, { statusById: { "subsystem:equipment-bus": "Disabled" } });
    const projected = createSuitEquipmentInterfaceSnapshot(offState, suitDefinition);
    expect(projected.equipmentBusOnline).toBe(false);
    expect(projected.continuousPowerBudgetMilliwatts).toBe(0);
    expect(projected.pulseEnergyAvailableMillijoules).toBe(0);
    expect(Object.isFrozen(projected.interfaceIds)).toBe(true);
    expect(offState.energyMillijoules).toBe(10_000);
  });

  it("16 combines explicit oxygen loss with deterministic damaged-seal leak", () => {
    const suitDefinition = definition();
    const sealed = advanceSuitState(state(suitDefinition, { workload: "Incapacitated", seal: 10_000 }), { definition: suitDefinition, exposure: exposure({ oxygenLossMilligramsPerTick: 5 }) }, 10);
    const damaged = advanceSuitState(state(suitDefinition, { workload: "Incapacitated", seal: 5_000 }), { definition: suitDefinition, exposure: exposure({ oxygenLossMilligramsPerTick: 5 }) }, 10);
    expect(sealed.state.oxygenMilligrams).toBe(9_950);
    expect(damaged.state.oxygenMilligrams).toBe(9_450);
  });

  it("17 oxygen depletion raises the canonical alert and applies configured health damage", () => {
    const suitDefinition = definition();
    const depleted = advanceSuitState(state(suitDefinition, { oxygen: 1 }), { definition: suitDefinition, exposure: exposure({ oxygenLossMilligramsPerTick: 10 }) }, 10);
    expect(depleted.state.oxygenMilligrams).toBe(0);
    expect(depleted.state.healthMilliPoints).toBe(9_900);
    expect(depleted.state.activeAlerts.some((entry) => entry.code === "OxygenDepleted")).toBe(true);
  });

  it("18 derives temperature warning/critical from definition and clears after explicit thermal recovery", () => {
    const suitDefinition = definition();
    const warning = advanceSuitState(state(suitDefinition, { temperature: 324_999 }), { definition: suitDefinition, exposure: exposure({ temperatureDeltaMilliKelvinPerTick: 10 }) });
    expect(warning.state.activeAlerts.some((entry) => entry.code === "TemperatureHigh")).toBe(true);
    const critical = advanceSuitState(warning.state, { definition: suitDefinition, exposure: exposure({ temperatureDeltaMilliKelvinPerTick: 10_000 }) });
    expect(critical.state.activeAlerts.some((entry) => entry.code === "TemperatureCritical")).toBe(true);
    expect(critical.state.healthMilliPoints).toBeLessThan(10_000);
    const recovered = advanceSuitState(critical.state, { definition: suitDefinition, exposure: exposure({ temperatureDeltaMilliKelvinPerTick: -40_000 }) });
    expect(recovered.state.activeAlerts.some((entry) => entry.code.startsWith("Temperature"))).toBe(false);
  });

  it("19 keeps radiation cumulative and monotonic", () => {
    const suitDefinition = definition();
    const irradiated = advanceSuitState(state(suitDefinition), { definition: suitDefinition, exposure: exposure({ radiationMicrosievertsPerTick: 250 }) });
    const later = advanceSuitState(irradiated.state, { definition: suitDefinition });
    expect(irradiated.state.radiationMicrosieverts).toBe(250);
    expect(later.state.radiationMicrosieverts).toBe(250);
    expect(later.state.activeAlerts.some((entry) => entry.code === "RadiationCritical")).toBe(true);
  });

  it("20 contamination filtering affects incoming contamination only", () => {
    const suitDefinition = definition();
    const withFilter = advanceSuitState(state(suitDefinition, { contamination: 40 }), { definition: suitDefinition, exposure: exposure({ contaminationMicroUnitsPerTick: 100 }) });
    const withoutFilter = advanceSuitState(state(suitDefinition, { contamination: 40, statusById: { "subsystem:contamination-filter": "Disabled" } }), { definition: suitDefinition, exposure: exposure({ contaminationMicroUnitsPerTick: 100 }) });
    expect(withFilter.state.contaminationMicroUnits).toBe(90);
    expect(withoutFilter.state.contaminationMicroUnits).toBe(140);
    expect(withFilter.state.contaminationMicroUnits).toBeGreaterThanOrEqual(40);
  });

  it("21 decontaminates explicitly, clamps at zero, and reports actual removal", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition, { contamination: 75 });
    const result = applySuitCommand(start, suitDefinition, command(start, "Decontaminate", { requestedMicroUnits: 100 }));
    expect(result.state.contaminationMicroUnits).toBe(0);
    if (result.status === "Accepted") expect(result.detail.actualRemovedMicroUnits).toBe(75);
  });

  it("22 bounds seal repair by immutable initial ceiling and definition maximum", () => {
    const suitDefinition = definition();
    const damaged = state(suitDefinition, { seal: 5_000, sealCeiling: 8_000 });
    const result = applySuitCommand(damaged, suitDefinition, command(damaged, "ApplyRepair", { healthRepairMilliPoints: 0, sealRepairBasisPoints: 9_000, repairSubsystemIds: [] }));
    expect(result.state.sealIntegrityBasisPoints).toBe(8_000);
  });

  it("23 enabling a Faulted subsystem is NoChange and never repairs it", () => {
    const suitDefinition = definition();
    const faulted = state(suitDefinition, { statusById: { "subsystem:thermal-control": "Faulted" } });
    const result = applySuitCommand(faulted, suitDefinition, command(faulted, "SetSubsystemEnabled", { subsystemId: "subsystem:thermal-control", enabled: true }));
    expect(result.status).toBe("Accepted");
    if (result.status === "Accepted") expect(result.outcome).toBe("NoChange");
    expect(result.state.subsystemStates.find((entry) => entry.subsystemId === "subsystem:thermal-control")!.status).toBe("Faulted");
  });

  it("keeps a Faulted subsystem Faulted for both enable and disable attempts and retains its alert", () => {
    const suitDefinition = definition();
    const faulted = state(suitDefinition, { statusById: { "subsystem:thermal-control": "Faulted" } });
    for (const enabled of [true, false]) {
      const result = applySuitCommand(faulted, suitDefinition, command(faulted, "SetSubsystemEnabled", {
        subsystemId: "subsystem:thermal-control", enabled
      }));
      expect(result.status).toBe("Accepted");
      if (result.status === "Accepted") expect(result.outcome).toBe("NoChange");
      expect(result.state.subsystemStates.find((entry) => entry.subsystemId === "subsystem:thermal-control")!.status).toBe("Faulted");
      expect(result.state.activeAlerts.some((entry) => entry.code === "SubsystemFault" && entry.sourceId === "subsystem:thermal-control")).toBe(true);
    }
  });

  it("24 sorts alerts by severity, fixed code priority, source, then ID", () => {
    const alerts = sortSuitAlerts([
      { alertId: createSuitAlertId("alert:z"), code: "EnergyLow", severity: "Warning", measurement: 1, threshold: 2, sourceId: createSuitSourceId("source:z"), suggestedAction: "recharge-energy" },
      { alertId: createSuitAlertId("alert:a"), code: "OxygenDepleted", severity: "Critical", measurement: 0, threshold: 0, sourceId: createSuitSourceId("source:a"), suggestedAction: "resupply-oxygen" },
      { alertId: createSuitAlertId("alert:b"), code: "OxygenLow", severity: "Warning", measurement: 1, threshold: 2, sourceId: createSuitSourceId("source:b"), suggestedAction: "resupply-oxygen" }
    ]);
    expect(alerts.map((entry) => entry.code)).toEqual(["OxygenDepleted", "OxygenLow", "EnergyLow"]);
  });

  it("25 emits deterministic alert raise and clear events", () => {
    const suitDefinition = definition();
    const low = advanceSuitState(state(suitDefinition, { oxygen: 3_001 }), { definition: suitDefinition, exposure: exposure({ oxygenLossMilligramsPerTick: 10 }) });
    expect(low.events.some((entry) => entry.kind === "SuitAlertRaised" && entry.data.code === "OxygenLow")).toBe(true);
    const refill = command(low.state, "ResupplyOxygen", { requestedMilligrams: 10_000 });
    const cleared = advanceSuitState(low.state, { definition: suitDefinition, commands: [refill] });
    expect(cleared.events.some((entry) => entry.kind === "SuitAlertCleared" && entry.data.code === "OxygenLow")).toBe(true);
  });

  it("26 health zero forces incapacitation, workload, alert, and event", () => {
    const suitDefinition = definition();
    const result = advanceSuitState(state(suitDefinition, { health: 5 }), { definition: suitDefinition, exposure: exposure({ healthDamageMilliPointsPerTick: 10 }) });
    expect(result.state.actorIncapacitated).toBe(true);
    expect(result.state.workload).toBe("Incapacitated");
    expect(result.state.activeAlerts.some((entry) => entry.code === "ActorIncapacitated")).toBe(true);
    expect(result.events.some((entry) => entry.kind === "SuitActorIncapacitated")).toBe(true);
  });

  it("27 accepts valid no-effect commands as explicit NoChange with one revision", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition);
    const result = applySuitCommand(start, suitDefinition, command(start, "SetLifeSupportMode", { mode: "Nominal" }));
    expect(result.status).toBe("Accepted");
    if (result.status === "Accepted") expect(result.outcome).toBe("NoChange");
    expect(result.state.revision).toBe(1);
  });

  it("28 fails closed for unknown modes, workloads, subsystem roles, and command kinds", () => {
    expect(() => createSuitCommand({ kind: "Unknown", payload: {} })).toThrow(SuitValidationError);
    expect(() => definition((input) => { input.allowedModes = ["Unknown" as never]; })).toThrow(SuitValidationError);
    expect(() => definition((input) => { input.subsystemDefinitions[0]!.role = "unknown-role" as never; })).toThrow(SuitValidationError);
    expect(() => definition((input) => { input.workloadProfiles[0]!.workload = "Unknown"; })).toThrow(SuitValidationError);
  });

  it("29 keeps suit source free of browser/render/clock/random/TestBridge APIs", () => {
    const sourceRoot = join(process.cwd(), "src", "suit");
    const source = readdirSync(sourceRoot).filter((name) => name.endsWith(".ts")).map((name) => readFileSync(join(sourceRoot, name), "utf8")).join("\n");
    const forbidden = ["doc" + "ument", "win" + "dow", "three", "Date" + ".now", "performance" + ".now", "Math" + ".random", "Test" + "Bridge"];
    for (const token of forbidden) expect(source).not.toContain(token);
  });

  it("preserves slow positive rates in named quotient/remainder accumulators", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition, { workload: "Rest", statusById: { "subsystem:oxygen-regulator": "Disabled" } });
    const afterNine = advanceSuitState(start, { definition: suitDefinition }, 9);
    expect(afterNine.state.oxygenMilligrams).toBe(10_000);
    const afterTen = advanceSuitState(afterNine.state, { definition: suitDefinition });
    expect(afterTen.state.oxygenMilligrams).toBe(9_999);
    expect(afterTen.state.rateRemainders.some((entry) => entry.key === "net:oxygen")).toBe(true);
  });

  it("normalizes signed quotient zero and accumulates slow negative thermal rates", () => {
    const suitDefinition = definition((input) => {
      input.modeProfiles.find((entry) => entry.mode === "Nominal")!.temperatureDeltaAdjustmentMilliKelvinPerSecond = -1;
    });
    const start = state(suitDefinition, { workload: "Rest", statusById: { "subsystem:thermal-control": "Disabled" } });
    const first = advanceSuitState(start, { definition: suitDefinition });
    const remainder = first.state.rateRemainders.find((entry) => entry.key === "net:thermal")!;
    expect(first.state.internalTemperatureMilliKelvin).toBe(300_000);
    expect(remainder.numeratorRemainder).toBe(-1);
    expect(Object.is(remainder.numeratorRemainder, -0)).toBe(false);
    const tenth = advanceSuitState(first.state, { definition: suitDefinition }, 9);
    expect(tenth.state.internalTemperatureMilliKelvin).toBe(299_999);
  });

  it("composes oxygen and thermal rates before rounding so slow net effects remain exact", () => {
    const suitDefinition = definition((input) => {
      const rest = input.workloadProfiles.find((entry) => entry.workload === "Rest")!;
      rest.oxygenConsumptionMilligramsPerSecond = 5;
      rest.temperatureDeltaMilliKelvinPerSecond = 5;
      const oxygenRegulator = input.subsystemDefinitions.find((entry) => entry.role === "oxygen-regulator")!;
      oxygenRegulator.oxygenConsumptionReductionMilligramsPerSecond = 3;
      const thermalControl = input.subsystemDefinitions.find((entry) => entry.role === "thermal-control")!;
      thermalControl.thermalDeltaMilliKelvinPerSecond = -3;
    });
    const result = advanceSuitState(state(suitDefinition, { workload: "Rest" }), { definition: suitDefinition }, 10);
    expect(result.state.oxygenMilligrams).toBe(9_998);
    expect(result.state.internalTemperatureMilliKelvin).toBe(300_002);
  });

  it("decides phase-4 subsystem power before phase-5 exposure energy gain", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition, { energy: 0, workload: "Incapacitated" });
    const gained = advanceSuitState(start, {
      definition: suitDefinition,
      exposure: exposure({ energyGainMillijoulesPerTick: 100 })
    });
    const busAfterGain = gained.state.subsystemStates.find((entry) => entry.subsystemId === "subsystem:equipment-bus")!;
    expect(busAfterGain.powerState).toBe("PowerStarved");
    expect(gained.state.energyMillijoules).toBe(100);
    const followingTick = advanceSuitState(gained.state, { definition: suitDefinition });
    expect(followingTick.state.subsystemStates.find((entry) => entry.subsystemId === "subsystem:equipment-bus")!.powerState).toBe("Powered");
  });

  it("saturates every bounded canonical channel without unsafe intermediate arithmetic", () => {
    const maximum = Number.MAX_SAFE_INTEGER;
    const suitDefinition = definition((input) => {
      input.healthMaximumMilliPoints = maximum;
      input.oxygenCapacityMilligrams = maximum;
      input.energyCapacityMillijoules = maximum;
      input.recoveryRules.healthRepairLimitMilliPointsPerCommand = maximum;
      input.recoveryRules.sealRepairLimitBasisPointsPerCommand = maximum;
      Object.assign(input.interfaceDefinitions[0]!, {
        continuousPowerBudgetMilliwatts: maximum,
        pulseEnergyReserveMillijoules: maximum,
        thermalDissipationBudgetMilliwatts: maximum
      });
      input.interfaceDefinitions.push({
        ...input.interfaceDefinitions[0]!,
        interfaceId: "interface:secondary"
      });
    });
    const start = state(suitDefinition, {
      health: maximum, healthCeiling: maximum, oxygen: maximum, energy: maximum,
      seal: 10_000, sealCeiling: 10_000, temperature: maximum - 1,
      radiation: maximum - 1, contamination: maximum - 1,
      statusById: { "subsystem:contamination-filter": "Disabled" }
    });
    const saturated = advanceSuitState(start, {
      definition: suitDefinition,
      exposure: exposure({
        oxygenLossMilligramsPerTick: maximum,
        energyDrawMillijoulesPerTick: maximum,
        energyGainMillijoulesPerTick: maximum,
        temperatureDeltaMilliKelvinPerTick: maximum,
        sealDamageBasisPointsPerTick: maximum,
        radiationMicrosievertsPerTick: maximum,
        contaminationMicroUnitsPerTick: maximum,
        healthDamageMilliPointsPerTick: maximum
      })
    });
    expect(saturated.state.healthMilliPoints).toBe(0);
    expect(saturated.state.oxygenMilligrams).toBe(0);
    expect(saturated.state.energyMillijoules).toBe(maximum);
    expect(saturated.state.sealIntegrityBasisPoints).toBe(0);
    expect(saturated.state.internalTemperatureMilliKelvin).toBe(maximum);
    expect(saturated.state.radiationMicrosieverts).toBe(maximum);
    expect(saturated.state.contaminationMicroUnits).toBe(maximum);
    const equipment = createSuitEquipmentInterfaceSnapshot(saturated.state, suitDefinition);
    expect(equipment.continuousPowerBudgetMilliwatts).toBe(maximum);
    expect(equipment.pulseEnergyAvailableMillijoules).toBe(maximum);
    expect(equipment.thermalDissipationBudgetMilliwatts).toBe(maximum);

    const minimumTemperature = advanceSuitState(state(suitDefinition, { temperature: 1 }), {
      definition: suitDefinition,
      exposure: exposure({ temperatureDeltaMilliKelvinPerTick: Number.MIN_SAFE_INTEGER })
    });
    expect(minimumTemperature.state.internalTemperatureMilliKelvin).toBe(1);

    const repairable = state(suitDefinition, {
      health: maximum - 1, healthCeiling: maximum, seal: 9_999, sealCeiling: 10_000
    });
    const repaired = applySuitCommand(repairable, suitDefinition, command(repairable, "ApplyRepair", {
      healthRepairMilliPoints: maximum, sealRepairBasisPoints: maximum, repairSubsystemIds: []
    }));
    expect(repaired.state.healthMilliPoints).toBe(maximum);
    expect(repaired.state.sealIntegrityBasisPoints).toBe(10_000);
    const damaged = applySuitCommand(repaired.state, suitDefinition, command(repaired.state, "ApplyExternalDamage", {
      healthDamageMilliPoints: maximum, sealDamageBasisPoints: maximum, faultSubsystemIds: []
    }));
    expect(damaged.state.healthMilliPoints).toBe(0);
    expect(damaged.state.sealIntegrityBasisPoints).toBe(0);
  });

  it("uses immutable definition recovery rules and initial ceilings for explicit repair limits", () => {
    const suitDefinition = definition((input) => {
      input.recoveryRules.healthRepairLimitMilliPointsPerCommand = 100;
      input.recoveryRules.sealRepairLimitBasisPointsPerCommand = 50;
    });
    const damaged = state(suitDefinition, { health: 1_000, healthCeiling: 2_000, seal: 5_000, sealCeiling: 6_000 });
    const repaired = applySuitCommand(damaged, suitDefinition, command(damaged, "ApplyRepair", {
      healthRepairMilliPoints: 9_000, sealRepairBasisPoints: 9_000, repairSubsystemIds: []
    }));
    expect(repaired.state.healthMilliPoints).toBe(1_100);
    expect(repaired.state.sealIntegrityBasisPoints).toBe(5_050);
    expect(Object.isFrozen(suitDefinition.recoveryRules)).toBe(true);
    expect(() => state(suitDefinition, { health: 1_000, healthCeiling: 10_001 })).toThrow(SuitValidationError);

    const highLimitDefinition = definition();
    const initialCap = state(highLimitDefinition, { health: 1_000, healthCeiling: 2_000 });
    const capped = applySuitCommand(initialCap, highLimitDefinition, command(initialCap, "ApplyRepair", {
      healthRepairMilliPoints: 9_000, sealRepairBasisPoints: 0, repairSubsystemIds: []
    }));
    expect(capped.state.healthMilliPoints).toBe(2_000);
    expect(capped.state.healthRepairCeilingMilliPoints).toBe(2_000);
  });

  it("derives canonical alerts for public snapshots and direct changed command results", () => {
    const suitDefinition = definition();
    const low = state(suitDefinition, { oxygen: 2_000 });
    expect(low.activeAlerts.some((entry) => entry.code === "OxygenLow")).toBe(true);
    const forged = { ...low, activeAlerts: [] };
    expect(() => createSuitStateSnapshot(forged, suitDefinition)).toThrow(SuitValidationError);
    const resupplied = applySuitCommand(low, suitDefinition, command(low, "ResupplyOxygen", { requestedMilligrams: 8_000 }));
    expect(resupplied.state.activeAlerts.some((entry) => entry.code.startsWith("Oxygen"))).toBe(false);
    const damaged = applySuitCommand(resupplied.state, suitDefinition, command(resupplied.state, "ApplyExternalDamage", {
      healthDamageMilliPoints: 0, sealDamageBasisPoints: 0, faultSubsystemIds: ["subsystem:thermal-control"]
    }));
    expect(damaged.state.activeAlerts.some((entry) => entry.code === "SubsystemFault")).toBe(true);
  });

  it("emits canonical ordered subsystem state changes for external damage and explicit repair", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition);
    const faultIds = ["subsystem:thermal-control", "subsystem:oxygen-regulator"];
    const damaged = applySuitCommand(start, suitDefinition, command(start, "ApplyExternalDamage", {
      healthDamageMilliPoints: 0, sealDamageBasisPoints: 0, faultSubsystemIds: [...faultIds].reverse()
    }));
    const damageEvents = damaged.events.filter((entry) => entry.kind === "SuitSubsystemStateChanged");
    expect(damageEvents.map((entry) => entry.sourceId)).toEqual([...faultIds].sort());
    expect(damageEvents.every((entry) => entry.data.currentStatus === "Faulted")).toBe(true);
    const repaired = applySuitCommand(damaged.state, suitDefinition, command(damaged.state, "ApplyRepair", {
      healthRepairMilliPoints: 0, sealRepairBasisPoints: 0, repairSubsystemIds: [...faultIds].reverse()
    }));
    const repairEvents = repaired.events.filter((entry) => entry.kind === "SuitSubsystemStateChanged");
    expect(repairEvents.map((entry) => entry.sourceId)).toEqual([...faultIds].sort());
    expect(repairEvents.every((entry) => entry.data.currentStatus === "Disabled")).toBe(true);
  });

  it("rejects equipment projections whose state and definition IDs do not match", () => {
    const leftDefinition = definition();
    const rightDefinition = definition((input) => { input.definitionId = "suit-definition:other-v1"; });
    expect(() => createSuitEquipmentInterfaceSnapshot(state(leftDefinition), rightDefinition)).toThrow(SuitValidationError);
  });

  it("never freezes or mutates caller-owned raw state while rejecting a command", () => {
    const suitDefinition = definition();
    const raw = JSON.parse(JSON.stringify(state(suitDefinition, { tick: 5 }))) as SuitStateSnapshot;
    const before = JSON.stringify(raw);
    const result = applySuitCommand(raw, suitDefinition, command(raw, "SetWorkload", { workload: "Walk" }, { tick: 4 }));
    expect(result.status).toBe("Rejected");
    expect(JSON.stringify(raw)).toBe(before);
    expect(Object.isFrozen(raw)).toBe(false);
    expect(Object.isFrozen(raw.subsystemStates)).toBe(false);
    expect(result.state).not.toBe(raw);
    expect(Object.isFrozen(result.state)).toBe(true);
  });

  it("executes aggregate-call commands once on their designated tick and preserves single-step signatures", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition);
    const setWalk = command(start, "SetWorkload", { workload: "Walk" });
    const aggregate = advanceSuitState(start, { definition: suitDefinition, commands: [setWalk] }, 3);
    const first = advanceSuitState(start, { definition: suitDefinition, commands: [setWalk] });
    const second = advanceSuitState(first.state, { definition: suitDefinition });
    const third = advanceSuitState(second.state, { definition: suitDefinition });
    const singles = createCanonicalSuitEventSequence([...first.events, ...second.events, ...third.events]);
    expect(aggregate.state.revision).toBe(1);
    expect(aggregate.state.contentSignature).toBe(third.state.contentSignature);
    expect(aggregate.eventSignature).toBe(singles.signature);
    expect(aggregate.events).toEqual(singles.events);
  });

  it("applies exposure commands in the exposure phase with immutable accepted results", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition);
    const apply = command(start, "ApplyExposure", { exposure: exposure({ sealDamageBasisPointsPerTick: 500 }) });
    const result = advanceSuitState(start, { definition: suitDefinition, commands: [apply] });
    expect(result.commandResults[0]!.status).toBe("Accepted");
    expect(result.state.revision).toBe(1);
    expect(result.state.sealIntegrityBasisPoints).toBe(9_500);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("repairs Faulted subsystems only through explicit repair and leaves them disabled", () => {
    const suitDefinition = definition();
    const faulted = state(suitDefinition, { statusById: { "subsystem:thermal-control": "Faulted" } });
    const result = applySuitCommand(faulted, suitDefinition, command(faulted, "ApplyRepair", { healthRepairMilliPoints: 0, sealRepairBasisPoints: 0, repairSubsystemIds: ["subsystem:thermal-control"] }));
    expect(result.state.subsystemStates.find((entry) => entry.subsystemId === "subsystem:thermal-control")!.status).toBe("Disabled");
  });

  it("applies external damage deterministically and publishes canonical command channel events", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition);
    const damage = command(start, "ApplyExternalDamage", {
      healthDamageMilliPoints: 125,
      sealDamageBasisPoints: 250,
      faultSubsystemIds: ["subsystem:thermal-control"]
    });
    const result = applySuitCommand(start, suitDefinition, damage);
    expect(result.state.healthMilliPoints).toBe(9_875);
    expect(result.state.sealIntegrityBasisPoints).toBe(9_750);
    expect(result.state.subsystemStates.find((entry) => entry.subsystemId === "subsystem:thermal-control")!.status).toBe("Faulted");
    expect(result.events.filter((entry) => entry.kind === "SuitChannelChanged").map((entry) => entry.data.channel)).toEqual([
      "healthMilliPoints", "sealIntegrityBasisPoints"
    ]);
  });

  it("explicit health repair can recover incapacitation without creating capacity", () => {
    const suitDefinition = definition();
    const incapacitated = state(suitDefinition, { health: 0, healthCeiling: 10_000 });
    const repaired = applySuitCommand(incapacitated, suitDefinition, command(incapacitated, "ApplyRepair", {
      healthRepairMilliPoints: 20_000,
      sealRepairBasisPoints: 0,
      repairSubsystemIds: []
    }));
    expect(repaired.state.healthMilliPoints).toBe(10_000);
    expect(repaired.state.actorIncapacitated).toBe(false);
    expect(repaired.state.workload).toBe("Rest");
  });

  it("exports a critical-state flag derived only from canonical Critical alerts", () => {
    const suitDefinition = definition();
    const critical = advanceSuitState(state(suitDefinition, { oxygen: 1 }), {
      definition: suitDefinition,
      exposure: exposure({ oxygenLossMilligramsPerTick: 1 })
    });
    expect(critical.state.criticalState).toBe(true);
    expect(critical.state.activeAlerts.some((entry) => entry.severity === "Critical")).toBe(true);
    expect(() => createSuitStateSnapshot({ ...critical.state, criticalState: false }, suitDefinition)).toThrow(SuitValidationError);
  });

  it("sorts semantic events strictly by tick, phase, actor, source, and event ID", () => {
    const suitDefinition = definition();
    const result = advanceSuitState(state(suitDefinition, { oxygen: 1, energy: 1 }), {
      definition: suitDefinition,
      exposure: exposure({ oxygenLossMilligramsPerTick: 1, energyDrawMillijoulesPerTick: 1 })
    });
    const resorted = createCanonicalSuitEventSequence([...result.events].reverse());
    expect(resorted.events).toEqual(result.events);
    expect(resorted.signature).toBe(result.eventSignature);
  });

  it("executes a future in-range command immediately before its designated aggregate tick", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition);
    const setWalk = command(start, "SetWorkload", { workload: "Walk" }, { tick: 1 });
    const aggregate = advanceSuitState(start, { definition: suitDefinition, commands: [setWalk] }, 3);
    const first = advanceSuitState(start, { definition: suitDefinition });
    const second = advanceSuitState(first.state, { definition: suitDefinition, commands: [setWalk] });
    const third = advanceSuitState(second.state, { definition: suitDefinition });
    const singles = createCanonicalSuitEventSequence([...first.events, ...second.events, ...third.events]);

    expect(aggregate.state.revision).toBe(1);
    expect(aggregate.state.workload).toBe("Walk");
    expect(canonicalSuitJson(aggregate.state)).toBe(canonicalSuitJson(third.state));
    expect(aggregate.state.contentSignature).toBe(third.state.contentSignature);
    expect(canonicalSuitJson(aggregate.events)).toBe(canonicalSuitJson(singles.events));
    expect(aggregate.eventSignature).toBe(singles.signature);
    expect(aggregate.commandResults).toEqual(second.commandResults);
  });

  it("serializes Changed and NoChange aggregate command results byte-identically to repeated schedules", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition);
    const changed = command(start, "SetWorkload", { workload: "Walk" }, {
      tick: 1, expectedRevision: 0, resultingRevision: 1
    });
    const noChange = command(start, "SetLifeSupportMode", { mode: "Nominal" }, {
      tick: 2, expectedRevision: 1, resultingRevision: 2
    });
    const aggregate = advanceSuitState(start, { definition: suitDefinition, commands: [changed, noChange] }, 3);
    const first = advanceSuitState(start, { definition: suitDefinition });
    const second = advanceSuitState(first.state, { definition: suitDefinition, commands: [changed] });
    const third = advanceSuitState(second.state, { definition: suitDefinition, commands: [noChange] });
    const repeatedResults = [...second.commandResults, ...third.commandResults];
    const canonicalJson = canonicalSuitCommandResultsJson(aggregate.commandResults);
    const parsed = JSON.parse(canonicalJson) as unknown;

    expect(aggregate.commandResults.map((entry) => entry.status === "Accepted" ? entry.outcome : entry.status))
      .toEqual(["Changed", "NoChange"]);
    expect(canonicalJson).toBe(canonicalSuitCommandResultsJson(repeatedResults));
    expect(parsed).toEqual(aggregate.commandResults.map((result) => {
      if (result.status !== "Accepted") throw new Error("Expected accepted command result.");
      return {
        status: "Accepted",
        outcome: result.outcome,
        state: result.state,
        detail: result.detail,
        events: result.events,
        appliedExposure: result.appliedExposure
      };
    }));
    expect((parsed as Array<{ state: { contentSignature: string } }>).map((result) => result.state.contentSignature))
      .toEqual(aggregate.commandResults.map((result) => result.state.contentSignature));
    expect((parsed as Array<{ events: unknown[] }>).map((result) => result.events))
      .toEqual(aggregate.commandResults.map((result) => result.events));
  });

  it("serializes rejected aggregate command results byte-identically and excludes diagnostic causes", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition);
    const invalidRevision = command(start, "SetWorkload", { workload: "Walk" }, {
      tick: 1, expectedRevision: 1, resultingRevision: 2
    });
    const aggregate = advanceSuitState(start, { definition: suitDefinition, commands: [invalidRevision] }, 2);
    const first = advanceSuitState(start, { definition: suitDefinition });
    const repeated = advanceSuitState(first.state, { definition: suitDefinition, commands: [invalidRevision] });
    const rejected = aggregate.commandResults[0]!;
    const canonicalJson = canonicalSuitCommandResultsJson(aggregate.commandResults);
    const parsed = JSON.parse(canonicalJson) as Array<{
      status: string;
      state: SuitStateSnapshot;
      error: Record<string, unknown>;
      events: Array<{ data: Record<string, unknown> }>;
      appliedExposure: null;
    }>;

    expect(rejected.status).toBe("Rejected");
    expect(canonicalJson).toBe(canonicalSuitCommandResultsJson(repeated.commandResults));
    if (rejected.status === "Rejected") {
      expect(parsed).toEqual([{
        status: "Rejected",
        state: rejected.state,
        error: {
          code: rejected.error.code,
          path: rejected.error.path,
          message: rejected.error.message
        },
        events: rejected.events,
        appliedExposure: null
      }]);
      expect(parsed[0]!.state.contentSignature).toBe(rejected.state.contentSignature);
      expect(parsed[0]!.events).toEqual(rejected.events);
      expect(parsed[0]!.events[0]!.data).toMatchObject({
        commandId: invalidRevision.commandId,
        commandKind: invalidRevision.kind
      });
      expect(parsed[0]!.error).toEqual({
        code: rejected.error.code,
        path: rejected.error.path,
        message: rejected.error.message
      });
      expect("cause" in parsed[0]!.error).toBe(false);
      const withFirstCause = {
        ...rejected,
        error: new SuitTransitionError(rejected.error.code, rejected.error.path, rejected.error.message, { diagnostic: "first" })
      };
      const withSecondCause = {
        ...rejected,
        error: new SuitTransitionError(rejected.error.code, rejected.error.path, rejected.error.message, { diagnostic: "second" })
      };
      expect(canonicalSuitCommandResultsJson([withFirstCause]))
        .toBe(canonicalSuitCommandResultsJson([withSecondCause]));
    }
  });

  it("canonicalizes a caller-order-invariant command schedule across multiple ticks", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition);
    const schedule = [
      command(start, "SetWorkload", { workload: "Walk" }, { tick: 0, expectedRevision: 0, resultingRevision: 1 }),
      command(start, "SetLifeSupportMode", { mode: "Conserve" }, { tick: 1, expectedRevision: 1, resultingRevision: 2 }),
      command(start, "SetWorkload", { workload: "Sprint" }, { tick: 2, expectedRevision: 2, resultingRevision: 3 })
    ];
    const callerSchedule = [...schedule].reverse();
    const callerScheduleJson = canonicalSuitJson(callerSchedule);
    const aggregate = advanceSuitState(start, { definition: suitDefinition, commands: callerSchedule }, 3);
    const canonicalOrder = advanceSuitState(start, { definition: suitDefinition, commands: schedule }, 3);
    let current = start;
    const events = [];
    const commandResults = [];
    for (const scheduled of schedule) {
      const next = advanceSuitState(current, { definition: suitDefinition, commands: [scheduled] });
      current = next.state;
      events.push(...next.events);
      commandResults.push(...next.commandResults);
    }
    const singles = createCanonicalSuitEventSequence(events);

    expect(aggregate.commandResults).toEqual(canonicalOrder.commandResults);
    expect(aggregate.commandResults).toEqual(commandResults);
    expect(canonicalSuitJson(aggregate.state)).toBe(canonicalSuitJson(current));
    expect(aggregate.state.contentSignature).toBe(current.contentSignature);
    expect(aggregate.events).toEqual(singles.events);
    expect(aggregate.eventSignature).toBe(singles.signature);
    expect(canonicalSuitJson(callerSchedule)).toBe(callerScheduleJson);
  });

  it("rejects commands outside the aggregate range deterministically without command mutation", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition, { tick: 5 });
    const backward = command(start, "SetWorkload", { workload: "Walk" }, { tick: 4 });
    const future = command(start, "SetWorkload", { workload: "Sprint" }, { tick: 7 });
    const forward = advanceSuitState(start, { definition: suitDefinition, commands: [backward, future] }, 2);
    const reverse = advanceSuitState(start, { definition: suitDefinition, commands: [future, backward] }, 2);

    expect(forward.commandResults.map((entry) => entry.status === "Rejected" ? entry.error.code : null))
      .toEqual(["BackwardTick", "FutureTick"]);
    expect(forward.state.tick).toBe(7);
    expect(forward.state.revision).toBe(start.revision);
    expect(forward.state.workload).toBe(start.workload);
    expect(forward.commandResults).toEqual(reverse.commandResults);
    expect(forward.eventSignature).toBe(reverse.eventSignature);
    expect(forward.state.contentSignature).toBe(reverse.state.contentSignature);
  });

  it("pre-rejects duplicate command IDs across designated ticks before any command executes", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition);
    const duplicateId = "command:duplicate-across-ticks";
    const tickZero = command(start, "SetWorkload", { workload: "Walk" }, { commandId: duplicateId, tick: 0 });
    const tickOne = command(start, "SetWorkload", { workload: "Sprint" }, { commandId: duplicateId, tick: 1 });
    const forward = advanceSuitState(start, { definition: suitDefinition, commands: [tickZero, tickOne] }, 2);
    const reverse = advanceSuitState(start, { definition: suitDefinition, commands: [tickOne, tickZero] }, 2);

    expect(forward.commandResults.every((entry) => entry.status === "Rejected" && entry.error.code === "DuplicateCommand")).toBe(true);
    expect(forward.state.revision).toBe(0);
    expect(forward.state.workload).toBe("Rest");
    expect(forward.commandResults).toEqual(reverse.commandResults);
    expect(forward.eventSignature).toBe(reverse.eventSignature);
  });

  it("applies command exposure once in phase 5 of its designated tick while normal exposure remains per-tick", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition);
    const scheduledExposure = command(start, "ApplyExposure", {
      exposure: exposure({ sourceId: "exposure:scheduled", sealDamageBasisPointsPerTick: 500 })
    }, { tick: 1 });
    const ambient = exposure({ sourceId: "exposure:ambient", sealDamageBasisPointsPerTick: 1 });
    const aggregate = advanceSuitState(start, { definition: suitDefinition, exposure: ambient, commands: [scheduledExposure] }, 3);
    const first = advanceSuitState(start, { definition: suitDefinition, exposure: ambient });
    const second = advanceSuitState(first.state, { definition: suitDefinition, exposure: ambient, commands: [scheduledExposure] });
    const third = advanceSuitState(second.state, { definition: suitDefinition, exposure: ambient });
    const singles = createCanonicalSuitEventSequence([...first.events, ...second.events, ...third.events]);

    expect(aggregate.state.sealIntegrityBasisPoints).toBe(9_497);
    expect(canonicalSuitJson(aggregate.state)).toBe(canonicalSuitJson(third.state));
    expect(aggregate.eventSignature).toBe(singles.signature);
    expect(aggregate.events).toEqual(singles.events);
  });

  it("publishes direct-command alert clears and raises but no alert deltas for NoChange", () => {
    const suitDefinition = definition();
    const low = state(suitDefinition, { oxygen: 2_000 });
    const resupplied = applySuitCommand(low, suitDefinition, command(low, "ResupplyOxygen", { requestedMilligrams: 8_000 }));
    expect(resupplied.events.filter((entry) => entry.kind === "SuitAlertCleared" && entry.data.code === "OxygenLow")).toHaveLength(1);

    const damaged = applySuitCommand(resupplied.state, suitDefinition, command(resupplied.state, "ApplyExternalDamage", {
      healthDamageMilliPoints: 0, sealDamageBasisPoints: 0, faultSubsystemIds: ["subsystem:thermal-control"]
    }));
    expect(damaged.events.filter((entry) => entry.kind === "SuitAlertRaised" && entry.data.code === "SubsystemFault")).toHaveLength(1);
    const faultAlert = damaged.state.activeAlerts.find((entry) => entry.code === "SubsystemFault")!;
    expect({ measurement: faultAlert.measurement, threshold: faultAlert.threshold }).toEqual({ measurement: 1, threshold: 1 });

    const noChange = applySuitCommand(damaged.state, suitDefinition, command(damaged.state, "SetLifeSupportMode", { mode: damaged.state.mode }));
    expect(noChange.status).toBe("Accepted");
    if (noChange.status === "Accepted") expect(noChange.outcome).toBe("NoChange");
    expect(noChange.events.filter((entry) => entry.kind === "SuitAlertRaised" || entry.kind === "SuitAlertCleared")).toHaveLength(0);
  });

  it("keeps phase-11 aggregate alert deltas consolidated without direct-command duplicates", () => {
    const suitDefinition = definition();
    const low = state(suitDefinition, { oxygen: 2_000 });
    const refill = command(low, "ResupplyOxygen", { requestedMilligrams: 8_000 });
    const cleared = advanceSuitState(low, { definition: suitDefinition, commands: [refill] });
    expect(cleared.events.filter((entry) => entry.kind === "SuitAlertCleared" && entry.data.code === "OxygenLow")).toHaveLength(1);
    expect(cleared.commandResults[0]!.events.filter((entry) => entry.kind === "SuitAlertCleared")).toHaveLength(0);

    const healthy = state(suitDefinition);
    const fault = command(healthy, "ApplyExternalDamage", {
      healthDamageMilliPoints: 0, sealDamageBasisPoints: 0, faultSubsystemIds: ["subsystem:thermal-control"]
    });
    const raised = advanceSuitState(healthy, { definition: suitDefinition, commands: [fault] });
    expect(raised.events.filter((entry) => entry.kind === "SuitAlertRaised" && entry.data.code === "SubsystemFault")).toHaveLength(1);
    expect(raised.commandResults[0]!.events.filter((entry) => entry.kind === "SuitAlertRaised")).toHaveLength(0);
  });

  it("bounds derived alert and remainder identities for 128-character public IDs", () => {
    const oxygenId = `o${"a".repeat(127)}`;
    const thermalId = `t${"b".repeat(127)}`;
    const filterId = `f${"c".repeat(127)}`;
    const exposureSourceId = `e${"d".repeat(127)}`;
    const stateId = `s${"e".repeat(127)}`;
    const commandSourceId = `c${"f".repeat(127)}`;
    const suitDefinition = definition((input) => {
      const rest = input.workloadProfiles.find((entry) => entry.workload === "Rest")!;
      rest.oxygenConsumptionMilligramsPerSecond = 9;
      rest.temperatureDeltaMilliKelvinPerSecond = 9;
      const oxygenRegulator = input.subsystemDefinitions.find((entry) => entry.role === "oxygen-regulator")!;
      oxygenRegulator.subsystemId = oxygenId;
      oxygenRegulator.oxygenConsumptionReductionMilligramsPerSecond = 8;
      const thermalControl = input.subsystemDefinitions.find((entry) => entry.role === "thermal-control")!;
      thermalControl.subsystemId = thermalId;
      thermalControl.thermalDeltaMilliKelvinPerSecond = -8;
      input.subsystemDefinitions.find((entry) => entry.role === "contamination-filter")!.subsystemId = filterId;
    });
    const start = state(suitDefinition, { stateId });
    const contaminated = advanceSuitState(start, {
      definition: suitDefinition,
      exposure: exposure({ sourceId: exposureSourceId, contaminationMicroUnitsPerTick: 1 })
    });
    expect(contaminated.state.rateRemainders.some((entry) => entry.key === "net:oxygen" && entry.numeratorRemainder === 1)).toBe(true);
    expect(contaminated.state.rateRemainders.some((entry) => entry.key === "net:thermal" && entry.numeratorRemainder === 1)).toBe(true);
    expect(contaminated.state.rateRemainders.some((entry) => entry.key.startsWith("contamination:") && entry.numeratorRemainder === 5_000)).toBe(true);
    expect(contaminated.state.rateRemainders.some((entry) => entry.key.startsWith("subsystem:o") && entry.key.endsWith(":energy"))).toBe(true);
    expect(contaminated.state.rateRemainders.some((entry) => entry.key.startsWith("subsystem:t") && entry.key.endsWith(":energy"))).toBe(true);
    expect(contaminated.state.rateRemainders.some((entry) => entry.key.startsWith("subsystem:f") && entry.key.endsWith(":energy"))).toBe(true);
    expect(contaminated.state.rateRemainders.every((entry) => entry.key.length <= 128 && /^[a-z0-9][a-z0-9._:-]{0,127}$/.test(entry.key))).toBe(true);

    const fault = command(contaminated.state, "ApplyExternalDamage", {
      healthDamageMilliPoints: 0, sealDamageBasisPoints: 0, faultSubsystemIds: [oxygenId]
    }, { sourceId: commandSourceId });
    const faulted = applySuitCommand(contaminated.state, suitDefinition, fault);
    const alert = faulted.state.activeAlerts.find((entry) => entry.code === "SubsystemFault" && entry.sourceId === oxygenId)!;
    expect(alert.alertId.length).toBeLessThanOrEqual(128);
    expect(alert.alertId).toMatch(/^[a-z0-9][a-z0-9._:-]{0,127}$/);
    expect(faulted.events.every((entry) => entry.stateId === stateId)).toBe(true);
    expect(faulted.events.some((entry) => entry.sourceId === commandSourceId)).toBe(true);
    expect(canonicalSuitJson(faulted.state)).toBe(canonicalSuitJson(applySuitCommand(contaminated.state, suitDefinition, fault).state));
  });

  it("alerts exactly at critical temperature bounds without damage and damages one unit outside", () => {
    const suitDefinition = definition();
    const withoutThermalControl = { "subsystem:thermal-control": "Disabled" as const };
    for (const temperature of [270_000, 330_000]) {
      const result = advanceSuitState(state(suitDefinition, { temperature, statusById: withoutThermalControl }), { definition: suitDefinition });
      expect(result.state.activeAlerts.some((entry) => entry.code === "TemperatureCritical")).toBe(true);
      expect(result.state.healthMilliPoints).toBe(10_000);
    }
    for (const temperature of [269_999, 330_001]) {
      const result = advanceSuitState(state(suitDefinition, { temperature, statusById: withoutThermalControl }), { definition: suitDefinition });
      expect(result.state.activeAlerts.some((entry) => entry.code === "TemperatureCritical")).toBe(true);
      expect(result.state.healthMilliPoints).toBe(9_990);
    }
  });

  it("composes sub-tick oxygen and thermal streams before early rounding", () => {
    const suitDefinition = definition((input) => {
      const rest = input.workloadProfiles.find((entry) => entry.workload === "Rest")!;
      rest.oxygenConsumptionMilligramsPerSecond = 9;
      rest.temperatureDeltaMilliKelvinPerSecond = 9;
      input.subsystemDefinitions.find((entry) => entry.role === "oxygen-regulator")!.oxygenConsumptionReductionMilligramsPerSecond = 8;
      input.subsystemDefinitions.find((entry) => entry.role === "thermal-control")!.thermalDeltaMilliKelvinPerSecond = -8;
    });
    const result = advanceSuitState(state(suitDefinition), { definition: suitDefinition }, 6);
    expect(result.state.oxygenMilligrams).toBe(10_000);
    expect(result.state.internalTemperatureMilliKelvin).toBe(300_000);
    expect(result.state.rateRemainders.find((entry) => entry.key === "net:oxygen")!.numeratorRemainder).toBe(6);
    expect(result.state.rateRemainders.find((entry) => entry.key === "net:thermal")!.numeratorRemainder).toBe(6);
  });

  it("saturates multiple MAX_SAFE_INTEGER exposure contributors without unsafe intermediates", () => {
    const maximum = Number.MAX_SAFE_INTEGER;
    const suitDefinition = definition((input) => {
      input.healthMaximumMilliPoints = maximum;
      input.oxygenCapacityMilligrams = maximum;
      input.energyCapacityMillijoules = maximum;
    });
    const disabled = Object.fromEntries(suitDefinition.subsystemDefinitions.map((entry) => [entry.subsystemId, "Disabled"])) as Record<string, SuitSubsystemStatus>;
    const start = state(suitDefinition, {
      health: maximum, healthCeiling: maximum, oxygen: maximum, energy: maximum,
      radiation: maximum - 1, contamination: maximum - 1, workload: "Incapacitated", statusById: disabled
    });
    const contributors = [0, 1, 2].map((index) => command(start, "ApplyExposure", {
      exposure: exposure({
        sourceId: `exposure:max-${index}`,
        oxygenLossMilligramsPerTick: maximum,
        energyDrawMillijoulesPerTick: maximum,
        energyGainMillijoulesPerTick: maximum,
        temperatureDeltaMilliKelvinPerTick: maximum,
        sealDamageBasisPointsPerTick: maximum,
        radiationMicrosievertsPerTick: maximum,
        contaminationMicroUnitsPerTick: maximum,
        healthDamageMilliPointsPerTick: maximum
      })
    }, { expectedRevision: index, resultingRevision: index + 1 }));
    const forward = advanceSuitState(start, { definition: suitDefinition, commands: contributors });
    const reverse = advanceSuitState(start, { definition: suitDefinition, commands: [...contributors].reverse() });

    expect(forward.state.healthMilliPoints).toBe(0);
    expect(forward.state.oxygenMilligrams).toBe(0);
    expect(forward.state.energyMillijoules).toBe(maximum);
    expect(forward.state.sealIntegrityBasisPoints).toBe(0);
    expect(forward.state.internalTemperatureMilliKelvin).toBe(maximum);
    expect(forward.state.radiationMicrosieverts).toBe(maximum);
    expect(forward.state.contaminationMicroUnits).toBe(maximum);
    expect(forward.state.contentSignature).toBe(reverse.state.contentSignature);
    expect(forward.eventSignature).toBe(reverse.eventSignature);
  });

  it("normalizes expected boundary failures while propagating programmer errors unchanged", () => {
    const suitDefinition = definition();
    const start = state(suitDefinition);
    const missing = applySuitCommand(start, suitDefinition, command(start, "SetSubsystemEnabled", {
      subsystemId: "subsystem:missing", enabled: true
    }));
    expect(missing.status).toBe("Rejected");
    if (missing.status === "Rejected") {
      expect(missing.error).toBeInstanceOf(SuitTransitionError);
      expect(missing.error.code).toBe("SubsystemNotFound");
      expect(missing.error.path).toBe("/command/payload/subsystemId");
    }
    const programmerError = new Error("programmer-error");
    const hostileCommand = Object.create(null) as SuitCommand;
    Object.defineProperty(hostileCommand, "kind", { get: () => { throw programmerError; } });
    let caught: unknown;
    try {
      applySuitCommand(start, suitDefinition, hostileCommand);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(programmerError);
  });
});
