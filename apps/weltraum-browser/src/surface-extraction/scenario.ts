import {
  beginExtractionSession,
  executeExtractionPulse,
  prepareExtractionSession,
  scanSurfaceResourceNode
} from "./core";
import { canonicalSurfaceExtractionJson, freezeSurfaceExtraction, surfaceExtractionSignature } from "./canonical";
import { createSurfaceExtractionFixtures } from "./fixtures";
import type { ExtractionPulseResult } from "./types";

export interface SurfaceExtractionBrowserScenarioResult {
  readonly schema: "weltraum.surface-extraction-browser-scenario";
  readonly schemaVersion: 1;
  readonly scan: {
    readonly nodeId: string;
    readonly confidence: number;
    readonly resourceId: string;
    readonly estimatedQuantity: number;
    readonly signature: string;
  };
  readonly preparationState: string;
  readonly startedState: string;
  readonly pulses: readonly {
    readonly pulseIndex: number;
    readonly status: string;
    readonly extractedQuantity: number;
    readonly nodeRevision: number;
    readonly sessionRevision: number;
    readonly targetRevision: number;
    readonly pulseSignature: string;
    readonly eventIntentCount: number;
    readonly missionIntentCount: number;
  }[];
  readonly final: {
    readonly nodeRevision: number;
    readonly depletionState: string;
    readonly remainingQuantity: number;
    readonly sessionRevision: number;
    readonly sessionState: string;
    readonly pulseSequence: number;
    readonly targetRevision: number;
    readonly targetQuantity: number;
    readonly targetSignature: string;
    readonly eventIntentCount: number;
    readonly missionIntentCount: number;
  };
  readonly signature: string;
  readonly canonicalJson: string;
}

export const runSurfaceExtractionBrowserScenario = (): SurfaceExtractionBrowserScenarioResult => {
  const fixtures = createSurfaceExtractionFixtures();
  const definition = fixtures.ironSilicateVein.definition;
  let node = fixtures.ironSilicateVein.state;
  let target = fixtures.miningDroneContainer;
  const environment = fixtures.environments.earth;

  const scan = scanSurfaceResourceNode(definition, node, {
    actorContext: fixtures.equipment.scanner.actorContext,
    equipment: fixtures.equipment.scanner.projection,
    environment,
    scanSkillBasisPoints: 10_000,
    distanceMeters: 2
  });
  if (scan.status !== "Scanned") throw new Error(`Fixture scan blocked: ${scan.reason}`);

  const preparation = prepareExtractionSession(definition, node, {
    sessionId: "extraction-session:browser-proof",
    actorId: fixtures.suit.state.actorId,
    expectedNodeRevision: node.revision,
    targetContainerId: target.definition.containerId,
    startedUniverseTick: 100,
    actorContext: fixtures.equipment.cutter.actorContext,
    blueprint: fixtures.equipment.cutter.fixture.blueprint,
    equipmentStats: fixtures.equipment.cutter.stats,
    equipmentReadiness: fixtures.equipment.cutter.readiness,
    equipmentProjection: fixtures.equipment.cutter.projection,
    suitState: fixtures.suit.state,
    suitInterface: fixtures.suit.equipmentInterface,
    environment,
    target,
    catalog: fixtures.catalog
  });
  if (!preparation.ready) throw new Error(`Fixture preparation blocked: ${preparation.blockReasons.join(",")}`);

  const begin = beginExtractionSession(
    preparation.session,
    node,
    preparation.session.revision,
    node.revision,
    100
  );
  if (begin.status !== "Applied" || begin.node === undefined) {
    throw new Error(`Fixture begin blocked: ${begin.reason ?? "unknown"}`);
  }
  let session = begin.session;
  node = begin.node;
  const pulseResults: ExtractionPulseResult[] = [];
  for (let pulseIndex = 1; pulseIndex <= 3; pulseIndex += 1) {
    const pulse = executeExtractionPulse(definition, node, session, target, environment, fixtures.catalog, {
      idempotencyKey: `extraction-pulse:browser-proof:${pulseIndex}`,
      expectedSessionRevision: session.revision,
      expectedNodeRevision: node.revision,
      expectedTargetRevision: target.state.revision,
      explicitTickDelta: fixtures.equipment.cutter.stats.cycleTicks,
      pulseIndex,
      deterministicSeed: "surface-proof-seed",
      universeTick: 100 + pulseIndex * fixtures.equipment.cutter.stats.cycleTicks
    });
    if (pulse.status !== "Applied") throw new Error(`Fixture pulse ${pulseIndex} blocked: ${pulse.reason ?? "unknown"}`);
    pulseResults.push(pulse);
    session = pulse.session;
    node = pulse.node;
    target = pulse.target;
  }

  const pulseSummary = pulseResults.map((pulse, index) => freezeSurfaceExtraction({
    pulseIndex: index + 1,
    status: pulse.status,
    extractedQuantity: pulse.extractedQuantity,
    nodeRevision: pulse.node.revision,
    sessionRevision: pulse.session.revision,
    targetRevision: pulse.target.state.revision,
    pulseSignature: pulse.pulseSignature,
    eventIntentCount: pulse.eventIntents.length,
    missionIntentCount: pulse.missionIntents.length
  }));
  const targetQuantity = target.resourceTotals.find((entry) => entry.resourceId === definition.resourceId)?.quantity ?? 0;
  const unsigned = {
    schema: "weltraum.surface-extraction-browser-scenario" as const,
    schemaVersion: 1 as const,
    scan: {
      nodeId: scan.result.nodeId,
      confidence: scan.result.confidence,
      resourceId: scan.result.resourceId,
      estimatedQuantity: scan.result.estimatedQuantity,
      signature: scan.result.deterministicSignature
    },
    preparationState: preparation.session.state,
    startedState: begin.session.state,
    pulses: pulseSummary,
    final: {
      nodeRevision: node.revision,
      depletionState: node.depletionState,
      remainingQuantity: node.reservoir.depletion?.remainingQuantity ?? 0,
      sessionRevision: session.revision,
      sessionState: session.state,
      pulseSequence: session.pulseSequence,
      targetRevision: target.state.revision,
      targetQuantity,
      targetSignature: target.signature,
      eventIntentCount: pulseResults.reduce((sum, pulse) => sum + pulse.eventIntents.length, preparation.eventIntents.length + begin.eventIntents.length),
      missionIntentCount: pulseResults.reduce((sum, pulse) => sum + pulse.missionIntents.length, 0)
    }
  };
  const signature = surfaceExtractionSignature(unsigned);
  return freezeSurfaceExtraction({
    ...unsigned,
    signature,
    canonicalJson: canonicalSurfaceExtractionJson({ ...unsigned, signature })
  }) as SurfaceExtractionBrowserScenarioResult;
};
