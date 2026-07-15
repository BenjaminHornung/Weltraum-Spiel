import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ciTimeout } from "./support/ciTiming";

type ShipPowerThermalDomain = typeof import("../../src/ship-power-thermal/index");

const evidenceDir = path.resolve(process.cwd(), "evidence");
const summaryPath = path.join(evidenceDir, "browser-ship-power-thermal-core-v1-summary.json");
const markdownPath = path.join(evidenceDir, "browser-ship-power-thermal-core-v1.md");
const generator = "apps/weltraum-browser/tests/e2e/ship-power-thermal-core.spec.ts";
const focusedCommand = "$env:WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH=\"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe\"; npx --yes node@22 \"C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js\" run test:e2e -- tests/e2e/ship-power-thermal-core.spec.ts";

interface BrowserHealth {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly failedRequests: string[];
  readonly nonSuccessHttpResponses: string[];
}

interface TestBridgeState {
  readonly ownProperty: boolean;
  readonly inWindow: boolean;
}

interface ConsumerStageResult {
  readonly consumerId: string;
  readonly priority: string;
  readonly requestedPowerW: number;
  readonly allocatedPowerW: number;
  readonly state: string;
}

interface ShipPowerThermalStageResult {
  readonly tick: number;
  readonly sourceOutputW: number;
  readonly battery: {
    readonly flowState: string;
    readonly busPowerW: number;
    readonly previousStoredEnergyJ: number;
    readonly nextStoredEnergyJ: number;
  };
  readonly consumers: readonly ConsumerStageResult[];
  readonly temperatureK: number;
  readonly protectionState: string;
  readonly heatInputW: number;
  readonly heatRemovedW: number;
  readonly cooling: {
    readonly allocatedOperatingPowerW: number;
    readonly heatRemovedW: number;
    readonly coolingInsufficient: boolean;
  };
  readonly actionCodes: readonly string[];
  readonly eventCodes: readonly string[];
  readonly eventIds: readonly string[];
  readonly canonicalJson: string;
  readonly signature: string;
}

interface ShipPowerThermalScenarioRun {
  readonly scenarioName: "deterministic-power-brownout-thermal-recovery";
  readonly modulePath: "/src/ship-power-thermal/index.ts";
  readonly fixtureIds: {
    readonly generator: string;
    readonly battery: string;
    readonly criticalConsumer: string;
    readonly flightConsumer: string;
    readonly weaponMissionConsumer: string;
    readonly coolingConsumer: string;
    readonly coolingUnit: string;
  };
  readonly normalOperation: ShipPowerThermalStageResult;
  readonly reducedSourceBrownout: ShipPowerThermalStageResult;
  readonly thermalProgression: {
    readonly warning: ShipPowerThermalStageResult;
    readonly critical: ShipPowerThermalStageResult;
  };
  readonly coolingRecovery: ShipPowerThermalStageResult;
  readonly eventStreams: readonly (readonly string[])[];
  readonly canonicalJson: string;
  readonly signature: string;
}

interface ShipPowerThermalBrowserEvidence {
  readonly schemaVersion: "browser-ship-power-thermal-core-v1";
  readonly status: "PASS";
  readonly generator: string;
  readonly publicModulePath: ShipPowerThermalScenarioRun["modulePath"];
  readonly normalRoute: {
    readonly path: "/";
    readonly debugSceneVisible: true;
    readonly faviconHref: "/favicon.png";
    readonly testBridgeBefore: TestBridgeState;
    readonly testBridgeAfter: TestBridgeState;
  };
  readonly browserHealth: BrowserHealth;
  readonly deterministicRepeat: {
    readonly completeResultEqual: true;
    readonly canonicalJsonEqual: true;
    readonly signatureEqual: true;
    readonly eventStreamsEqual: true;
  };
  readonly scenario: ShipPowerThermalScenarioRun;
  readonly verification: {
    readonly command: string;
    readonly nodeVersion: "22";
    readonly expectedResult: "one focused Playwright test passes and writes deterministic JSON and Markdown evidence";
    readonly observedResult: "pass";
  };
}

const installBrowserHealthCollectors = (page: Page): BrowserHealth => {
  const health: BrowserHealth = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    nonSuccessHttpResponses: []
  };
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      health.consoleErrors.push(`${message.text()} @ ${location.url}:${location.lineNumber}:${location.columnNumber}`);
    }
  });
  page.on("pageerror", (error) => health.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    health.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (response) => {
    if (!response.ok()) {
      health.nonSuccessHttpResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  return health;
};

const readTestBridgeState = (page: Page): Promise<TestBridgeState> => page.evaluate(() => ({
  ownProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
  inWindow: "TestBridge" in window
}));

const consumer = (stage: ShipPowerThermalStageResult, consumerId: string): ConsumerStageResult => {
  const result = stage.consumers.find((entry) => entry.consumerId === consumerId);
  if (result === undefined) throw new Error(`Missing consumer result for ${consumerId}.`);
  return result;
};

const createMarkdown = (evidence: ShipPowerThermalBrowserEvidence): string => `# Browser Ship Power/Thermal Core v1 Evidence

Generated by \`${evidence.generator}\` through the normal Browser route.

## Result

- Status: \`${evidence.status}\`
- Public module: \`${evidence.publicModulePath}\`
- Route: \`${evidence.normalRoute.path}\`
- Debug scene ready: \`${evidence.normalRoute.debugSceneVisible}\`
- Document favicon: \`${evidence.normalRoute.faviconHref}\`; no route interception or network exclusion is installed.
- TestBridge absent before and after: \`${!evidence.normalRoute.testBridgeBefore.ownProperty && !evidence.normalRoute.testBridgeBefore.inWindow && !evidence.normalRoute.testBridgeAfter.ownProperty && !evidence.normalRoute.testBridgeAfter.inWindow}\`
- No screenshot: this proof exercises a standalone pure core with no UI or renderer integration.

## Browser Health

\`\`\`json
${JSON.stringify(evidence.browserHealth, null, 2)}
\`\`\`

All four arrays are asserted empty. No console, uncaught page, failed-request, or non-success HTTP noise is excluded or intercepted.

## Deterministic Fixture

\`\`\`json
${JSON.stringify(evidence.scenario.fixtureIds, null, 2)}
\`\`\`

The explicit fixture contains one generator, one battery, Critical and Flight consumers, a Weapon/Mission consumer, and a Cooling consumer/unit on one isolated bus.

## Proven Stages

| Stage | Source W | Battery | Battery W | Battery J | Critical | Flight | Cooling | Weapon/Mission | Temperature K | Protection |
| --- | ---: | --- | ---: | ---: | --- | --- | --- | --- | ---: | --- |
| Normal | ${evidence.scenario.normalOperation.sourceOutputW} | ${evidence.scenario.normalOperation.battery.flowState} | ${evidence.scenario.normalOperation.battery.busPowerW} | ${evidence.scenario.normalOperation.battery.nextStoredEnergyJ} | ${consumer(evidence.scenario.normalOperation, evidence.scenario.fixtureIds.criticalConsumer).state} | ${consumer(evidence.scenario.normalOperation, evidence.scenario.fixtureIds.flightConsumer).state} | ${consumer(evidence.scenario.normalOperation, evidence.scenario.fixtureIds.coolingConsumer).state} | ${consumer(evidence.scenario.normalOperation, evidence.scenario.fixtureIds.weaponMissionConsumer).state} | ${evidence.scenario.normalOperation.temperatureK} | ${evidence.scenario.normalOperation.protectionState} |
| Reduced source | ${evidence.scenario.reducedSourceBrownout.sourceOutputW} | ${evidence.scenario.reducedSourceBrownout.battery.flowState} | ${evidence.scenario.reducedSourceBrownout.battery.busPowerW} | ${evidence.scenario.reducedSourceBrownout.battery.nextStoredEnergyJ} | ${consumer(evidence.scenario.reducedSourceBrownout, evidence.scenario.fixtureIds.criticalConsumer).state} | ${consumer(evidence.scenario.reducedSourceBrownout, evidence.scenario.fixtureIds.flightConsumer).state} | ${consumer(evidence.scenario.reducedSourceBrownout, evidence.scenario.fixtureIds.coolingConsumer).state} | ${consumer(evidence.scenario.reducedSourceBrownout, evidence.scenario.fixtureIds.weaponMissionConsumer).state} | ${evidence.scenario.reducedSourceBrownout.temperatureK} | ${evidence.scenario.reducedSourceBrownout.protectionState} |
| Warning | ${evidence.scenario.thermalProgression.warning.sourceOutputW} | ${evidence.scenario.thermalProgression.warning.battery.flowState} | ${evidence.scenario.thermalProgression.warning.battery.busPowerW} | ${evidence.scenario.thermalProgression.warning.battery.nextStoredEnergyJ} | ${consumer(evidence.scenario.thermalProgression.warning, evidence.scenario.fixtureIds.criticalConsumer).state} | ${consumer(evidence.scenario.thermalProgression.warning, evidence.scenario.fixtureIds.flightConsumer).state} | Not requested | ${consumer(evidence.scenario.thermalProgression.warning, evidence.scenario.fixtureIds.weaponMissionConsumer).state} | ${evidence.scenario.thermalProgression.warning.temperatureK} | ${evidence.scenario.thermalProgression.warning.protectionState} |
| Critical | ${evidence.scenario.thermalProgression.critical.sourceOutputW} | ${evidence.scenario.thermalProgression.critical.battery.flowState} | ${evidence.scenario.thermalProgression.critical.battery.busPowerW} | ${evidence.scenario.thermalProgression.critical.battery.nextStoredEnergyJ} | ${consumer(evidence.scenario.thermalProgression.critical, evidence.scenario.fixtureIds.criticalConsumer).state} | ${consumer(evidence.scenario.thermalProgression.critical, evidence.scenario.fixtureIds.flightConsumer).state} | Not requested | ${consumer(evidence.scenario.thermalProgression.critical, evidence.scenario.fixtureIds.weaponMissionConsumer).state} | ${evidence.scenario.thermalProgression.critical.temperatureK} | ${evidence.scenario.thermalProgression.critical.protectionState} |
| Cooling recovery | ${evidence.scenario.coolingRecovery.sourceOutputW} | ${evidence.scenario.coolingRecovery.battery.flowState} | ${evidence.scenario.coolingRecovery.battery.busPowerW} | ${evidence.scenario.coolingRecovery.battery.nextStoredEnergyJ} | Not requested | Not requested | ${consumer(evidence.scenario.coolingRecovery, evidence.scenario.fixtureIds.coolingConsumer).state} | Not requested | ${evidence.scenario.coolingRecovery.temperatureK} | ${evidence.scenario.coolingRecovery.protectionState} |

Reduced generator availability leaves Critical, Flight, and Cooling powered in priority order, discharges the battery, sheds Weapon/Mission, and emits the brownout outcome. Two explicit fixed heat steps cross Warning and Critical. A fully powered cooling step removes ${evidence.scenario.coolingRecovery.cooling.heatRemovedW} W and returns the node to ${evidence.scenario.coolingRecovery.protectionState} at ${evidence.scenario.coolingRecovery.temperatureK} K.

## Duplicate Run

- Complete serializable result equal: \`${evidence.deterministicRepeat.completeResultEqual}\`
- Canonical JSON equal: \`${evidence.deterministicRepeat.canonicalJsonEqual}\`
- Signature equal: \`${evidence.deterministicRepeat.signatureEqual}\`
- Event streams equal: \`${evidence.deterministicRepeat.eventStreamsEqual}\`
- Scenario signature: \`${evidence.scenario.signature}\`

## Focused Verification

- Command: \`${evidence.verification.command}\`
- Node major: \`${evidence.verification.nodeVersion}\`
- Expected: ${evidence.verification.expectedResult}
- Observed: \`${evidence.verification.observedResult}\`
`;

test("normal route proves deterministic ship power, brownout, thermal progression, and cooling recovery", async ({ page }) => {
  test.setTimeout(ciTimeout(60_000, 90_000));
  const browserHealth = installBrowserHealthCollectors(page);
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await page.waitForLoadState("networkidle");

  const favicon = page.locator('head link[rel="icon"]');
  await expect(favicon).toHaveCount(1);
  await expect(favicon).toHaveAttribute("type", "image/png");
  await expect(favicon).toHaveAttribute("href", "/favicon.png");

  const testBridgeBefore = await readTestBridgeState(page);
  expect(testBridgeBefore).toEqual({ ownProperty: false, inWindow: false });

  const repeated = await page.evaluate<{
    readonly first: ShipPowerThermalScenarioRun;
    readonly second: ShipPowerThermalScenarioRun;
  }>(async () => {
    type StepInput = Parameters<ShipPowerThermalDomain["evaluateShipPowerThermalStep"]>[0];
    type StepSuccess = Extract<ReturnType<ShipPowerThermalDomain["evaluateShipPowerThermalStep"]>, { readonly ok: true }>;

    const modulePath = "/src/ship-power-thermal/index.ts";
    const domain = (await import(/* @vite-ignore */ modulePath)) as ShipPowerThermalDomain;
    const ids = domain.SHIP_POWER_THERMAL_FIXTURE_IDS;

    const definitionsFor = (availableFraction: number): StepInput["definitions"] => ({
      buses: [{ busId: ids.busMain }],
      sources: [{
        sourceId: ids.sourceGenerator,
        busId: ids.busMain,
        thermalNodeId: ids.thermalNodeMain,
        maxOutputW: 100,
        availableFraction,
        rampLimitWPerSecond: 100,
        efficiency: 1
      }],
      consumers: [
        {
          consumerId: ids.consumerCritical,
          busId: ids.busMain,
          priority: "Critical",
          minimumOperationalPowerW: 20,
          canThrottle: false,
          canShed: false
        },
        {
          consumerId: ids.consumerFlight,
          busId: ids.busMain,
          priority: "Flight",
          minimumOperationalPowerW: 15,
          canThrottle: true,
          canShed: true
        },
        {
          consumerId: ids.consumerCooling,
          busId: ids.busMain,
          priority: "Safety",
          minimumOperationalPowerW: 10,
          canThrottle: true,
          canShed: true
        },
        {
          consumerId: ids.consumerMission,
          busId: ids.busMain,
          priority: "Mission",
          minimumOperationalPowerW: 20,
          canThrottle: false,
          canShed: true
        }
      ],
      batteries: [{
        batteryId: ids.batteryMain,
        busId: ids.busMain,
        thermalNodeId: ids.thermalNodeMain,
        capacityJ: 200,
        reserveEnergyJ: 20,
        maxChargePowerW: 20,
        maxDischargePowerW: 20,
        chargeEfficiency: 1,
        dischargeEfficiency: 1,
        reservePolicy: "PreserveReserve"
      }],
      thermalNodes: [{
        thermalNodeId: ids.thermalNodeMain,
        busId: ids.busMain,
        heatCapacityJPerK: 10,
        minimumTemperatureK: 250,
        warningTemperatureK: 310,
        criticalTemperatureK: 325,
        shutdownTemperatureK: 360,
        maximumTemperatureK: 400
      }],
      cooling: [{
        coolingId: ids.coolingMain,
        thermalNodeId: ids.thermalNodeMain,
        consumerId: ids.consumerCooling,
        maxCoolingPowerW: 250,
        minimumOperatingPowerW: 10,
        sinkTemperatureK: 290
      }]
    });

    const initialState: StepInput["state"] = {
      tick: 0,
      sources: [{
        sourceId: ids.sourceGenerator,
        busId: ids.busMain,
        thermalNodeId: ids.thermalNodeMain,
        currentOutputW: 0
      }],
      batteries: [{
        batteryId: ids.batteryMain,
        busId: ids.busMain,
        thermalNodeId: ids.thermalNodeMain,
        storedEnergyJ: 100
      }],
      thermalNodes: [{
        thermalNodeId: ids.thermalNodeMain,
        busId: ids.busMain,
        temperatureK: 300,
        protectionState: "Nominal"
      }],
      cooling: [{
        coolingId: ids.coolingMain,
        thermalNodeId: ids.thermalNodeMain,
        consumerId: ids.consumerCooling,
        allocatedOperatingPowerW: 0
      }]
    };

    const normalRequests: StepInput["consumerRequests"] = [
      { consumerId: ids.consumerMission, requestedPowerW: 25 },
      { consumerId: ids.consumerCooling, requestedPowerW: 10 },
      { consumerId: ids.consumerFlight, requestedPowerW: 30 },
      { consumerId: ids.consumerCritical, requestedPowerW: 20 }
    ];
    const heatingRequests: StepInput["consumerRequests"] = [
      { consumerId: ids.consumerMission, requestedPowerW: 25 },
      { consumerId: ids.consumerFlight, requestedPowerW: 30 },
      { consumerId: ids.consumerCritical, requestedPowerW: 20 }
    ];

    const runStep = (
      state: StepInput["state"],
      tick: number,
      availableFraction: number,
      requests: StepInput["consumerRequests"],
      heatInputW: number
    ): StepSuccess => {
      const input: StepInput = {
        definitions: definitionsFor(availableFraction),
        state,
        tick,
        deltaTimeSeconds: 1,
        consumerRequests: requests,
        heatContributions: heatInputW === 0
          ? []
          : [{ heatContributionId: ids.heatMission, thermalNodeId: ids.thermalNodeMain, heatInputW }]
      };
      const result = domain.evaluateShipPowerThermalStep(input);
      if (!result.ok) throw new Error(`Ship power/thermal step ${tick} failed: ${JSON.stringify(result.issues)}`);
      return result;
    };

    const summarize = (result: StepSuccess): ShipPowerThermalStageResult => ({
      tick: result.state.tick,
      sourceOutputW: result.sourceResults[0].outputW,
      battery: {
        flowState: result.batteryResults[0].flowState,
        busPowerW: result.batteryResults[0].busPowerW,
        previousStoredEnergyJ: result.batteryResults[0].previousStoredEnergyJ,
        nextStoredEnergyJ: result.batteryResults[0].nextStoredEnergyJ
      },
      consumers: result.consumerResults.map((entry) => ({
        consumerId: entry.consumerId,
        priority: entry.priority,
        requestedPowerW: entry.requestedPowerW,
        allocatedPowerW: entry.allocatedPowerW,
        state: entry.state
      })),
      temperatureK: result.thermalResults[0].nextTemperatureK,
      protectionState: result.thermalResults[0].protectionState,
      heatInputW: result.thermalResults[0].heatInputW,
      heatRemovedW: result.thermalResults[0].heatRemovedW,
      cooling: {
        allocatedOperatingPowerW: result.coolingResults[0].allocatedOperatingPowerW,
        heatRemovedW: result.coolingResults[0].heatRemovedW,
        coolingInsufficient: result.coolingResults[0].coolingInsufficient
      },
      actionCodes: result.actions.map((action) => action.code),
      eventCodes: result.events.map((event) => event.code),
      eventIds: result.events.map((event) => event.eventId),
      canonicalJson: result.canonicalJson,
      signature: result.signature
    });

    const runScenario = (): ShipPowerThermalScenarioRun => {
      const normal = runStep(initialState, 1, 1, normalRequests, 0);
      const brownout = runStep(normal.state, 2, 0.4, normalRequests, 0);
      const warning = runStep(brownout.state, 3, 1, heatingRequests, 200);
      const critical = runStep(warning.state, 4, 1, heatingRequests, 200);
      const recovery = runStep(
        critical.state,
        5,
        1,
        [{ consumerId: ids.consumerCooling, requestedPowerW: 10 }],
        0
      );
      const normalOperation = summarize(normal);
      const reducedSourceBrownout = summarize(brownout);
      const warningStage = summarize(warning);
      const criticalStage = summarize(critical);
      const coolingRecovery = summarize(recovery);
      const eventStreams = [
        normalOperation.eventIds,
        reducedSourceBrownout.eventIds,
        warningStage.eventIds,
        criticalStage.eventIds,
        coolingRecovery.eventIds
      ];
      const semantic = {
        scenarioName: "deterministic-power-brownout-thermal-recovery" as const,
        modulePath: modulePath as "/src/ship-power-thermal/index.ts",
        fixtureIds: {
          generator: ids.sourceGenerator,
          battery: ids.batteryMain,
          criticalConsumer: ids.consumerCritical,
          flightConsumer: ids.consumerFlight,
          weaponMissionConsumer: ids.consumerMission,
          coolingConsumer: ids.consumerCooling,
          coolingUnit: ids.coolingMain
        },
        normalOperation,
        reducedSourceBrownout,
        thermalProgression: { warning: warningStage, critical: criticalStage },
        coolingRecovery,
        eventStreams
      };
      return {
        ...semantic,
        canonicalJson: domain.serializeCanonicalShipPowerThermalValue(semantic),
        signature: domain.createShipPowerThermalSignature(semantic)
      };
    };

    return { first: runScenario(), second: runScenario() };
  });

  const testBridgeAfter = await readTestBridgeState(page);
  expect(testBridgeAfter).toEqual({ ownProperty: false, inWindow: false });
  expect(browserHealth).toEqual({
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    nonSuccessHttpResponses: []
  });

  expect(repeated.second).toEqual(repeated.first);
  expect(repeated.second.canonicalJson).toBe(repeated.first.canonicalJson);
  expect(repeated.second.signature).toBe(repeated.first.signature);
  expect(repeated.second.eventStreams).toEqual(repeated.first.eventStreams);

  const fixture = repeated.first.fixtureIds;
  expect(repeated.first.normalOperation).toMatchObject({
    sourceOutputW: 85,
    battery: { flowState: "Idle", busPowerW: 0, previousStoredEnergyJ: 100, nextStoredEnergyJ: 100 },
    temperatureK: 290,
    protectionState: "Nominal",
    heatInputW: 0,
    heatRemovedW: 100,
    cooling: { allocatedOperatingPowerW: 10, heatRemovedW: 100, coolingInsufficient: false }
  });
  expect(repeated.first.normalOperation.consumers.map((entry) => [entry.consumerId, entry.state, entry.allocatedPowerW])).toEqual([
    [fixture.coolingConsumer, "Powered", 10],
    [fixture.criticalConsumer, "Powered", 20],
    [fixture.flightConsumer, "Powered", 30],
    [fixture.weaponMissionConsumer, "Powered", 25]
  ]);

  expect(repeated.first.reducedSourceBrownout).toMatchObject({
    sourceOutputW: 40,
    battery: { flowState: "Discharging", busPowerW: 20, previousStoredEnergyJ: 100, nextStoredEnergyJ: 80 },
    temperatureK: 290,
    protectionState: "Nominal"
  });
  expect(consumer(repeated.first.reducedSourceBrownout, fixture.criticalConsumer)).toMatchObject({
    priority: "Critical", state: "Powered", allocatedPowerW: 20
  });
  expect(consumer(repeated.first.reducedSourceBrownout, fixture.flightConsumer)).toMatchObject({
    priority: "Flight", state: "Powered", allocatedPowerW: 30
  });
  expect(consumer(repeated.first.reducedSourceBrownout, fixture.coolingConsumer)).toMatchObject({
    priority: "Safety", state: "Powered", allocatedPowerW: 10
  });
  expect(consumer(repeated.first.reducedSourceBrownout, fixture.weaponMissionConsumer)).toMatchObject({
    priority: "Mission", state: "Shed", allocatedPowerW: 0
  });
  expect(repeated.first.reducedSourceBrownout.actionCodes).toEqual(["PowerBusBrownout", "RequestConsumerShutdown"]);
  expect(repeated.first.reducedSourceBrownout.eventCodes).toEqual([
    "PowerAllocationCompleted",
    "PowerConsumerShed",
    "PowerBusBrownout"
  ]);

  expect(repeated.first.thermalProgression.warning).toMatchObject({
    temperatureK: 310,
    protectionState: "Warning",
    heatInputW: 200,
    heatRemovedW: 0
  });
  expect(repeated.first.thermalProgression.warning.eventCodes).toEqual([
    "PowerAllocationCompleted",
    "ThermalWarning"
  ]);
  expect(repeated.first.thermalProgression.critical).toMatchObject({
    temperatureK: 330,
    protectionState: "Critical",
    heatInputW: 200,
    heatRemovedW: 0
  });
  expect(repeated.first.thermalProgression.critical.actionCodes).toEqual([
    "CoolingInsufficient",
    "ThermalNodeCritical"
  ]);
  expect(repeated.first.thermalProgression.critical.eventCodes).toEqual([
    "PowerAllocationCompleted",
    "CoolingInsufficient",
    "ThermalCritical"
  ]);

  expect(repeated.first.coolingRecovery).toMatchObject({
    sourceOutputW: 10,
    temperatureK: 305,
    protectionState: "Nominal",
    heatInputW: 0,
    heatRemovedW: 250,
    cooling: { allocatedOperatingPowerW: 10, heatRemovedW: 250, coolingInsufficient: false }
  });
  expect(consumer(repeated.first.coolingRecovery, fixture.coolingConsumer)).toMatchObject({
    state: "Powered", allocatedPowerW: 10
  });

  const evidence: ShipPowerThermalBrowserEvidence = {
    schemaVersion: "browser-ship-power-thermal-core-v1",
    status: "PASS",
    generator,
    publicModulePath: repeated.first.modulePath,
    normalRoute: {
      path: "/",
      debugSceneVisible: true,
      faviconHref: "/favicon.png",
      testBridgeBefore,
      testBridgeAfter
    },
    browserHealth,
    deterministicRepeat: {
      completeResultEqual: true,
      canonicalJsonEqual: true,
      signatureEqual: true,
      eventStreamsEqual: true
    },
    scenario: repeated.first,
    verification: {
      command: focusedCommand,
      nodeVersion: "22",
      expectedResult: "one focused Playwright test passes and writes deterministic JSON and Markdown evidence",
      observedResult: "pass"
    }
  };

  await mkdir(evidenceDir, { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, createMarkdown(evidence), "utf8");
});
