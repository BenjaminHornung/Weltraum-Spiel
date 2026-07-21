import { createStableFixtureId, createUniverseClock, deepFreeze } from "../persistence/index";
import type {
  SchedulerSnapshot,
  SimulationJobDefinition,
  SimulationJobInstance,
  SimulationSchedulerFixture
} from "./types";
import {
  validateSchedulerSnapshot,
  validateSimulationJobDefinition,
  validateSimulationJobInstance
} from "./validation";

const definition = (
  seed: string,
  kind: string,
  priority: SimulationJobDefinition["priority"],
  cadenceTicks: number,
  costUnits: number,
  allowedModes: SimulationJobDefinition["allowedModes"]
): SimulationJobDefinition => validateSimulationJobDefinition({
  definitionId: `simulation-job-definition:${seed}.v1`,
  kind,
  allowedModes,
  cadenceTicks,
  costUnits,
  priority,
  maxCatchUpExecutions: 4,
  payloadSchemaVersion: 1,
  executionPayload: { fixture: seed, neutral: true },
  resultContractVersion: 1,
  dormantWakePolicy: "ExplicitWake"
});

const job = (
  seed: string,
  definitionId: string,
  ownerId: string,
  mode: SimulationJobInstance["mode"],
  nextDueTick: number | null,
  facts: SimulationJobInstance["facts"] = { fixture: seed }
): SimulationJobInstance => validateSimulationJobInstance({
  jobId: `simulation-job:${seed}.0`,
  definitionId,
  ownerId,
  revision: 0,
  mode,
  nextDueTick,
  lastPlannedTick: null,
  lastCompletedTick: null,
  failureCount: 0,
  paused: false,
  cancelled: false,
  facts
});

const fixture = (
  name: SimulationSchedulerFixture["name"],
  fixtureDefinition: SimulationJobDefinition,
  fixtureJob: SimulationJobInstance
): SimulationSchedulerFixture => deepFreeze({ name, definition: fixtureDefinition, job: fixtureJob }) as SimulationSchedulerFixture;

const miningDefinition = definition("mining-background", "mining.background", "Normal", 30, 3, ["Active", "Background"]);
export const MINING_BACKGROUND_SCHEDULER_FIXTURE = fixture(
  "mining-background",
  miningDefinition,
  job(
    "mining-background",
    miningDefinition.definitionId,
    createStableFixtureId("resource-node", "ore-field", 0),
    "Background",
    40,
    { resourceNodeClass: "neutral-ore", schedulerFixture: true }
  )
);

const cargoDefinition = definition("cargo-transfer", "cargo.transfer", "High", 20, 4, ["Active", "Background"]);
export const CARGO_TRANSFER_SCHEDULER_FIXTURE = fixture(
  "cargo-transfer",
  cargoDefinition,
  job(
    "cargo-transfer",
    cargoDefinition.definitionId,
    createStableFixtureId("container", "transfer-source", 0),
    "Background",
    60,
    { transferContract: "neutral", schedulerFixture: true }
  )
);

const surveyDefinition = definition("drone-survey", "drone.survey", "Low", 25, 2, ["Active", "Background"]);
export const DRONE_SURVEY_SCHEDULER_FIXTURE = fixture(
  "drone-survey",
  surveyDefinition,
  job(
    "drone-survey",
    surveyDefinition.definitionId,
    createStableFixtureId("drone", "survey", 0),
    "Background",
    50,
    { surveyContract: "neutral", schedulerFixture: true }
  )
);

const repairDefinition = definition("repair", "repair.check", "Normal", 40, 5, ["Active", "Background"]);
export const REPAIR_SCHEDULER_FIXTURE = fixture(
  "repair",
  repairDefinition,
  job(
    "repair",
    repairDefinition.definitionId,
    createStableFixtureId("ship", "repair", 0),
    "Active",
    80,
    { repairContract: "neutral", schedulerFixture: true }
  )
);

const deadlineDefinition = definition("mission-deadline-check", "mission.deadline-check", "Critical", 10, 1, ["Active", "Background"]);
export const MISSION_DEADLINE_CHECK_SCHEDULER_FIXTURE = fixture(
  "mission-deadline-check",
  deadlineDefinition,
  job(
    "mission-deadline-check",
    deadlineDefinition.definitionId,
    createStableFixtureId("mission", "deadline", 0),
    "Background",
    90,
    { deadlineContract: "neutral", schedulerFixture: true }
  )
);

const attentionDefinition = definition(
  "needs-player-attention",
  "attention.gate",
  "High",
  30,
  2,
  ["Background", "NeedsPlayerAttention"]
);
export const NEEDS_PLAYER_ATTENTION_SCHEDULER_FIXTURE = fixture(
  "needs-player-attention",
  attentionDefinition,
  job(
    "needs-player-attention",
    attentionDefinition.definitionId,
    createStableFixtureId("player", "captain", 0),
    "NeedsPlayerAttention",
    70,
    { attentionReasonCode: "fixture", schedulerFixture: true }
  )
);

const destroyedDefinition = definition("destroyed", "terminal.destroyed", "Critical", 30, 1, ["Background", "Destroyed"]);
export const DESTROYED_SCHEDULER_FIXTURE = fixture(
  "destroyed",
  destroyedDefinition,
  job(
    "destroyed",
    destroyedDefinition.definitionId,
    createStableFixtureId("ship", "destroyed", 0),
    "Destroyed",
    null,
    { terminalReasonCode: "fixture", schedulerFixture: true }
  )
);

const dormantDefinition = definition("dormant-outpost", "outpost.dormant", "Low", 60, 2, ["Background", "Dormant"]);
export const DORMANT_OUTPOST_SCHEDULER_FIXTURE = fixture(
  "dormant-outpost",
  dormantDefinition,
  job(
    "dormant-outpost",
    dormantDefinition.definitionId,
    createStableFixtureId("base", "outpost", 0),
    "Dormant",
    null,
    { outpostClass: "neutral", schedulerFixture: true }
  )
);

export const SIMULATION_SCHEDULER_FIXTURES = deepFreeze([
  MINING_BACKGROUND_SCHEDULER_FIXTURE,
  CARGO_TRANSFER_SCHEDULER_FIXTURE,
  DRONE_SURVEY_SCHEDULER_FIXTURE,
  REPAIR_SCHEDULER_FIXTURE,
  MISSION_DEADLINE_CHECK_SCHEDULER_FIXTURE,
  NEEDS_PLAYER_ATTENTION_SCHEDULER_FIXTURE,
  DESTROYED_SCHEDULER_FIXTURE,
  DORMANT_OUTPOST_SCHEDULER_FIXTURE
]) as readonly SimulationSchedulerFixture[];

export const createSimulationSchedulerFixtureSnapshot = (tick = 100): SchedulerSnapshot =>
  validateSchedulerSnapshot({
    schemaVersion: 1,
    revision: 0,
    universeTime: createUniverseClock(tick),
    definitions: SIMULATION_SCHEDULER_FIXTURES.map((entry) => entry.definition),
    jobs: SIMULATION_SCHEDULER_FIXTURES.map((entry) => entry.job),
    budget: { maxCostUnits: 12 },
    fairness: { windowTicks: 100 },
    resultReceipts: []
  });
