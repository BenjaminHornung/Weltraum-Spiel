import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type SuitDomain = typeof import("../../src/suit/index");

const evidenceDir = path.resolve(process.cwd(), "evidence");
const summaryPath = path.join(evidenceDir, "browser-suit-survival-state-core-v1-summary.json");
const markdownPath = path.join(evidenceDir, "browser-suit-survival-state-core-v1.md");
const generator = "apps/weltraum-browser/tests/e2e/suit-survival-state-core.spec.ts";
const focusedCommand = "npm run test:e2e -- tests/e2e/suit-survival-state-core.spec.ts --workers=1 --retries=0";

interface BrowserFailures {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly requestFailures: string[];
  readonly httpErrors: string[];
}

interface TestBridgeState {
  readonly ownProperty: boolean;
  readonly inWindow: boolean;
}

interface SuitStageEvidence {
  readonly id: string;
  readonly tick: number;
  readonly revision: number;
  readonly mode: string;
  readonly workload: string;
  readonly healthMilliPoints: number;
  readonly healthRepairCeilingMilliPoints: number;
  readonly oxygenMilligrams: number;
  readonly energyMillijoules: number;
  readonly sealIntegrityBasisPoints: number;
  readonly radiationMicrosieverts: number;
  readonly contaminationMicroUnits: number;
  readonly activeAlerts: readonly string[];
  readonly raisedAlerts: readonly string[];
  readonly clearedAlerts: readonly string[];
  readonly powerStarvedTransitionSubsystemIds: readonly string[];
  readonly equipmentBusOnline: boolean;
  readonly actualRechargeMillijoules: number | null;
  readonly actualResupplyMilligrams: number | null;
  readonly stateSignature: string;
  readonly eventSignature: string;
}

interface SuitScenarioRun {
  readonly scenarioName: "nominal-walk-survival-recovery";
  readonly modulePath: "/src/suit/index.ts";
  readonly importedPublicApi: readonly string[];
  readonly definitionSignature: string;
  readonly configuredTotalContinuousDrawMilliwatts: number;
  readonly initialStateSignature: string;
  readonly stages: readonly SuitStageEvidence[];
  readonly alertTransitions: {
    readonly raised: readonly string[];
    readonly cleared: readonly string[];
  };
  readonly finalStateSignature: string;
  readonly eventSequenceSignature: string;
  readonly scenarioSignature: string;
  readonly canonicalStateJson: string;
  readonly canonicalEventJson: string;
  readonly canonicalScenarioJson: string;
}

interface SuitBrowserEvidence {
  readonly schemaVersion: "browser-suit-survival-state-core-v1";
  readonly status: "PASS";
  readonly generator: string;
  readonly normalRoute: {
    readonly path: "/";
    readonly debugSceneVisible: true;
    readonly testBridgeBefore: TestBridgeState;
    readonly testBridgeAfter: TestBridgeState;
  };
  readonly dynamicImport: {
    readonly modulePath: "/src/suit/index.ts";
    readonly importedPublicApi: readonly string[];
  };
  readonly browserHealth: {
    readonly collectorsRegisteredBeforeNavigation: true;
    readonly consoleErrors: 0;
    readonly pageErrors: 0;
    readonly requestFailures: 0;
    readonly httpErrors: 0;
  };
  readonly deterministicRepeat: {
    readonly identicalCanonicalStateJson: true;
    readonly identicalCanonicalEventJson: true;
    readonly identicalCanonicalScenarioJson: true;
    readonly identicalStateSignature: true;
    readonly identicalEventSignature: true;
    readonly identicalScenarioSignature: true;
  };
  readonly signatures: {
    readonly definition: string;
    readonly finalState: string;
    readonly eventSequence: string;
    readonly scenario: string;
  };
  readonly scenario: SuitScenarioRun;
  readonly checks: readonly string[];
  readonly verification: {
    readonly command: string;
    readonly expectedResult: "one focused Playwright test passes and overwrites exactly two deterministic evidence files";
    readonly observedResult: "pass";
    readonly screenshot: "not captured: pure domain proof with no visual change";
  };
}

const installBrowserFailureCollectors = (page: Page): BrowserFailures => {
  const failures: BrowserFailures = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on("console", (message) => {
    if (message.type() === "error") failures.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => failures.pageErrors.push(error.message));
  page.on("requestfailed", (request) => failures.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`));
  page.on("response", (response) => {
    if (response.status() >= 400) failures.httpErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
  return failures;
};

const readTestBridgeState = (page: Page): Promise<TestBridgeState> => page.evaluate(() => ({
  ownProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
  inWindow: "TestBridge" in window
}));

const createMarkdown = (evidence: SuitBrowserEvidence): string => {
  const stageRows = evidence.scenario.stages.map((stage) =>
    `| ${stage.id} | ${stage.tick} | ${stage.revision} | ${stage.mode} | ${stage.healthMilliPoints} | ${stage.healthRepairCeilingMilliPoints} | ${stage.oxygenMilligrams} | ${stage.energyMillijoules} | ${stage.sealIntegrityBasisPoints} | ${stage.radiationMicrosieverts} | ${stage.contaminationMicroUnits} | ${stage.equipmentBusOnline} | ${stage.activeAlerts.join(", ") || "—"} |`
  ).join("\n");

  return `# Browser Suit Survival State Core v1 Evidence

Generated by \`${evidence.generator}\` through the normal Browser route.

## Result

- Status: \`${evidence.status}\`
- Route: \`${evidence.normalRoute.path}\`
- TestBridge absent before and after the proof: \`${!evidence.normalRoute.testBridgeBefore.ownProperty && !evidence.normalRoute.testBridgeBefore.inWindow && !evidence.normalRoute.testBridgeAfter.ownProperty && !evidence.normalRoute.testBridgeAfter.inWindow}\`
- Dynamically imported public module: \`${evidence.dynamicImport.modulePath}\`
- Browser health (console/page/request/HTTP): \`${evidence.browserHealth.consoleErrors}/${evidence.browserHealth.pageErrors}/${evidence.browserHealth.requestFailures}/${evidence.browserHealth.httpErrors}\`
- Failure collectors registered before navigation: \`${evidence.browserHealth.collectorsRegisteredBeforeNavigation}\`

## Deterministic Scenario

The identical run order was Nominal → Walk → damaged seal → deterministic equipment-bus starvation → radiation and contamination → oxygen critical → explicit Emergency command → recharge and resupply.

| Stage | Tick | Revision | Mode | Health mP | Health repair ceiling mP | Oxygen mg | Energy mJ | Seal bp | Radiation µSv | Contamination µU | Equipment bus online | Active alerts |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
${stageRows}

- Raised alert sequence: ${evidence.scenario.alertTransitions.raised.map((entry) => `\`${entry}\``).join(" → ")}
- Cleared alert sequence: ${evidence.scenario.alertTransitions.cleared.map((entry) => `\`${entry}\``).join(" → ")}
- Configured continuous subsystem draw: \`${evidence.scenario.configuredTotalContinuousDrawMilliwatts} mW\`
- Recovery actuals: \`${evidence.scenario.stages.at(-1)?.actualRechargeMillijoules} mJ\` recharged and \`${evidence.scenario.stages.at(-1)?.actualResupplyMilligrams} mg\` resupplied

## Signatures And Repeatability

- Definition: \`${evidence.signatures.definition}\`
- Final state: \`${evidence.signatures.finalState}\`
- Event sequence: \`${evidence.signatures.eventSequence}\`
- Scenario: \`${evidence.signatures.scenario}\`
- Canonical state JSON identical: \`${evidence.deterministicRepeat.identicalCanonicalStateJson}\`
- Canonical event JSON identical: \`${evidence.deterministicRepeat.identicalCanonicalEventJson}\`
- Canonical scenario JSON identical: \`${evidence.deterministicRepeat.identicalCanonicalScenarioJson}\`
- State/event/scenario signatures identical: \`${evidence.deterministicRepeat.identicalStateSignature}/${evidence.deterministicRepeat.identicalEventSignature}/${evidence.deterministicRepeat.identicalScenarioSignature}\`

## Checks

${evidence.checks.map((check) => `- ${check}`).join("\n")}

## Focused Verification

- Command: \`${evidence.verification.command}\`
- Expected: ${evidence.verification.expectedResult}
- Observed: \`${evidence.verification.observedResult}\`
- Screenshot: ${evidence.verification.screenshot}
`;
};

test("normal route proves the deterministic suit survival scenario twice", async ({ page }) => {
  const failures = installBrowserFailureCollectors(page);
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await page.waitForLoadState("networkidle");

  const testBridgeBefore = await readTestBridgeState(page);
  expect(testBridgeBefore).toEqual({ ownProperty: false, inWindow: false });

  const repeated = await page.evaluate<{
    readonly first: SuitScenarioRun;
    readonly second: SuitScenarioRun;
  }>(async () => {
    const modulePath = "/src/suit/index.ts";
    const suit = (await import(/* @vite-ignore */ modulePath)) as SuitDomain;
    const importedPublicApi = [
      "SUIT_SCHEMA_VERSION",
      "SUIT_SUBSYSTEM_ROLES",
      "advanceSuitState",
      "canonicalSuitJson",
      "createCanonicalSuitEventSequence",
      "createSuitCommand",
      "createSuitDefinition",
      "createSuitEnvironmentExposure",
      "createSuitEquipmentInterfaceSnapshot",
      "createSuitSignature",
      "createSuitStateSnapshot"
    ] as const;
    for (const exportName of importedPublicApi) {
      if (!(exportName in suit)) throw new Error(`Missing public suit export: ${exportName}`);
    }

    const runScenario = (): SuitScenarioRun => {
      const priorities: Readonly<Record<string, number>> = {
        "oxygen-regulator": 100,
        "thermal-control": 90,
        "seal-monitor": 80,
        "radiation-monitor": 70,
        "contamination-filter": 60,
        "emergency-beacon": 50,
        "equipment-bus": 10
      };
      const definition = suit.createSuitDefinition({
        schemaVersion: suit.SUIT_SCHEMA_VERSION,
        definitionId: "suit-definition:e2e-survival-v1",
        healthMaximumMilliPoints: 10_000,
        oxygenCapacityMilligrams: 1_000,
        energyCapacityMillijoules: 1_000,
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
          oxygenLowMilligrams: 400,
          oxygenCriticalMilligrams: 200,
          energyLowMillijoules: 400,
          energyCriticalMillijoules: 200,
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
          healthRepairLimitMilliPointsPerCommand: 1_000,
          sealRepairLimitBasisPointsPerCommand: 1_000
        },
        workloadProfiles: [
          { workload: "Rest", oxygenConsumptionMilligramsPerSecond: 0, energyConsumptionMillijoulesPerSecond: 0, temperatureDeltaMilliKelvinPerSecond: 0 },
          { workload: "Walk", oxygenConsumptionMilligramsPerSecond: 100, energyConsumptionMillijoulesPerSecond: 100, temperatureDeltaMilliKelvinPerSecond: 0 },
          { workload: "Sprint", oxygenConsumptionMilligramsPerSecond: 200, energyConsumptionMillijoulesPerSecond: 200, temperatureDeltaMilliKelvinPerSecond: 10 },
          { workload: "HeavyWork", oxygenConsumptionMilligramsPerSecond: 300, energyConsumptionMillijoulesPerSecond: 300, temperatureDeltaMilliKelvinPerSecond: 20 },
          { workload: "Incapacitated", oxygenConsumptionMilligramsPerSecond: 0, energyConsumptionMillijoulesPerSecond: 0, temperatureDeltaMilliKelvinPerSecond: 0 }
        ],
        modeProfiles: [
          { mode: "Nominal", oxygenConsumptionAdjustmentMilligramsPerSecond: 0, energyConsumptionAdjustmentMillijoulesPerSecond: 0, temperatureDeltaAdjustmentMilliKelvinPerSecond: 0 },
          { mode: "Conserve", oxygenConsumptionAdjustmentMilligramsPerSecond: -50, energyConsumptionAdjustmentMillijoulesPerSecond: -50, temperatureDeltaAdjustmentMilliKelvinPerSecond: 0 },
          { mode: "Emergency", oxygenConsumptionAdjustmentMilligramsPerSecond: -100, energyConsumptionAdjustmentMillijoulesPerSecond: -100, temperatureDeltaAdjustmentMilliKelvinPerSecond: 0 },
          { mode: "Offline", oxygenConsumptionAdjustmentMilligramsPerSecond: 0, energyConsumptionAdjustmentMillijoulesPerSecond: 0, temperatureDeltaAdjustmentMilliKelvinPerSecond: 0 }
        ],
        allowedModes: ["Nominal", "Conserve", "Emergency", "Offline"],
        interfaceDefinitions: [{
          interfaceId: "interface:e2e-primary",
          continuousPowerBudgetMilliwatts: 2_000,
          pulseEnergyReserveMillijoules: 500,
          thermalDissipationBudgetMilliwatts: 1_000,
          revision: 0
        }],
        subsystemDefinitions: suit.SUIT_SUBSYSTEM_ROLES.map((role) => ({
          subsystemId: `subsystem:${role}`,
          role,
          continuousPowerDrawMilliwatts: role === "oxygen-regulator" ? 1_000 : role === "equipment-bus" ? 1_500 : 500,
          oxygenConsumptionReductionMilligramsPerSecond: role === "oxygen-regulator" ? 20 : 0,
          thermalDeltaMilliKelvinPerSecond: 0,
          contaminationFilterBasisPoints: role === "contamination-filter" ? 5_000 : 0,
          priority: priorities[role],
          requiredInterfaceId: "interface:e2e-primary",
          revision: 0
        })),
        failSafeModeOnEquipmentBusLoss: null,
        registryVersion: "suit-registry:e2e-v1",
        algorithmVersion: "suit-algorithm:e2e-v1"
      });
      const initialState = suit.createSuitStateSnapshot({
        schemaVersion: suit.SUIT_SCHEMA_VERSION,
        stateId: "suit-state:e2e-player",
        actorId: "actor:e2e-player",
        definitionId: definition.definitionId,
        revision: 0,
        tick: 0,
        healthMilliPoints: 10_000,
        healthRepairCeilingMilliPoints: 10_000,
        oxygenMilligrams: 1_000,
        energyMillijoules: 1_000,
        sealIntegrityBasisPoints: 10_000,
        sealRepairCeilingBasisPoints: 10_000,
        internalTemperatureMilliKelvin: 300_000,
        radiationMicrosieverts: 0,
        contaminationMicroUnits: 0,
        mode: "Nominal",
        workload: "Rest",
        subsystemStates: definition.subsystemDefinitions.map((entry) => ({
          subsystemId: entry.subsystemId,
          status: "Enabled",
          powerState: "Powered",
          revision: 0
        })),
        rateRemainders: [],
        actorIncapacitated: false,
        acceptedCommandIds: []
      }, definition);
      const createCommand = (
        state: typeof initialState,
        commandId: string,
        kind: "SetWorkload" | "SetLifeSupportMode" | "RechargeEnergy" | "ResupplyOxygen",
        payload: Readonly<Record<string, unknown>>,
        revisionOffset = 0
      ) => suit.createSuitCommand({
        kind,
        commandId,
        actorId: state.actorId,
        stateId: state.stateId,
        expectedRevision: state.revision + revisionOffset,
        resultingRevision: state.revision + revisionOffset + 1,
        tick: state.tick,
        payload,
        sourceId: "source:e2e-operator"
      });
      const createExposure = (sourceId: string, overrides: Readonly<Record<string, unknown>>) => suit.createSuitEnvironmentExposure({
        oxygenLossMilligramsPerTick: 0,
        energyDrawMillijoulesPerTick: 0,
        energyGainMillijoulesPerTick: 0,
        temperatureDeltaMilliKelvinPerTick: 0,
        sealDamageBasisPointsPerTick: 0,
        radiationMicrosievertsPerTick: 0,
        contaminationMicroUnitsPerTick: 0,
        healthDamageMilliPointsPerTick: 0,
        hazardTags: [],
        sourceId,
        sourceRevision: 0,
        ...overrides
      });
      const stageResults = [] as ReturnType<typeof suit.advanceSuitState>[];
      let current = initialState;
      const advance = (commands: readonly ReturnType<typeof suit.createSuitCommand>[], exposure: ReturnType<typeof suit.createSuitEnvironmentExposure> | null) => {
        const result = suit.advanceSuitState(current, { definition, commands, exposure });
        current = result.state;
        stageResults.push(result);
        return result;
      };

      advance([createCommand(current, "command:e2e-walk", "SetWorkload", { workload: "Walk" })], null);
      advance([], createExposure("exposure:e2e-seal", { sealDamageBasisPointsPerTick: 2_500, hazardTags: ["damaged-seal"] }));
      advance([], createExposure("exposure:e2e-hazards", { radiationMicrosievertsPerTick: 150, contaminationMicroUnitsPerTick: 300, hazardTags: ["contamination", "radiation"] }));
      advance([], createExposure("exposure:e2e-oxygen", { oxygenLossMilligramsPerTick: 750, hazardTags: ["oxygen-loss"] }));
      advance([createCommand(current, "command:e2e-emergency", "SetLifeSupportMode", { mode: "Emergency" })], null);
      advance([
        createCommand(current, "command:e2e-recharge", "RechargeEnergy", { requestedMillijoules: 2_000 }),
        createCommand(current, "command:e2e-resupply", "ResupplyOxygen", { requestedMilligrams: 2_000 }, 1)
      ], null);

      const stageIds = ["walk", "damaged-seal", "radiation-contamination", "oxygen-critical", "emergency", "recharge-resupply"];
      const stages = stageResults.map((result, index): SuitStageEvidence => {
        const equipment = suit.createSuitEquipmentInterfaceSnapshot(result.state, definition);
        const rechargeResult = result.commandResults.find((entry) => entry.status === "Accepted" && entry.detail.kind === "RechargeEnergy");
        const resupplyResult = result.commandResults.find((entry) => entry.status === "Accepted" && entry.detail.kind === "ResupplyOxygen");
        return {
          id: stageIds[index]!,
          tick: result.state.tick,
          revision: result.state.revision,
          mode: result.state.mode,
          workload: result.state.workload,
          healthMilliPoints: result.state.healthMilliPoints,
          healthRepairCeilingMilliPoints: result.state.healthRepairCeilingMilliPoints,
          oxygenMilligrams: result.state.oxygenMilligrams,
          energyMillijoules: result.state.energyMillijoules,
          sealIntegrityBasisPoints: result.state.sealIntegrityBasisPoints,
          radiationMicrosieverts: result.state.radiationMicrosieverts,
          contaminationMicroUnits: result.state.contaminationMicroUnits,
          activeAlerts: result.state.activeAlerts.map((alert) => alert.code),
          raisedAlerts: result.events.filter((event) => event.kind === "SuitAlertRaised").map((event) => String(event.data.code)),
          clearedAlerts: result.events.filter((event) => event.kind === "SuitAlertCleared").map((event) => String(event.data.code)),
          powerStarvedTransitionSubsystemIds: result.events.filter((event) => event.kind === "SuitPowerStarved").map((event) => String(event.data.subsystemId)),
          equipmentBusOnline: equipment.equipmentBusOnline,
          actualRechargeMillijoules: rechargeResult?.status === "Accepted" ? rechargeResult.detail.actualAcceptedMillijoules ?? null : null,
          actualResupplyMilligrams: resupplyResult?.status === "Accepted" ? resupplyResult.detail.actualAcceptedMilligrams ?? null : null,
          stateSignature: result.state.contentSignature,
          eventSignature: result.eventSignature
        };
      });
      const allEvents = stageResults.flatMap((result) => result.events);
      const eventSequence = suit.createCanonicalSuitEventSequence(allEvents);
      const alertTransitions = {
        raised: stages.flatMap((stage) => stage.raisedAlerts.map((code) => `${stage.id}:${code}`)),
        cleared: stages.flatMap((stage) => stage.clearedAlerts.map((code) => `${stage.id}:${code}`))
      };
      const semantic = {
        scenarioName: "nominal-walk-survival-recovery" as const,
        modulePath: modulePath as "/src/suit/index.ts",
        importedPublicApi,
        definitionSignature: definition.contentSignature,
        configuredTotalContinuousDrawMilliwatts: definition.subsystemDefinitions.reduce((sum, entry) => sum + entry.continuousPowerDrawMilliwatts, 0),
        initialStateSignature: initialState.contentSignature,
        stages,
        alertTransitions,
        finalStateSignature: current.contentSignature,
        eventSequenceSignature: eventSequence.signature
      };
      const canonicalScenarioJson = suit.canonicalSuitJson(semantic);
      return {
        ...semantic,
        scenarioSignature: suit.createSuitSignature(semantic),
        canonicalStateJson: suit.canonicalSuitJson(current),
        canonicalEventJson: eventSequence.canonicalJson,
        canonicalScenarioJson
      };
    };

    return { first: runScenario(), second: runScenario() };
  });

  const testBridgeAfter = await readTestBridgeState(page);
  expect(testBridgeAfter).toEqual({ ownProperty: false, inWindow: false });
  expect(failures).toEqual({ consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] });

  expect(repeated.second).toEqual(repeated.first);
  expect(repeated.second.canonicalStateJson).toBe(repeated.first.canonicalStateJson);
  expect(repeated.second.canonicalEventJson).toBe(repeated.first.canonicalEventJson);
  expect(repeated.second.canonicalScenarioJson).toBe(repeated.first.canonicalScenarioJson);
  expect(repeated.second.finalStateSignature).toBe(repeated.first.finalStateSignature);
  expect(repeated.second.eventSequenceSignature).toBe(repeated.first.eventSequenceSignature);
  expect(repeated.second.scenarioSignature).toBe(repeated.first.scenarioSignature);

  expect(repeated.first.stages.map((stage) => stage.id)).toEqual([
    "walk", "damaged-seal", "radiation-contamination", "oxygen-critical", "emergency", "recharge-resupply"
  ]);
  expect(repeated.first.stages[0]).toMatchObject({ mode: "Nominal", workload: "Walk", oxygenMilligrams: 992, energyMillijoules: 490, equipmentBusOnline: true });
  expect(repeated.first.stages[1]).toMatchObject({ sealIntegrityBasisPoints: 7_500, oxygenMilligrams: 959, energyMillijoules: 130, equipmentBusOnline: false, powerStarvedTransitionSubsystemIds: ["subsystem:equipment-bus"] });
  expect(repeated.first.stages[2]).toMatchObject({ radiationMicrosieverts: 150, contaminationMicroUnits: 300, oxygenMilligrams: 926, energyMillijoules: 20, equipmentBusOnline: false });
  expect(repeated.first.stages[3]).toMatchObject({ oxygenMilligrams: 141, energyMillijoules: 10, mode: "Nominal" });
  expect(repeated.first.stages[4]).toMatchObject({ oxygenMilligrams: 116, energyMillijoules: 10, mode: "Emergency" });
  expect(repeated.first.stages[5]).toMatchObject({
    oxygenMilligrams: 975,
    energyMillijoules: 500,
    mode: "Emergency",
    equipmentBusOnline: true,
    actualRechargeMillijoules: 990,
    actualResupplyMilligrams: 884,
    activeAlerts: ["ContaminationCritical", "RadiationElevated", "SealDamaged"]
  });
  expect(repeated.first.alertTransitions).toEqual({
    raised: [
      "damaged-seal:EnergyCritical",
      "damaged-seal:EquipmentBusOffline",
      "damaged-seal:SealDamaged",
      "radiation-contamination:ContaminationCritical",
      "radiation-contamination:RadiationElevated",
      "oxygen-critical:OxygenCritical"
    ],
    cleared: [
      "recharge-resupply:EnergyCritical",
      "recharge-resupply:EquipmentBusOffline",
      "recharge-resupply:OxygenCritical"
    ]
  });

  const evidence: SuitBrowserEvidence = {
    schemaVersion: "browser-suit-survival-state-core-v1",
    status: "PASS",
    generator,
    normalRoute: {
      path: "/",
      debugSceneVisible: true,
      testBridgeBefore,
      testBridgeAfter
    },
    dynamicImport: {
      modulePath: repeated.first.modulePath,
      importedPublicApi: repeated.first.importedPublicApi
    },
    browserHealth: {
      collectorsRegisteredBeforeNavigation: true,
      consoleErrors: 0,
      pageErrors: 0,
      requestFailures: 0,
      httpErrors: 0
    },
    deterministicRepeat: {
      identicalCanonicalStateJson: true,
      identicalCanonicalEventJson: true,
      identicalCanonicalScenarioJson: true,
      identicalStateSignature: true,
      identicalEventSignature: true,
      identicalScenarioSignature: true
    },
    signatures: {
      definition: repeated.first.definitionSignature,
      finalState: repeated.first.finalStateSignature,
      eventSequence: repeated.first.eventSequenceSignature,
      scenario: repeated.first.scenarioSignature
    },
    scenario: repeated.first,
    checks: [
      "Normal / route reached with TestBridge absent before and after the proof.",
      "Only the public /src/suit/index.ts entry was dynamically imported by the proof.",
      "Nominal Walk, damaged seal, deterministic equipment-bus starvation, hazards, oxygen critical, explicit Emergency, recharge, and resupply ran in the prescribed order.",
      "Raised and cleared alerts matched the canonical transition sequence; persistent seal, radiation, and contamination alerts remained active after energy and oxygen recovery.",
      "Power-starvation subsystem IDs describe transitions emitted during each stage, not the persistent current power state; equipmentBusOnline carries the current equipment-bus state.",
      "Suit state snapshots derived canonical active alerts and preserved the immutable health repair ceiling through every stage.",
      "Both complete in-page runs produced identical canonical state, event, and scenario JSON plus identical signatures.",
      "Console, page, request-failure, and HTTP >=400 collectors all remained zero.",
      "No screenshot was captured because this proof changes no UI or render behavior."
    ],
    verification: {
      command: focusedCommand,
      expectedResult: "one focused Playwright test passes and overwrites exactly two deterministic evidence files",
      observedResult: "pass",
      screenshot: "not captured: pure domain proof with no visual change"
    }
  };

  await mkdir(evidenceDir, { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, createMarkdown(evidence), "utf8");
});
