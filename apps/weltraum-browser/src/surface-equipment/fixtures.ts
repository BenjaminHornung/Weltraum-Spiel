import type { DamageType } from "../combat";
import { createInteractionCapabilityId } from "../interaction";
import { createResourceRequirement, type ResourceRequirement } from "../resources";
import { createSuitInterfaceId } from "../suit";
import { cloneAndFreezeSurfaceEquipmentValue } from "./canonical";
import {
  createSurfaceEquipmentBlueprint,
  createSurfaceEquipmentCatalog,
  type SurfaceEquipmentCalibrationDefinitionInput,
  type SurfaceEquipmentModuleDefinitionInput,
  type SurfaceEquipmentSlotDefinitionInput
} from "./catalog";
import { SURFACE_EQUIPMENT_SCHEMA_VERSION } from "./ids";
import type {
  SurfaceEquipmentCategory,
  SurfaceEquipmentDeliveryClass,
  SurfaceEquipmentFixture,
  SurfaceEquipmentLegalClass,
  SurfaceEquipmentModuleRole
} from "./types";

export const SURFACE_EQUIPMENT_PRIMARY_SUIT_INTERFACE_ID = createSuitInterfaceId("interface:primary");

const capability = (value: string) => createInteractionCapabilityId(value);
const repairRequirement = createResourceRequirement({ resourceId: "component_scrap_electronics", quantity: 1 });
const ballisticRequirement = createResourceRequirement({ resourceId: "ammo_ballistic_powder", quantity: 1 });

const display = (displayName: string, description: string) => ({ displayName, description });

const outputCalibration = (): SurfaceEquipmentCalibrationDefinitionInput => ({
  calibrationId: "calibration:output-mode",
  order: 0,
  displayMetadata: display("Output mode", "Catalog-defined discrete output selection."),
  defaultOptionId: "calibration-option:standard",
  options: [
    {
      optionId: "calibration-option:low",
      order: 0,
      displayMetadata: display("Low", "Reduced provisional output mode.")
    },
    {
      optionId: "calibration-option:standard",
      order: 1,
      displayMetadata: display("Standard", "Nominal provisional output mode.")
    },
    {
      optionId: "calibration-option:high",
      order: 2,
      displayMetadata: display("High", "Elevated provisional output mode.")
    }
  ]
});

interface ModuleOptions {
  readonly id: string;
  readonly name: string;
  readonly role: SurfaceEquipmentModuleRole;
  readonly tags?: readonly string[];
  readonly massGrams: number;
  readonly bulkMicroUnits: number;
  readonly continuousPowerMilliwatts?: number;
  readonly pulseEnergyMillijoules?: number;
  readonly heatPerActionMillijoules?: number;
  readonly activeThermalLoadMilliwatts?: number;
  readonly passiveDissipationMilliwatts?: number;
  readonly capabilities?: readonly string[];
  readonly resourceRequirements?: readonly ResourceRequirement[];
  readonly damageType?: DamageType;
  readonly deliveryClass?: SurfaceEquipmentDeliveryClass;
  readonly rangeMillimeters?: number;
  readonly cycleTicks?: number;
  readonly capacity?: { readonly kind: "Ammo" | "Charge"; readonly units: number };
  readonly calibrationDefinitions?: readonly SurfaceEquipmentCalibrationDefinitionInput[];
  readonly legalClass?: SurfaceEquipmentLegalClass;
  readonly interlockRequired?: boolean;
  readonly certified?: boolean;
}

const moduleDefinition = (options: ModuleOptions): SurfaceEquipmentModuleDefinitionInput => ({
  moduleId: options.id,
  moduleVersion: 1,
  displayMetadata: display(options.name, `${options.name} provisional V1 catalog definition.`),
  primaryRole: options.role,
  tags: options.tags ?? [options.role.toLowerCase()],
  massGrams: options.massGrams,
  bulkMicroUnits: options.bulkMicroUnits,
  continuousPowerMilliwatts: options.continuousPowerMilliwatts ?? 0,
  pulseEnergyMillijoules: options.pulseEnergyMillijoules ?? 0,
  heatPerActionMillijoules: options.heatPerActionMillijoules ?? 0,
  activeThermalLoadMilliwatts: options.activeThermalLoadMilliwatts ?? 0,
  passiveDissipationMilliwatts: options.passiveDissipationMilliwatts ?? 0,
  compatibleSlotTypeIds: [`slot-type:${options.role.toLowerCase()}`],
  interactionCapabilities: (options.capabilities ?? []).map(capability),
  requiredSuitInterfaces: [SURFACE_EQUIPMENT_PRIMARY_SUIT_INTERFACE_ID],
  resourceRequirements: options.resourceRequirements ?? [],
  ...(options.damageType === undefined ? {} : { damageType: options.damageType }),
  ...(options.deliveryClass === undefined ? {} : { deliveryClass: options.deliveryClass }),
  ...(options.rangeMillimeters === undefined ? {} : { rangeMillimeters: options.rangeMillimeters }),
  ...(options.cycleTicks === undefined ? {} : { cycleTicks: options.cycleTicks }),
  ...(options.capacity === undefined ? {} : { capacity: options.capacity }),
  calibrationDefinitions: options.calibrationDefinitions ?? [],
  safetyMetadata: {
    interlockRequired: options.interlockRequired ?? false,
    certified: options.certified ?? true
  },
  legalMetadata: {
    legalClassId: (options.legalClass ?? "Unrestricted").toLowerCase(),
    legalClass: options.legalClass ?? "Unrestricted"
  },
  balanceMetadata: {
    tier: "provisional-v0",
    rationale: "Fixture values establish deterministic contracts only; they are not production balance."
  }
});

const slotFor = (module: SurfaceEquipmentModuleDefinitionInput, index: number): SurfaceEquipmentSlotDefinitionInput => ({
  slotId: `slot:${String(index).padStart(2, "0")}:${module.primaryRole.toLowerCase()}`,
  order: index,
  slotTypeId: `slot-type:${module.primaryRole.toLowerCase()}`,
  required: true,
  exactCount: 1,
  allowedRoles: [module.primaryRole],
  allowedTags: [],
  excludedTags: [],
  requiredSuitInterfaces: module.requiredSuitInterfaces,
  maximumMassGrams: module.massGrams,
  maximumBulkMicroUnits: module.bulkMicroUnits,
  displayMetadata: display(`${module.primaryRole} slot`, `Required ${module.primaryRole} fixture slot.`)
});

interface FixtureInput {
  readonly key: string;
  readonly name: string;
  readonly category: SurfaceEquipmentCategory;
  readonly modules: readonly SurfaceEquipmentModuleDefinitionInput[];
  readonly calibrationChoices?: readonly {
    readonly moduleId: string;
    readonly calibrationId: string;
    readonly optionId: string;
  }[];
}

const createFixture = (input: FixtureInput): SurfaceEquipmentFixture => {
  const slots = input.modules.map(slotFor);
  const catalog = createSurfaceEquipmentCatalog({
    catalogId: `catalog:${input.key}.v1`,
    catalogVersion: 1,
    schemaVersion: SURFACE_EQUIPMENT_SCHEMA_VERSION,
    displayMetadata: display(`${input.name} catalog`, `Provisional catalog for the ${input.name} fixture.`),
    slots,
    modules: input.modules
  });
  const moduleInstances = input.modules.map((module, index) => ({
    moduleInstanceId: `instance:${String(index).padStart(2, "0")}:${module.moduleId}`,
    moduleId: module.moduleId
  }));
  const blueprint = createSurfaceEquipmentBlueprint({
    blueprintId: `blueprint:${input.key}.v1`,
    catalogId: catalog.catalogId,
    catalogVersion: catalog.catalogVersion,
    revision: 0,
    category: input.category,
    displayMetadata: display(input.name, `${input.name} nominal provisional fixture.`),
    slotAssignments: slots.map((slot, index) => ({
      slotId: slot.slotId,
      moduleInstanceIds: [moduleInstances[index].moduleInstanceId]
    })),
    moduleInstances,
    calibrationChoices: (input.calibrationChoices ?? []).map((choice) => {
      const instance = moduleInstances.find((candidate) => candidate.moduleId === choice.moduleId);
      if (instance === undefined) throw new Error(`Unknown fixture module '${choice.moduleId}'.`);
      return {
        moduleInstanceId: instance.moduleInstanceId,
        calibrationId: choice.calibrationId,
        optionId: choice.optionId
      };
    }),
    tags: [`fixture:${input.key}`, "balance:provisional-v0"],
    processedCommandIds: []
  }, catalog);
  return cloneAndFreezeSurfaceEquipmentValue({ fixtureId: blueprint.blueprintId, catalog, blueprint }) as SurfaceEquipmentFixture;
};

export const SURVEY_SCANNER_FIXTURE = createFixture({
  key: "survey-scanner",
  name: "Survey Scanner",
  category: "Scanner",
  modules: [
    moduleDefinition({ id: "module:survey-scanner.frame", name: "Survey Scanner Frame", role: "Frame", massGrams: 600, bulkMicroUnits: 850 }),
    moduleDefinition({
      id: "module:survey-scanner.sensor",
      name: "Survey Scanner Sensor",
      role: "Scanner",
      massGrams: 450,
      bulkMicroUnits: 600,
      continuousPowerMilliwatts: 350,
      pulseEnergyMillijoules: 120,
      activeThermalLoadMilliwatts: 100,
      capabilities: ["capability.access", "capability.scan"],
      rangeMillimeters: 50_000
    }),
    moduleDefinition({ id: "module:survey-scanner.control", name: "Survey Scanner Control", role: "Control", massGrams: 180, bulkMicroUnits: 200 })
  ]
});

export const MINING_CUTTER_FIXTURE = createFixture({
  key: "mining-cutter",
  name: "Mining Cutter",
  category: "ExtractionTool",
  modules: [
    moduleDefinition({ id: "module:mining-cutter.frame", name: "Mining Cutter Frame", role: "Frame", massGrams: 1_200, bulkMicroUnits: 1_400 }),
    moduleDefinition({
      id: "module:mining-cutter.head",
      name: "Mining Cutter Head",
      role: "ToolHead",
      tags: ["cutting", "industrial"],
      massGrams: 900,
      bulkMicroUnits: 800,
      continuousPowerMilliwatts: 1_100,
      pulseEnergyMillijoules: 900,
      heatPerActionMillijoules: 700,
      activeThermalLoadMilliwatts: 1_000,
      capabilities: ["capability.access", "capability.extract"],
      damageType: "Cutting",
      deliveryClass: "ToolContact",
      rangeMillimeters: 1_500,
      cycleTicks: 8,
      calibrationDefinitions: [outputCalibration()],
      legalClass: "IndustrialOnly",
      interlockRequired: true
    }),
    moduleDefinition({ id: "module:mining-cutter.power", name: "Mining Cutter Power Pack", role: "PowerPack", massGrams: 650, bulkMicroUnits: 500, pulseEnergyMillijoules: 1_200 }),
    moduleDefinition({ id: "module:mining-cutter.thermal", name: "Mining Cutter Thermal Sink", role: "ThermalSink", massGrams: 400, bulkMicroUnits: 350, passiveDissipationMilliwatts: 800 })
  ],
  calibrationChoices: [{
    moduleId: "module:mining-cutter.head",
    calibrationId: "calibration:output-mode",
    optionId: "calibration-option:standard"
  }]
});

export const REPAIR_TOOL_FIXTURE = createFixture({
  key: "repair-tool",
  name: "Repair Tool",
  category: "RepairTool",
  modules: [
    moduleDefinition({ id: "module:repair-tool.frame", name: "Repair Tool Frame", role: "Frame", massGrams: 700, bulkMicroUnits: 700 }),
    moduleDefinition({
      id: "module:repair-tool.head",
      name: "Repair Tool Head",
      role: "ToolHead",
      tags: ["repair", "service"],
      massGrams: 500,
      bulkMicroUnits: 450,
      continuousPowerMilliwatts: 300,
      pulseEnergyMillijoules: 250,
      activeThermalLoadMilliwatts: 200,
      capabilities: ["capability.access", "capability.repair"],
      resourceRequirements: [repairRequirement]
    }),
    moduleDefinition({ id: "module:repair-tool.control", name: "Repair Tool Control", role: "Control", massGrams: 160, bulkMicroUnits: 160 })
  ]
});

export const EMP_BREACHER_FIXTURE = createFixture({
  key: "emp-breacher",
  name: "EMP Breacher",
  category: "BreachingTool",
  modules: [
    moduleDefinition({ id: "module:emp-breacher.frame", name: "EMP Breacher Frame", role: "Frame", massGrams: 1_100, bulkMicroUnits: 1_100, legalClass: "Restricted" }),
    moduleDefinition({
      id: "module:emp-breacher.delivery",
      name: "EMP Contact Delivery",
      role: "DeliveryAssembly",
      tags: ["breaching", "emp"],
      massGrams: 750,
      bulkMicroUnits: 650,
      pulseEnergyMillijoules: 1_800,
      heatPerActionMillijoules: 500,
      activeThermalLoadMilliwatts: 600,
      capabilities: ["capability.access"],
      damageType: "ElectricalEmp",
      deliveryClass: "ToolContact",
      rangeMillimeters: 1_000,
      cycleTicks: 20,
      capacity: { kind: "Charge", units: 3 },
      legalClass: "Restricted",
      interlockRequired: true
    }),
    moduleDefinition({ id: "module:emp-breacher.safety", name: "EMP Breacher Safety", role: "Safety", massGrams: 220, bulkMicroUnits: 180, legalClass: "Restricted", interlockRequired: true })
  ]
});

export const BALLISTIC_SIDEARM_FIXTURE = createFixture({
  key: "ballistic-sidearm",
  name: "Ballistic Sidearm",
  category: "Sidearm",
  modules: [
    moduleDefinition({ id: "module:ballistic-sidearm.frame", name: "Ballistic Sidearm Frame", role: "Frame", massGrams: 720, bulkMicroUnits: 650, legalClass: "Licensed" }),
    moduleDefinition({
      id: "module:ballistic-sidearm.delivery",
      name: "Ballistic Delivery Assembly",
      role: "DeliveryAssembly",
      tags: ["ballistic", "projectile"],
      massGrams: 380,
      bulkMicroUnits: 260,
      activeThermalLoadMilliwatts: 100,
      capabilities: ["capability.access"],
      resourceRequirements: [ballisticRequirement],
      damageType: "Kinetic",
      deliveryClass: "Projectile",
      rangeMillimeters: 75_000,
      cycleTicks: 5,
      legalClass: "Licensed",
      interlockRequired: true
    }),
    moduleDefinition({ id: "module:ballistic-sidearm.feed", name: "Ballistic Feed System", role: "FeedSystem", massGrams: 140, bulkMicroUnits: 120, legalClass: "Licensed" }),
    moduleDefinition({ id: "module:ballistic-sidearm.magazine", name: "Ballistic Magazine", role: "Magazine", massGrams: 240, bulkMicroUnits: 180, capacity: { kind: "Ammo", units: 12 }, legalClass: "Licensed" }),
    moduleDefinition({ id: "module:ballistic-sidearm.control", name: "Ballistic Trigger Control", role: "Control", massGrams: 90, bulkMicroUnits: 80, legalClass: "Licensed", interlockRequired: true }),
    moduleDefinition({ id: "module:ballistic-sidearm.safety", name: "Ballistic Safety", role: "Safety", massGrams: 70, bulkMicroUnits: 60, legalClass: "Licensed", interlockRequired: true })
  ]
});

export const LASER_CUTTER_FIXTURE = createFixture({
  key: "laser-cutter",
  name: "Laser Cutter",
  category: "ExtractionTool",
  modules: [
    moduleDefinition({ id: "module:laser-cutter.frame", name: "Laser Cutter Frame", role: "Frame", massGrams: 950, bulkMicroUnits: 900 }),
    moduleDefinition({
      id: "module:laser-cutter.emitter",
      name: "Laser Cutter Emitter",
      role: "ToolHead",
      tags: ["beam", "cutting"],
      massGrams: 620,
      bulkMicroUnits: 500,
      continuousPowerMilliwatts: 1_400,
      pulseEnergyMillijoules: 1_200,
      heatPerActionMillijoules: 1_000,
      activeThermalLoadMilliwatts: 1_500,
      capabilities: ["capability.access", "capability.extract"],
      damageType: "Cutting",
      deliveryClass: "Beam",
      rangeMillimeters: 8_000,
      cycleTicks: 10,
      calibrationDefinitions: [outputCalibration()],
      legalClass: "IndustrialOnly",
      interlockRequired: true
    }),
    moduleDefinition({ id: "module:laser-cutter.power", name: "Laser Cutter Power Pack", role: "PowerPack", massGrams: 700, bulkMicroUnits: 550, pulseEnergyMillijoules: 1_800 }),
    moduleDefinition({ id: "module:laser-cutter.thermal", name: "Laser Cutter Thermal Sink", role: "ThermalSink", massGrams: 480, bulkMicroUnits: 420, passiveDissipationMilliwatts: 1_100 })
  ],
  calibrationChoices: [{
    moduleId: "module:laser-cutter.emitter",
    calibrationId: "calibration:output-mode",
    optionId: "calibration-option:standard"
  }]
});

export const SURFACE_EQUIPMENT_FIXTURES = Object.freeze([
  SURVEY_SCANNER_FIXTURE,
  MINING_CUTTER_FIXTURE,
  REPAIR_TOOL_FIXTURE,
  EMP_BREACHER_FIXTURE,
  BALLISTIC_SIDEARM_FIXTURE,
  LASER_CUTTER_FIXTURE
] as const);

export const getSurfaceEquipmentFixture = (fixtureId: string): SurfaceEquipmentFixture | undefined =>
  SURFACE_EQUIPMENT_FIXTURES.find((fixture) => fixture.fixtureId === fixtureId);
