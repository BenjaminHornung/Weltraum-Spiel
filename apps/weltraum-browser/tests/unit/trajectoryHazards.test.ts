import { describe, expect, it } from "vitest";
import {
  HESTIA_TRAJECTORY_FRAME_ID,
  analyzeSweptTrajectoryHazards,
  createHestiaAccelerationImpulseTrajectoryRequest,
  createTrajectoryClosestApproaches,
  createTrajectoryHazardEvents,
  createTrajectoryHazardId,
  createTrajectorySegmentId,
  predictTrajectory,
  type SphericalTrajectoryHazard,
  type TrajectoryIntegratedStep,
  type TrajectoryState
} from "../../src/trajectory";
import { createSimulationTick } from "../../src/persistence/time";

const positionState = (tick: number, x: number, y = 0): TrajectoryState => ({
  frameId: HESTIA_TRAJECTORY_FRAME_ID,
  epochTick: createSimulationTick(tick),
  positionMeters: { x, y, z: 0 },
  velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
  massKilograms: 1
});

const step = (ordinal: number, startX: number, endX: number, startY = 0, endY = startY): TrajectoryIntegratedStep => ({
  segmentId: createTrajectorySegmentId("segment:hazard-sweep"),
  segmentKind: "GravityCoast",
  resolvedIntegrator: "VelocityVerlet",
  stepOrdinal: ordinal,
  startTick: createSimulationTick(ordinal - 1),
  endTick: createSimulationTick(ordinal),
  startState: positionState(ordinal - 1, startX, startY),
  endState: positionState(ordinal, endX, endY)
});

const hazard = (id: string, x = 0, y = 0, radius = 1): SphericalTrajectoryHazard => ({
  hazardId: createTrajectoryHazardId(id),
  frameId: HESTIA_TRAJECTORY_FRAME_ID,
  centerMeters: { x, y, z: 0 },
  radiusMeters: radius,
  safetyMarginMeters: 0
});

describe("swept trajectory hazards", () => {
  it("detects tunneling through a sphere between step endpoints", () => {
    const analysis = analyzeSweptTrajectoryHazards([step(1, -2, 2)], [hazard("hazard:tunnel")], 1e-9)[0];

    expect(analysis?.event).not.toBeNull();
    expect(analysis?.event?.entry.fraction).toBeCloseTo(0.25, 12);
    expect(analysis?.event?.exit?.fraction).toBeCloseTo(0.75, 12);
    expect(analysis?.event?.minimumCenterDistanceMeters).toBe(0);
    expect(analysis?.event?.tangent).toBe(false);
  });

  it("preserves physical entry and exit when geometry epsilon exceeds the hazard radius", () => {
    const analysis = analyzeSweptTrajectoryHazards(
      [step(1, -2, 2)],
      [hazard("hazard:large-epsilon-crossing")],
      2
    )[0];

    expect(analysis?.event).not.toBeNull();
    expect(analysis?.event?.entry.fraction).toBeCloseTo(0.25, 12);
    expect(analysis?.event?.exit?.fraction).toBeCloseTo(0.75, 12);
    expect(analysis?.event?.minimumClearanceMeters).toBe(-1);
    expect(analysis?.event?.startedInside).toBe(false);
    expect(analysis?.event?.tangent).toBe(false);
  });

  it("preserves a physical start-inside event when geometry epsilon exceeds the hazard radius", () => {
    const analysis = analyzeSweptTrajectoryHazards(
      [step(1, 0, 2)],
      [hazard("hazard:large-epsilon-start-inside")],
      2
    )[0];

    expect(analysis?.event).not.toBeNull();
    expect(analysis?.event?.entry.fraction).toBe(0);
    expect(analysis?.event?.exit?.fraction).toBeCloseTo(0.5, 12);
    expect(analysis?.event?.minimumClearanceMeters).toBe(-1);
    expect(analysis?.event?.startedInside).toBe(true);
    expect(analysis?.event?.tangent).toBe(false);
  });

  it("reports stable tangency as one zero-duration contact", () => {
    const analysis = analyzeSweptTrajectoryHazards(
      [step(1, -2, 2, 1, 1)],
      [hazard("hazard:tangent")],
      1e-9
    )[0];

    expect(analysis?.event?.tangent).toBe(true);
    expect(analysis?.event?.entry.fraction).toBeCloseTo(0.5, 12);
    expect(analysis?.event?.exit?.fraction).toBeCloseTo(0.5, 12);
    expect(analysis?.event?.minimumCenterDistanceMeters).toBeCloseTo(1, 12);
  });

  it("retains a touch followed by retreat as a tangent event", () => {
    const event = analyzeSweptTrajectoryHazards(
      [step(1, -2, -1), step(2, -1, -2)],
      [hazard("hazard:touch-retreat")],
      1e-9
    )[0]?.event;

    expect(event?.tangent).toBe(true);
    expect(event?.entry.stepStartTick).toBe(0);
    expect(event?.entry.fraction).toBe(1);
    expect(event?.exit?.stepStartTick).toBe(0);
    expect(event?.exit?.fraction).toBe(1);
  });

  it.each([
    { label: "boundary", x: 1, event: true, tangent: true, startedInside: false },
    { label: "inside", x: 0, event: true, tangent: false, startedInside: true },
    { label: "outside", x: 2, event: false, tangent: false, startedInside: false }
  ])("classifies an isolated zero-length $label chord", ({ x, event, tangent, startedInside }) => {
    const result = analyzeSweptTrajectoryHazards(
      [step(1, x, x)],
      [hazard(`hazard:zero-length-${x}`)],
      1e-9
    )[0]?.event;

    if (!event) {
      expect(result).toBeNull();
      return;
    }
    expect(result).not.toBeNull();
    expect(result?.entry.fraction).toBe(0);
    expect(result?.tangent).toBe(tangent);
    expect(result?.startedInside).toBe(startedInside);
    if (tangent) {
      expect(result?.exit?.fraction).toBe(0);
    } else {
      expect(result?.exit).toBeNull();
    }
  });

  it("does not report an epsilon-outside chord as contact", () => {
    const epsilonMeters = 1e-6;
    const analysis = analyzeSweptTrajectoryHazards(
      [step(1, -2, 2, 1 + 2 * epsilonMeters, 1 + 2 * epsilonMeters)],
      [hazard("hazard:epsilon-outside")],
      epsilonMeters
    )[0];

    expect(analysis?.event).toBeNull();
    expect(analysis?.closestApproach?.centerDistanceMeters).toBeCloseTo(1 + 2 * epsilonMeters, 12);
  });

  it("stably treats a chord inside the geometry tolerance band as tangent contact", () => {
    const effectiveRadiusMeters = 1;
    const epsilonMeters = 1e-6;
    const withinToleranceDeltaMeters = epsilonMeters / 2;
    const expectedContactFraction = 0.5;
    // Contract boundary: radius < distance < radius + epsilon is one stable tangent contact.
    const analysis = analyzeSweptTrajectoryHazards(
      [step(
        1,
        -2,
        2,
        effectiveRadiusMeters + withinToleranceDeltaMeters,
        effectiveRadiusMeters + withinToleranceDeltaMeters
      )],
      [hazard("hazard:within-epsilon-tangent", 0, 0, effectiveRadiusMeters)],
      epsilonMeters
    )[0];

    expect(analysis?.event).not.toBeNull();
    expect(analysis?.event?.tangent).toBe(true);
    expect(analysis?.event?.startedInside).toBe(false);
    expect(analysis?.event?.entry.fraction).toBeCloseTo(expectedContactFraction, 12);
    expect(analysis?.event?.exit?.fraction).toBeCloseTo(expectedContactFraction, 12);
    expect(analysis?.event?.minimumCenterDistanceMeters).toBeCloseTo(
      effectiveRadiusMeters + withinToleranceDeltaMeters,
      12
    );
    expect(analysis?.event?.minimumClearanceMeters).toBeCloseTo(withinToleranceDeltaMeters, 12);
  });

  it("solves start-inside and end-inside roots analytically", () => {
    const startInside = analyzeSweptTrajectoryHazards(
      [step(1, 0, 2)],
      [hazard("hazard:start-inside")],
      1e-9
    )[0]?.event;
    const endInside = analyzeSweptTrajectoryHazards(
      [step(1, -2, 0)],
      [hazard("hazard:end-inside")],
      1e-9
    )[0]?.event;

    expect(startInside?.startedInside).toBe(true);
    expect(startInside?.entry.fraction).toBe(0);
    expect(startInside?.exit?.fraction).toBeCloseTo(0.5, 12);
    expect(endInside?.startedInside).toBe(false);
    expect(endInside?.entry.fraction).toBeCloseTo(0.5, 12);
    expect(endInside?.exit).toBeNull();
  });

  it("continues a zero-length boundary contact into penetration", () => {
    const event = analyzeSweptTrajectoryHazards(
      [step(1, 1, 1), step(2, 1, 0), step(3, 0, 2)],
      [hazard("hazard:boundary-penetration")],
      1e-9
    )[0]?.event;

    expect(event?.entry.stepStartTick).toBe(0);
    expect(event?.entry.fraction).toBe(0);
    expect(event?.exit?.stepStartTick).toBe(2);
    expect(event?.exit?.fraction).toBeCloseTo(0.5, 12);
    expect(event?.tangent).toBe(false);
  });

  it("orders closest approaches by clearance, center distance and lexical ID", () => {
    const hazards = [
      hazard("hazard:z-tie", 0, 3, 1),
      hazard("hazard:nearest", 0, 2, 1),
      hazard("hazard:a-tie", 0, -3, 1)
    ];
    const analyses = analyzeSweptTrajectoryHazards([step(1, -5, 5)], hazards, 1e-9);

    const closest = createTrajectoryClosestApproaches(analyses);

    expect(closest.map((item) => item.hazardId)).toEqual([
      "hazard:nearest",
      "hazard:a-tie",
      "hazard:z-tie"
    ]);
  });

  it("uses center distance before lexical ID when clearances are equal", () => {
    const sharedClearanceMeters = 1;
    const nearCenterDistanceMeters = 2;
    const farCenterDistanceMeters = 3;
    const nearRadiusMeters = nearCenterDistanceMeters - sharedClearanceMeters;
    const farRadiusMeters = farCenterDistanceMeters - sharedClearanceMeters;
    // IDs intentionally oppose the expected order: equal clearance must defer to center distance, not lexical ID.
    const analyses = analyzeSweptTrajectoryHazards(
      [step(1, -5, 5)],
      [
        hazard("hazard:a-far-center", 0, farCenterDistanceMeters, farRadiusMeters),
        hazard("hazard:z-near-center", 0, nearCenterDistanceMeters, nearRadiusMeters)
      ],
      1e-9
    );

    const closest = createTrajectoryClosestApproaches(analyses);

    expect(closest).toHaveLength(2);
    expect(closest[0]?.clearanceMeters).toBe(sharedClearanceMeters);
    expect(closest[1]?.clearanceMeters).toBe(sharedClearanceMeters);
    expect(closest[0]?.centerDistanceMeters).toBe(nearCenterDistanceMeters);
    expect(closest[1]?.centerDistanceMeters).toBe(farCenterDistanceMeters);
    expect(closest.map((item) => item.hazardId)).toEqual([
      "hazard:z-near-center",
      "hazard:a-far-center"
    ]);
  });

  it("orders events by step start tick before local fraction and lexical ID", () => {
    const earlierStepExpectedFraction = 0.85;
    const laterStepExpectedFraction = 0.05;
    const earlierStepHazard = hazard("hazard:z-earlier-step", 9, 0, 0.5);
    const laterStepHazard = hazard("hazard:a-later-step", 21, 0, 0.5);
    // The earlier step has the larger local fraction and lexically later ID, isolating stepStartTick as key one.
    const analyses = analyzeSweptTrajectoryHazards(
      [step(1, 0, 10), step(2, 20, 30)],
      [laterStepHazard, earlierStepHazard],
      1e-9
    );
    const events = createTrajectoryHazardEvents(analyses);

    expect(events.map((event) => event.hazardId)).toEqual([
      earlierStepHazard.hazardId,
      laterStepHazard.hazardId
    ]);
    expect(events[0]?.entry.stepStartTick).toBe(0);
    expect(events[0]?.entry.fraction).toBeCloseTo(earlierStepExpectedFraction, 12);
    expect(events[1]?.entry.stepStartTick).toBe(1);
    expect(events[1]?.entry.fraction).toBeCloseTo(laterStepExpectedFraction, 12);
  });

  it("uses lexical hazard ID as the stable simultaneous-event tie break", () => {
    // Geometry is identical, so tick and fraction tie before lexical hazard ID is consulted.
    const analyses = analyzeSweptTrajectoryHazards(
      [step(1, -2, 2)],
      [hazard("hazard:z-event"), hazard("hazard:a-event")],
      1e-9
    );

    expect(createTrajectoryHazardEvents(analyses).map((event) => event.hazardId)).toEqual([
      "hazard:a-event",
      "hazard:z-event"
    ]);
  });

  it("publishes swept events and closest approaches through predictTrajectory", () => {
    const base = createHestiaAccelerationImpulseTrajectoryRequest();
    const publicHazard = hazard("hazard:public-swept");
    const request = {
      ...base,
      initialState: {
        ...base.initialState,
        positionMeters: { x: -2, y: 0, z: 0 },
        velocityMetersPerSecond: { x: 4, y: 0, z: 0 }
      },
      gravitySource: {
        ...base.gravitySource,
        positionMeters: { x: 1e150, y: 0, z: 0 },
        gravitationalParameterMu: Number.MIN_VALUE
      },
      segments: [{
        kind: "GravityCoast" as const,
        segmentId: createTrajectorySegmentId("segment:public-hazard-sweep"),
        frameId: base.initialState.frameId,
        startTick: createSimulationTick(0),
        endTick: createSimulationTick(120)
      }],
      integratorPolicy: {
        ...base.integratorPolicy,
        gravityCoast: "SemiImplicitEuler" as const
      },
      stepTicks: 120,
      sampleEverySteps: 1,
      hazards: [publicHazard]
    };

    const result = predictTrajectory(request);

    expect(result.status).toBe("Completed");
    if (result.status !== "Completed") {
      throw new Error(`Public hazard request rejected: ${result.issues[0]?.message ?? "unknown"}`);
    }
    expect(result.hazardEvents).toHaveLength(1);
    expect(result.closestApproaches).toHaveLength(1);
    expect(result.hazardEvents[0]?.hazardId).toBe(publicHazard.hazardId);
    expect(result.hazardEvents[0]?.entry.fraction).toBeCloseTo(0.25, 12);
    expect(result.hazardEvents[0]?.exit?.fraction).toBeCloseTo(0.75, 12);
    expect(result.closestApproaches[0]?.hazardId).toBe(publicHazard.hazardId);
    expect(result.closestApproaches[0]?.centerDistanceMeters).toBe(0);
  });
});
