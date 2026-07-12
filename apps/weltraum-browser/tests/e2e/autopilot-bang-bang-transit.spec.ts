import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BangBangTransitMetrics } from "../../src/test-harness/autopilotBangBangMetrics";

const evidenceDir = path.resolve(process.cwd(), "evidence");
const machineEvidencePath = path.join(evidenceDir, "browser-autopilot-bang-bang-metrics.json");
const humanEvidencePath = path.join(evidenceDir, "browser-autopilot-bang-bang-report.json");
const timelineEvidencePath = path.join(evidenceDir, "browser-autopilot-bang-bang-timeline.json");
const standardGravityMps2 = 9.80665;

const legacy2500mBaselineSeconds = Object.freeze({
  Safe: 215.7,
  Balanced: 147.6,
  Fast: 123.0
});

const directScenarioId = (policy: "crew-comfort" | "crew-sprint" | "economy", distance: 500 | 1000 | 2500) =>
  `${policy}-${distance}m`;

const isFiniteMetric = (value: unknown): boolean => typeof value === "number" && Number.isFinite(value);

const idealizedKinematics = (result: BangBangTransitMetrics) => {
  const accelerationMps2 = result.actualAcceleration.peakPositiveG * standardGravityMps2;
  const canUseConstantAccelerationLowerBound = accelerationMps2 > 0 && result.transitPolicy.resolved !== "Economy";
  return {
    label: "Idealized constant-acceleration rest-to-rest lower bound, not the simulated result",
    assumptions: [
      "No finite attitude alignment or flip time",
      "No jerk ramp, terminal capture, station keeping, obstacle geometry, or RCS correction",
      "Uses recorded peak positive actuator acceleration only"
    ],
    accelerationMps2: Number(accelerationMps2.toFixed(4)),
    lowerBoundSeconds: canUseConstantAccelerationLowerBound
      ? Number((2 * Math.sqrt(result.targetDistanceMeters / accelerationMps2)).toFixed(4))
      : null,
    simulatedFirstArrivalSeconds: result.firstArrival.simulatedSeconds
  };
};

test("bang-bang transit creates deterministic core-truth machine, human, and timeline evidence", async ({ page }) => {
  await mkdir(evidenceDir, { recursive: true });
  await page.goto("/?testBridge=1");
  await page.waitForFunction(() => Boolean((window as any).TestBridge));

  const firstRun = await page.evaluate(() => (window as any).TestBridge.runBangBangTransitScenarioMatrix());
  const secondRun = await page.evaluate(() => (window as any).TestBridge.runBangBangTransitScenarioMatrix());
  const results = firstRun as BangBangTransitMetrics[];

  expect(secondRun).toEqual(firstRun);
  expect(results).toHaveLength(22);
  expect(results.every((result) => result.fixedStepHz === 30)).toBe(true);
  expect(results.every((result) => result.classification === result.expectedOutcome)).toBe(true);
  expect(results.every((result) => result.lockedPlan.stable)).toBe(true);
  expect(results.every((result) => result.modeledPropulsion.throttleEfficiencyClaim === false)).toBe(true);

  const byId = (id: string): BangBangTransitMetrics => {
    const result = results.find((candidate) => candidate.scenarioId === id);
    if (!result) {
      throw new Error(`Missing evidence scenario ${id}`);
    }
    return result;
  };

  const policyComparisons = ([500, 1000, 2500] as const).map((distance) => {
    const crewComfort = byId(directScenarioId("crew-comfort", distance));
    const crewSprint = byId(directScenarioId("crew-sprint", distance));
    const economy = byId(directScenarioId("economy", distance));

    for (const result of [crewComfort, crewSprint, economy]) {
      expect(result.classification, result.scenarioId).toBe("Pass");
      expect(result.firstArrival.finalDistanceMeters, result.scenarioId).toBeLessThanOrEqual(3);
      expect(result.firstArrival.finalSpeedMps, result.scenarioId).toBeLessThanOrEqual(0.5);
      expect(result.signals.replanRequired, result.scenarioId).toBe(false);
      expect(result.lockedPlan.completed, result.scenarioId).toBe(result.lockedPlan.before);
    }

    expect(crewSprint.firstArrival.simulatedSeconds ?? Number.MAX_VALUE).toBeLessThan(crewComfort.firstArrival.simulatedSeconds ?? 0);
    expect(economy.firstArrival.simulatedSeconds ?? 0).toBeGreaterThan(crewSprint.firstArrival.simulatedSeconds ?? Number.MAX_VALUE);
    expect(economy.peakSpeedMps).toBeLessThan(crewSprint.peakSpeedMps);
    expect(economy.modeledPropulsion.totalDeltaVMps).toBeLessThan(crewSprint.modeledPropulsion.totalDeltaVMps);
    expect(economy.modeledPropulsion.impulseNewtonSeconds).toBeLessThan(crewSprint.modeledPropulsion.impulseNewtonSeconds);
    expect(economy.modeledPropulsion.actualFuelUsedKg).toBeLessThan(crewSprint.modeledPropulsion.actualFuelUsedKg);

    return {
      distanceMeters: distance,
      crewComfort,
      crewSprint,
      economy,
      idealizedKinematics: {
        crewComfort: idealizedKinematics(crewComfort),
        crewSprint: idealizedKinematics(crewSprint),
        economy: idealizedKinematics(economy)
      }
    };
  });

  const human = byId("human-sprint-high-thrust-1000m");
  const drone = byId("drone-sprint-high-g-1000m");
  const underpowered = byId("underpowered-crew-comfort-1000m");
  const lowRcs = byId("low-rcs-attitude-expected-fail");
  const terminalHolding = byId("terminal-holding-no-snap");
  const geometryResults = [byId("single-obstacle-corner-1000m"), byId("sharp-corner-geometry-1000m")];

  expect(human.actualAcceleration.peakAppliedG).toBeLessThanOrEqual(1.5 + 1e-6);
  expect(human.actualAcceleration.aboveHumanMaximumSeconds).toBe(0);
  expect(drone.actualAcceleration.peakAppliedG).toBeGreaterThan(human.actualAcceleration.peakAppliedG);
  expect(drone.actualAcceleration.peakAppliedG).toBeGreaterThan(1.5);
  expect(drone.actualAcceleration.peakAppliedAccelerationMps2).toBeLessThanOrEqual(drone.physicalLimits.sustainedThermalMaxAccelerationMps2 + 1e-6);
  expect(drone.physicalLimits.maximumHumanG).toBeNull();
  expect(underpowered.classification).toBe("ExpectedFail");
  expect(underpowered.status).toBe("NoAuthority");
  expect(underpowered.actualAcceleration.belowComfortMainBurnSeconds).toBe(0);
  expect(underpowered.signals.failureReasonCodes).toEqual(["ComfortAccelerationUnavailable"]);
  expect(underpowered.signals.invalidationReasons).toEqual(["ComfortAccelerationUnavailable"]);
  expect(lowRcs.classification).toBe("ExpectedFail");
  expect(lowRcs.signals.failureReasonCodes).toContain("AuthorityInsufficient");
  expect(lowRcs.actualAcceleration.peakAppliedG).toBe(0);
  expect(terminalHolding.signals.holdingObserved).toBe(true);
  expect(terminalHolding.firstArrival.finalDistanceMeters).toBeGreaterThan(0);
  for (const geometry of geometryResults) {
    expect(geometry.classification, geometry.scenarioId).toBe("Pass");
    expect(geometry.minObstacleClearanceMeters, geometry.scenarioId).toBeGreaterThanOrEqual(0);
  }

  const metricNumbers = results.flatMap((result) => [
    result.simulatedSeconds,
    result.peakSpeedMps,
    result.firstArrival.finalDistanceMeters,
    result.firstArrival.finalSpeedMps,
    result.settledTerminal.distanceMeters,
    result.settledTerminal.speedMps,
    result.actualAcceleration.peakPositiveG,
    result.actualAcceleration.peakNegativeG,
    result.actualAcceleration.sustainedPositiveG,
    result.actualAcceleration.sustainedNegativeG,
    result.modeledPropulsion.impulseNewtonSeconds,
    result.modeledPropulsion.totalDeltaVMps,
    result.modeledPropulsion.actualFuelUsedKg,
    result.modeledThermal.accumulatedHeatLoad,
    result.minObstacleClearanceMeters
  ]);
  expect(metricNumbers.every(isFiniteMetric)).toBe(true);

  const machineEvidence = {
    schemaVersion: 1,
    evidenceKind: "machine-readable-core-truth-metrics",
    evidenceOwner: "apps/weltraum-browser/tests/e2e/autopilot-bang-bang-transit.spec.ts",
    fixedStepHz: 30,
    deterministicRepeatability: true,
    immutableLegacy2500mBaselineSeconds: legacy2500mBaselineSeconds,
    policyComparisons,
    specialCases: {
      human,
      drone,
      underpowered,
      lowRcs,
      terminalHolding,
      geometry: geometryResults
    },
    scenarios: results
  };
  const humanEvidence = {
    schemaVersion: 1,
    evidenceKind: "human-readable-transit-report",
    title: "Browser Autopilot Bang-Bang Transit Profiles v1",
    deterministicRepeatability: "Two independent query-gated TestBridge runs produced identical structured results.",
    legacyBaseline: {
      label: "Immutable legacy capped 2500 m simulated baselines; these are not ideal kinematics.",
      seconds: legacy2500mBaselineSeconds
    },
    summaries: [
      "All gravity and phase metrics come from executor/actuator truth at a fixed 30 Hz; renderer and UI do not contribute physics truth.",
      "Coast, Flip, TerminalCapture, and Holding phases only report their actual controller output. A phase label never creates gravity.",
      "Economy uses lower modeled impulse, total delta-v, peak speed, and fuel in the existing fixed impulse model. It does not claim a throttle-efficiency bonus.",
      "Modeled thermal fields are abstract capability metadata only. Browser v1 does not model a heat-soak curve or thermal throttle bonus.",
      "The abstract propulsion snapshot is a future Ship Builder data boundary, not a Ship Builder implementation."
    ],
    policyComparisonRows: policyComparisons.map((comparison) => ({
      distanceMeters: comparison.distanceMeters,
      rows: [comparison.crewComfort, comparison.crewSprint, comparison.economy].map((result) => ({
        policy: result.transitPolicy.resolved,
        simulatedFirstArrivalSeconds: result.firstArrival.simulatedSeconds,
        peakSpeedMps: result.peakSpeedMps,
        totalDeltaVMps: result.modeledPropulsion.totalDeltaVMps,
        impulseNewtonSeconds: result.modeledPropulsion.impulseNewtonSeconds,
        actualFuelUsedKg: result.modeledPropulsion.actualFuelUsedKg,
        classification: result.classification
      })),
      idealizedKinematics: comparison.idealizedKinematics
    })),
    safetySummary: {
      lowRcs: "ExpectedFail / AuthorityInsufficient; no world-space thrust, fake RCS, snap, or silent replan is used.",
      terminal: "First-arrival and post-arrival settled fields remain separate, retaining terminal capture and controller-integrated holding evidence.",
      lockedPlan: "Every scenario records before/after/completed hashes and replan/failure/invalidation signals.",
      obstacleGeometry: geometryResults.map((result) => ({ scenarioId: result.scenarioId, clearanceMeters: result.minObstacleClearanceMeters, classification: result.classification }))
    }
  };
  const timelineEvidence = {
    schemaVersion: 1,
    evidenceKind: "phase-timeline-core-truth",
    evidenceOwner: "apps/weltraum-browser/tests/e2e/autopilot-bang-bang-transit.spec.ts",
    fixedStepHz: 30,
    timelines: results.map((result) => ({
      scenarioId: result.scenarioId,
      classification: result.classification,
      phaseDurationsSeconds: result.phaseDurationsSeconds,
      phaseTimeline: result.phaseTimeline,
      actualAcceleration: result.actualAcceleration,
      terminal: { firstArrival: result.firstArrival, settled: result.settledTerminal },
      lockedPlan: result.lockedPlan,
      signals: result.signals
    }))
  };

  await writeFile(machineEvidencePath, `${JSON.stringify(machineEvidence, null, 2)}\n`, "utf8");
  await writeFile(humanEvidencePath, `${JSON.stringify(humanEvidence, null, 2)}\n`, "utf8");
  await writeFile(timelineEvidencePath, `${JSON.stringify(timelineEvidence, null, 2)}\n`, "utf8");
});

test("product bootstrap keeps TestBridge hidden without the query gate", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await expect.poll(() => page.evaluate(() => "TestBridge" in window)).toBe(false);
});
