import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type SurfaceEquipmentDomain = typeof import("../../src/surface-equipment/index");
type SuitDomain = typeof import("../../src/suit/index");
type CombatDomain = typeof import("../../src/combat/index");
type SurfaceEquipmentBlueprint = import("../../src/surface-equipment").SurfaceEquipmentBlueprint;
type InstallModuleCommand = import("../../src/surface-equipment").InstallModuleCommand;
type MutableRecord = Record<string, any>;

const evidenceDir = path.resolve(process.cwd(), "evidence");
const summaryPath = path.join(evidenceDir, "browser-surface-equipment-builder-core-v1-summary.json");
const markdownPath = path.join(evidenceDir, "browser-surface-equipment-builder-core-v1.md");
const generator = "apps/weltraum-browser/tests/e2e/surface-equipment-builder-core.spec.ts";
const focusedCommand = "npm run test:e2e -- tests/e2e/surface-equipment-builder-core.spec.ts --workers=1 --retries=0";

const dependencyShas = Object.freeze({
  interaction: "291c7d49e79d9a075a8ff6c50e7ddb578a8f1217",
  suit: "f8d257aeec17e8a6bd22400925ee816fc524b566",
  dependencyMerge: "ffb858ba661ae2d30f1e8c331ef5e6c163e9cd97"
});

interface BrowserFailures {
  readonly pageErrors: string[];
  readonly consoleErrors: string[];
  readonly failedResponses: string[];
  readonly requestFailures: string[];
}

interface TestBridgeState {
  readonly ownProperty: boolean;
  readonly inWindow: boolean;
}

interface FixtureSummary {
  readonly fixtureId: string;
  readonly catalogId: string;
  readonly category: string;
  readonly catalogSignature: string;
  readonly blueprintSignature: string;
  readonly slotCompatibility: readonly {
    readonly slotId: string;
    readonly slotTypeId: string;
    readonly moduleInstanceId: string;
    readonly moduleId: string;
    readonly compatibleSlotTypeIds: readonly string[];
  }[];
  readonly thermal: {
    readonly activeThermalLoadMilliwatts: number;
    readonly passiveDissipationMilliwatts: number;
    readonly netThermalBurdenMilliwatts: number;
    readonly heatPerActionMillijoules: number;
  };
  readonly statsProvenance: {
    readonly blueprintId: string;
    readonly revision: number;
    readonly catalogId: string;
    readonly catalogVersion: number;
    readonly signature: string;
  };
  readonly readinessProvenance: {
    readonly blueprintId: string;
    readonly revision: number;
    readonly catalogId: string;
    readonly catalogVersion: number;
    readonly statsSignature: string;
    readonly suitStateId: string;
    readonly suitRevision: number;
    readonly signature: string;
  };
  readonly readiness: string;
  readonly diagnostics: readonly { readonly code: string; readonly path: string }[];
  readonly balanceTier: "provisional-v0";
}

interface SurfaceEquipmentScenarioRun {
  readonly scenarioName: "six-fixtures-cutter-readiness-sidearm-safety-projections";
  readonly modulePath: "/src/surface-equipment/index.ts";
  readonly suitModulePath: "/src/suit/index.ts";
  readonly combatModulePath: "/src/combat/index.ts";
  readonly importedPublicApi: readonly string[];
  readonly fixtureCatalog: {
    readonly fixtureCount: 6;
    readonly catalogCount: 6;
    readonly fixtureIds: readonly string[];
    readonly catalogIds: readonly string[];
    readonly fixtures: readonly FixtureSummary[];
  };
  readonly diagnosticCodeOrder: readonly string[];
  readonly laserCutter: {
    readonly fixtureId: "blueprint:laser-cutter.v1";
    readonly damageType: "Cutting";
    readonly damageTypeAuthority: "imported Combat DamageType";
    readonly combatDamageTypesIncludesCutting: true;
    readonly deliveryClass: "Beam";
    readonly statsSignature: string;
  };
  readonly miningCutter: {
    readonly nominal: {
      readonly state: "Ready";
      readonly blockerCodes: readonly string[];
      readonly suitSnapshotSignature: string;
      readonly readinessSignature: string;
    };
    readonly insufficientEnergy: {
      readonly state: "Limited" | "Blocked";
      readonly blockerCodes: readonly string[];
      readonly blockerImpacts: readonly string[];
      readonly requiredPulseEnergyMillijoules: number;
      readonly availablePulseEnergyMillijoules: number;
      readonly suitSnapshotSignature: string;
      readonly readinessSignature: string;
      readonly policy: Readonly<Record<string, string>>;
    };
  };
  readonly ballisticSidearm: {
    readonly withoutSafety: {
      readonly revision: number;
      readonly state: "Blocked";
      readonly diagnosticCodes: readonly string[];
      readonly readinessSignature: string;
    };
    readonly installSafetyCommand: {
      readonly kind: "InstallModule";
      readonly status: "Accepted";
      readonly outcome: "Changed";
      readonly commandId: string;
      readonly installedModuleId: string;
      readonly installedModuleInstanceId: string;
      readonly resultingRevision: number;
    };
    readonly afterSafetyInstall: {
      readonly state: "Ready";
      readonly diagnosticCodes: readonly string[];
      readonly readinessSignature: string;
      readonly blueprintSignature: string;
    };
  };
  readonly projections: {
    readonly interaction: {
      readonly equipmentId: string;
      readonly readiness: string;
      readonly capabilityIds: readonly string[];
      readonly toolId: string;
      readonly rangeClass: string;
      readonly projectionSignature: string;
    };
    readonly combat: {
      readonly status: "Available";
      readonly damageType: string;
      readonly deliveryClass: string;
      readonly currentReadiness: string;
      readonly readinessRequired: string;
      readonly projectionSignature: string;
    };
  };
  readonly canonicalScenarioJson: string;
  readonly scenarioSignature: string;
}

interface SurfaceEquipmentBrowserEvidence {
  readonly schemaVersion: "browser-surface-equipment-builder-core-v1";
  readonly status: "PASS";
  readonly generator: string;
  readonly dependencyShas: typeof dependencyShas;
  readonly normalRoute: {
    readonly path: "/";
    readonly search: "";
    readonly debugSceneVisible: true;
    readonly testBridgeBefore: TestBridgeState;
    readonly testBridgeAfter: TestBridgeState;
  };
  readonly dynamicImport: {
    readonly modulePath: SurfaceEquipmentScenarioRun["modulePath"];
    readonly suitModulePath: SurfaceEquipmentScenarioRun["suitModulePath"];
    readonly combatModulePath: SurfaceEquipmentScenarioRun["combatModulePath"];
    readonly importedPublicApi: readonly string[];
  };
  readonly browserHealth: {
    readonly order: "pageErrors/consoleErrors/failedResponses/requestFailures";
    readonly summary: "0/0/0/0";
    readonly collectorsRegisteredBeforeNavigation: true;
    readonly pageErrors: 0;
    readonly consoleErrors: 0;
    readonly failedResponses: 0;
    readonly requestFailures: 0;
  };
  readonly deterministicRepeat: {
    readonly completeRunIdentical: true;
    readonly canonicalScenarioJsonIdentical: true;
    readonly scenarioSignatureIdentical: true;
  };
  readonly signatures: {
    readonly scenario: string;
    readonly canonicalScenarioBytes: number;
  };
  readonly fixtureSummary: SurfaceEquipmentScenarioRun["fixtureCatalog"];
  readonly diagnosticCodeOrder: SurfaceEquipmentScenarioRun["diagnosticCodeOrder"];
  readonly laserCutterProof: SurfaceEquipmentScenarioRun["laserCutter"];
  readonly readinessSummary: {
    readonly miningCutter: SurfaceEquipmentScenarioRun["miningCutter"];
    readonly ballisticSidearm: SurfaceEquipmentScenarioRun["ballisticSidearm"];
  };
  readonly projectionSummary: SurfaceEquipmentScenarioRun["projections"];
  readonly proof: SurfaceEquipmentScenarioRun;
  readonly v1Boundaries: readonly string[];
  readonly verification: {
    readonly command: string;
    readonly expectedResult: "one focused Playwright test passes and overwrites exactly two deterministic evidence files";
    readonly observedResult: "pass";
    readonly screenshot: "not captured: pure domain proof with no UI or render change";
    readonly productIntegration: "none";
  };
}

const installBrowserFailureCollectors = (page: Page): BrowserFailures => {
  const failures: BrowserFailures = { pageErrors: [], consoleErrors: [], failedResponses: [], requestFailures: [] };
  page.on("pageerror", (error) => failures.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") failures.consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (!response.ok()) failures.failedResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    failures.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`);
  });
  return failures;
};

const readTestBridgeState = (page: Page): Promise<TestBridgeState> => page.evaluate(() => ({
  ownProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
  inWindow: "TestBridge" in window
}));

const createMarkdown = (evidence: SurfaceEquipmentBrowserEvidence): string => {
  const fixtureRows = evidence.fixtureSummary.fixtures.map((fixture) =>
    `| ${fixture.fixtureId} | ${fixture.category} | ${fixture.readiness} | ${fixture.diagnostics.map((entry) => entry.code).join(", ") || "none"} | ${fixture.thermal.activeThermalLoadMilliwatts} mW | ${fixture.thermal.heatPerActionMillijoules} mJ | ${fixture.slotCompatibility.length}/${fixture.slotCompatibility.length} | \`${fixture.statsProvenance.signature}\` | \`${fixture.readinessProvenance.signature}\` |`
  ).join("\n");

  return `# Browser Surface Equipment Builder Core v1 Evidence

Generated by \`${evidence.generator}\` through the normal Browser route.

## Result

- Status: \`${evidence.status}\`
- Route: \`${evidence.normalRoute.path}${evidence.normalRoute.search}\`
- TestBridge absent before and after: \`${!evidence.normalRoute.testBridgeBefore.ownProperty && !evidence.normalRoute.testBridgeBefore.inWindow && !evidence.normalRoute.testBridgeAfter.ownProperty && !evidence.normalRoute.testBridgeAfter.inWindow}\`
- Public equipment import: \`${evidence.dynamicImport.modulePath}\`
- Public Combat authority import: \`${evidence.dynamicImport.combatModulePath}\`
- Browser health (${evidence.browserHealth.order}): \`${evidence.browserHealth.summary}\`
- Collectors registered before navigation: \`${evidence.browserHealth.collectorsRegisteredBeforeNavigation}\`
- Screenshot: ${evidence.verification.screenshot}
- Product integration: \`${evidence.verification.productIntegration}\`

## Dependency Baseline

- Interaction: \`${evidence.dependencyShas.interaction}\`
- Suit: \`${evidence.dependencyShas.suit}\`
- Dependency merge: \`${evidence.dependencyShas.dependencyMerge}\`

## Six Built-in Fixtures

| Fixture | Category | Nominal Suit readiness | Diagnostics | Active thermal load | Heat/action | Compatible assignments | Stats signature | Readiness signature |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${fixtureRows}

All ${evidence.fixtureSummary.fixtureCount} built-ins and ${evidence.fixtureSummary.catalogCount} fixture catalogs loaded from the public barrel. Every assigned module explicitly lists its assigned slot type in \`compatibleSlotTypeIds\`, and every module reports the provisional \`provisional-v0\` balance tier. Stats provenance records blueprint/catalog identity and revision; readiness provenance additionally records the exact stats signature and Suit state/revision.

Thermal units remain distinct: active thermal load, passive dissipation, and net thermal burden are rates in milliwatts (mW); heat per action is energy in millijoules (mJ).

## Imported Combat DamageType Proof

- Laser Cutter fixture: \`${evidence.laserCutterProof.fixtureId}\`
- Imported Combat \`DamageType\`: \`${evidence.laserCutterProof.damageType}\` (present in the Combat public registry: \`${evidence.laserCutterProof.combatDamageTypesIncludesCutting}\`)
- Surface Equipment delivery class: \`${evidence.laserCutterProof.deliveryClass}\`
- Derived stats signature: \`${evidence.laserCutterProof.statsSignature}\`

## Diagnostic Contract

Fixed public order: ${evidence.diagnosticCodeOrder.map((code) => `\`${code}\``).join(", ")}.

## Readiness And Public Command Proof

- Mining Cutter with the nominal Suit snapshot: \`${evidence.readinessSummary.miningCutter.nominal.state}\`.
- Mining Cutter with ${evidence.readinessSummary.miningCutter.insufficientEnergy.availablePulseEnergyMillijoules} mJ available for ${evidence.readinessSummary.miningCutter.insufficientEnergy.requiredPulseEnergyMillijoules} mJ demand: \`${evidence.readinessSummary.miningCutter.insufficientEnergy.state}\` with \`${evidence.readinessSummary.miningCutter.insufficientEnergy.blockerCodes.join(", ")}\`.
- Ballistic Sidearm without Safety: \`${evidence.readinessSummary.ballisticSidearm.withoutSafety.state}\` with diagnostics \`${evidence.readinessSummary.ballisticSidearm.withoutSafety.diagnosticCodes.join(", ")}\`.
- Public \`${evidence.readinessSummary.ballisticSidearm.installSafetyCommand.kind}\` command: \`${evidence.readinessSummary.ballisticSidearm.installSafetyCommand.status}/${evidence.readinessSummary.ballisticSidearm.installSafetyCommand.outcome}\`, revision \`${evidence.readinessSummary.ballisticSidearm.installSafetyCommand.resultingRevision}\`.
- Ballistic Sidearm after Safety installation: \`${evidence.readinessSummary.ballisticSidearm.afterSafetyInstall.state}\`.

## Projection Proof

- Interaction: equipment \`${evidence.projectionSummary.interaction.equipmentId}\`, readiness \`${evidence.projectionSummary.interaction.readiness}\`, range \`${evidence.projectionSummary.interaction.rangeClass}\`, signature \`${evidence.projectionSummary.interaction.projectionSignature}\`.
- Combat: \`${evidence.projectionSummary.combat.status}\`, \`${evidence.projectionSummary.combat.damageType}/${evidence.projectionSummary.combat.deliveryClass}\`, readiness \`${evidence.projectionSummary.combat.currentReadiness}\`, signature \`${evidence.projectionSummary.combat.projectionSignature}\`.

## Determinism

- Complete repeated run identical: \`${evidence.deterministicRepeat.completeRunIdentical}\`
- Canonical scenario JSON identical: \`${evidence.deterministicRepeat.canonicalScenarioJsonIdentical}\`
- Scenario signature identical: \`${evidence.deterministicRepeat.scenarioSignatureIdentical}\`
- Scenario signature: \`${evidence.signatures.scenario}\`
- Canonical scenario bytes: \`${evidence.signatures.canonicalScenarioBytes}\`

## Explicit V1 Boundaries

${evidence.v1Boundaries.map((boundary) => `- ${boundary}`).join("\n")}

## Focused Verification

- Command: \`${evidence.verification.command}\`
- Expected: ${evidence.verification.expectedResult}
- Observed: \`${evidence.verification.observedResult}\`
`;
};

test.use({ screenshot: "off", trace: "off" });

test("normal route proves surface equipment fixtures, readiness, commands, and projections twice", async ({ page }) => {
  const failures = installBrowserFailureCollectors(page);
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await page.waitForLoadState("networkidle");

  const routeUrl = new URL(page.url());
  expect(routeUrl.pathname).toBe("/");
  expect(routeUrl.search).toBe("");
  expect(routeUrl.searchParams.has("testBridge")).toBe(false);

  const testBridgeBefore = await readTestBridgeState(page);
  expect(testBridgeBefore).toEqual({ ownProperty: false, inWindow: false });

  const repeated = await page.evaluate<{
    readonly first: SurfaceEquipmentScenarioRun;
    readonly second: SurfaceEquipmentScenarioRun;
  }>(async () => {
    const modulePath = "/src/surface-equipment/index.ts" as const;
    const suitModulePath = "/src/suit/index.ts" as const;
    const combatModulePath = "/src/combat/index.ts" as const;
    const surface = (await import(/* @vite-ignore */ modulePath)) as SurfaceEquipmentDomain;
    const suit = (await import(/* @vite-ignore */ suitModulePath)) as SuitDomain;
    const combat = (await import(/* @vite-ignore */ combatModulePath)) as CombatDomain;
    const importedPublicApi = [
      "SURFACE_EQUIPMENT_FIXTURES",
      "MINING_CUTTER_FIXTURE",
      "BALLISTIC_SIDEARM_FIXTURE",
      "LASER_CUTTER_FIXTURE",
      "SURFACE_EQUIPMENT_DIAGNOSTIC_CODE_ORDER",
      "SURFACE_EQUIPMENT_BUDGET_READINESS_POLICY",
      "applySurfaceEquipmentCommand",
      "canonicalSurfaceEquipmentJson",
      "createCombatCapabilityProjection",
      "createInteractionCapabilityProjection",
      "createSurfaceEquipmentCommandId",
      "createSurfaceEquipmentSignature",
      "deriveSurfaceEquipmentStats",
      "evaluateEquipmentSuitReadiness"
    ] as const;
    for (const exportName of importedPublicApi) {
      if (!(exportName in surface)) throw new Error(`Missing public surface-equipment export: ${exportName}`);
    }
    for (const exportName of ["createSuitDefinition", "createSuitEquipmentInterfaceSnapshot", "createSuitStateSnapshot"] as const) {
      if (typeof suit[exportName] !== "function") throw new Error(`Missing public Suit export: ${exportName}`);
    }

    const createSuitSnapshot = (label: string, pulseEnergyMillijoules: number) => {
      const definition = suit.createSuitDefinition({
        schemaVersion: suit.SUIT_SCHEMA_VERSION,
        definitionId: `suit-definition:surface-equipment-${label}`,
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
        modeProfiles: suit.SUIT_LIFE_SUPPORT_MODES.map((mode) => ({
          mode,
          oxygenConsumptionAdjustmentMilligramsPerSecond: 0,
          energyConsumptionAdjustmentMillijoulesPerSecond: 0,
          temperatureDeltaAdjustmentMilliKelvinPerSecond: 0
        })),
        allowedModes: [...suit.SUIT_LIFE_SUPPORT_MODES],
        subsystemDefinitions: suit.SUIT_SUBSYSTEM_ROLES.map((role, index) => ({
          subsystemId: `subsystem:${role}`,
          role,
          continuousPowerDrawMilliwatts: 0,
          oxygenConsumptionReductionMilligramsPerSecond: 0,
          thermalDeltaMilliKelvinPerSecond: 0,
          contaminationFilterBasisPoints: 0,
          priority: 100 - index,
          requiredInterfaceId: "interface:primary",
          revision: 0
        })),
        interfaceDefinitions: [{
          interfaceId: "interface:primary",
          continuousPowerBudgetMilliwatts: 10_000,
          pulseEnergyReserveMillijoules: pulseEnergyMillijoules,
          thermalDissipationBudgetMilliwatts: 10_000,
          revision: 0
        }],
        failSafeModeOnEquipmentBusLoss: "Emergency",
        registryVersion: "suit-registry:surface-equipment-e2e-v1",
        algorithmVersion: "suit-algorithm:surface-equipment-e2e-v1"
      });
      const state = suit.createSuitStateSnapshot({
        schemaVersion: suit.SUIT_SCHEMA_VERSION,
        stateId: `suit-state:surface-equipment-${label}`,
        actorId: "actor:surface-equipment-e2e",
        definitionId: definition.definitionId,
        revision: 0,
        tick: 0,
        healthMilliPoints: 10_000,
        healthRepairCeilingMilliPoints: 10_000,
        oxygenMilligrams: 10_000,
        energyMillijoules: pulseEnergyMillijoules,
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
      return suit.createSuitEquipmentInterfaceSnapshot(state, definition);
    };

    const runScenario = (): SurfaceEquipmentScenarioRun => {
      const nominalSuit = createSuitSnapshot("nominal", 10_000);
      const lowEnergySuit = createSuitSnapshot("low-energy", 1_000);
      const fixtureSummaries: FixtureSummary[] = surface.SURFACE_EQUIPMENT_FIXTURES.map((fixture) => {
        const stats = surface.deriveSurfaceEquipmentStats(fixture.blueprint, fixture.catalog);
        const readiness = surface.evaluateEquipmentSuitReadiness(fixture.blueprint, stats, nominalSuit);
        const slotCompatibility = fixture.blueprint.slotAssignments.flatMap((assignment) => {
          const slot = fixture.catalog.slots.find((candidate) => candidate.slotId === assignment.slotId);
          if (slot === undefined) throw new Error(`Fixture ${fixture.fixtureId} references an unknown slot.`);
          return assignment.moduleInstanceIds.map((moduleInstanceId) => {
            const instance = fixture.blueprint.moduleInstances.find((candidate) => candidate.moduleInstanceId === moduleInstanceId);
            const module = fixture.catalog.modules.find((candidate) => candidate.moduleId === instance?.moduleId);
            if (instance === undefined || module === undefined) {
              throw new Error(`Fixture ${fixture.fixtureId} references an unknown module instance.`);
            }
            if (!module.compatibleSlotTypeIds.includes(slot.slotTypeId)) {
              throw new Error(`Fixture ${fixture.fixtureId} assigns ${module.moduleId} to an incompatible slot type.`);
            }
            return {
              slotId: slot.slotId,
              slotTypeId: slot.slotTypeId,
              moduleInstanceId,
              moduleId: module.moduleId,
              compatibleSlotTypeIds: module.compatibleSlotTypeIds
            };
          });
        });
        const balanceTiers = [...new Set(fixture.catalog.modules.map((module) => module.balanceMetadata.tier))];
        if (balanceTiers.length !== 1 || balanceTiers[0] !== "provisional-v0") {
          throw new Error(`Fixture ${fixture.fixtureId} does not have one provisional-v0 balance tier.`);
        }
        return {
          fixtureId: fixture.fixtureId,
          catalogId: fixture.catalog.catalogId,
          category: fixture.blueprint.category,
          catalogSignature: fixture.catalog.contentSignature,
          blueprintSignature: fixture.blueprint.contentSignature,
          slotCompatibility,
          thermal: {
            activeThermalLoadMilliwatts: stats.activeThermalLoadMilliwatts,
            passiveDissipationMilliwatts: stats.passiveDissipationMilliwatts,
            netThermalBurdenMilliwatts: stats.netThermalBurdenMilliwatts,
            heatPerActionMillijoules: stats.heatPerActionMillijoules
          },
          statsProvenance: {
            blueprintId: stats.blueprintId,
            revision: stats.revision,
            catalogId: stats.catalogId,
            catalogVersion: stats.catalogVersion,
            signature: stats.signature
          },
          readinessProvenance: {
            blueprintId: readiness.blueprintId,
            revision: readiness.revision,
            catalogId: readiness.catalogId,
            catalogVersion: readiness.catalogVersion,
            statsSignature: readiness.statsSignature,
            suitStateId: readiness.suitStateId,
            suitRevision: readiness.suitRevision,
            signature: readiness.signature
          },
          readiness: readiness.state,
          diagnostics: stats.diagnostics.map((entry) => ({ code: entry.code, path: entry.path })),
          balanceTier: balanceTiers[0]
        };
      });

      const cutter = surface.MINING_CUTTER_FIXTURE;
      const cutterStats = surface.deriveSurfaceEquipmentStats(cutter.blueprint, cutter.catalog);
      const nominalCutterReadiness = surface.evaluateEquipmentSuitReadiness(cutter.blueprint, cutterStats, nominalSuit);
      const lowEnergyCutterReadiness = surface.evaluateEquipmentSuitReadiness(cutter.blueprint, cutterStats, lowEnergySuit);

      const laser = surface.LASER_CUTTER_FIXTURE;
      const laserStats = surface.deriveSurfaceEquipmentStats(laser.blueprint, laser.catalog);
      if (laserStats.damageType !== "Cutting" || !combat.DAMAGE_TYPES.includes(laserStats.damageType)) {
        throw new Error("Laser Cutter does not expose the imported Combat DamageType Cutting.");
      }
      if (laserStats.deliveryClass !== "Beam") {
        throw new Error("Laser Cutter does not expose Beam delivery.");
      }

      const sidearm = surface.BALLISTIC_SIDEARM_FIXTURE;
      const safetyModule = sidearm.catalog.modules.find((entry) => entry.primaryRole === "Safety");
      const safetyInstance = sidearm.blueprint.moduleInstances.find((entry) => entry.moduleId === safetyModule?.moduleId);
      const safetySlot = sidearm.catalog.slots.find((entry) => entry.allowedRoles.includes("Safety"));
      if (safetyModule === undefined || safetyInstance === undefined || safetySlot === undefined) {
        throw new Error("Ballistic Sidearm fixture is missing its public Safety facts.");
      }
      const unsafeBlueprint = structuredClone(sidearm.blueprint) as MutableRecord;
      unsafeBlueprint.moduleInstances = unsafeBlueprint.moduleInstances.filter(
        (entry: MutableRecord) => entry.moduleInstanceId !== safetyInstance.moduleInstanceId
      );
      unsafeBlueprint.slotAssignments = unsafeBlueprint.slotAssignments.map((entry: MutableRecord) => ({
        ...entry,
        moduleInstanceIds: entry.moduleInstanceIds.filter((id: string) => id !== safetyInstance.moduleInstanceId)
      }));
      unsafeBlueprint.calibrationChoices = unsafeBlueprint.calibrationChoices.filter(
        (entry: MutableRecord) => entry.moduleInstanceId !== safetyInstance.moduleInstanceId
      );
      const unsafeStats = surface.deriveSurfaceEquipmentStats(unsafeBlueprint as SurfaceEquipmentBlueprint, sidearm.catalog);
      const unsafeReadiness = surface.evaluateEquipmentSuitReadiness(
        unsafeBlueprint as SurfaceEquipmentBlueprint,
        unsafeStats,
        nominalSuit
      );

      const installCommand: InstallModuleCommand = {
        kind: "InstallModule",
        commandId: surface.createSurfaceEquipmentCommandId("command:e2e-install-ballistic-safety"),
        blueprintId: sidearm.blueprint.blueprintId,
        expectedRevision: unsafeBlueprint.revision,
        resultingRevision: unsafeBlueprint.revision + 1,
        payload: {
          slotId: safetySlot.slotId,
          moduleInstanceId: safetyInstance.moduleInstanceId,
          moduleId: safetyModule.moduleId
        },
        source: "source:e2e-surface-equipment-proof",
        sequence: 1
      };
      const installResult = surface.applySurfaceEquipmentCommand(
        unsafeBlueprint as SurfaceEquipmentBlueprint,
        sidearm.catalog,
        installCommand
      );
      if (installResult.status !== "Accepted") {
        throw new Error(`Safety installation was rejected: ${installResult.diagnostics.map((entry) => entry.code).join(",")}`);
      }
      const repairedStats = surface.deriveSurfaceEquipmentStats(installResult.blueprint, sidearm.catalog);
      const repairedReadiness = surface.evaluateEquipmentSuitReadiness(
        installResult.blueprint,
        repairedStats,
        nominalSuit
      );
      const interactionProjection = surface.createInteractionCapabilityProjection(
        installResult.blueprint,
        repairedStats,
        repairedReadiness
      );
      const combatProjection = surface.createCombatCapabilityProjection(
        installResult.blueprint,
        repairedStats,
        repairedReadiness
      );
      if (combatProjection.status !== "Available") {
        throw new Error(`Expected an available Ballistic Sidearm Combat projection, received ${combatProjection.status}.`);
      }

      const facts = {
        scenarioName: "six-fixtures-cutter-readiness-sidearm-safety-projections" as const,
        modulePath,
        suitModulePath,
        combatModulePath,
        importedPublicApi,
        fixtureCatalog: {
          fixtureCount: surface.SURFACE_EQUIPMENT_FIXTURES.length as 6,
          catalogCount: new Set(surface.SURFACE_EQUIPMENT_FIXTURES.map((fixture) => fixture.catalog.catalogId)).size as 6,
          fixtureIds: surface.SURFACE_EQUIPMENT_FIXTURES.map((fixture) => fixture.fixtureId),
          catalogIds: surface.SURFACE_EQUIPMENT_FIXTURES.map((fixture) => fixture.catalog.catalogId),
          fixtures: fixtureSummaries
        },
        diagnosticCodeOrder: surface.SURFACE_EQUIPMENT_DIAGNOSTIC_CODE_ORDER,
        laserCutter: {
          fixtureId: laser.fixtureId as "blueprint:laser-cutter.v1",
          damageType: laserStats.damageType,
          damageTypeAuthority: "imported Combat DamageType" as const,
          combatDamageTypesIncludesCutting: true as const,
          deliveryClass: laserStats.deliveryClass,
          statsSignature: laserStats.signature
        },
        miningCutter: {
          nominal: {
            state: nominalCutterReadiness.state as "Ready",
            blockerCodes: nominalCutterReadiness.blockers.map((entry) => entry.code),
            suitSnapshotSignature: nominalSuit.canonicalSignature,
            readinessSignature: nominalCutterReadiness.signature
          },
          insufficientEnergy: {
            state: lowEnergyCutterReadiness.state as "Limited" | "Blocked",
            blockerCodes: lowEnergyCutterReadiness.blockers.map((entry) => entry.code),
            blockerImpacts: lowEnergyCutterReadiness.blockers.map((entry) => entry.impact),
            requiredPulseEnergyMillijoules: cutterStats.pulseEnergyMillijoules,
            availablePulseEnergyMillijoules: lowEnergySuit.pulseEnergyAvailableMillijoules,
            suitSnapshotSignature: lowEnergySuit.canonicalSignature,
            readinessSignature: lowEnergyCutterReadiness.signature,
            policy: surface.SURFACE_EQUIPMENT_BUDGET_READINESS_POLICY
          }
        },
        ballisticSidearm: {
          withoutSafety: {
            revision: unsafeBlueprint.revision as number,
            state: unsafeReadiness.state as "Blocked",
            diagnosticCodes: unsafeStats.diagnostics.map((entry) => entry.code),
            readinessSignature: unsafeReadiness.signature
          },
          installSafetyCommand: {
            kind: installCommand.kind,
            status: installResult.status,
            outcome: installResult.outcome as "Changed",
            commandId: installCommand.commandId,
            installedModuleId: safetyModule.moduleId,
            installedModuleInstanceId: safetyInstance.moduleInstanceId,
            resultingRevision: installResult.blueprint.revision
          },
          afterSafetyInstall: {
            state: repairedReadiness.state as "Ready",
            diagnosticCodes: repairedStats.diagnostics.map((entry) => entry.code),
            readinessSignature: repairedReadiness.signature,
            blueprintSignature: installResult.blueprint.contentSignature
          }
        },
        projections: {
          interaction: {
            equipmentId: interactionProjection.equipmentId,
            readiness: interactionProjection.readiness,
            capabilityIds: interactionProjection.capabilityIds,
            toolId: interactionProjection.toolId,
            rangeClass: interactionProjection.rangeClass,
            projectionSignature: surface.createSurfaceEquipmentSignature(interactionProjection)
          },
          combat: {
            status: combatProjection.status,
            damageType: combatProjection.projection.damageType,
            deliveryClass: combatProjection.projection.deliveryClass,
            currentReadiness: combatProjection.projection.firePermission.currentReadiness,
            readinessRequired: combatProjection.projection.firePermission.readinessRequired,
            projectionSignature: surface.createSurfaceEquipmentSignature(combatProjection)
          }
        }
      };
      return {
        ...facts,
        canonicalScenarioJson: surface.canonicalSurfaceEquipmentJson(facts),
        scenarioSignature: surface.createSurfaceEquipmentSignature(facts)
      };
    };

    return { first: runScenario(), second: runScenario() };
  });

  await page.waitForLoadState("networkidle");
  const testBridgeAfter = await readTestBridgeState(page);
  expect(testBridgeAfter).toEqual({ ownProperty: false, inWindow: false });
  expect(failures).toEqual({ pageErrors: [], consoleErrors: [], failedResponses: [], requestFailures: [] });

  expect(repeated.second).toEqual(repeated.first);
  expect(repeated.second.canonicalScenarioJson).toBe(repeated.first.canonicalScenarioJson);
  expect(repeated.second.scenarioSignature).toBe(repeated.first.scenarioSignature);
  expect(repeated.first.fixtureCatalog.fixtureCount).toBe(6);
  expect(repeated.first.fixtureCatalog.catalogCount).toBe(6);
  expect(repeated.first.fixtureCatalog.fixtureIds).toEqual([
    "blueprint:survey-scanner.v1",
    "blueprint:mining-cutter.v1",
    "blueprint:repair-tool.v1",
    "blueprint:emp-breacher.v1",
    "blueprint:ballistic-sidearm.v1",
    "blueprint:laser-cutter.v1"
  ]);
  expect(repeated.first.fixtureCatalog.fixtures.every((fixture) =>
    fixture.readiness === "Ready" && fixture.diagnostics.length === 0 && fixture.balanceTier === "provisional-v0" &&
    fixture.slotCompatibility.length > 0 &&
    fixture.slotCompatibility.every((entry) => entry.compatibleSlotTypeIds.includes(entry.slotTypeId)) &&
    fixture.statsProvenance.blueprintId === fixture.fixtureId &&
    fixture.statsProvenance.catalogId === fixture.catalogId &&
    fixture.readinessProvenance.blueprintId === fixture.fixtureId &&
    fixture.readinessProvenance.catalogId === fixture.catalogId &&
    fixture.readinessProvenance.statsSignature === fixture.statsProvenance.signature
  )).toBe(true);
  expect(repeated.first.fixtureCatalog.fixtures.map((fixture) => fixture.thermal)).toEqual([
    { activeThermalLoadMilliwatts: 100, passiveDissipationMilliwatts: 0, netThermalBurdenMilliwatts: 100, heatPerActionMillijoules: 0 },
    { activeThermalLoadMilliwatts: 1_000, passiveDissipationMilliwatts: 800, netThermalBurdenMilliwatts: 200, heatPerActionMillijoules: 700 },
    { activeThermalLoadMilliwatts: 200, passiveDissipationMilliwatts: 0, netThermalBurdenMilliwatts: 200, heatPerActionMillijoules: 0 },
    { activeThermalLoadMilliwatts: 600, passiveDissipationMilliwatts: 0, netThermalBurdenMilliwatts: 600, heatPerActionMillijoules: 500 },
    { activeThermalLoadMilliwatts: 100, passiveDissipationMilliwatts: 0, netThermalBurdenMilliwatts: 100, heatPerActionMillijoules: 0 },
    { activeThermalLoadMilliwatts: 1_500, passiveDissipationMilliwatts: 1_100, netThermalBurdenMilliwatts: 400, heatPerActionMillijoules: 1_000 }
  ]);
  expect(repeated.first.laserCutter).toMatchObject({
    fixtureId: "blueprint:laser-cutter.v1",
    damageType: "Cutting",
    damageTypeAuthority: "imported Combat DamageType",
    combatDamageTypesIncludesCutting: true,
    deliveryClass: "Beam"
  });
  expect(repeated.first.diagnosticCodeOrder).toEqual([
    "MissingRequiredSlot", "SlotCountMismatch", "SlotTypeMismatch", "SlotRoleMismatch", "TagIncompatible",
    "InterfaceMissing", "MassLimitExceeded", "BulkLimitExceeded", "ContinuousPowerExceeded", "PulseEnergyExceeded",
    "ThermalBudgetExceeded", "AmmoFeedMissing", "MagazineMissing", "ControlMissing", "SafetyMissing",
    "SafetyCertificationInvalid", "DamageDeliveryIncomplete", "CapabilityUnsatisfied", "ResourceRequirementInvalid",
    "AggregateOverflow", "SuitActorIncapacitated", "SuitEquipmentBusOffline", "LegalConfigurationInvalid",
    "DuplicateModuleInstance", "RevisionConflict", "DuplicateCommand", "BlueprintMismatch", "UnknownModuleInstance",
    "UnknownModule", "UnknownSlot", "SlotCapacityExceeded", "CalibrationInvalid", "GripRequirementUnsatisfied", "InvalidCommand"
  ]);
  expect(repeated.first.miningCutter.nominal).toMatchObject({ state: "Ready", blockerCodes: [] });
  expect(repeated.first.miningCutter.insufficientEnergy).toMatchObject({
    state: "Limited",
    blockerCodes: ["PulseEnergyExceeded"],
    blockerImpacts: ["Limited"],
    requiredPulseEnergyMillijoules: 2_100,
    availablePulseEnergyMillijoules: 1_000
  });
  expect(repeated.first.ballisticSidearm.withoutSafety).toMatchObject({
    state: "Blocked",
    diagnosticCodes: ["MissingRequiredSlot", "SafetyMissing"]
  });
  expect(repeated.first.ballisticSidearm.installSafetyCommand).toMatchObject({
    kind: "InstallModule",
    status: "Accepted",
    outcome: "Changed",
    resultingRevision: 1
  });
  expect(repeated.first.ballisticSidearm.afterSafetyInstall).toMatchObject({ state: "Ready", diagnosticCodes: [] });
  expect(repeated.first.projections.interaction).toMatchObject({
    equipmentId: "blueprint:ballistic-sidearm.v1",
    readiness: "Ready",
    capabilityIds: ["capability.access"],
    rangeClass: "Long"
  });
  expect(repeated.first.projections.combat).toMatchObject({
    status: "Available",
    damageType: "Kinetic",
    deliveryClass: "Projectile",
    currentReadiness: "Ready",
    readinessRequired: "Ready"
  });

  const evidence: SurfaceEquipmentBrowserEvidence = {
    schemaVersion: "browser-surface-equipment-builder-core-v1",
    status: "PASS",
    generator,
    dependencyShas,
    normalRoute: {
      path: "/",
      search: "",
      debugSceneVisible: true,
      testBridgeBefore,
      testBridgeAfter
    },
    dynamicImport: {
      modulePath: repeated.first.modulePath,
      suitModulePath: repeated.first.suitModulePath,
      combatModulePath: repeated.first.combatModulePath,
      importedPublicApi: repeated.first.importedPublicApi
    },
    browserHealth: {
      order: "pageErrors/consoleErrors/failedResponses/requestFailures",
      summary: "0/0/0/0",
      collectorsRegisteredBeforeNavigation: true,
      pageErrors: 0,
      consoleErrors: 0,
      failedResponses: 0,
      requestFailures: 0
    },
    deterministicRepeat: {
      completeRunIdentical: true,
      canonicalScenarioJsonIdentical: true,
      scenarioSignatureIdentical: true
    },
    signatures: {
      scenario: repeated.first.scenarioSignature,
      canonicalScenarioBytes: new TextEncoder().encode(repeated.first.canonicalScenarioJson).byteLength
    },
    fixtureSummary: repeated.first.fixtureCatalog,
    diagnosticCodeOrder: repeated.first.diagnosticCodeOrder,
    laserCutterProof: repeated.first.laserCutter,
    readinessSummary: {
      miningCutter: repeated.first.miningCutter,
      ballisticSidearm: repeated.first.ballisticSidearm
    },
    projectionSummary: repeated.first.projections,
    proof: repeated.first,
    v1Boundaries: [
      "Pure TypeScript catalog, blueprint, command, diagnostics, readiness, and projection proof only.",
      "No main.ts, UI, renderer, Three.js, TestBridge, package, Playwright config, CI-group, or product-runtime integration.",
      "Readiness consumes an immutable Suit equipment-interface snapshot and does not reserve or consume Suit energy.",
      "Interaction and Combat projections publish immutable facts and intent; they do not evaluate/complete interactions or create/fire runtime weapons.",
      "Resource requirements are projected only; no inventory reservation, consumption, or transfer occurs.",
      "Safety and legal class remain metadata; V1 applies no faction, security, or legal consequences.",
      "All six fixture values remain provisional-v0 rather than production balance.",
      "No screenshot is evidence for this non-visual domain slice."
    ],
    verification: {
      command: focusedCommand,
      expectedResult: "one focused Playwright test passes and overwrites exactly two deterministic evidence files",
      observedResult: "pass",
      screenshot: "not captured: pure domain proof with no UI or render change",
      productIntegration: "none"
    }
  };

  await mkdir(evidenceDir, { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, createMarkdown(evidence), "utf8");
});
