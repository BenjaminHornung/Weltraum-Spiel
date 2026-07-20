import {
  createSimulationTick,
  deepFreeze,
  parseExternalReferenceId,
  parseSiteId,
  type JsonObject
} from "../persistence/index";
import type { MissionDefinition } from "./types";
import { validateMissionDefinition } from "./validation";

const issuer = parseSiteId("site:hestia.contract-office");
const outpost = parseSiteId("site:hestia.outpost-kappa");
const geologySite = parseSiteId("site:hestia.geology-alpha");
const extractionSite = parseSiteId("site:hestia.ore-field-seven");
const relay = parseSiteId("site:hestia.surface-relay-three");
const wreck = parseSiteId("site:hestia.wreck-blackbox");
const hazardZone = parseSiteId("site:hestia.hazard-zone-nine");

const objective = (
  objectiveId: string,
  descriptor: JsonObject,
  prerequisites: readonly string[] = [],
  requirementMode: "Required" | "Optional" = "Required"
): JsonObject => ({
  objectiveId: parseExternalReferenceId(`mission-objective:${objectiveId}`),
  requirementMode,
  hiddenUntilPrerequisitesMet: prerequisites.length > 0,
  prerequisiteObjectiveIds: prerequisites.map((entry) => parseExternalReferenceId(`mission-objective:${entry}`)),
  descriptor
});

const shared = {
  schemaVersion: 1,
  issuerId: issuer,
  eligibilityRequirements: [{ kind: "FactAtLeast", factKey: "license-level", minimum: 1 }],
  failureConditions: [{ kind: "AnyRequiredObjectiveFailed" }],
  rewardDescriptors: [
    { kind: "Resource", resourceId: parseExternalReferenceId("resource:credits"), quantity: 500, currencyLike: true },
    { kind: "ReputationDelta", factionId: parseExternalReferenceId("faction:hestia-survey"), delta: 1 }
  ],
  penaltyDescriptors: [
    { kind: "ReputationDelta", factionId: parseExternalReferenceId("faction:hestia-survey"), delta: -1 }
  ],
  legalityTags: ["civilian"],
  definitionsVersion: "missions-v1"
} as const;

export const HESTIA_GEOLOGICAL_SURVEY = validateMissionDefinition({
  ...shared,
  definitionId: parseExternalReferenceId("mission-definition:hestia-geological-survey"),
  missionKind: "Survey",
  contentKey: "mission.hestia.geological-survey",
  objectiveGraph: {
    mode: "Sequential",
    objectives: [
      objective("survey-reach", { kind: "ReachTarget", targetId: geologySite }),
      objective("survey-samples", { kind: "SurveyTarget", targetId: geologySite, sampleCount: 3 }, ["survey-reach"])
    ]
  },
  expiryPolicy: { kind: "TicksAfterAcceptance", ticks: createSimulationTick(2_400) }
});

export const ORE_EXTRACTION_AND_DELIVERY = validateMissionDefinition({
  ...shared,
  definitionId: parseExternalReferenceId("mission-definition:ore-extraction-delivery"),
  missionKind: "Extraction",
  contentKey: "mission.hestia.ore-extraction-delivery",
  objectiveGraph: {
    mode: "Sequential",
    objectives: [
      objective("ore-reach", { kind: "ReachTarget", targetId: extractionSite }),
      objective(
        "ore-extract",
        { kind: "ExtractResource", resourceId: parseExternalReferenceId("resource:hematite"), quantity: 12 },
        ["ore-reach"]
      ),
      objective(
        "ore-deliver",
        { kind: "DeliverResource", resourceId: parseExternalReferenceId("resource:hematite"), quantity: 12 },
        ["ore-extract"]
      )
    ]
  },
  expiryPolicy: { kind: "None" }
});

export const DAMAGED_SURFACE_RELAY_REPAIR = validateMissionDefinition({
  ...shared,
  definitionId: parseExternalReferenceId("mission-definition:damaged-surface-relay-repair"),
  missionKind: "Repair",
  contentKey: "mission.hestia.damaged-surface-relay-repair",
  objectiveGraph: {
    mode: "ParallelAll",
    objectives: [
      objective("relay-inspect", { kind: "InteractWithTarget", targetId: relay }),
      objective("relay-repair", { kind: "RepairTarget", targetId: relay, requiredAmount: 100 })
    ]
  },
  expiryPolicy: { kind: "None" },
  rewardDescriptors: [
    ...shared.rewardDescriptors,
    { kind: "LicenseUnlock", licenseId: parseExternalReferenceId("license:surface-relay-maintenance") }
  ]
});

export const BLACK_BOX_DATA_CORE_RECOVERY = validateMissionDefinition({
  ...shared,
  definitionId: parseExternalReferenceId("mission-definition:black-box-data-core-recovery"),
  missionKind: "Recovery",
  contentKey: "mission.hestia.black-box-data-core-recovery",
  objectiveGraph: {
    mode: "ParallelAny",
    objectives: [
      objective("recover-primary-core", {
        kind: "RecoverItem",
        itemDefinitionId: parseExternalReferenceId("item-definition:black-box-primary")
      }),
      objective("recover-backup-core", {
        kind: "RecoverItem",
        itemDefinitionId: parseExternalReferenceId("item-definition:black-box-backup")
      })
    ]
  },
  expiryPolicy: { kind: "None" },
  rewardDescriptors: [
    ...shared.rewardDescriptors,
    { kind: "MissionChainUnlock", missionDefinitionId: parseExternalReferenceId("mission-definition:black-box-analysis") }
  ]
});

export const HAZARD_ZONE_ATMOSPHERIC_SAMPLING = validateMissionDefinition({
  ...shared,
  definitionId: parseExternalReferenceId("mission-definition:hazard-zone-atmospheric-sampling"),
  missionKind: "Protection",
  contentKey: "mission.hestia.hazard-zone-atmospheric-sampling",
  objectiveGraph: {
    mode: "Sequential",
    objectives: [
      objective("hazard-reach", { kind: "ReachTarget", targetId: hazardZone }),
      objective("hazard-sample", { kind: "SurveyTarget", targetId: hazardZone, sampleCount: 2 }, ["hazard-reach"]),
      objective(
        "hazard-protect",
        { kind: "ProtectTarget", targetId: hazardZone, untilTick: createSimulationTick(900) },
        ["hazard-sample"],
        "Optional"
      )
    ]
  },
  expiryPolicy: { kind: "TicksAfterAcceptance", ticks: createSimulationTick(1_200) }
});

export const CARGO_COURIER_TO_OUTPOST = validateMissionDefinition({
  ...shared,
  definitionId: parseExternalReferenceId("mission-definition:cargo-courier-outpost"),
  missionKind: "Courier",
  contentKey: "mission.hestia.cargo-courier-outpost",
  objectiveGraph: {
    mode: "Sequential",
    objectives: [
      objective("courier-reach", { kind: "ReachTarget", targetId: outpost }),
      objective(
        "courier-deliver",
        { kind: "DeliverResource", resourceId: parseExternalReferenceId("resource:sealed-cargo"), quantity: 4 },
        ["courier-reach"]
      )
    ]
  },
  expiryPolicy: { kind: "AbsoluteUniverseTick", tick: createSimulationTick(3_600) },
  legalityTags: ["civilian", "sealed-cargo"]
});

export const MISSION_DEFINITION_FIXTURES = deepFreeze([
  HESTIA_GEOLOGICAL_SURVEY,
  ORE_EXTRACTION_AND_DELIVERY,
  DAMAGED_SURFACE_RELAY_REPAIR,
  BLACK_BOX_DATA_CORE_RECOVERY,
  HAZARD_ZONE_ATMOSPHERIC_SAMPLING,
  CARGO_COURIER_TO_OUTPOST
]) as readonly MissionDefinition[];

export const CYCLIC_INVALID_MISSION_DEFINITION = deepFreeze({
  ...shared,
  definitionId: parseExternalReferenceId("mission-definition:cyclic-invalid"),
  missionKind: "Protection",
  contentKey: "mission.invalid.cyclic",
  objectiveGraph: {
    mode: "ParallelAll",
    objectives: [
      objective("cycle-alpha", { kind: "WaitUntilTick", tick: createSimulationTick(1) }, ["cycle-beta"]),
      objective("cycle-beta", { kind: "WaitUntilTick", tick: createSimulationTick(2) }, ["cycle-alpha"])
    ]
  },
  expiryPolicy: { kind: "None" }
});

export const MISSION_FIXTURE_IDS = deepFreeze({
  issuer,
  outpost,
  geologySite,
  extractionSite,
  relay,
  wreck,
  hazardZone
});
