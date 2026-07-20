import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BLACK_BOX_DATA_CORE_RECOVERY,
  CARGO_COURIER_TO_OUTPOST,
  CYCLIC_INVALID_MISSION_DEFINITION,
  DAMAGED_SURFACE_RELAY_REPAIR,
  HAZARD_ZONE_ATMOSPHERIC_SAMPLING,
  HESTIA_GEOLOGICAL_SURVEY,
  MISSION_DEFINITION_FIXTURES,
  MISSION_FIXTURE_IDS,
  ORE_EXTRACTION_AND_DELIVERY,
  abandonMission,
  acceptMission,
  activateMission,
  applyObjectiveProgress,
  claimMissionReward,
  completeMission,
  completeObjective,
  createMissionInstanceSignature,
  createMissionOffer,
  expireMission,
  failMission,
  failObjective,
  objectiveOrder,
  remainingObjectiveProgress,
  skipOptionalObjective,
  validateMissionDefinition,
  type MissionCommandResult,
  type MissionCommandSuccess,
  type MissionDefinition,
  type MissionInstance,
  type MissionProgress,
  type ObjectiveId
} from "../../src/missions/index";
import {
  createMissionTime,
  createUniverseClock,
  parseExternalReferenceId,
  parseMissionId,
  parsePlayerId,
  type JsonObject
} from "../../src/persistence/index";

const ownerId = parsePlayerId("player:mission-tests");
let missionSequence = 0;
let commandSequence = 0;

const commandId = (label: string) =>
  parseExternalReferenceId(`mission-command:${label}.${commandSequence++}`);

const expectSuccess = (result: MissionCommandResult): MissionCommandSuccess => {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`${result.rejection.code}: ${result.rejection.message}`);
  }
  return result;
};

const offer = (
  definition: MissionDefinition,
  facts: JsonObject = { "license-level": 1 },
  atTick = 0
): MissionCommandSuccess =>
  expectSuccess(
    createMissionOffer({
      commandId: commandId("offer"),
      expectedRevision: 0,
      at: createUniverseClock(atTick),
      definition,
      missionId: parseMissionId(`mission:contract.${missionSequence++}`),
      ownerId,
      facts
    })
  );

const accept = (definition: MissionDefinition, instance: MissionInstance, atTick = 10): MissionCommandSuccess =>
  expectSuccess(
    acceptMission({
      commandId: commandId("accept"),
      expectedRevision: instance.revision,
      at: createUniverseClock(atTick),
      definition,
      instance
    })
  );

const activate = (definition: MissionDefinition, instance: MissionInstance, atTick = 20): MissionCommandSuccess =>
  expectSuccess(
    activateMission({
      commandId: commandId("activate"),
      expectedRevision: instance.revision,
      at: createUniverseClock(atTick),
      missionTime: createMissionTime(atTick),
      definition,
      instance
    })
  );

const activeMission = (definition: MissionDefinition): MissionInstance => {
  const offered = offer(definition).instance;
  const accepted = accept(definition, offered).instance;
  return activate(definition, accepted).instance;
};

const progress = (
  definition: MissionDefinition,
  instance: MissionInstance,
  objectiveId: ObjectiveId,
  update: MissionProgress,
  atTick = 30
): MissionCommandSuccess =>
  expectSuccess(
    applyObjectiveProgress({
      commandId: commandId("progress"),
      expectedRevision: instance.revision,
      at: createUniverseClock(atTick),
      definition,
      instance,
      objectiveId,
      progress: update
    })
  );

const completeObjectiveNow = (
  definition: MissionDefinition,
  instance: MissionInstance,
  objectiveId: ObjectiveId,
  atTick = 40
): MissionCommandSuccess =>
  expectSuccess(
    completeObjective({
      commandId: commandId("complete-objective"),
      expectedRevision: instance.revision,
      at: createUniverseClock(atTick),
      definition,
      instance,
      objectiveId
    })
  );

const objectiveIdAt = (definition: MissionDefinition, index: number): ObjectiveId =>
  definition.objectiveGraph.objectives[index].objectiveId;

describe("mission definition validation and graph contracts", () => {
  it("validates all six complete fixtures and freezes them deeply", () => {
    expect(MISSION_DEFINITION_FIXTURES).toHaveLength(6);
    expect(MISSION_DEFINITION_FIXTURES.map((definition) => definition.missionKind)).toEqual([
      "Survey",
      "Extraction",
      "Repair",
      "Recovery",
      "Protection",
      "Courier"
    ]);
    for (const definition of MISSION_DEFINITION_FIXTURES) {
      expect(validateMissionDefinition(definition)).toEqual(definition);
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.isFrozen(definition.objectiveGraph.objectives)).toBe(true);
      expect(Object.isFrozen(definition.rewardDescriptors)).toBe(true);
    }
  });

  it("rejects a cyclic graph fail-closed", () => {
    expect(() => validateMissionDefinition(CYCLIC_INVALID_MISSION_DEFINITION)).toThrowError(
      expect.objectContaining({ code: "OBJECTIVE_CYCLE" })
    );
  });

  it("orders independent objectives deterministically by stable objective ID", () => {
    const original = DAMAGED_SURFACE_RELAY_REPAIR;
    const reversed = validateMissionDefinition({
      ...original,
      objectiveGraph: {
        ...original.objectiveGraph,
        objectives: [...original.objectiveGraph.objectives].reverse()
      }
    });

    expect(objectiveOrder(reversed)).toEqual(objectiveOrder(original));
    expect(objectiveOrder(original)).toEqual([
      parseExternalReferenceId("mission-objective:relay-inspect"),
      parseExternalReferenceId("mission-objective:relay-repair")
    ]);
  });

  it("rejects unknown fields at the definition boundary", () => {
    expect(() =>
      validateMissionDefinition({
        ...HESTIA_GEOLOGICAL_SURVEY,
        playerFacingTitle: "Do not accept this field"
      })
    ).toThrowError(expect.objectContaining({ code: "UNKNOWN_FIELD", path: "/playerFacingTitle" }));
  });
});

describe("mission lifecycle, graph modes, and objective progress", () => {
  it("unlocks a sequential objective only after its prerequisite completes", () => {
    const definition = HESTIA_GEOLOGICAL_SURVEY;
    let instance = activeMission(definition);
    const reachId = objectiveIdAt(definition, 0);
    const surveyId = objectiveIdAt(definition, 1);

    expect(instance.objectiveStates.map((state) => state.state)).toEqual(["Active", "Locked"]);
    instance = progress(definition, instance, reachId, { kind: "Target", targetId: MISSION_FIXTURE_IDS.geologySite }).instance;
    instance = completeObjectiveNow(definition, instance, reachId).instance;
    expect(instance.objectiveStates.map((state) => state.state)).toEqual(["Completed", "Active"]);

    instance = progress(definition, instance, surveyId, { kind: "Target", targetId: MISSION_FIXTURE_IDS.geologySite }).instance;
    instance = progress(definition, instance, surveyId, { kind: "Count", amount: 10 }).instance;
    expect(instance.objectiveStates[1].progress.count).toBe(3);
    expect(remainingObjectiveProgress(definition.objectiveGraph.objectives[1], instance.objectiveStates[1].progress)).toBe(0);
    instance = completeObjectiveNow(definition, instance, surveyId).instance;

    const completed = expectSuccess(
      completeMission({
        commandId: commandId("complete-mission"),
        expectedRevision: instance.revision,
        at: createUniverseClock(100),
        definition,
        instance
      })
    );
    expect(completed.instance.state).toBe("Completed");
    expect(completed.instance.rewardClaimState).toBe("Unclaimed");
  });

  it("requires every ParallelAll objective", () => {
    const definition = DAMAGED_SURFACE_RELAY_REPAIR;
    let instance = activeMission(definition);
    const inspectId = objectiveIdAt(definition, 0);
    const repairId = objectiveIdAt(definition, 1);
    expect(instance.objectiveStates.map((state) => state.state)).toEqual(["Active", "Active"]);

    instance = progress(definition, instance, inspectId, { kind: "Target", targetId: MISSION_FIXTURE_IDS.relay }).instance;
    instance = completeObjectiveNow(definition, instance, inspectId).instance;
    const premature = completeMission({
      commandId: commandId("parallel-all-premature"),
      expectedRevision: instance.revision,
      at: createUniverseClock(50),
      definition,
      instance
    });
    expect(premature).toMatchObject({ ok: false, rejection: { code: "MISSION_REQUIREMENTS_NOT_MET" } });

    instance = progress(definition, instance, repairId, { kind: "Target", targetId: MISSION_FIXTURE_IDS.relay }).instance;
    instance = progress(definition, instance, repairId, { kind: "MeasuredAmount", amount: 150 }).instance;
    expect(instance.objectiveStates[1].progress.measuredAmount).toBe(100);
    instance = completeObjectiveNow(definition, instance, repairId).instance;
    expect(
      completeMission({
        commandId: commandId("parallel-all-complete"),
        expectedRevision: instance.revision,
        at: createUniverseClock(60),
        definition,
        instance
      }).ok
    ).toBe(true);
  });

  it("completes ParallelAny through one branch and skips the other deterministically", () => {
    const definition = BLACK_BOX_DATA_CORE_RECOVERY;
    let instance = activeMission(definition);
    const primaryId = objectiveIdAt(definition, 0);
    const primaryDefinition = definition.objectiveGraph.objectives[0];
    expect(instance.objectiveStates.map((state) => state.state)).toEqual(["Active", "Active"]);
    if (primaryDefinition.descriptor.kind !== "RecoverItem") {
      throw new Error("Unexpected fixture descriptor.");
    }
    instance = progress(definition, instance, primaryId, {
      kind: "Item",
      itemDefinitionId: primaryDefinition.descriptor.itemDefinitionId
    }).instance;
    instance = completeObjectiveNow(definition, instance, primaryId).instance;
    expect(instance.objectiveStates.map((state) => state.state)).toEqual(["Completed", "Skipped"]);
    expect(
      completeMission({
        commandId: commandId("parallel-any-complete"),
        expectedRevision: instance.revision,
        at: createUniverseClock(70),
        definition,
        instance
      }).ok
    ).toBe(true);
  });

  it("allows an Optional objective to be skipped explicitly", () => {
    const definition = HAZARD_ZONE_ATMOSPHERIC_SAMPLING;
    let instance = activeMission(definition);
    const reachId = objectiveIdAt(definition, 0);
    const sampleId = objectiveIdAt(definition, 1);
    const optionalId = objectiveIdAt(definition, 2);
    instance = progress(definition, instance, reachId, { kind: "Target", targetId: MISSION_FIXTURE_IDS.hazardZone }).instance;
    instance = completeObjectiveNow(definition, instance, reachId).instance;
    instance = progress(definition, instance, sampleId, { kind: "Target", targetId: MISSION_FIXTURE_IDS.hazardZone }).instance;
    instance = progress(definition, instance, sampleId, { kind: "Count", amount: 2 }).instance;
    instance = completeObjectiveNow(definition, instance, sampleId).instance;
    expect(instance.objectiveStates[2].state).toBe("Active");
    instance = expectSuccess(
      skipOptionalObjective({
        commandId: commandId("skip-optional"),
        expectedRevision: instance.revision,
        at: createUniverseClock(80),
        definition,
        instance,
        objectiveId: optionalId
      })
    ).instance;
    expect(instance.objectiveStates[2].state).toBe("Skipped");
    expect(
      completeMission({
        commandId: commandId("optional-complete"),
        expectedRevision: instance.revision,
        at: createUniverseClock(81),
        definition,
        instance
      }).ok
    ).toBe(true);
  });

  it("refreshes sequential availability after a non-terminal objective failure", () => {
    const definition = validateMissionDefinition({
      ...HESTIA_GEOLOGICAL_SURVEY,
      objectiveGraph: {
        mode: "Sequential",
        objectives: [
          { ...HESTIA_GEOLOGICAL_SURVEY.objectiveGraph.objectives[0], requirementMode: "Optional" },
          {
            ...HESTIA_GEOLOGICAL_SURVEY.objectiveGraph.objectives[1],
            hiddenUntilPrerequisitesMet: false,
            prerequisiteObjectiveIds: []
          }
        ]
      }
    });
    const active = activeMission(definition);
    expect(active.objectiveStates.map((state) => state.state)).toEqual(["Active", "Locked"]);

    const result = expectSuccess(
      failObjective({
        commandId: commandId("optional-failure-advances-sequence"),
        expectedRevision: active.revision,
        at: createUniverseClock(30),
        definition,
        instance: active,
        objectiveId: objectiveIdAt(definition, 0),
        reasonCode: parseExternalReferenceId("mission-reason:optional-objective-failed")
      })
    );

    expect(result.instance.state).toBe("Active");
    expect(result.instance.objectiveStates.map((state) => state.state)).toEqual(["Failed", "Active"]);
    expect(result.outcomeIntents).toEqual([]);
  });

  it("enforces eligibility and explicit expiry", () => {
    const ineligible = offer(HESTIA_GEOLOGICAL_SURVEY, { "license-level": 0 }).instance;
    expect(
      acceptMission({
        commandId: commandId("ineligible"),
        expectedRevision: ineligible.revision,
        at: createUniverseClock(10),
        definition: HESTIA_GEOLOGICAL_SURVEY,
        instance: ineligible
      })
    ).toMatchObject({ ok: false, rejection: { code: "ELIGIBILITY_FAILED" } });

    let expiring = offer(HESTIA_GEOLOGICAL_SURVEY).instance;
    expiring = accept(HESTIA_GEOLOGICAL_SURVEY, expiring, 100).instance;
    expect(expiring.expiry?.tick).toBe(2_500);
    expect(
      expireMission({
        commandId: commandId("early-expiry"),
        expectedRevision: expiring.revision,
        at: createUniverseClock(2_499),
        definition: HESTIA_GEOLOGICAL_SURVEY,
        instance: expiring
      })
    ).toMatchObject({ ok: false, rejection: { code: "EXPIRY_NOT_REACHED" } });
    expect(
      expireMission({
        commandId: commandId("expiry"),
        expectedRevision: expiring.revision,
        at: createUniverseClock(2_500),
        definition: HESTIA_GEOLOGICAL_SURVEY,
        instance: expiring
      })
    ).toMatchObject({ ok: true, instance: { state: "Expired" } });
  });

  it("tracks resource quantity, clamps over-completion, and rejects identity mismatch", () => {
    const definition = ORE_EXTRACTION_AND_DELIVERY;
    let instance = activeMission(definition);
    const reachId = objectiveIdAt(definition, 0);
    const extractId = objectiveIdAt(definition, 1);
    instance = progress(definition, instance, reachId, { kind: "Target", targetId: MISSION_FIXTURE_IDS.extractionSite }).instance;
    instance = completeObjectiveNow(definition, instance, reachId).instance;

    const mismatch = applyObjectiveProgress({
      commandId: commandId("resource-mismatch"),
      expectedRevision: instance.revision,
      at: createUniverseClock(30),
      definition,
      instance,
      objectiveId: extractId,
      progress: { kind: "ResourceQuantity", resourceId: parseExternalReferenceId("resource:ice"), quantity: 1 }
    });
    expect(mismatch).toMatchObject({ ok: false, rejection: { code: "RESOURCE_MISMATCH" } });

    instance = progress(definition, instance, extractId, {
      kind: "ResourceQuantity",
      resourceId: parseExternalReferenceId("resource:hematite"),
      quantity: 50
    }).instance;
    expect(instance.objectiveStates[1].progress.resourceQuantity).toBe(12);
    expect(remainingObjectiveProgress(definition.objectiveGraph.objectives[1], instance.objectiveStates[1].progress)).toBe(0);
  });

  it("rejects target mismatch without mutating the mission", () => {
    const definition = HESTIA_GEOLOGICAL_SURVEY;
    const instance = activeMission(definition);
    const before = JSON.stringify(instance);
    const result = applyObjectiveProgress({
      commandId: commandId("target-mismatch"),
      expectedRevision: instance.revision,
      at: createUniverseClock(30),
      definition,
      instance,
      objectiveId: objectiveIdAt(definition, 0),
      progress: { kind: "Target", targetId: MISSION_FIXTURE_IDS.outpost }
    });
    expect(result).toMatchObject({ ok: false, rejection: { code: "TARGET_MISMATCH" } });
    expect(JSON.stringify(instance)).toBe(before);
  });

  it("rejects non-finite progress as a typed command error without throwing or mutating", () => {
    const definition = HESTIA_GEOLOGICAL_SURVEY;
    const instance = activeMission(definition);
    const before = JSON.stringify(instance);
    const result = applyObjectiveProgress({
      commandId: commandId("non-finite-progress"),
      expectedRevision: instance.revision,
      at: createUniverseClock(30),
      definition,
      instance,
      objectiveId: objectiveIdAt(definition, 0),
      progress: { kind: "Count", amount: Number.POSITIVE_INFINITY }
    });

    expect(result).toMatchObject({ ok: false, rejection: { code: "INVALID_COMMAND", path: "/command" } });
    expect(JSON.stringify(instance)).toBe(before);
  });
});

describe("CAS, replay, terminal transitions, events, and intents", () => {
  it("rejects stale CAS, returns an identical immediate replay, and rejects conflicting replay", () => {
    const offered = offer(HESTIA_GEOLOGICAL_SURVEY).instance;
    const command = {
      commandId: commandId("replay-accept"),
      expectedRevision: offered.revision,
      at: createUniverseClock(10),
      definition: HESTIA_GEOLOGICAL_SURVEY,
      instance: offered
    } as const;
    const first = expectSuccess(acceptMission(command));
    const replay = acceptMission({ ...command, instance: first.instance });
    expect(replay).toEqual(first);
    expect(JSON.stringify(replay)).toBe(JSON.stringify(first));

    const conflict = acceptMission({ ...command, at: createUniverseClock(11), instance: first.instance });
    expect(conflict).toMatchObject({ ok: false, rejection: { code: "CONFLICTING_REPLAY" } });

    const stale = activateMission({
      commandId: commandId("stale-cas"),
      expectedRevision: offered.revision,
      at: createUniverseClock(20),
      missionTime: createMissionTime(20),
      definition: HESTIA_GEOLOGICAL_SURVEY,
      instance: first.instance
    });
    expect(stale).toMatchObject({ ok: false, rejection: { code: "REVISION_CONFLICT" } });

    const crossRevisionIdentity = activateMission({
      commandId: command.commandId,
      expectedRevision: first.instance.revision,
      at: createUniverseClock(20),
      missionTime: createMissionTime(20),
      definition: HESTIA_GEOLOGICAL_SURVEY,
      instance: first.instance
    });
    expect(crossRevisionIdentity).toMatchObject({ ok: false, rejection: { code: "CONFLICTING_REPLAY" } });
  });

  it("pins the complete validated definition against reward and graph drift", () => {
    const offered = offer(HESTIA_GEOLOGICAL_SURVEY).instance;
    const drifted = validateMissionDefinition({
      ...HESTIA_GEOLOGICAL_SURVEY,
      rewardDescriptors: [
        ...HESTIA_GEOLOGICAL_SURVEY.rewardDescriptors,
        { kind: "Resource", resourceId: "resource:credits", quantity: 999_999, currencyLike: true }
      ]
    });
    expect(
      acceptMission({
        commandId: commandId("definition-drift"),
        expectedRevision: offered.revision,
        at: createUniverseClock(10),
        definition: drifted,
        instance: offered
      })
    ).toMatchObject({ ok: false, rejection: { code: "INVALID_DEFINITION" } });
  });

  it("requires explicit expiry or failure transitions once time policies are reached", () => {
    let expiring = offer(HESTIA_GEOLOGICAL_SURVEY).instance;
    expiring = accept(HESTIA_GEOLOGICAL_SURVEY, expiring, 100).instance;
    expect(
      activateMission({
        commandId: commandId("post-expiry-activate"),
        expectedRevision: expiring.revision,
        at: createUniverseClock(2_500),
        missionTime: createMissionTime(2_500),
        definition: HESTIA_GEOLOGICAL_SURVEY,
        instance: expiring
      })
    ).toMatchObject({ ok: false, rejection: { code: "EXPIRY_REQUIRED" } });
    expect(
      expireMission({
        commandId: commandId("required-expiry"),
        expectedRevision: expiring.revision,
        at: createUniverseClock(2_500),
        definition: HESTIA_GEOLOGICAL_SURVEY,
        instance: expiring
      })
    ).toMatchObject({ ok: true, instance: { state: "Expired" } });

    const timedDefinition = validateMissionDefinition({
      ...ORE_EXTRACTION_AND_DELIVERY,
      failureConditions: [{ kind: "UniverseTickReached", tick: 25 }]
    });
    const timed = activeMission(timedDefinition);
    expect(
      applyObjectiveProgress({
        commandId: commandId("post-failure-progress"),
        expectedRevision: timed.revision,
        at: createUniverseClock(25),
        definition: timedDefinition,
        instance: timed,
        objectiveId: objectiveIdAt(timedDefinition, 0),
        progress: { kind: "Target", targetId: MISSION_FIXTURE_IDS.extractionSite }
      })
    ).toMatchObject({ ok: false, rejection: { code: "FAILURE_CONDITION_REACHED" } });
    expect(
      failMission({
        commandId: commandId("required-time-failure"),
        expectedRevision: timed.revision,
        at: createUniverseClock(25),
        definition: timedDefinition,
        instance: timed,
        reasonCode: parseExternalReferenceId("mission-reason:time-condition")
      })
    ).toMatchObject({ ok: true, instance: { state: "Failed" } });

    const earlierFailureDefinition = validateMissionDefinition({
      ...HESTIA_GEOLOGICAL_SURVEY,
      failureConditions: [{ kind: "UniverseTickReached", tick: 1_000 }]
    });
    let earlierFailure = offer(earlierFailureDefinition).instance;
    earlierFailure = accept(earlierFailureDefinition, earlierFailure, 100).instance;
    expect(earlierFailure.expiry?.tick).toBe(2_500);
    expect(
      expireMission({
        commandId: commandId("earlier-failure-blocks-later-expiry"),
        expectedRevision: earlierFailure.revision,
        at: createUniverseClock(2_500),
        definition: earlierFailureDefinition,
        instance: earlierFailure
      })
    ).toMatchObject({ ok: false, rejection: { code: "FAILURE_CONDITION_REACHED" } });
    expect(
      failMission({
        commandId: commandId("earlier-failure-transition"),
        expectedRevision: earlierFailure.revision,
        at: createUniverseClock(2_500),
        definition: earlierFailureDefinition,
        instance: earlierFailure,
        reasonCode: parseExternalReferenceId("mission-reason:earlier-time-condition")
      })
    ).toMatchObject({ ok: true, instance: { state: "Failed" } });

    const offeredDefinition = validateMissionDefinition({
      ...HESTIA_GEOLOGICAL_SURVEY,
      expiryPolicy: { kind: "AbsoluteUniverseTick", tick: 2_500 },
      failureConditions: [{ kind: "UniverseTickReached", tick: 1_000 }]
    });
    const offeredWithEarlierFailure = offer(offeredDefinition).instance;
    expect(offeredWithEarlierFailure.expiry?.tick).toBe(2_500);
    expect(
      expireMission({
        commandId: commandId("offered-expiry-after-earlier-failure"),
        expectedRevision: offeredWithEarlierFailure.revision,
        at: createUniverseClock(2_500),
        definition: offeredDefinition,
        instance: offeredWithEarlierFailure
      })
    ).toMatchObject({ ok: true, instance: { state: "Expired" } });

    const collisionDefinition = validateMissionDefinition({
      ...HESTIA_GEOLOGICAL_SURVEY,
      failureConditions: [{ kind: "UniverseTickReached", tick: 2_500 }]
    });
    let collision = offer(collisionDefinition).instance;
    collision = accept(collisionDefinition, collision, 100).instance;
    expect(collision.expiry?.tick).toBe(2_500);
    expect(
      expireMission({
        commandId: commandId("collision-expiry-precedence"),
        expectedRevision: collision.revision,
        at: createUniverseClock(2_500),
        definition: collisionDefinition,
        instance: collision
      })
    ).toMatchObject({ ok: true, instance: { state: "Expired" } });
  });

  it("derives bounded persistent event IDs for maximum-length mission IDs", () => {
    const result = createMissionOffer({
      commandId: commandId("maximum-mission-id"),
      expectedRevision: 0,
      at: createUniverseClock(0),
      definition: HESTIA_GEOLOGICAL_SURVEY,
      missionId: parseMissionId(`mission:${"a".repeat(120)}`),
      ownerId,
      facts: { "license-level": 1 }
    });
    const created = expectSuccess(result);
    expect(created.eventIntents[0].eventId.length).toBeLessThanOrEqual(128);
  });

  it("supports failure and abandonment with penalty intents", () => {
    let failed = activeMission(DAMAGED_SURFACE_RELAY_REPAIR);
    const failedResult = expectSuccess(
      failObjective({
        commandId: commandId("fail-objective"),
        expectedRevision: failed.revision,
        at: createUniverseClock(100),
        definition: DAMAGED_SURFACE_RELAY_REPAIR,
        instance: failed,
        objectiveId: objectiveIdAt(DAMAGED_SURFACE_RELAY_REPAIR, 0),
        reasonCode: parseExternalReferenceId("mission-reason:relay-inaccessible")
      })
    );
    failed = failedResult.instance;
    expect(failed.state).toBe("Failed");
    expect(failedResult.outcomeIntents.every((intent) => intent.disposition === "Penalty")).toBe(true);

    const active = activeMission(CARGO_COURIER_TO_OUTPOST);
    const abandoned = expectSuccess(
      abandonMission({
        commandId: commandId("abandon"),
        expectedRevision: active.revision,
        at: createUniverseClock(200),
        definition: CARGO_COURIER_TO_OUTPOST,
        instance: active,
        reasonCode: parseExternalReferenceId("mission-reason:player-abandoned")
      })
    );
    expect(abandoned.instance.state).toBe("Abandoned");
    expect(abandoned.instance.abandonReason).toBe("mission-reason:player-abandoned");
  });

  it("supports explicit mission failure", () => {
    const active = activeMission(ORE_EXTRACTION_AND_DELIVERY);
    const failed = failMission({
      commandId: commandId("fail-mission"),
      expectedRevision: active.revision,
      at: createUniverseClock(90),
      definition: ORE_EXTRACTION_AND_DELIVERY,
      instance: active,
      reasonCode: parseExternalReferenceId("mission-reason:contract-breach")
    });
    expect(failed).toMatchObject({ ok: true, instance: { state: "Failed", failureReason: "mission-reason:contract-breach" } });
  });

  it("claims reward intents exactly once and rejects later terminal progress", () => {
    const definition = BLACK_BOX_DATA_CORE_RECOVERY;
    let instance = activeMission(definition);
    const objectiveId = objectiveIdAt(definition, 0);
    const descriptor = definition.objectiveGraph.objectives[0].descriptor;
    if (descriptor.kind !== "RecoverItem") {
      throw new Error("Unexpected fixture descriptor.");
    }
    instance = progress(definition, instance, objectiveId, {
      kind: "Item",
      itemDefinitionId: descriptor.itemDefinitionId
    }).instance;
    instance = completeObjectiveNow(definition, instance, objectiveId).instance;
    instance = expectSuccess(
      completeMission({
        commandId: commandId("reward-complete"),
        expectedRevision: instance.revision,
        at: createUniverseClock(100),
        definition,
        instance
      })
    ).instance;

    const claimCommand = {
      commandId: commandId("claim"),
      expectedRevision: instance.revision,
      at: createUniverseClock(110),
      definition,
      instance
    } as const;
    const claimed = expectSuccess(claimMissionReward(claimCommand));
    expect(claimed.instance.state).toBe("RewardClaimed");
    expect(claimed.instance.rewardClaimState).toBe("Claimed");
    expect(claimed.outcomeIntents).toHaveLength(definition.rewardDescriptors.length);
    expect(claimed.outcomeIntents.every((intent) => intent.disposition === "Reward")).toBe(true);
    expect(claimMissionReward({ ...claimCommand, instance: claimed.instance })).toEqual(claimed);

    expect(
      applyObjectiveProgress({
        commandId: commandId("terminal-progress"),
        expectedRevision: claimed.instance.revision,
        at: createUniverseClock(120),
        definition,
        instance: claimed.instance,
        objectiveId,
        progress: { kind: "Item", itemDefinitionId: descriptor.itemDefinitionId }
      })
    ).toMatchObject({ ok: false, rejection: { code: "MISSION_TERMINAL" } });

    expect(
      claimMissionReward({
        commandId: commandId("claim-again"),
        expectedRevision: claimed.instance.revision,
        at: createUniverseClock(121),
        definition,
        instance: claimed.instance
      })
    ).toMatchObject({ ok: false, rejection: { code: "REWARD_NOT_AVAILABLE" } });
  });

  it("returns validated persistent event intents with equal signatures for equal execution", () => {
    const first = offer(HESTIA_GEOLOGICAL_SURVEY, { "license-level": 1, "survey-rank": 2 }, 5);
    missionSequence -= 1;
    commandSequence -= 1;
    const second = offer(HESTIA_GEOLOGICAL_SURVEY, { "survey-rank": 2, "license-level": 1 }, 5);
    expect(first.instance.signature).toBe(second.instance.signature);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.eventIntents).toHaveLength(1);
    expect(first.eventIntents[0]).toMatchObject({
      type: "NeedsPlayerAttention",
      sourceId: HESTIA_GEOLOGICAL_SURVEY.issuerId,
      targetId: ownerId,
      status: "Pending"
    });
    expect(Object.isFrozen(first.eventIntents[0])).toBe(true);
    expect(createMissionInstanceSignature(first.instance)).toBe(first.instance.signature);
  });

  it("keeps inputs unchanged and freezes accepted results recursively", () => {
    const facts = { "license-level": 1, nested: { proof: true } };
    const before = JSON.stringify(facts);
    const created = offer(HESTIA_GEOLOGICAL_SURVEY, facts);
    expect(JSON.stringify(facts)).toBe(before);
    expect(Object.isFrozen(created)).toBe(true);
    expect(Object.isFrozen(created.instance)).toBe(true);
    expect(Object.isFrozen(created.instance.objectiveStates)).toBe(true);
    expect(Object.isFrozen(created.instance.objectiveStates[0].progress.facts)).toBe(true);
    expect(Object.isFrozen(created.eventIntents)).toBe(true);
  });
});

describe("pure-domain dependency guard", () => {
  it("contains no ambient Date, Random, DOM, Three.js, or forbidden subsystem imports", () => {
    const missionDir = path.resolve(process.cwd(), "src/missions");
    const files = ["types.ts", "validation.ts", "core.ts", "fixtures.ts", "index.ts"];
    const source = files.map((file) => readFileSync(path.join(missionDir, file), "utf8")).join("\n");
    expect(source).not.toMatch(/\bDate\b|Math\.random|\bdocument\b|\bwindow\b|from\s+["']three["']/);
    expect(source).not.toMatch(/\.\.\/(resources|cargo|world|navigation|interaction|suit)\//);
    expect(source.match(/\.\.\/persistence\/index/g)?.length).toBeGreaterThanOrEqual(1);
  });
});
