import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SUIT_LIFE_SUPPORT_MODES,
  SUIT_SCHEMA_VERSION,
  SUIT_SUBSYSTEM_ROLES,
  createSuitDefinition,
  createSuitEquipmentInterfaceSnapshot,
  createSuitStateSnapshot,
  type SuitEquipmentInterfaceSnapshot
} from "../../src/suit";
import {
  BALLISTIC_SIDEARM_FIXTURE,
  EMP_BREACHER_FIXTURE,
  LASER_CUTTER_FIXTURE,
  MINING_CUTTER_FIXTURE,
  REPAIR_TOOL_FIXTURE,
  SURFACE_EQUIPMENT_FIXTURES,
  SURVEY_SCANNER_FIXTURE,
  SurfaceEquipmentDataError,
  canonicalSurfaceEquipmentJson,
  createCombatCapabilityProjection,
  createInteractionCapabilityProjection,
  createSurfaceEquipmentSignature,
  deriveSurfaceEquipmentStats,
  evaluateEquipmentSuitReadiness,
  type SurfaceEquipmentCatalog,
  type SurfaceEquipmentBlueprint,
  type SurfaceEquipmentDerivedStats,
  type SurfaceEquipmentFixture,
  type SurfaceEquipmentModuleRole,
  type SurfaceEquipmentSuitReadiness
} from "../../src/surface-equipment";

type MutableRecord = Record<string, any>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const dataError = (operation: () => unknown): SurfaceEquipmentDataError => {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(SurfaceEquipmentDataError);
    return error as SurfaceEquipmentDataError;
  }
  throw new Error("Expected SurfaceEquipmentDataError.");
};

const suitSnapshot = (options: {
  readonly interfaceId?: string;
  readonly continuousPower?: number;
  readonly pulseEnergy?: number;
  readonly thermalDissipation?: number;
  readonly actorIncapacitated?: boolean;
  readonly equipmentBusOnline?: boolean;
} = {}): SuitEquipmentInterfaceSnapshot => {
  const interfaceId = options.interfaceId ?? "interface:primary";
  const continuousPower = options.continuousPower ?? 10_000;
  const pulseEnergy = options.pulseEnergy ?? 10_000;
  const thermalDissipation = options.thermalDissipation ?? 10_000;
  const actorIncapacitated = options.actorIncapacitated ?? false;
  const equipmentBusOnline = options.equipmentBusOnline ?? true;
  const definition = createSuitDefinition({
    schemaVersion: SUIT_SCHEMA_VERSION,
    definitionId: `suit-definition:test-${interfaceId.replaceAll(":", "-")}`,
    healthMaximumMilliPoints: 10_000,
    oxygenCapacityMilligrams: 10_000,
    energyCapacityMillijoules: 10_000,
    sealIntegrityMaximumBasisPoints: 10_000,
    temperature: {
      nominalMinimumMilliKelvin: 290_000,
      nominalMaximumMilliKelvin: 310_000,
      safeMinimumMilliKelvin: 280_000,
      safeMaximumMilliKelvin: 320_000,
      warningLowMilliKelvin: 275_000,
      warningHighMilliKelvin: 325_000,
      criticalLowMilliKelvin: 270_000,
      criticalHighMilliKelvin: 330_000
    },
    alerts: {
      oxygenLowMilligrams: 3_000,
      oxygenCriticalMilligrams: 1_000,
      energyLowMillijoules: 3_000,
      energyCriticalMillijoules: 1_000,
      sealDamagedBasisPoints: 8_000,
      sealCriticalBasisPoints: 4_000,
      radiationElevatedMicrosieverts: 100,
      radiationCriticalMicrosieverts: 200,
      contaminationElevatedMicroUnits: 100,
      contaminationCriticalMicroUnits: 200
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
    workloadProfiles: [
      ["Rest", 1, 1, 0], ["Walk", 10, 10, 10], ["Sprint", 20, 20, 20],
      ["HeavyWork", 30, 30, 30], ["Incapacitated", 0, 0, 0]
    ].map(([workload, oxygen, energy, thermal]) => ({
      workload,
      oxygenConsumptionMilligramsPerSecond: oxygen,
      energyConsumptionMillijoulesPerSecond: energy,
      temperatureDeltaMilliKelvinPerSecond: thermal
    })),
    modeProfiles: SUIT_LIFE_SUPPORT_MODES.map((mode) => ({
      mode,
      oxygenConsumptionAdjustmentMilligramsPerSecond: 0,
      energyConsumptionAdjustmentMillijoulesPerSecond: 0,
      temperatureDeltaAdjustmentMilliKelvinPerSecond: 0
    })),
    allowedModes: [...SUIT_LIFE_SUPPORT_MODES],
    subsystemDefinitions: SUIT_SUBSYSTEM_ROLES.map((role, index) => ({
      subsystemId: `subsystem:${role}`,
      role,
      continuousPowerDrawMilliwatts: 0,
      oxygenConsumptionReductionMilligramsPerSecond: 0,
      thermalDeltaMilliKelvinPerSecond: 0,
      contaminationFilterBasisPoints: 0,
      priority: 100 - index,
      requiredInterfaceId: interfaceId,
      revision: 0
    })),
    interfaceDefinitions: [{
      interfaceId,
      continuousPowerBudgetMilliwatts: continuousPower,
      pulseEnergyReserveMillijoules: pulseEnergy,
      thermalDissipationBudgetMilliwatts: thermalDissipation,
      revision: 0
    }],
    failSafeModeOnEquipmentBusLoss: "Emergency",
    registryVersion: "suit-registry:surface-equipment-tests-v1",
    algorithmVersion: "suit-algorithm:surface-equipment-tests-v1"
  });
  const health = actorIncapacitated ? 0 : 10_000;
  const state = createSuitStateSnapshot({
    schemaVersion: SUIT_SCHEMA_VERSION,
    stateId: "suit-state:surface-equipment-test",
    actorId: "actor:surface-equipment-test",
    definitionId: definition.definitionId,
    revision: 0,
    tick: 0,
    healthMilliPoints: health,
    healthRepairCeilingMilliPoints: health,
    oxygenMilligrams: 10_000,
    energyMillijoules: pulseEnergy,
    sealIntegrityBasisPoints: 10_000,
    sealRepairCeilingBasisPoints: 10_000,
    internalTemperatureMilliKelvin: 300_000,
    radiationMicrosieverts: 0,
    contaminationMicroUnits: 0,
    mode: "Nominal",
    workload: actorIncapacitated ? "Incapacitated" : "Rest",
    subsystemStates: definition.subsystemDefinitions.map((entry) => ({
      subsystemId: entry.subsystemId,
      status: !equipmentBusOnline && entry.role === "equipment-bus" ? "Disabled" : "Enabled",
      powerState: !equipmentBusOnline && entry.role === "equipment-bus" ? "Unpowered" : "Powered",
      revision: 0
    })),
    rateRemainders: [],
    actorIncapacitated,
    acceptedCommandIds: []
  }, definition);
  return createSuitEquipmentInterfaceSnapshot(state, definition);
};

const readinessFor = (fixture: SurfaceEquipmentFixture, suit = suitSnapshot()) => {
  const stats = deriveSurfaceEquipmentStats(fixture.blueprint, fixture.catalog);
  return { stats, readiness: evaluateEquipmentSuitReadiness(fixture.blueprint, stats, suit) };
};

const withoutRole = (
  fixture: SurfaceEquipmentFixture,
  role: SurfaceEquipmentModuleRole
): SurfaceEquipmentBlueprint => {
  const blueprint = clone(fixture.blueprint) as MutableRecord;
  const removedModuleIds = new Set(
    fixture.catalog.modules.filter((module) => module.primaryRole === role).map((module) => module.moduleId)
  );
  const removedInstanceIds = new Set(
    blueprint.moduleInstances
      .filter((instance: MutableRecord) => removedModuleIds.has(instance.moduleId))
      .map((instance: MutableRecord) => instance.moduleInstanceId)
  );
  blueprint.moduleInstances = blueprint.moduleInstances.filter(
    (instance: MutableRecord) => !removedInstanceIds.has(instance.moduleInstanceId)
  );
  blueprint.slotAssignments = blueprint.slotAssignments.map((assignment: MutableRecord) => ({
    ...assignment,
    moduleInstanceIds: assignment.moduleInstanceIds.filter((id: string) => !removedInstanceIds.has(id))
  }));
  blueprint.calibrationChoices = blueprint.calibrationChoices.filter(
    (choice: MutableRecord) => !removedInstanceIds.has(choice.moduleInstanceId)
  );
  return blueprint as SurfaceEquipmentBlueprint;
};

const collectKeys = (value: unknown, keys = new Set<string>()): ReadonlySet<string> => {
  if (value === null || typeof value !== "object") return keys;
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, keys);
    return keys;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    keys.add(key);
    collectKeys(nested, keys);
  }
  return keys;
};

describe("Surface Equipment fixtures, readiness, projections, and deterministic scenario", () => {
  it("9-14 evaluates continuous power, pulse reserve, thermal, bus, incapacity, and interfaces in fixed order", () => {
    const scanner = readinessFor(SURVEY_SCANNER_FIXTURE, suitSnapshot({ continuousPower: 100 }));
    expect(scanner.readiness.state).toBe("Limited");
    expect(scanner.readiness.blockers.map((entry) => entry.code)).toEqual(["ContinuousPowerExceeded"]);

    const miningLimited = readinessFor(MINING_CUTTER_FIXTURE, suitSnapshot({ pulseEnergy: 1_000 }));
    expect(miningLimited.readiness.state).toBe("Limited");
    expect(miningLimited.readiness.blockers.map((entry) => entry.code)).toEqual(["PulseEnergyExceeded"]);

    const empThermal = readinessFor(EMP_BREACHER_FIXTURE, suitSnapshot({ thermalDissipation: 100 }));
    expect(empThermal.readiness.state).toBe("Blocked");
    expect(empThermal.readiness.blockers.map((entry) => entry.code)).toEqual(["ThermalBudgetExceeded"]);

    const offline = readinessFor(SURVEY_SCANNER_FIXTURE, suitSnapshot({ equipmentBusOnline: false }));
    expect(offline.readiness.state).toBe("Blocked");
    expect(offline.readiness.blockers.map((entry) => entry.code)).toEqual([
      "SuitEquipmentBusOffline", "ContinuousPowerExceeded", "PulseEnergyExceeded", "ThermalBudgetExceeded"
    ]);

    const incapacitated = readinessFor(SURVEY_SCANNER_FIXTURE, suitSnapshot({ actorIncapacitated: true }));
    expect(incapacitated.readiness.state).toBe("Blocked");
    expect(incapacitated.readiness.blockers[0]?.code).toBe("SuitActorIncapacitated");

    const missingInterface = readinessFor(SURVEY_SCANNER_FIXTURE, suitSnapshot({ interfaceId: "interface:secondary" }));
    expect(missingInterface.readiness.state).toBe("Blocked");
    expect(missingInterface.readiness.blockers.map((entry) => entry.code)).toEqual(["InterfaceMissing"]);
    expect(Object.isFrozen(missingInterface.readiness.blockers)).toBe(true);
  });

  it("27 validates all six provisional built-ins with deterministic nominal stats and Ready suit state", () => {
    expect(SURFACE_EQUIPMENT_FIXTURES.map((fixture) => fixture.fixtureId)).toEqual([
      "blueprint:survey-scanner.v1",
      "blueprint:mining-cutter.v1",
      "blueprint:repair-tool.v1",
      "blueprint:emp-breacher.v1",
      "blueprint:ballistic-sidearm.v1",
      "blueprint:laser-cutter.v1"
    ]);
    expect(new Set(SURFACE_EQUIPMENT_FIXTURES.map((fixture) => fixture.fixtureId)).size).toBe(6);
    for (const fixture of SURFACE_EQUIPMENT_FIXTURES) {
      const { stats, readiness } = readinessFor(fixture);
      expect(stats.diagnostics, fixture.fixtureId).toEqual([]);
      expect(readiness.state, fixture.fixtureId).toBe("Ready");
      expect(readiness.blockers, fixture.fixtureId).toEqual([]);
      expect(fixture.catalog.modules.every((module) => module.balanceMetadata.tier === "provisional-v0")).toBe(true);
      expect(Object.isFrozen(stats)).toBe(true);
      expect(Object.isFrozen(readiness)).toBe(true);
    }
    const laserStats = deriveSurfaceEquipmentStats(LASER_CUTTER_FIXTURE.blueprint, LASER_CUTTER_FIXTURE.catalog);
    expect([laserStats.damageType, laserStats.deliveryClass]).toEqual(["Cutting", "Beam"]);
  });

  it("keeps active thermal rates separate from heat-per-action energy for all six fixtures", () => {
    const thermalFacts = SURFACE_EQUIPMENT_FIXTURES.map((fixture) => {
      const stats = deriveSurfaceEquipmentStats(fixture.blueprint, fixture.catalog);
      return [
        fixture.fixtureId,
        stats.activeThermalLoadMilliwatts,
        stats.passiveDissipationMilliwatts,
        stats.netThermalBurdenMilliwatts,
        stats.heatPerActionMillijoules
      ];
    });
    expect(thermalFacts).toEqual([
      ["blueprint:survey-scanner.v1", 100, 0, 100, 0],
      ["blueprint:mining-cutter.v1", 1_000, 800, 200, 700],
      ["blueprint:repair-tool.v1", 200, 0, 200, 0],
      ["blueprint:emp-breacher.v1", 600, 0, 600, 500],
      ["blueprint:ballistic-sidearm.v1", 100, 0, 100, 0],
      ["blueprint:laser-cutter.v1", 1_500, 1_100, 400, 1_000]
    ]);
    for (const fixture of SURFACE_EQUIPMENT_FIXTURES) {
      for (const module of fixture.catalog.modules) {
        expect(Number.isSafeInteger(module.activeThermalLoadMilliwatts)).toBe(true);
      }
    }
  });

  it("keeps module-slot interface mismatch blocking independently from Suit interface availability", () => {
    const catalog = clone(SURVEY_SCANNER_FIXTURE.catalog) as MutableRecord;
    catalog.slots[0].requiredSuitInterfaces = ["interface:secondary"];
    const slotId = catalog.slots[0].slotId as string;
    const assignment = SURVEY_SCANNER_FIXTURE.blueprint.slotAssignments.find((entry) => entry.slotId === slotId)!;
    const expectedConfigurationPath = `/slotAssignments/${slotId}/${assignment.moduleInstanceIds[0]}/interfaces/interface:secondary`;
    const stats = deriveSurfaceEquipmentStats(
      SURVEY_SCANNER_FIXTURE.blueprint,
      catalog as SurfaceEquipmentCatalog
    );
    expect(stats.diagnostics.map((entry) => [entry.code, entry.path])).toEqual([
      ["InterfaceMissing", expectedConfigurationPath]
    ]);
    const suitWithBothInterfaces = clone(suitSnapshot()) as MutableRecord;
    suitWithBothInterfaces.interfaceIds.push("interface:secondary");
    const readiness = evaluateEquipmentSuitReadiness(
      SURVEY_SCANNER_FIXTURE.blueprint,
      stats,
      suitWithBothInterfaces as SuitEquipmentInterfaceSnapshot
    );
    expect(readiness.state).toBe("Blocked");
    expect(readiness.blockers.map((entry) => [entry.code, entry.phase, entry.path])).toEqual([
      ["InterfaceMissing", "StructureSafety", stats.diagnostics[0]!.path]
    ]);

    const suitMissingModuleInterface = readinessFor(
      SURVEY_SCANNER_FIXTURE,
      suitSnapshot({ interfaceId: "interface:secondary" })
    ).readiness;
    expect(suitMissingModuleInterface.blockers.map((entry) => [entry.code, entry.phase, entry.path])).toEqual([
      ["InterfaceMissing", "Interfaces", "/suit/interfaces/interface:primary"]
    ]);
  });

  it("blocks an installed required interlock whose safety certification is invalid", () => {
    const catalog = clone(BALLISTIC_SIDEARM_FIXTURE.catalog) as MutableRecord;
    const safety = catalog.modules.find((module: MutableRecord) => module.primaryRole === "Safety");
    safety.safetyMetadata.certified = false;
    const stats = deriveSurfaceEquipmentStats(
      BALLISTIC_SIDEARM_FIXTURE.blueprint,
      catalog as SurfaceEquipmentCatalog
    );
    expect(stats.diagnostics.map((entry) => [entry.code, entry.path])).toEqual([
      ["SafetyCertificationInvalid", "/safety/certification"]
    ]);
    const readiness = evaluateEquipmentSuitReadiness(BALLISTIC_SIDEARM_FIXTURE.blueprint, stats, suitSnapshot());
    expect(readiness.state).toBe("Blocked");
    expect(readiness.blockers.map((entry) => entry.code)).toEqual(["SafetyCertificationInvalid"]);
  });

  it("rejects stale blueprint, catalog, stats, and readiness provenance with controlled data errors", () => {
    const fixture = EMP_BREACHER_FIXTURE;
    const stats = deriveSurfaceEquipmentStats(fixture.blueprint, fixture.catalog);
    expect(stats).toMatchObject({
      blueprintId: fixture.blueprint.blueprintId,
      revision: fixture.blueprint.revision,
      catalogId: fixture.catalog.catalogId,
      catalogVersion: fixture.catalog.catalogVersion
    });

    const wrongCatalogId = clone(fixture.catalog) as MutableRecord;
    wrongCatalogId.catalogId = "catalog:wrong.v1";
    expect(dataError(() => deriveSurfaceEquipmentStats(
      fixture.blueprint,
      wrongCatalogId as SurfaceEquipmentCatalog
    )).path).toBe("/blueprint/catalogId");
    const wrongCatalogVersion = clone(fixture.catalog) as MutableRecord;
    wrongCatalogVersion.catalogVersion += 1;
    expect(dataError(() => deriveSurfaceEquipmentStats(
      fixture.blueprint,
      wrongCatalogVersion as SurfaceEquipmentCatalog
    )).path).toBe("/blueprint/catalogVersion");

    const staleRevisionStats = clone(stats) as MutableRecord;
    staleRevisionStats.revision += 1;
    expect(dataError(() => evaluateEquipmentSuitReadiness(
      fixture.blueprint,
      staleRevisionStats as SurfaceEquipmentDerivedStats,
      suitSnapshot()
    )).path).toBe("/stats/revision");
    const staleCatalogStats = clone(stats) as MutableRecord;
    staleCatalogStats.catalogVersion += 1;
    expect(dataError(() => evaluateEquipmentSuitReadiness(
      fixture.blueprint,
      staleCatalogStats as SurfaceEquipmentDerivedStats,
      suitSnapshot()
    )).path).toBe("/stats/catalogVersion");

    const readiness = evaluateEquipmentSuitReadiness(fixture.blueprint, stats, suitSnapshot());
    const staleReadiness = clone(readiness) as MutableRecord;
    staleReadiness.statsSignature = "00000000";
    expect(dataError(() => createInteractionCapabilityProjection(
      fixture.blueprint,
      stats,
      staleReadiness as SurfaceEquipmentSuitReadiness
    )).path).toBe("/readiness/statsSignature");
    const wrongRevisionReadiness = clone(readiness) as MutableRecord;
    wrongRevisionReadiness.revision += 1;
    expect(dataError(() => createCombatCapabilityProjection(
      fixture.blueprint,
      stats,
      wrongRevisionReadiness as SurfaceEquipmentSuitReadiness
    )).path).toBe("/readiness/revision");
  });

  it("28-30 produces exact ordered diagnostics for broken sidearm safety and magazine variants", () => {
    const unsafe = deriveSurfaceEquipmentStats(
      withoutRole(BALLISTIC_SIDEARM_FIXTURE, "Safety"),
      BALLISTIC_SIDEARM_FIXTURE.catalog
    );
    expect(unsafe.diagnostics.map((entry) => [entry.code, entry.path])).toEqual([
      ["MissingRequiredSlot", "/slotAssignments/slot:05:safety"],
      ["SafetyMissing", "/category/Sidearm/Safety"]
    ]);
    const unsafeReadiness = evaluateEquipmentSuitReadiness(
      withoutRole(BALLISTIC_SIDEARM_FIXTURE, "Safety"),
      unsafe,
      suitSnapshot()
    );
    expect(unsafeReadiness.state).toBe("Blocked");

    const noMagazineBlueprint = withoutRole(BALLISTIC_SIDEARM_FIXTURE, "Magazine");
    const noMagazine = deriveSurfaceEquipmentStats(noMagazineBlueprint, BALLISTIC_SIDEARM_FIXTURE.catalog);
    expect(noMagazine.diagnostics.map((entry) => [entry.code, entry.path])).toEqual([
      ["MissingRequiredSlot", "/slotAssignments/slot:03:magazine"],
      ["MagazineMissing", "/category/Sidearm/Magazine"]
    ]);
    expect(evaluateEquipmentSuitReadiness(noMagazineBlueprint, noMagazine, suitSnapshot()).state).toBe("Blocked");
  });

  it("31 classifies insufficient cutter energy as Limited when positive and Blocked when zero", () => {
    const limited = readinessFor(MINING_CUTTER_FIXTURE, suitSnapshot({ pulseEnergy: 1_000 })).readiness;
    const blocked = readinessFor(MINING_CUTTER_FIXTURE, suitSnapshot({ pulseEnergy: 0 })).readiness;
    expect([limited.state, limited.blockers[0]?.impact]).toEqual(["Limited", "Limited"]);
    expect([blocked.state, blocked.blockers[0]?.impact]).toEqual(["Blocked", "Blocked"]);
    expect(limited.blockers[0]).toMatchObject({ required: 2_100, available: 1_000 });
    expect(blocked.blockers[0]).toMatchObject({ required: 2_100, available: 0 });
  });

  it("32 projects repair requirements as immutable intent without transferring or mutating resources", () => {
    const suit = suitSnapshot();
    const beforeCatalog = canonicalSurfaceEquipmentJson(REPAIR_TOOL_FIXTURE.catalog);
    const { stats, readiness } = readinessFor(REPAIR_TOOL_FIXTURE, suit);
    const projection = createInteractionCapabilityProjection(REPAIR_TOOL_FIXTURE.blueprint, stats, readiness);
    expect(projection.resourceRequirements).toEqual([{ resourceId: "component_scrap_electronics", quantity: 1 }]);
    expect(Object.isFrozen(projection.resourceRequirements)).toBe(true);
    expect(canonicalSurfaceEquipmentJson(REPAIR_TOOL_FIXTURE.catalog)).toBe(beforeCatalog);
    expect(collectKeys(projection)).not.toContain("containerId");
    expect(collectKeys(projection)).not.toContain("transferId");
  });

  it("33 preserves EMP legal and safety metadata separately in both projections", () => {
    const { stats, readiness } = readinessFor(EMP_BREACHER_FIXTURE);
    const interaction = createInteractionCapabilityProjection(EMP_BREACHER_FIXTURE.blueprint, stats, readiness);
    const combat = createCombatCapabilityProjection(EMP_BREACHER_FIXTURE.blueprint, stats, readiness);
    expect(interaction.legalClass).toBe("Restricted");
    expect(interaction.capabilityIds).toEqual(["capability.access"]);
    expect(interaction.safetyMetadata).toEqual({ interlockRequired: true, certified: true });
    expect(combat.status).toBe("Available");
    if (combat.status !== "Available") return;
    expect(combat.projection).toMatchObject({
      damageType: "ElectricalEmp",
      deliveryClass: "ToolContact",
      firePermission: { legalClass: "Restricted", interlockRequired: true, safetyCertified: true }
    });
  });

  it("34 gates Combat projections by category and contains no runtime weapon or fire state", () => {
    const statuses = SURFACE_EQUIPMENT_FIXTURES.map((fixture) => {
      const { stats, readiness } = readinessFor(fixture);
      const result = createCombatCapabilityProjection(fixture.blueprint, stats, readiness);
      expect(Object.isFrozen(result)).toBe(true);
      return result;
    });
    expect(statuses.map((entry) => entry.status)).toEqual([
      "Absent", "Absent", "Absent", "Available", "Available", "Absent"
    ]);
    for (const result of statuses) {
      const keys = collectKeys(result);
      for (const forbidden of ["runtimeState", "weaponRuntimeState", "projectile", "hit", "damageApplied", "fireExecuted"]) {
        expect(keys).not.toContain(forbidden);
      }
    }
  });

  it("35 returns a frozen Interaction projection with no evaluation or completion authority", () => {
    const suit = suitSnapshot();
    const suitBytes = canonicalSurfaceEquipmentJson(suit);
    const { stats, readiness } = readinessFor(SURVEY_SCANNER_FIXTURE, suit);
    const projection = createInteractionCapabilityProjection(SURVEY_SCANNER_FIXTURE.blueprint, stats, readiness);
    expect(projection.capabilityIds).toEqual(["capability.access", "capability.scan"]);
    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(projection.energyIntent)).toBe(true);
    const keys = collectKeys(projection);
    for (const forbidden of ["completion", "completed", "decision", "target", "interactionSession", "consume"] ) {
      expect(keys).not.toContain(forbidden);
    }
    expect(canonicalSurfaceEquipmentJson(suit)).toBe(suitBytes);
  });

  it("36 has no DOM, Three.js, Date, or randomness dependency in any core source file", () => {
    const sourceDirectory = resolve(process.cwd(), "src/surface-equipment");
    const entries = readdirSync(sourceDirectory).filter((fileName) => fileName.endsWith(".ts"));
    expect(entries.length).toBeGreaterThan(0);
    for (const fileName of entries) {
      const source = readFileSync(join(sourceDirectory, fileName), "utf8");
      expect(source, fileName).not.toMatch(/from\s+["']three(?:\/|["'])/);
      expect(source, fileName).not.toMatch(/\b(?:document|window|HTMLElement|HTMLCanvasElement|Date)\b/);
      expect(source, fileName).not.toMatch(/\bMath\.random\b|\bcrypto\.(?:getRandomValues|randomUUID)\b/);
    }
  });

  it("37 pins canonical browser-equivalent scenario bytes and signature", () => {
    const readySuit = suitSnapshot();
    const projectionStatuses = SURFACE_EQUIPMENT_FIXTURES.map((fixture) => {
      const { stats, readiness } = readinessFor(fixture, readySuit);
      return createCombatCapabilityProjection(fixture.blueprint, stats, readiness).status;
    });
    const unsafeDiagnostics = deriveSurfaceEquipmentStats(
      withoutRole(BALLISTIC_SIDEARM_FIXTURE, "Safety"),
      BALLISTIC_SIDEARM_FIXTURE.catalog
    ).diagnostics.map((entry) => entry.code);
    const noMagazineDiagnostics = deriveSurfaceEquipmentStats(
      withoutRole(BALLISTIC_SIDEARM_FIXTURE, "Magazine"),
      BALLISTIC_SIDEARM_FIXTURE.catalog
    ).diagnostics.map((entry) => entry.code);
    const scenario = {
      fixtureIds: SURFACE_EQUIPMENT_FIXTURES.map((fixture) => fixture.fixtureId),
      health: { consoleErrors: 0, networkFailures: 0, pageErrors: 0, requestFailures: 0 },
      lowEnergyCutter: readinessFor(MINING_CUTTER_FIXTURE, suitSnapshot({ pulseEnergy: 1_000 })).readiness.state,
      noMagazineSidearmDiagnostics: noMagazineDiagnostics,
      projectionStatuses,
      readinessStates: SURFACE_EQUIPMENT_FIXTURES.map((fixture) => readinessFor(fixture, readySuit).readiness.state),
      repairRequirements: readinessFor(REPAIR_TOOL_FIXTURE, readySuit).stats.resourceRequirements,
      unsafeSidearmDiagnostics: unsafeDiagnostics,
      zeroEnergyCutter: readinessFor(MINING_CUTTER_FIXTURE, suitSnapshot({ pulseEnergy: 0 })).readiness.state
    };
    const expectedBytes = "{\"fixtureIds\":[\"blueprint:survey-scanner.v1\",\"blueprint:mining-cutter.v1\",\"blueprint:repair-tool.v1\",\"blueprint:emp-breacher.v1\",\"blueprint:ballistic-sidearm.v1\",\"blueprint:laser-cutter.v1\"],\"health\":{\"consoleErrors\":0,\"networkFailures\":0,\"pageErrors\":0,\"requestFailures\":0},\"lowEnergyCutter\":\"Limited\",\"noMagazineSidearmDiagnostics\":[\"MissingRequiredSlot\",\"MagazineMissing\"],\"projectionStatuses\":[\"Absent\",\"Absent\",\"Absent\",\"Available\",\"Available\",\"Absent\"],\"readinessStates\":[\"Ready\",\"Ready\",\"Ready\",\"Ready\",\"Ready\",\"Ready\"],\"repairRequirements\":[{\"quantity\":1,\"resourceId\":\"component_scrap_electronics\"}],\"unsafeSidearmDiagnostics\":[\"MissingRequiredSlot\",\"SafetyMissing\"],\"zeroEnergyCutter\":\"Blocked\"}";
    expect(canonicalSurfaceEquipmentJson(scenario)).toBe(expectedBytes);
    expect(createSurfaceEquipmentSignature(scenario)).toBe("28cb036c");
    expect(canonicalSurfaceEquipmentJson(clone(scenario))).toBe(expectedBytes);
  });

  it("38 exposes timestamp-free, plain, immutable readiness health data suitable for isolated E2E proof", () => {
    const healthScenario = Object.freeze({
      fixtureCount: SURFACE_EQUIPMENT_FIXTURES.length,
      fixtureReadiness: Object.freeze(SURFACE_EQUIPMENT_FIXTURES.map((fixture) => Object.freeze({
        fixtureId: fixture.fixtureId,
        state: readinessFor(fixture).readiness.state
      }))),
      health: Object.freeze({ consoleErrors: 0, pageErrors: 0, networkFailures: 0, requestFailures: 0 })
    });
    const bytes = canonicalSurfaceEquipmentJson(healthScenario);
    expect(healthScenario.fixtureCount).toBe(6);
    expect(healthScenario.fixtureReadiness.every((entry) => entry.state === "Ready")).toBe(true);
    expect(healthScenario.health).toEqual({ consoleErrors: 0, pageErrors: 0, networkFailures: 0, requestFailures: 0 });
    expect(bytes).not.toMatch(/timestamp|generatedAt|date|random/i);
    expect(JSON.parse(bytes)).toEqual(healthScenario);
  });

  it("does not mutate Suit, Resource, Combat, blueprint, or catalog authorities while projecting", () => {
    const suit = suitSnapshot();
    const fixture = BALLISTIC_SIDEARM_FIXTURE;
    const suitBefore = canonicalSurfaceEquipmentJson(suit);
    const blueprintBefore = canonicalSurfaceEquipmentJson(fixture.blueprint);
    const catalogBefore = canonicalSurfaceEquipmentJson(fixture.catalog);
    const stats = deriveSurfaceEquipmentStats(fixture.blueprint, fixture.catalog);
    const readiness = evaluateEquipmentSuitReadiness(fixture.blueprint, stats, suit);
    createInteractionCapabilityProjection(fixture.blueprint, stats, readiness);
    createCombatCapabilityProjection(fixture.blueprint, stats, readiness);
    expect(canonicalSurfaceEquipmentJson(suit)).toBe(suitBefore);
    expect(canonicalSurfaceEquipmentJson(fixture.blueprint)).toBe(blueprintBefore);
    expect(canonicalSurfaceEquipmentJson(fixture.catalog)).toBe(catalogBefore);
  });
});
