import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  beginExtractionSession,
  calculateDeterministicPulseYield,
  cancelExtractionSession,
  createSurfaceExtractionFixtures,
  executeExtractionPulse,
  pauseExtractionSession,
  prepareExtractionSession,
  resumeExtractionSession,
  runSurfaceExtractionBrowserScenario,
  type ExtractionPulseCommand
} from "../../src/surface-extraction/index";

const prepared = () => {
  const fixtures = createSurfaceExtractionFixtures();
  const node = fixtures.ironSilicateVein.state;
  const session = prepareExtractionSession(fixtures.ironSilicateVein.definition, node, {
    sessionId: "extraction-session:pulse-tests",
    actorId: fixtures.suit.state.actorId,
    expectedNodeRevision: node.revision,
    targetContainerId: fixtures.miningDroneContainer.definition.containerId,
    startedUniverseTick: 100,
    actorContext: fixtures.equipment.cutter.actorContext,
    blueprint: fixtures.equipment.cutter.fixture.blueprint,
    equipmentStats: fixtures.equipment.cutter.stats,
    equipmentReadiness: fixtures.equipment.cutter.readiness,
    equipmentProjection: fixtures.equipment.cutter.projection,
    suitState: fixtures.suit.state,
    suitInterface: fixtures.suit.equipmentInterface,
    environment: fixtures.environments.earth,
    target: fixtures.miningDroneContainer,
    catalog: fixtures.catalog
  });
  expect(session.ready, session.blockReasons.join(",")).toBe(true);
  const active = beginExtractionSession(session.session, node, 0, 0, 100);
  expect(active.status).toBe("Applied");
  if (active.node === undefined) throw new Error("Expected active node snapshot.");
  return { fixtures, prepared: session.session, session: active.session, node: active.node, target: fixtures.miningDroneContainer };
};

const command = (
  state: ReturnType<typeof prepared>,
  pulseIndex = state.session.pulseSequence + 1,
  overrides: Partial<ExtractionPulseCommand> = {}
): ExtractionPulseCommand => ({
  idempotencyKey: `extraction-pulse:test:${pulseIndex}`,
  expectedSessionRevision: state.session.revision,
  expectedNodeRevision: state.node.revision,
  expectedTargetRevision: state.target.state.revision,
  explicitTickDelta: state.fixtures.equipment.cutter.stats.cycleTicks,
  pulseIndex,
  deterministicSeed: "deterministic-test-seed",
  universeTick: 100 + pulseIndex * 8,
  ...overrides
});

const pulse = (state: ReturnType<typeof prepared>, pulseCommand = command(state)) => executeExtractionPulse(
  state.fixtures.ironSilicateVein.definition,
  state.node,
  state.session,
  state.target,
  state.fixtures.environments.earth,
  state.fixtures.catalog,
  pulseCommand
);

describe("surface extraction deterministic pulses", () => {
  it("derives identical yield from identical explicit inputs without a global random source", () => {
    const state = prepared();
    const pulseCommand = command(state);
    const remaining = state.node.reservoir.depletion?.remainingQuantity ?? 0;
    const first = calculateDeterministicPulseYield(
      state.fixtures.ironSilicateVein.definition,
      state.session,
      state.fixtures.environments.earth,
      pulseCommand,
      remaining,
      state.fixtures.catalog
    );
    const second = calculateDeterministicPulseYield(
      state.fixtures.ironSilicateVein.definition,
      state.session,
      state.fixtures.environments.earth,
      pulseCommand,
      remaining,
      state.fixtures.catalog
    );
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(first);
  });

  it("enforces pulse ordering and node/session/target CAS", () => {
    const state = prepared();
    expect(pulse(state, command(state, 2)).reason).toBe("InvalidPulse");
    expect(pulse(state, command(state, 1, { expectedNodeRevision: state.node.revision + 1 })).reason)
      .toBe("NodeRevisionConflict");
    expect(pulse(state, command(state, 1, { expectedSessionRevision: state.session.revision + 1 })).reason)
      .toBe("SessionRevisionConflict");
    expect(pulse(state, command(state, 1, { expectedTargetRevision: state.target.state.revision + 1 })).reason)
      .toBe("InvalidPulse");
  });

  it("transfers through Resource Core, updates depletion, and emits event and mission intents", () => {
    let state = prepared();
    const first = pulse(state);
    expect(first.status, JSON.stringify(first.transferResult)).toBe("Applied");
    expect(first.transferResult?.status).toBe("Accepted");
    expect(first.extractedQuantity).toBeGreaterThan(0);
    expect(first.node.depletionState).toBe("PartiallyDepleted");
    expect(first.target.resourceTotals).toEqual([{ resourceId: "ore_iron_silicate", quantity: 1 }]);
    expect(first.eventIntents.map((intent) => intent.type)).toEqual(["ExtractionPulseExecuted", "ResourceTransferred"]);
    expect(first.missionIntents.map((intent) => intent.type)).toEqual(["RecordExtractionProgress"]);

    state = { ...state, node: first.node, session: first.session, target: first.target };
    const second = pulse(state);
    state = { ...state, node: second.node, session: second.session, target: second.target };
    const third = pulse(state);
    expect(third.status).toBe("Applied");
    expect(third.node.depletionState).toBe("Depleted");
    expect(third.node.activeSessionId).toBeUndefined();
    expect(third.session.state).toBe("Completed");
    expect(third.target.resourceTotals).toEqual([{ resourceId: "ore_iron_silicate", quantity: 3 }]);
    expect(third.eventIntents.at(-1)?.type).toBe("NodeDepleted");
    expect(third.missionIntents.at(-1)?.type).toBe("CompleteExtractionObjective");
  });

  it("rejects capacity and hazardous-container preparations atomically", () => {
    const fixtures = createSurfaceExtractionFixtures();
    const capacity = prepareExtractionSession(fixtures.geologicalSampleCore.definition, fixtures.geologicalSampleCore.state, {
      sessionId: "extraction-session:capacity",
      actorId: fixtures.suit.state.actorId,
      expectedNodeRevision: fixtures.geologicalSampleCore.state.revision,
      targetContainerId: fixtures.insufficientSuitContainer.definition.containerId,
      startedUniverseTick: 100,
      actorContext: fixtures.equipment.cutter.actorContext,
      blueprint: fixtures.equipment.cutter.fixture.blueprint,
      equipmentStats: fixtures.equipment.cutter.stats,
      equipmentReadiness: fixtures.equipment.cutter.readiness,
      equipmentProjection: fixtures.equipment.cutter.projection,
      suitState: fixtures.suit.state,
      suitInterface: fixtures.suit.equipmentInterface,
      environment: fixtures.environments.earth,
      target: fixtures.insufficientSuitContainer,
      catalog: fixtures.catalog
    });
    expect(capacity.ready).toBe(false);
    expect(capacity.blockReasons).toContain("TargetCapacityExceeded");
    expect(fixtures.insufficientSuitContainer.state.revision).toBe(0);

    const hazard = prepareExtractionSession(
      fixtures.hestiaContaminatedBiologicalSample.definition,
      fixtures.hestiaContaminatedBiologicalSample.state,
      {
        ...{
          sessionId: "extraction-session:hazard",
          actorId: fixtures.suit.state.actorId,
          expectedNodeRevision: fixtures.hestiaContaminatedBiologicalSample.state.revision,
          targetContainerId: fixtures.biologicalHazardRejectedContainer.definition.containerId,
          startedUniverseTick: 100,
          actorContext: fixtures.equipment.cutter.actorContext,
          blueprint: fixtures.equipment.cutter.fixture.blueprint,
          equipmentStats: fixtures.equipment.cutter.stats,
          equipmentReadiness: fixtures.equipment.cutter.readiness,
          equipmentProjection: fixtures.equipment.cutter.projection,
          suitState: fixtures.suit.state,
          suitInterface: fixtures.suit.equipmentInterface,
          environment: fixtures.environments.hestia,
          target: fixtures.biologicalHazardRejectedContainer,
          catalog: fixtures.catalog
        }
      }
    );
    expect(hazard.blockReasons).toContain("HazardContainerRequired");
    expect(fixtures.biologicalHazardRejectedContainer.state.revision).toBe(0);
  });

  it("supports pause, resume, cancel, and active-session conflict semantics", () => {
    const state = prepared();
    const paused = pauseExtractionSession(state.session, state.session.revision, 108);
    expect(paused.status).toBe("Applied");
    expect(paused.session.state).toBe("Paused");
    const resumed = resumeExtractionSession(paused.session, paused.session.revision, 116);
    expect(resumed.status).toBe("Applied");
    expect(resumed.session.state).toBe("Active");
    const cancelled = cancelExtractionSession(
      resumed.session,
      state.node,
      resumed.session.revision,
      state.node.revision,
      124
    );
    expect(cancelled.status).toBe("Applied");
    expect(cancelled.session.state).toBe("Cancelled");
    expect(cancelled.node?.activeSessionId).toBeUndefined();
    expect(cancelled.node?.revision).toBe(state.node.revision + 1);
  });

  it("returns the recorded result for an identical idempotent retry and rejects key reuse", () => {
    const state = prepared();
    const pulseCommand = command(state);
    const first = pulse(state, pulseCommand);
    expect(first.status, JSON.stringify(first.transferResult)).toBe("Applied");
    const updated = { ...state, node: first.node, session: first.session, target: first.target };
    const retry = pulse(updated, pulseCommand);
    expect(retry.status).toBe("Idempotent");
    expect(retry.pulseSignature).toBe(first.pulseSignature);
    expect(retry.extractedQuantity).toBe(first.extractedQuantity);
    const collision = pulse(updated, { ...pulseCommand, deterministicSeed: "different-seed" });
    expect(collision.status).toBe("Blocked");
    expect(collision.reason).toBe("InvalidPulse");
  });

  it("deep-freezes snapshots and produces byte-identical complete scenarios", () => {
    const state = prepared();
    const result = pulse(state);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.node)).toBe(true);
    expect(Object.isFrozen(result.node.localPosition)).toBe(true);
    expect(Object.isFrozen(result.session)).toBe(true);
    expect(Object.isFrozen(result.session.pulseReceipts)).toBe(true);
    expect(Object.isFrozen(result.target)).toBe(true);

    const first = runSurfaceExtractionBrowserScenario();
    const second = runSurfaceExtractionBrowserScenario();
    expect(first.canonicalJson).toBe(second.canonicalJson);
    expect(first.signature).toBe(second.signature);
    expect(first.final).toMatchObject({
      depletionState: "Depleted",
      remainingQuantity: 0,
      sessionState: "Completed",
      pulseSequence: 3,
      targetQuantity: 3
    });
  });

  it("keeps Date, Random, DOM, and Three.js out of the domain module", () => {
    const sourceRoot = resolve(process.cwd(), "src", "surface-extraction");
    const source = ["canonical.ts", "core.ts", "fixtures.ts", "index.ts", "scenario.ts", "types.ts"]
      .map((file) => readFileSync(resolve(sourceRoot, file), "utf8"))
      .join("\n");
    expect(source).not.toMatch(/\bDate\b/);
    expect(source).not.toMatch(/Math\.random|\bRandom\b/);
    expect(source).not.toMatch(/\bwindow\b|\bdocument\b|\bHTMLElement\b/);
    expect(source).not.toMatch(/from\s+["']three["']|THREE\./);
  });
});
