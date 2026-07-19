import {
  createResourceCatalog,
  createResourceContainerDefinition,
  createResourceContainerSnapshot,
  createResourceContainerState,
  createResourceStack,
  createStarterResourceCatalog,
  type ResourceCatalog,
  type ResourceContainerSnapshot,
  type ResourceDefinitionInput,
  type ResourceLegalStatus
} from "../resources/index";
import { createInteractionActorContext, type InteractionActorContext } from "../interaction/index";
import {
  MINING_CUTTER_FIXTURE,
  SURVEY_SCANNER_FIXTURE,
  createInteractionCapabilityProjection,
  deriveSurfaceEquipmentStats,
  evaluateEquipmentSuitReadiness,
  type InteractionCapabilityProjection,
  type SurfaceEquipmentFixture
} from "../surface-equipment/index";
import {
  SUIT_LIFE_SUPPORT_MODES,
  SUIT_SCHEMA_VERSION,
  SUIT_SUBSYSTEM_ROLES,
  createSuitDefinition,
  createSuitEquipmentInterfaceSnapshot,
  createSuitStateSnapshot,
  type SuitDefinition,
  type SuitEquipmentInterfaceSnapshot,
  type SuitStateSnapshot
} from "../suit/index";
import {
  computeEnvironmentSample,
  createRequiredEnvironmentFixtures,
  createRequiredEnvironmentSampleInputs,
  type PlanetaryEnvironmentSample
} from "../planetary-environment/index";
import {
  createSurfaceResourceNodeDefinition,
  createSurfaceResourceNodeState
} from "./core";
import type {
  SurfaceResourceClaimInput,
  SurfaceResourceNodeDefinition,
  SurfaceResourceNodeState
} from "./types";

const ACTOR_ID = "actor_surface_extraction";
const FRAME_ID = "surface-frame:fixture";

const HESTIA_BIOLOGICAL_SAMPLE: ResourceDefinitionInput = {
  resourceId: "sample_hestia_biological",
  displayName: "Hestia Contaminated Biological Sample",
  categoryId: "research_sample",
  massPerUnitKg: 0.1,
  volumePerUnitM3: 0.0002,
  baseValueCredits: 500,
  stackRule: { kind: "Discrete", maxQuantity: 1, splitAllowed: false },
  rarityTier: "Exotic",
  tags: ["biological", "contaminated", "hestia", "research", "sample"],
  hazardFlags: ["biohazard"],
  legalStatus: "ProtectedSample",
  ownershipImplication: "FactionEvidence",
  defaultUse: "research",
  extensions: { "weltraum.surface-extraction": "fixture-v1" }
};

export const createSurfaceExtractionResourceCatalog = (): ResourceCatalog => {
  const starter = createStarterResourceCatalog();
  return createResourceCatalog({
    catalogId: "surface_extraction_fixture_catalog_v1",
    categories: starter.categories,
    resources: [...starter.resources, HESTIA_BIOLOGICAL_SAMPLE],
    extensions: { "weltraum.surface-extraction": "fixture-v1" }
  });
};

export interface SurfaceExtractionSuitFixtureOptions {
  readonly actorId?: string;
  readonly actorIncapacitated?: boolean;
  readonly equipmentBusOnline?: boolean;
  readonly energyMillijoules?: number;
  readonly continuousPowerBudgetMilliwatts?: number;
  readonly pulseEnergyReserveMillijoules?: number;
  readonly thermalDissipationBudgetMilliwatts?: number;
}

export interface SurfaceExtractionSuitFixture {
  readonly definition: SuitDefinition;
  readonly state: SuitStateSnapshot;
  readonly equipmentInterface: SuitEquipmentInterfaceSnapshot;
}

export const createSurfaceExtractionSuitFixture = (
  options: SurfaceExtractionSuitFixtureOptions = {}
): SurfaceExtractionSuitFixture => {
  const actorId = options.actorId ?? ACTOR_ID;
  const actorIncapacitated = options.actorIncapacitated ?? false;
  const equipmentBusOnline = options.equipmentBusOnline ?? true;
  const interfaceId = "interface:primary";
  const definition = createSuitDefinition({
    schemaVersion: SUIT_SCHEMA_VERSION,
    definitionId: "suit-definition:surface-extraction-v1",
    healthMaximumMilliPoints: 10_000,
    oxygenCapacityMilligrams: 20_000,
    energyCapacityMillijoules: 20_000,
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
      continuousPowerBudgetMilliwatts: options.continuousPowerBudgetMilliwatts ?? 20_000,
      pulseEnergyReserveMillijoules: options.pulseEnergyReserveMillijoules ?? 20_000,
      thermalDissipationBudgetMilliwatts: options.thermalDissipationBudgetMilliwatts ?? 20_000,
      revision: 0
    }],
    failSafeModeOnEquipmentBusLoss: "Emergency",
    registryVersion: "suit-registry:surface-extraction-v1",
    algorithmVersion: "suit-algorithm:surface-extraction-v1"
  });
  const health = actorIncapacitated ? 0 : 10_000;
  const state = createSuitStateSnapshot({
    schemaVersion: SUIT_SCHEMA_VERSION,
    stateId: "suit-state:surface-extraction-v1",
    actorId,
    definitionId: definition.definitionId,
    revision: 0,
    tick: 100,
    healthMilliPoints: health,
    healthRepairCeilingMilliPoints: health,
    oxygenMilligrams: 20_000,
    energyMillijoules: options.energyMillijoules ?? 20_000,
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
  return Object.freeze({
    definition,
    state,
    equipmentInterface: createSuitEquipmentInterfaceSnapshot(state, definition)
  });
};

export interface SurfaceExtractionEquipmentFixture {
  readonly fixture: SurfaceEquipmentFixture;
  readonly stats: ReturnType<typeof deriveSurfaceEquipmentStats>;
  readonly readiness: ReturnType<typeof evaluateEquipmentSuitReadiness>;
  readonly projection: InteractionCapabilityProjection;
  readonly actorContext: InteractionActorContext;
}

const equipment = (
  fixture: SurfaceEquipmentFixture,
  suit: SurfaceExtractionSuitFixture,
  actorCapabilities: readonly string[]
): SurfaceExtractionEquipmentFixture => {
  const stats = deriveSurfaceEquipmentStats(fixture.blueprint, fixture.catalog);
  const readiness = evaluateEquipmentSuitReadiness(fixture.blueprint, stats, suit.equipmentInterface);
  const projection = createInteractionCapabilityProjection(fixture.blueprint, stats, readiness);
  const actorContext = createInteractionActorContext({
    actorId: suit.state.actorId,
    revision: 0,
    knownCapabilities: ["capability.access", "capability.extract", "capability.scan"],
    capabilities: actorCapabilities,
    tools: [projection.toolId],
    energyAvailable: suit.state.energyMillijoules,
    resources: [],
    permissions: [],
    legalOverride: false,
    hazardTolerance: 10_000,
    incapacitated: suit.state.actorIncapacitated,
    mode: "surface"
  });
  return Object.freeze({ fixture, stats, readiness, projection, actorContext });
};

export const createSurfaceExtractionEquipmentFixtures = (suit: SurfaceExtractionSuitFixture) => Object.freeze({
  scanner: equipment(SURVEY_SCANNER_FIXTURE, suit, ["capability.access", "capability.scan"]),
  cutter: equipment(MINING_CUTTER_FIXTURE, suit, ["capability.access", "capability.extract"])
});

const environments = (): { readonly earth: PlanetaryEnvironmentSample; readonly hestia: PlanetaryEnvironmentSample } => {
  const profiles = createRequiredEnvironmentFixtures();
  const inputs = createRequiredEnvironmentSampleInputs();
  return Object.freeze({
    earth: computeEnvironmentSample(profiles[2], inputs[2]),
    hestia: computeEnvironmentSample(profiles[4], inputs[4])
  });
};

const container = (
  catalog: ResourceCatalog,
  containerId: string,
  kind: "Suit" | "DroneCargo" | "MiningNodeReservoir",
  options: {
    readonly maxMassKg?: number;
    readonly maxVolumeM3?: number;
    readonly maxStackCount?: number;
    readonly contents?: readonly ReturnType<typeof createResourceStack>[];
    readonly initialContents?: readonly ReturnType<typeof createResourceStack>[];
    readonly blockedHazards?: readonly string[];
  } = {}
): ResourceContainerSnapshot => {
  const definition = createResourceContainerDefinition({
    containerId,
    kind,
    maxMassKg: options.maxMassKg ?? 100_000,
    maxVolumeM3: options.maxVolumeM3 ?? 1_000,
    maxStackCount: options.maxStackCount ?? 20,
    policy: { blockedHazards: options.blockedHazards ?? [] }
  });
  const contents = options.contents ?? [];
  const state = createResourceContainerState({
    containerId,
    revision: 0,
    contents,
    initialContents: options.initialContents ?? contents
  }, catalog);
  return createResourceContainerSnapshot(definition, state, catalog);
};

const reservoir = (
  catalog: ResourceCatalog,
  containerId: string,
  resourceId: string,
  quantity: number,
  grade: string,
  legalStatus: ResourceLegalStatus,
  ownerId?: string,
  depleted = false
): ResourceContainerSnapshot => {
  const stack = createResourceStack({
    stackId: `${containerId}_stack`,
    resourceId,
    quantity,
    grade,
    legalStatus,
    ...(ownerId === undefined ? {} : { ownerId })
  });
  return container(catalog, containerId, "MiningNodeReservoir", {
    contents: depleted ? [] : [stack],
    initialContents: [stack]
  });
};

const node = (
  catalog: ResourceCatalog,
  key: string,
  resourceId: string,
  quantity: number,
  options: {
    readonly method?: "Cutting" | "Sampling" | "Sublimation";
    readonly grade?: string;
    readonly gradeBasisPoints?: number;
    readonly legalStatus?: ResourceLegalStatus;
    readonly ownershipPolicy?: "Unclaimed" | "OwnerOnly" | "PermitOrOwner";
    readonly claim?: SurfaceResourceClaimInput;
    readonly ownerId?: string;
    readonly depleted?: boolean;
    readonly hestia?: boolean;
  } = {}
): { readonly definition: SurfaceResourceNodeDefinition; readonly state: SurfaceResourceNodeState } => {
  const definition = createSurfaceResourceNodeDefinition({
    definitionId: `resource-node-definition:${key}`,
    resourceId,
    extractionMethod: options.method ?? "Cutting",
    requiredCapability: "capability.extract",
    hardnessBasisPoints: 2_100,
    grade: options.grade ?? "industrial",
    gradeBasisPoints: options.gradeBasisPoints ?? 10_000,
    pulseYieldRange: { minimum: 1, maximum: 1 },
    contaminationFactor: options.hestia ? 0.8 : 0,
    dustFactor: resourceId === "ore_iron_silicate" ? 0.25 : 0,
    legality: {
      legalStatus: options.legalStatus ?? "Legal",
      ownershipPolicy: options.ownershipPolicy ?? "Unclaimed"
    },
    environmentRestrictions: options.hestia
      ? { allowedModelStates: ["Valid"], maximumSporeLoad: Number.MAX_SAFE_INTEGER }
      : { allowedModelStates: ["Valid", "Vacuum"] }
  });
  const state = createSurfaceResourceNodeState(definition, {
    nodeId: `resource-node:${key}`,
    surfaceFrameId: FRAME_ID,
    localPosition: { x: key.length, y: 0, z: key.length * -2 },
    revision: 0,
    reservoir: reservoir(
      catalog,
      `reservoir_${key.replaceAll("-", "_")}`,
      resourceId,
      quantity,
      options.grade ?? "industrial",
      options.legalStatus ?? "Legal",
      options.ownerId,
      options.depleted
    ),
    exposureState: "Exposed",
    ...(options.claim === undefined ? {} : { claim: options.claim })
  });
  return Object.freeze({ definition, state });
};

export interface SurfaceExtractionFixtureSet {
  readonly catalog: ResourceCatalog;
  readonly suit: SurfaceExtractionSuitFixture;
  readonly equipment: ReturnType<typeof createSurfaceExtractionEquipmentFixtures>;
  readonly environments: ReturnType<typeof environments>;
  readonly ironSilicateVein: ReturnType<typeof node>;
  readonly waterIceDeposit: ReturnType<typeof node>;
  readonly geologicalSampleCore: ReturnType<typeof node>;
  readonly hestiaContaminatedBiologicalSample: ReturnType<typeof node>;
  readonly claimedIllegalNode: ReturnType<typeof node>;
  readonly depletedNode: ReturnType<typeof node>;
  readonly insufficientSuitContainer: ResourceContainerSnapshot;
  readonly miningDroneContainer: ResourceContainerSnapshot;
  readonly biologicalHazardRejectedContainer: ResourceContainerSnapshot;
  readonly biologicalHazardContainer: ResourceContainerSnapshot;
}

export const createSurfaceExtractionFixtures = (): SurfaceExtractionFixtureSet => {
  const catalog = createSurfaceExtractionResourceCatalog();
  const suit = createSurfaceExtractionSuitFixture();
  return Object.freeze({
    catalog,
    suit,
    equipment: createSurfaceExtractionEquipmentFixtures(suit),
    environments: environments(),
    ironSilicateVein: node(catalog, "iron-silicate-vein", "ore_iron_silicate", 3),
    waterIceDeposit: node(catalog, "water-ice-deposit", "volatile_water_ice", 8, { method: "Sublimation", grade: "pure" }),
    geologicalSampleCore: node(catalog, "geological-sample-core", "sample_geology_core", 1, {
      method: "Sampling", grade: "research", legalStatus: "ProtectedSample"
    }),
    hestiaContaminatedBiologicalSample: node(catalog, "hestia-biological-sample", "sample_hestia_biological", 1, {
      method: "Sampling", grade: "research", legalStatus: "ProtectedSample", hestia: true
    }),
    claimedIllegalNode: node(catalog, "claimed-illegal-node", "ore_iron_silicate", 4, {
      legalStatus: "Illegal",
      ownershipPolicy: "OwnerOnly",
      ownerId: "faction_claimant",
      claim: { claimId: "claim:illegal-node", ownerId: "faction_claimant", extractionAllowedActorIds: [] }
    }),
    depletedNode: node(catalog, "depleted-node", "ore_iron_silicate", 2, { depleted: true }),
    insufficientSuitContainer: container(catalog, "suit_sample_pocket", "Suit", {
      maxMassKg: 0.05,
      maxVolumeM3: 0.0001,
      maxStackCount: 1
    }),
    miningDroneContainer: container(catalog, "mining_drone_hold", "DroneCargo"),
    biologicalHazardRejectedContainer: container(catalog, "drone_general_hold", "DroneCargo", {
      blockedHazards: ["biohazard"]
    }),
    biologicalHazardContainer: container(catalog, "drone_bio_hold", "DroneCargo")
  });
};
