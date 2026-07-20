import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const evidenceDir = path.resolve(process.cwd(), "evidence");
const summaryPath = path.join(evidenceDir, "browser-mission-contract-framework-core-v1-summary.json");
const markdownPath = path.join(evidenceDir, "browser-mission-contract-framework-core-v1.md");
const modulePath = "/src/missions/index.ts" as const;

interface BrowserHealth {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly requestFailures: string[];
  readonly httpErrors: string[];
}

interface BrowserMissionInstance {
  readonly revision: number;
  readonly state: string;
  readonly signature: string;
  readonly rewardClaimState: string;
  readonly expiry: { readonly tick: number } | null;
  readonly objectiveStates: readonly {
    readonly objectiveId: string;
    readonly state: string;
    readonly progress: {
      readonly count: number;
      readonly resourceQuantity: number;
    };
  }[];
}

interface BrowserMissionSuccess {
  readonly ok: true;
  readonly instance: BrowserMissionInstance;
  readonly eventIntents: readonly { readonly eventId: string; readonly type: string }[];
  readonly outcomeIntents: readonly { readonly disposition: string; readonly descriptor: { readonly kind: string } }[];
}

interface BrowserMissionModule {
  readonly MISSION_DEFINITION_FIXTURES: readonly {
    readonly definitionId: string;
    readonly contentKey: string;
    readonly missionKind: string;
    readonly objectiveGraph: { readonly objectives: readonly { readonly objectiveId: string; readonly descriptor: Record<string, unknown> }[] };
  }[];
  readonly HESTIA_GEOLOGICAL_SURVEY: BrowserMissionModule["MISSION_DEFINITION_FIXTURES"][number];
  readonly ORE_EXTRACTION_AND_DELIVERY: BrowserMissionModule["MISSION_DEFINITION_FIXTURES"][number];
  readonly CARGO_COURIER_TO_OUTPOST: BrowserMissionModule["MISSION_DEFINITION_FIXTURES"][number];
  readonly MISSION_FIXTURE_IDS: Readonly<Record<string, string>>;
  readonly createMissionOffer: (command: Record<string, unknown>) => BrowserMissionSuccess | { readonly ok: false };
  readonly acceptMission: (command: Record<string, unknown>) => BrowserMissionSuccess | { readonly ok: false };
  readonly activateMission: (command: Record<string, unknown>) => BrowserMissionSuccess | { readonly ok: false };
  readonly applyObjectiveProgress: (command: Record<string, unknown>) => BrowserMissionSuccess | { readonly ok: false };
  readonly completeObjective: (command: Record<string, unknown>) => BrowserMissionSuccess | { readonly ok: false };
  readonly completeMission: (command: Record<string, unknown>) => BrowserMissionSuccess | { readonly ok: false };
  readonly expireMission: (command: Record<string, unknown>) => BrowserMissionSuccess | { readonly ok: false };
  readonly claimMissionReward: (command: Record<string, unknown>) => BrowserMissionSuccess | { readonly ok: false };
}

interface ScenarioRun {
  readonly fixtureCount: number;
  readonly fixtureDefinitionIds: readonly string[];
  readonly survey: {
    readonly finalState: string;
    readonly rewardClaimState: string;
    readonly signature: string;
    readonly objectiveStates: readonly string[];
    readonly eventIntentCount: number;
    readonly rewardIntentKinds: readonly string[];
  };
  readonly extractionDelivery: {
    readonly finalState: string;
    readonly signature: string;
    readonly objectiveStates: readonly string[];
    readonly extractedQuantity: number;
    readonly deliveredQuantity: number;
  };
  readonly expiry: {
    readonly finalState: string;
    readonly expiryTick: number | null;
    readonly penaltyIntentCount: number;
  };
}

interface MissionEvidence {
  readonly schemaVersion: 1;
  readonly feature: "browser-mission-contract-framework-core-v1";
  readonly route: "/";
  readonly testBridgeAbsent: true;
  readonly modulePath: typeof modulePath;
  readonly fixtureCount: 6;
  readonly fixtureDefinitionIds: readonly string[];
  readonly survey: ScenarioRun["survey"];
  readonly extractionDelivery: ScenarioRun["extractionDelivery"];
  readonly expiry: ScenarioRun["expiry"];
  readonly deterministicRepeat: {
    readonly byteIdentical: true;
    readonly firstBytes: number;
    readonly secondBytes: number;
  };
  readonly health: {
    readonly consoleErrors: 0;
    readonly pageErrors: 0;
    readonly requestFailures: 0;
    readonly httpErrors: 0;
  };
  readonly status: "PASS";
}

const installHealthCollector = (page: Page): BrowserHealth => {
  const health: BrowserHealth = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on("console", (message) => {
    if (message.type() === "error") {
      health.consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => health.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    health.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      health.httpErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  return health;
};

const createMarkdown = (evidence: MissionEvidence): string => `# Browser Mission Contract Framework Core v1 Evidence

Status: **${evidence.status}**

## Browser contract

- Route: \`${evidence.route}\`
- TestBridge absent: \`${evidence.testBridgeAbsent}\`
- Dynamic module import: \`${evidence.modulePath}\`
- Complete fixtures: \`${evidence.fixtureCount}\`
- Browser health (console/page/request/HTTP): \`${evidence.health.consoleErrors}/${evidence.health.pageErrors}/${evidence.health.requestFailures}/${evidence.health.httpErrors}\`
- Screenshots: \`none (no visual or UI contract)\`

## Deterministic mission runs

- Survey terminal state: \`${evidence.survey.finalState}\`
- Survey reward state: \`${evidence.survey.rewardClaimState}\`
- Survey objective states: \`${evidence.survey.objectiveStates.join(" -> ")}\`
- Survey persistent event intents: \`${evidence.survey.eventIntentCount}\`
- Extraction/delivery terminal state: \`${evidence.extractionDelivery.finalState}\`
- Extraction/delivery quantities: \`${evidence.extractionDelivery.extractedQuantity}/${evidence.extractionDelivery.deliveredQuantity}\`
- Expiry state/tick: \`${evidence.expiry.finalState}/${evidence.expiry.expiryTick}\`
- Complete scenario byte-identical twice: \`${evidence.deterministicRepeat.byteIdentical}\`
- First/second byte length: \`${evidence.deterministicRepeat.firstBytes}/${evidence.deterministicRepeat.secondBytes}\`

## Scope guard

This evidence exercises mission definitions, instances, objective graphs, CAS commands, typed progress, completion, expiry, persistent event intents, and reward/penalty intents only. It performs no UI, economy, cargo, faction, world, navigation, interaction, suit, or persistence-queue mutation.
`;

test("normal route proves the deterministic mission contract framework core", async ({ page }) => {
  const health = installHealthCollector(page);
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await page.waitForLoadState("networkidle");

  const guard = await page.evaluate(() => ({
    route: location.pathname,
    testBridgeAbsent: !("TestBridge" in window) && !Object.prototype.hasOwnProperty.call(window, "TestBridge")
  }));
  expect(guard).toEqual({ route: "/", testBridgeAbsent: true });

  const repeated = await page.evaluate(async (missionModulePath): Promise<{ readonly first: ScenarioRun; readonly second: ScenarioRun }> => {
    const domain = (await import(missionModulePath)) as unknown as BrowserMissionModule;
    const time = (tick: number) => ({ tick, epochSeconds: tick / 120 });
    const missionTime = (tick: number) => ({ tick });
    const unwrap = (result: ReturnType<BrowserMissionModule["createMissionOffer"]>): BrowserMissionSuccess => {
      if (!result.ok) {
        throw new Error("Mission scenario command was rejected.");
      }
      return result;
    };

    const runScenario = (): ScenarioRun => {
      let eventIntentCount = 0;
      const execute = (result: ReturnType<BrowserMissionModule["createMissionOffer"]>): BrowserMissionSuccess => {
        const accepted = unwrap(result);
        eventIntentCount += accepted.eventIntents.length;
        return accepted;
      };
      const base = (commandId: string, expectedRevision: number, tick: number) => ({
        commandId: `mission-command:${commandId}`,
        expectedRevision,
        at: time(tick)
      });

      const surveyDefinition = domain.HESTIA_GEOLOGICAL_SURVEY;
      const surveyObjectives = surveyDefinition.objectiveGraph.objectives;
      let survey = execute(
        domain.createMissionOffer({
          ...base("survey-offer", 0, 0),
          definition: surveyDefinition,
          missionId: "mission:evidence.survey",
          ownerId: "player:evidence",
          facts: { "license-level": 1 }
        })
      ).instance;
      survey = execute(domain.acceptMission({ ...base("survey-accept", survey.revision, 10), definition: surveyDefinition, instance: survey })).instance;
      survey = execute(
        domain.activateMission({
          ...base("survey-activate", survey.revision, 20),
          missionTime: missionTime(20),
          definition: surveyDefinition,
          instance: survey
        })
      ).instance;
      survey = execute(
        domain.applyObjectiveProgress({
          ...base("survey-reach-progress", survey.revision, 30),
          definition: surveyDefinition,
          instance: survey,
          objectiveId: surveyObjectives[0].objectiveId,
          progress: { kind: "Target", targetId: domain.MISSION_FIXTURE_IDS.geologySite }
        })
      ).instance;
      survey = execute(
        domain.completeObjective({
          ...base("survey-reach-complete", survey.revision, 31),
          definition: surveyDefinition,
          instance: survey,
          objectiveId: surveyObjectives[0].objectiveId
        })
      ).instance;
      survey = execute(
        domain.applyObjectiveProgress({
          ...base("survey-target", survey.revision, 40),
          definition: surveyDefinition,
          instance: survey,
          objectiveId: surveyObjectives[1].objectiveId,
          progress: { kind: "Target", targetId: domain.MISSION_FIXTURE_IDS.geologySite }
        })
      ).instance;
      survey = execute(
        domain.applyObjectiveProgress({
          ...base("survey-count", survey.revision, 41),
          definition: surveyDefinition,
          instance: survey,
          objectiveId: surveyObjectives[1].objectiveId,
          progress: { kind: "Count", amount: 3 }
        })
      ).instance;
      survey = execute(
        domain.completeObjective({
          ...base("survey-complete", survey.revision, 42),
          definition: surveyDefinition,
          instance: survey,
          objectiveId: surveyObjectives[1].objectiveId
        })
      ).instance;
      survey = execute(
        domain.completeMission({ ...base("survey-mission-complete", survey.revision, 43), definition: surveyDefinition, instance: survey })
      ).instance;
      const surveyClaim = execute(
        domain.claimMissionReward({ ...base("survey-reward", survey.revision, 44), definition: surveyDefinition, instance: survey })
      );
      survey = surveyClaim.instance;

      const extractionDefinition = domain.ORE_EXTRACTION_AND_DELIVERY;
      const extractionObjectives = extractionDefinition.objectiveGraph.objectives;
      let extraction = execute(
        domain.createMissionOffer({
          ...base("ore-offer", 0, 0),
          definition: extractionDefinition,
          missionId: "mission:evidence.ore",
          ownerId: "player:evidence",
          facts: { "license-level": 1 }
        })
      ).instance;
      extraction = execute(
        domain.acceptMission({ ...base("ore-accept", extraction.revision, 10), definition: extractionDefinition, instance: extraction })
      ).instance;
      extraction = execute(
        domain.activateMission({
          ...base("ore-activate", extraction.revision, 20),
          missionTime: missionTime(20),
          definition: extractionDefinition,
          instance: extraction
        })
      ).instance;
      extraction = execute(
        domain.applyObjectiveProgress({
          ...base("ore-reach", extraction.revision, 30),
          definition: extractionDefinition,
          instance: extraction,
          objectiveId: extractionObjectives[0].objectiveId,
          progress: { kind: "Target", targetId: domain.MISSION_FIXTURE_IDS.extractionSite }
        })
      ).instance;
      extraction = execute(
        domain.completeObjective({
          ...base("ore-reach-complete", extraction.revision, 31),
          definition: extractionDefinition,
          instance: extraction,
          objectiveId: extractionObjectives[0].objectiveId
        })
      ).instance;
      extraction = execute(
        domain.applyObjectiveProgress({
          ...base("ore-extract", extraction.revision, 40),
          definition: extractionDefinition,
          instance: extraction,
          objectiveId: extractionObjectives[1].objectiveId,
          progress: { kind: "ResourceQuantity", resourceId: "resource:hematite", quantity: 20 }
        })
      ).instance;
      extraction = execute(
        domain.completeObjective({
          ...base("ore-extract-complete", extraction.revision, 41),
          definition: extractionDefinition,
          instance: extraction,
          objectiveId: extractionObjectives[1].objectiveId
        })
      ).instance;
      extraction = execute(
        domain.applyObjectiveProgress({
          ...base("ore-deliver", extraction.revision, 50),
          definition: extractionDefinition,
          instance: extraction,
          objectiveId: extractionObjectives[2].objectiveId,
          progress: { kind: "ResourceQuantity", resourceId: "resource:hematite", quantity: 20 }
        })
      ).instance;
      extraction = execute(
        domain.completeObjective({
          ...base("ore-deliver-complete", extraction.revision, 51),
          definition: extractionDefinition,
          instance: extraction,
          objectiveId: extractionObjectives[2].objectiveId
        })
      ).instance;
      extraction = execute(
        domain.completeMission({
          ...base("ore-mission-complete", extraction.revision, 52),
          definition: extractionDefinition,
          instance: extraction
        })
      ).instance;

      const expiryDefinition = domain.CARGO_COURIER_TO_OUTPOST;
      let expiring = execute(
        domain.createMissionOffer({
          ...base("expiry-offer", 0, 0),
          definition: expiryDefinition,
          missionId: "mission:evidence.expiry",
          ownerId: "player:evidence",
          facts: { "license-level": 1 }
        })
      ).instance;
      const expired = execute(
        domain.expireMission({ ...base("expiry", expiring.revision, 3_600), definition: expiryDefinition, instance: expiring })
      );
      expiring = expired.instance;

      return {
        fixtureCount: domain.MISSION_DEFINITION_FIXTURES.length,
        fixtureDefinitionIds: domain.MISSION_DEFINITION_FIXTURES.map((definition) => definition.definitionId),
        survey: {
          finalState: survey.state,
          rewardClaimState: survey.rewardClaimState,
          signature: survey.signature,
          objectiveStates: survey.objectiveStates.map((objective) => objective.state),
          eventIntentCount,
          rewardIntentKinds: surveyClaim.outcomeIntents.map((intent) => intent.descriptor.kind)
        },
        extractionDelivery: {
          finalState: extraction.state,
          signature: extraction.signature,
          objectiveStates: extraction.objectiveStates.map((objective) => objective.state),
          extractedQuantity: extraction.objectiveStates[1].progress.resourceQuantity,
          deliveredQuantity: extraction.objectiveStates[2].progress.resourceQuantity
        },
        expiry: {
          finalState: expiring.state,
          expiryTick: expiring.expiry?.tick ?? null,
          penaltyIntentCount: expired.outcomeIntents.length
        }
      };
    };

    return { first: runScenario(), second: runScenario() };
  }, modulePath);

  const firstBytes = JSON.stringify(repeated.first);
  const secondBytes = JSON.stringify(repeated.second);
  expect(secondBytes).toBe(firstBytes);
  expect(repeated.first.fixtureCount).toBe(6);
  expect(repeated.first.survey).toMatchObject({
    finalState: "RewardClaimed",
    rewardClaimState: "Claimed",
    objectiveStates: ["Completed", "Completed"]
  });
  expect(repeated.first.survey.rewardIntentKinds).toEqual(["Resource", "ReputationDelta"]);
  expect(repeated.first.extractionDelivery).toMatchObject({
    finalState: "Completed",
    objectiveStates: ["Completed", "Completed", "Completed"],
    extractedQuantity: 12,
    deliveredQuantity: 12
  });
  expect(repeated.first.expiry).toMatchObject({ finalState: "Expired", expiryTick: 3_600, penaltyIntentCount: 1 });
  expect(health).toEqual({ consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] });

  const evidence: MissionEvidence = {
    schemaVersion: 1,
    feature: "browser-mission-contract-framework-core-v1",
    route: "/",
    testBridgeAbsent: true,
    modulePath,
    fixtureCount: 6,
    fixtureDefinitionIds: repeated.first.fixtureDefinitionIds,
    survey: repeated.first.survey,
    extractionDelivery: repeated.first.extractionDelivery,
    expiry: repeated.first.expiry,
    deterministicRepeat: {
      byteIdentical: true,
      firstBytes: firstBytes.length,
      secondBytes: secondBytes.length
    },
    health: { consoleErrors: 0, pageErrors: 0, requestFailures: 0, httpErrors: 0 },
    status: "PASS"
  };

  await mkdir(evidenceDir, { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, createMarkdown(evidence), "utf8");
});
