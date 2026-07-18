import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DAMAGE_TYPES } from "../../src/combat";
import { createInteractionCapabilityId } from "../../src/interaction";
import { createResourceRequirement } from "../../src/resources";
import { createSuitInterfaceId } from "../../src/suit";
import {
  REPAIR_TOOL_FIXTURE,
  SURFACE_EQUIPMENT_CAPACITY_KINDS,
  SURFACE_EQUIPMENT_CATEGORIES,
  SURFACE_EQUIPMENT_DELIVERY_CLASSES,
  SURFACE_EQUIPMENT_DIAGNOSTIC_CODE_ORDER,
  SURFACE_EQUIPMENT_FIXTURES,
  SURFACE_EQUIPMENT_LEGAL_CLASSES,
  SURFACE_EQUIPMENT_MODULE_ROLES,
  SURFACE_EQUIPMENT_PRIMARY_SUIT_INTERFACE_ID,
  SURFACE_EQUIPMENT_RANGE_CLASSES,
  SURFACE_EQUIPMENT_READINESS_STATES,
  SURVEY_SCANNER_FIXTURE,
  SurfaceEquipmentDataError,
  canonicalSurfaceEquipmentJson,
  createSurfaceEquipmentBlueprint,
  createSurfaceEquipmentBlueprintId,
  createSurfaceEquipmentCatalog,
  createSurfaceEquipmentCatalogId,
  createSurfaceEquipmentModuleId,
  deriveSurfaceEquipmentStats,
  type SurfaceEquipmentBlueprint,
  type SurfaceEquipmentCatalog,
  type SurfaceEquipmentCatalogInput,
  type SurfaceEquipmentModuleDefinitionInput,
  type SurfaceEquipmentSlotDefinitionInput
} from "../../src/surface-equipment";

type MutableRecord = Record<string, any>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const expectDeepFrozen = (value: unknown, visited = new Set<object>()): void => {
  if (value === null || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value as Record<string, unknown>)) expectDeepFrozen(nested, visited);
};

const dataError = (operation: () => unknown): SurfaceEquipmentDataError => {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(SurfaceEquipmentDataError);
    return error as SurfaceEquipmentDataError;
  }
  throw new Error("Expected SurfaceEquipmentDataError.");
};

const displayMetadata = (name: string) => ({ displayName: name, description: `${name} test definition.` });

const moduleInput = (
  overrides: Partial<SurfaceEquipmentModuleDefinitionInput> = {}
): SurfaceEquipmentModuleDefinitionInput => ({
  moduleId: "module:test.utility",
  moduleVersion: 1,
  displayMetadata: displayMetadata("Utility module"),
  primaryRole: "Utility",
  tags: ["tag:test"],
  massGrams: 100,
  bulkMicroUnits: 200,
  continuousPowerMilliwatts: 10,
  pulseEnergyMillijoules: 20,
  heatPerActionMillijoules: 30,
  activeThermalLoadMilliwatts: 40,
  passiveDissipationMilliwatts: 5,
  compatibleSlotTypeIds: ["slot-type:test"],
  interactionCapabilities: [createInteractionCapabilityId("capability.access")],
  requiredSuitInterfaces: [createSuitInterfaceId("interface:primary")],
  resourceRequirements: [],
  calibrationDefinitions: [],
  safetyMetadata: { interlockRequired: false, certified: true },
  legalMetadata: { legalClassId: "unrestricted", legalClass: "Unrestricted" },
  balanceMetadata: { tier: "provisional-v0", rationale: "Deterministic test values only." },
  ...overrides
});

const slotInput = (
  overrides: Partial<SurfaceEquipmentSlotDefinitionInput> = {}
): SurfaceEquipmentSlotDefinitionInput => ({
  slotId: "slot:test.required",
  order: 0,
  slotTypeId: "slot-type:test",
  required: true,
  exactCount: 1,
  allowedRoles: ["Utility"],
  allowedTags: [],
  excludedTags: [],
  requiredSuitInterfaces: [createSuitInterfaceId("interface:primary")],
  maximumMassGrams: 100,
  maximumBulkMicroUnits: 200,
  displayMetadata: displayMetadata("Required slot"),
  ...overrides
});

const catalogInput = (
  slots: readonly SurfaceEquipmentSlotDefinitionInput[] = [slotInput()],
  modules: readonly SurfaceEquipmentModuleDefinitionInput[] = [moduleInput()]
): SurfaceEquipmentCatalogInput => ({
  catalogId: "catalog:test.v1",
  catalogVersion: 1,
  schemaVersion: 1,
  displayMetadata: displayMetadata("Test catalog"),
  slots,
  modules
});

const blueprintFor = (catalog: SurfaceEquipmentCatalog): SurfaceEquipmentBlueprint => createSurfaceEquipmentBlueprint({
  blueprintId: "blueprint:test.v1",
  catalogId: catalog.catalogId,
  catalogVersion: catalog.catalogVersion,
  revision: 0,
  category: "UtilityDevice",
  displayMetadata: displayMetadata("Test equipment"),
  slotAssignments: [{ slotId: "slot:test.required", moduleInstanceIds: ["instance:test.utility"] }],
  moduleInstances: [{ moduleInstanceId: "instance:test.utility", moduleId: "module:test.utility" }],
  calibrationChoices: [],
  tags: ["tag:z", "tag:a"],
  processedCommandIds: []
}, catalog);

const catalogInputFrom = (catalog: SurfaceEquipmentCatalog): SurfaceEquipmentCatalogInput => ({
  catalogId: catalog.catalogId,
  catalogVersion: catalog.catalogVersion,
  schemaVersion: catalog.schemaVersion,
  displayMetadata: clone(catalog.displayMetadata),
  slots: clone(catalog.slots),
  modules: catalog.modules.map(({ contentSignature: _signature, ...module }) => clone(module))
});

const blueprintInputFrom = (blueprint: SurfaceEquipmentBlueprint): MutableRecord => {
  const { contentSignature: _signature, ...input } = clone(blueprint) as MutableRecord;
  return input;
};

describe("Surface Equipment catalog, identity, determinism, and authorities", () => {
  it("1 validates stable catalog, module, and blueprint IDs without normalization", () => {
    expect(createSurfaceEquipmentCatalogId("catalog:valid.v1")).toBe("catalog:valid.v1");
    expect(createSurfaceEquipmentModuleId("module_valid-1")).toBe("module_valid-1");
    expect(createSurfaceEquipmentBlueprintId("blueprint.valid:1")).toBe("blueprint.valid:1");
    for (const invalid of ["", " Upper", "upper ", "UPPER", "é", `a${"b".repeat(128)}`]) {
      expect(() => createSurfaceEquipmentCatalogId(invalid)).toThrow(SurfaceEquipmentDataError);
      expect(() => createSurfaceEquipmentModuleId(invalid)).toThrow(SurfaceEquipmentDataError);
      expect(() => createSurfaceEquipmentBlueprintId(invalid)).toThrow(SurfaceEquipmentDataError);
    }
  });

  it("2 rejects duplicate catalog, module, and blueprint identities at deterministic paths", () => {
    const duplicateModule = catalogInput([slotInput()], [moduleInput(), moduleInput()]);
    const moduleError = dataError(() => createSurfaceEquipmentCatalog(duplicateModule));
    expect([moduleError.code, moduleError.path]).toEqual(["DuplicateId", "/catalog/modules"]);

    const duplicateSlot = catalogInput([slotInput(), slotInput()], [moduleInput()]);
    const slotError = dataError(() => createSurfaceEquipmentCatalog(duplicateSlot));
    expect([slotError.code, slotError.path]).toEqual(["DuplicateId", "/catalog/slots"]);

    const catalog = createSurfaceEquipmentCatalog(catalogInput());
    const duplicateBlueprint = blueprintInputFrom(blueprintFor(catalog));
    duplicateBlueprint.moduleInstances.push(clone(duplicateBlueprint.moduleInstances[0]));
    const blueprintError = dataError(() => createSurfaceEquipmentBlueprint(duplicateBlueprint, catalog));
    expect([blueprintError.code, blueprintError.path]).toEqual(["DuplicateId", "/blueprint/moduleInstances"]);
  });

  it("validates compatible slot type IDs as canonical duplicate-free identity arrays", () => {
    const sorted = createSurfaceEquipmentCatalog(catalogInput([], [moduleInput({
      compatibleSlotTypeIds: ["slot-type:z", "slot-type:a"]
    })]));
    expect(sorted.modules[0]?.compatibleSlotTypeIds).toEqual(["slot-type:a", "slot-type:z"]);
    const duplicateError = dataError(() => createSurfaceEquipmentCatalog(catalogInput([], [moduleInput({
      compatibleSlotTypeIds: ["slot-type:a", "slot-type:a"]
    })])));
    expect([duplicateError.code, duplicateError.path]).toEqual([
      "DuplicateId", "/catalog/modules/0/compatibleSlotTypeIds"
    ]);
  });

  it("3 canonicalizes unordered catalog and blueprint inputs to byte-identical outputs", () => {
    const fixture = SURVEY_SCANNER_FIXTURE;
    const forwardCatalogInput = catalogInputFrom(fixture.catalog);
    const reversedCatalogInput = {
      ...clone(forwardCatalogInput),
      slots: [...clone(forwardCatalogInput.slots)].reverse(),
      modules: [...clone(forwardCatalogInput.modules)].reverse().map((module: MutableRecord) => ({
        ...module,
        tags: module.tags.reverse(),
        interactionCapabilities: module.interactionCapabilities.reverse(),
        requiredSuitInterfaces: module.requiredSuitInterfaces.reverse(),
        compatibleSlotTypeIds: module.compatibleSlotTypeIds.reverse()
      }))
    };
    const forwardCatalog = createSurfaceEquipmentCatalog(forwardCatalogInput);
    const reversedCatalog = createSurfaceEquipmentCatalog(reversedCatalogInput);
    expect(canonicalSurfaceEquipmentJson(reversedCatalog)).toBe(canonicalSurfaceEquipmentJson(forwardCatalog));
    expect(reversedCatalog.contentSignature).toBe(forwardCatalog.contentSignature);

    const forwardBlueprintInput = blueprintInputFrom(fixture.blueprint);
    const reversedBlueprintInput = {
      ...clone(forwardBlueprintInput),
      slotAssignments: clone(forwardBlueprintInput.slotAssignments).reverse(),
      moduleInstances: clone(forwardBlueprintInput.moduleInstances).reverse(),
      calibrationChoices: clone(forwardBlueprintInput.calibrationChoices).reverse(),
      tags: clone(forwardBlueprintInput.tags).reverse(),
      processedCommandIds: clone(forwardBlueprintInput.processedCommandIds).reverse()
    };
    const forwardBlueprint = createSurfaceEquipmentBlueprint(forwardBlueprintInput, forwardCatalog);
    const reversedBlueprint = createSurfaceEquipmentBlueprint(reversedBlueprintInput, reversedCatalog);
    expect(canonicalSurfaceEquipmentJson(reversedBlueprint)).toBe(canonicalSurfaceEquipmentJson(forwardBlueprint));
    expect(reversedBlueprint.contentSignature).toBe(forwardBlueprint.contentSignature);
  });

  it("4 copies without mutating caller inputs and deeply freezes every returned value", () => {
    const mutableInput = catalogInput();
    const bytesBefore = JSON.stringify(mutableInput);
    const catalog = createSurfaceEquipmentCatalog(mutableInput);
    expect(JSON.stringify(mutableInput)).toBe(bytesBefore);
    expect(Object.isFrozen(mutableInput)).toBe(false);
    expectDeepFrozen(catalog);

    const blueprintInput = blueprintInputFrom(blueprintFor(catalog));
    const blueprintBytesBefore = JSON.stringify(blueprintInput);
    const blueprint = createSurfaceEquipmentBlueprint(blueprintInput, catalog);
    expect(JSON.stringify(blueprintInput)).toBe(blueprintBytesBefore);
    expect(Object.isFrozen(blueprintInput)).toBe(false);
    expectDeepFrozen(blueprint);
    expectDeepFrozen(deriveSurfaceEquipmentStats(blueprint, catalog));
  });

  it("5 returns the same signatures and canonical bytes for identical valid inputs", () => {
    const firstCatalog = createSurfaceEquipmentCatalog(catalogInput());
    const secondCatalog = createSurfaceEquipmentCatalog(clone(catalogInput()));
    const firstBlueprint = blueprintFor(firstCatalog);
    const secondBlueprint = blueprintFor(secondCatalog);
    const firstStats = deriveSurfaceEquipmentStats(firstBlueprint, firstCatalog);
    const secondStats = deriveSurfaceEquipmentStats(secondBlueprint, secondCatalog);
    expect(secondCatalog.contentSignature).toBe(firstCatalog.contentSignature);
    expect(secondBlueprint.contentSignature).toBe(firstBlueprint.contentSignature);
    expect(secondStats.signature).toBe(firstStats.signature);
    expect(canonicalSurfaceEquipmentJson(secondStats)).toBe(canonicalSurfaceEquipmentJson(firstStats));
  });

  it("6 distinguishes required slots from optional slots without inventing optional failures", () => {
    const catalog = createSurfaceEquipmentCatalog(catalogInput([
      slotInput(),
      slotInput({ slotId: "slot:test.optional", order: 1, required: false, displayMetadata: displayMetadata("Optional slot") })
    ]));
    const valid = blueprintFor(catalog);
    expect(deriveSurfaceEquipmentStats(valid, catalog).diagnostics).toEqual([]);

    const broken = clone(valid) as MutableRecord;
    broken.slotAssignments = [];
    broken.moduleInstances = [];
    const diagnostics = deriveSurfaceEquipmentStats(broken as SurfaceEquipmentBlueprint, catalog).diagnostics;
    expect(diagnostics.map((entry) => entry.code)).toEqual(["MissingRequiredSlot"]);
    expect(diagnostics[0]?.path).toBe("/slotAssignments/slot:test.required");

    const optionalPairCatalog = createSurfaceEquipmentCatalog(catalogInput([
      slotInput({ slotId: "slot:test.optional-pair", required: false, exactCount: 2 })
    ], [moduleInput()]));
    const partial = blueprintInputFrom(blueprintFor(createSurfaceEquipmentCatalog(catalogInput())));
    partial.catalogId = optionalPairCatalog.catalogId;
    partial.catalogVersion = optionalPairCatalog.catalogVersion;
    partial.slotAssignments = [{ slotId: "slot:test.optional-pair", moduleInstanceIds: ["instance:test.utility"] }];
    const partialError = dataError(() => createSurfaceEquipmentBlueprint(partial, optionalPairCatalog));
    expect([partialError.code, partialError.path]).toEqual([
      "InvalidValue", "/blueprint/slotAssignments/slot:test.optional-pair"
    ]);

    const validEmptyOptional = createSurfaceEquipmentBlueprint({
      blueprintId: "blueprint:optional-pair.v1", catalogId: optionalPairCatalog.catalogId,
      catalogVersion: optionalPairCatalog.catalogVersion, revision: 0, category: "UtilityDevice",
      displayMetadata: displayMetadata("Optional pair"), slotAssignments: [], moduleInstances: [],
      calibrationChoices: [], tags: [], processedCommandIds: []
    }, optionalPairCatalog);
    const partialStatsInput = clone(validEmptyOptional) as MutableRecord;
    partialStatsInput.slotAssignments = partial.slotAssignments;
    partialStatsInput.moduleInstances = partial.moduleInstances;
    const partialDiagnostics = deriveSurfaceEquipmentStats(partialStatsInput as SurfaceEquipmentBlueprint, optionalPairCatalog).diagnostics;
    expect(partialDiagnostics.map((entry) => [entry.code, entry.path])).toEqual([
      ["SlotCountMismatch", "/slotAssignments/slot:test.optional-pair"]
    ]);
  });

  it("7-8 reports role, tag, interface, mass, and bulk incompatibility in fixed order", () => {
    const catalog = createSurfaceEquipmentCatalog(catalogInput([], [moduleInput({ tags: ["tag:blocked"] })]));
    const permissiveCatalog = createSurfaceEquipmentCatalog(catalogInput([
      slotInput({ allowedTags: [], excludedTags: [], maximumMassGrams: 100, maximumBulkMicroUnits: 200 })
    ], [moduleInput({ tags: ["tag:blocked"] })]));
    const blueprint = blueprintFor(permissiveCatalog);
    const incompatible = clone(catalog) as MutableRecord;
    incompatible.slots = [slotInput({
      slotTypeId: "slot-type:incompatible",
      allowedRoles: ["Frame"],
      allowedTags: ["tag:required"],
      excludedTags: ["tag:blocked"],
      requiredSuitInterfaces: [createSuitInterfaceId("interface:secondary")],
      maximumMassGrams: 99,
      maximumBulkMicroUnits: 199
    })];
    const diagnostics = deriveSurfaceEquipmentStats(
      blueprint,
      incompatible as SurfaceEquipmentCatalog
    ).diagnostics;
    expect(diagnostics.map((entry) => entry.code)).toEqual([
      "SlotTypeMismatch", "SlotRoleMismatch", "TagIncompatible", "InterfaceMissing", "MassLimitExceeded", "BulkLimitExceeded"
    ]);
    expect(diagnostics.map((entry) => entry.path)).toEqual([
      "/slotAssignments/slot:test.required/instance:test.utility",
      "/slotAssignments/slot:test.required/instance:test.utility",
      "/slotAssignments/slot:test.required/instance:test.utility",
      "/slotAssignments/slot:test.required/instance:test.utility/interfaces/interface:secondary",
      "/slotAssignments/slot:test.required/mass",
      "/slotAssignments/slot:test.required/bulk"
    ]);
  });

  it("asserts every required closed vocabulary and the complete fixed diagnostic priority", () => {
    expect(SURFACE_EQUIPMENT_CATEGORIES).toEqual([
      "Scanner", "ExtractionTool", "RepairTool", "BreachingTool", "Sidearm", "Longarm", "UtilityDevice"
    ]);
    expect(SURFACE_EQUIPMENT_MODULE_ROLES).toEqual([
      "Frame", "ToolHead", "DeliveryAssembly", "PowerPack", "ThermalSink", "FeedSystem", "Magazine",
      "Optic", "Scanner", "Control", "Safety", "LegalTransponder", "Grip", "Stock", "Utility"
    ]);
    expect(SURFACE_EQUIPMENT_LEGAL_CLASSES).toEqual([
      "Unrestricted", "Licensed", "Restricted", "Prohibited", "IndustrialOnly", "MissionAuthorized"
    ]);
    expect(SURFACE_EQUIPMENT_DELIVERY_CLASSES).toEqual(["Projectile", "Beam", "ToolContact"]);
    expect(SURFACE_EQUIPMENT_READINESS_STATES).toEqual(["Ready", "Limited", "Blocked"]);
    expect(SURFACE_EQUIPMENT_CAPACITY_KINDS).toEqual(["Ammo", "Charge"]);
    expect(SURFACE_EQUIPMENT_RANGE_CLASSES).toEqual(["Contact", "Short", "Medium", "Long"]);
    expect(SURFACE_EQUIPMENT_DIAGNOSTIC_CODE_ORDER).toEqual([
      "MissingRequiredSlot", "SlotCountMismatch", "SlotTypeMismatch", "SlotRoleMismatch", "TagIncompatible", "InterfaceMissing", "MassLimitExceeded",
      "BulkLimitExceeded", "ContinuousPowerExceeded", "PulseEnergyExceeded", "ThermalBudgetExceeded",
      "AmmoFeedMissing", "MagazineMissing", "ControlMissing", "SafetyMissing", "SafetyCertificationInvalid", "DamageDeliveryIncomplete",
      "CapabilityUnsatisfied", "ResourceRequirementInvalid", "AggregateOverflow", "SuitActorIncapacitated", "SuitEquipmentBusOffline",
      "LegalConfigurationInvalid", "DuplicateModuleInstance", "RevisionConflict", "DuplicateCommand",
      "BlueprintMismatch", "UnknownModuleInstance", "UnknownModule", "UnknownSlot", "SlotCapacityExceeded",
      "CalibrationInvalid", "GripRequirementUnsatisfied", "InvalidCommand"
    ]);
  });

  it("excludes module and catalog display metadata from gameplay signatures", () => {
    const originalInput = catalogInput();
    const renamedInput = clone(originalInput) as MutableRecord;
    renamedInput.displayMetadata = displayMetadata("Renamed catalog");
    renamedInput.modules[0].displayMetadata = displayMetadata("Renamed module");
    const original = createSurfaceEquipmentCatalog(originalInput);
    const renamed = createSurfaceEquipmentCatalog(renamedInput);
    expect(renamed.modules[0]?.contentSignature).toBe(original.modules[0]?.contentSignature);
    expect(renamed.contentSignature).toBe(original.contentSignature);
  });

  it("reports aggregate overflow without returning unsafe numeric totals", () => {
    const first = moduleInput({
      moduleId: "module:test.first", massGrams: Number.MAX_SAFE_INTEGER,
      continuousPowerMilliwatts: Number.MAX_SAFE_INTEGER
    });
    const second = moduleInput({
      moduleId: "module:test.second", massGrams: 1, continuousPowerMilliwatts: 1
    });
    const overflowCatalog = createSurfaceEquipmentCatalog(catalogInput([
      slotInput({ slotId: "slot:test.first", order: 0, maximumMassGrams: Number.MAX_SAFE_INTEGER }),
      slotInput({ slotId: "slot:test.second", order: 1 })
    ], [first, second]));
    const overflowBlueprint = createSurfaceEquipmentBlueprint({
      blueprintId: "blueprint:overflow.v1", catalogId: overflowCatalog.catalogId,
      catalogVersion: overflowCatalog.catalogVersion, revision: 0, category: "UtilityDevice",
      displayMetadata: displayMetadata("Overflow equipment"),
      slotAssignments: [
        { slotId: "slot:test.first", moduleInstanceIds: ["instance:first"] },
        { slotId: "slot:test.second", moduleInstanceIds: ["instance:second"] }
      ],
      moduleInstances: [
        { moduleInstanceId: "instance:first", moduleId: first.moduleId },
        { moduleInstanceId: "instance:second", moduleId: second.moduleId }
      ], calibrationChoices: [], tags: [], processedCommandIds: []
    }, overflowCatalog);
    const stats = deriveSurfaceEquipmentStats(overflowBlueprint, overflowCatalog);
    expect(stats.diagnostics.filter((entry) => entry.code === "AggregateOverflow").map((entry) => entry.path)).toEqual([
      "/totals/continuousPowerMilliwatts", "/totals/totalMassGrams"
    ]);
    expect(stats.totalMassGrams).toBe(Number.MAX_SAFE_INTEGER);
    expect(stats.continuousPowerMilliwatts).toBe(Number.MAX_SAFE_INTEGER);
    expect(Number.isSafeInteger(stats.totalMassGrams)).toBe(true);
    expect(Number.isSafeInteger(stats.continuousPowerMilliwatts)).toBe(true);
  });

  it("15-19 reuses Interaction, Suit, Combat, and Resources public authorities without local duplicates", () => {
    expect(SURFACE_EQUIPMENT_PRIMARY_SUIT_INTERFACE_ID).toBe(createSuitInterfaceId("interface:primary"));
    for (const fixture of SURFACE_EQUIPMENT_FIXTURES) {
      for (const module of fixture.catalog.modules) {
        for (const capabilityId of module.interactionCapabilities) {
          expect(capabilityId).toBe(createInteractionCapabilityId(capabilityId));
        }
        for (const interfaceId of module.requiredSuitInterfaces) {
          expect(interfaceId).toBe(createSuitInterfaceId(interfaceId));
        }
        if (module.damageType !== undefined) expect(DAMAGE_TYPES).toContain(module.damageType);
      }
    }
    const repairStats = deriveSurfaceEquipmentStats(REPAIR_TOOL_FIXTURE.blueprint, REPAIR_TOOL_FIXTURE.catalog);
    expect(repairStats.resourceRequirements).toEqual([
      createResourceRequirement({ resourceId: "component_scrap_electronics", quantity: 1 })
    ]);

    const sourceDirectory = resolve(process.cwd(), "src/surface-equipment");
    const sources = readdirSync(sourceDirectory)
      .filter((fileName) => fileName.endsWith(".ts"))
      .map((fileName) => readFileSync(join(sourceDirectory, fileName), "utf8"))
      .join("\n");
    expect(sources).toContain('from "../interaction"');
    expect(sources).toContain('from "../suit"');
    expect(sources).toContain('from "../combat"');
    expect(sources).toContain('from "../resources"');
    expect(sources).not.toMatch(/^\s*(?:export\s+)?(?:type|interface|enum|class)\s+(?:InteractionCapabilityId|SuitInterfaceId|SuitEquipmentInterfaceSnapshot|DamageType|ResourceRequirement)\b/m);
    expect(sources).not.toMatch(/^\s*(?:export\s+)?(?:const|let|var)\s+(?:DAMAGE_TYPES|INTERACTION_CAPABILITIES|SUIT_INTERFACES|RESOURCE_REQUIREMENTS)\b/m);
  });
});
