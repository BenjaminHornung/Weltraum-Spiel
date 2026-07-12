import { describe, expect, it } from "vitest";
import type { OccupantAccelerationEnvelope, RouteSegment, ShipPropulsionCapability, TargetDescriptor, TransitPolicyConstraints } from "../../src/core/types";
import { stableStringify } from "../../src/core/hash";
import { vec3 } from "../../src/core/vector";
import { defaultCrewlessDroneAccelerationEnvelope, defaultHumanCrewAccelerationEnvelope, normalCrewedScoutPropulsionCapability } from "../../src/flight/propulsionCapability";
import { createShipStateV2 } from "../../src/flight/state";
import { lockRouteMotionProfile } from "../../src/navigation/motionProfile";
import { DirectLocalPlanner, ObstacleAvoidanceLocalPlanner } from "../../src/navigation/planners";
import { findUnsafeRouteSegmentViolations } from "../../src/navigation/validation";

const unconstrainedCapability = (): ShipPropulsionCapability => {
  const { maximumCruiseSpeedMps: _maximumCruiseSpeedMps, ...capability } = normalCrewedScoutPropulsionCapability;
  return capability;
};

const shipAtOrigin = () => createShipStateV2({
  position: vec3(),
  velocity: vec3(),
  fuel: 100,
  authority: { mode: "Autopilot" }
});

const stopTarget = (id: string, position = vec3(240, 0, 0), terminalSpeed = 0.5): TargetDescriptor => ({
  id,
  label: id,
  kind: "Waypoint",
  position,
  arrivalEnvelope: { radius: 2, terminalSpeed, stopBehavior: "StopWithinEnvelope" }
});

const motionFor = (segment: RouteSegment) => {
  if (!segment.motionConstraint) {
    throw new Error(`Expected locked motion constraint for ${segment.id}.`);
  }
  return segment.motionConstraint;
};

const customConstraints: TransitPolicyConstraints = {
  targetAccelerationMps2: 7,
  maximumAccelerationMps2: 9,
  maximumJerkMps3: 4,
  coastAllowed: false,
  coastFraction: 0,
  minimumTime: false,
  brakingReserveMultiplier: 1.15,
  turnBehavior: "Balanced",
  waypointBehavior: "BrakeForWaypoint",
  gravityFloorPolicy: "Preferred"
};

describe("locked autopilot motion profiles", () => {
  it("locks canonical policy, occupant, capability, authority, phase, and segment bounds before hashing", () => {
    const planner = new DirectLocalPlanner();
    const context = {
      tick: 11,
      ship: shipAtOrigin(),
      target: stopTarget("locked-sprint"),
      transitPolicy: "CrewSprint" as const
    };
    const first = planner.plan(context);
    const second = planner.plan(context);
    const motionProfile = first.motionProfile;
    const segment = motionFor(first.segments[0]);

    expect(first.planHash).toBe(second.planHash);
    expect(stableStringify(first.motionProfile)).toBe(stableStringify(second.motionProfile));
    expect(motionProfile).toMatchObject({
      version: 1,
      requestedPolicyId: "CrewSprint",
      resolvedPolicy: { requestedPolicyId: "CrewSprint", resolvedPolicyId: "CrewSprint" },
      phaseVocabulary: ["AlignForBurn", "Accelerate", "Coast", "Flip", "Brake", "TerminalCapture", "Holding"]
    });
    expect(motionProfile?.occupantAccelerationEnvelope).toEqual(defaultHumanCrewAccelerationEnvelope);
    expect(motionProfile?.propulsionCapability).toEqual(normalCrewedScoutPropulsionCapability);
    expect(motionProfile?.planningAuthority).toEqual(context.ship.authority);
    expect(segment.entrySpeedMps).toBe(0);
    expect(segment.exitSpeedMps).toBe(0.5);
    expect(segment.terminalSpeedMps).toBe(0.5);
    expect(segment.plannedUsableMainAccelerationMps2).toBeGreaterThan(0);
    expect(segment.plannedUsableBrakingAccelerationMps2).toBeGreaterThan(0);
    expect(Object.isFrozen(motionProfile)).toBe(true);
    expect(Object.isFrozen(motionProfile?.resolvedPolicy ?? {})).toBe(true);
    expect(Object.isFrozen(segment)).toBe(true);
  });

  it("changes the hash when selected policy or planning motion snapshots change", () => {
    const planner = new DirectLocalPlanner();
    const ship = shipAtOrigin();
    const target = stopTarget("hash-inputs");
    const baseline = planner.plan({ tick: 12, ship, target, transitPolicy: "CrewSprint" });
    const policyChanged = planner.plan({ tick: 12, ship, target, transitPolicy: "CrewComfort" });
    const capabilityChanged = planner.plan({
      tick: 12,
      ship,
      target,
      transitPolicy: "CrewSprint",
      propulsionCapability: { ...normalCrewedScoutPropulsionCapability, maximumAngularVelocity: 0.9 }
    });
    const occupantChanged: OccupantAccelerationEnvelope = {
      ...defaultHumanCrewAccelerationEnvelope,
      maximumJerkMps3: 2.25
    };
    const envelopeChanged = planner.plan({
      tick: 12,
      ship,
      target,
      transitPolicy: "CrewSprint",
      occupantAccelerationEnvelope: occupantChanged
    });
    const customBaseline = planner.plan({
      tick: 12,
      ship,
      target,
      transitPolicy: "Custom",
      customTransitPolicyConstraints: customConstraints
    });
    const customChanged = planner.plan({
      tick: 12,
      ship,
      target,
      transitPolicy: "Custom",
      customTransitPolicyConstraints: { ...customConstraints, maximumJerkMps3: 2 }
    });

    for (const changed of [policyChanged, capabilityChanged, envelopeChanged]) {
      expect(changed.planHash).not.toBe(baseline.planHash);
    }
    expect(customChanged.planHash).not.toBe(customBaseline.planHash);
  });

  it("does not lock the legacy 12/18/22 m/s profiles as new-policy peak caps, but retains real Economy caps", () => {
    const planner = new DirectLocalPlanner();
    const ship = shipAtOrigin();
    const target = stopTarget("no-legacy-cap", vec3(2_500, 0, 0));

    for (const transitPolicy of ["CrewComfort", "CrewSprint", "DroneSprint"] as const) {
      const plan = planner.plan({
        tick: 13,
        ship,
        target,
        transitPolicy,
        propulsionCapability: unconstrainedCapability(),
        ...(transitPolicy === "DroneSprint" ? { occupantAccelerationEnvelope: defaultCrewlessDroneAccelerationEnvelope } : {})
      });
      const constraint = motionFor(plan.segments[0]);

      expect(plan.motionProfile?.maximumPeakSpeedMps, transitPolicy).toBeUndefined();
      expect(constraint.maximumPeakSpeedMps, transitPolicy).toBeUndefined();
      expect(constraint.entrySpeedMps, transitPolicy).toBe(0);
      expect(constraint.exitSpeedMps, transitPolicy).toBe(0.5);
      expect([12, 18, 22], transitPolicy).not.toContain(plan.segments[0].desiredSpeed);
    }

    const economy = planner.plan({
      tick: 13,
      ship,
      target,
      transitPolicy: "Economy",
      propulsionCapability: unconstrainedCapability()
    });
    expect(economy.motionProfile?.maximumPeakSpeedMps).toBe(36);
    expect(motionFor(economy.segments[0]).maximumPeakSpeedMps).toBe(36);
  });

  it("preserves stop and MatchTerminalSpeed gates in terminal motion constraints", () => {
    const planner = new DirectLocalPlanner();
    const ship = shipAtOrigin();
    const stopPlan = planner.plan({ tick: 14, ship, target: stopTarget("strict-stop", vec3(300, 0, 0), 0.25), transitPolicy: "CrewSprint" });
    const overDeclaredStopPlan = planner.plan({ tick: 14, ship, target: stopTarget("clamped-stop", vec3(300, 0, 0), 4), transitPolicy: "CrewSprint" });
    const matchTarget: TargetDescriptor = {
      id: "match-speed",
      label: "match-speed",
      kind: "Waypoint",
      position: vec3(300, 0, 0),
      arrivalEnvelope: { radius: 2, terminalSpeed: 6, stopBehavior: "MatchTerminalSpeed" }
    };
    const matchPlan = planner.plan({ tick: 14, ship, target: matchTarget, transitPolicy: "CrewSprint" });

    expect(motionFor(stopPlan.segments.at(-1) as RouteSegment)).toMatchObject({ terminalSpeedMps: 0.25, exitSpeedMps: 0.25 });
    expect(motionFor(overDeclaredStopPlan.segments.at(-1) as RouteSegment)).toMatchObject({ terminalSpeedMps: 0.5, exitSpeedMps: 0.5 });
    expect(motionFor(matchPlan.segments.at(-1) as RouteSegment)).toMatchObject({ terminalSpeedMps: 6, exitSpeedMps: 6 });
  });

  it("uses deterministic angle, authority, clearance, and braking passes to slow sharp waypoint corners", () => {
    const ship = shipAtOrigin();
    const sharpTarget = stopTarget("sharp-target", vec3(30, 30, 0));
    const shallowTarget = stopTarget("shallow-target", vec3(60, 5, 0));
    const sharp = lockRouteMotionProfile(
      { tick: 15, ship, target: sharpTarget, transitPolicy: "CrewSprint" },
      [
        { id: "sharp-entry", kind: "Avoidance", start: vec3(), end: vec3(30, 0, 0), desiredSpeed: 18, clearanceRadius: 6 },
        { id: "sharp-terminal", kind: "Terminal", start: vec3(30, 0, 0), end: sharpTarget.position, desiredSpeed: 12, clearanceRadius: 6 }
      ]
    );
    const shallow = lockRouteMotionProfile(
      { tick: 15, ship, target: shallowTarget, transitPolicy: "CrewSprint" },
      [
        { id: "shallow-entry", kind: "Avoidance", start: vec3(), end: vec3(30, 0, 0), desiredSpeed: 18, clearanceRadius: 6 },
        { id: "shallow-terminal", kind: "Terminal", start: vec3(30, 0, 0), end: shallowTarget.position, desiredSpeed: 12, clearanceRadius: 6 }
      ]
    );
    const lowAuthorityShip = createShipStateV2({
      position: vec3(),
      velocity: vec3(),
      fuel: 100,
      authority: { mode: "Autopilot", translationAuthority: 0.25, rotationAuthority: 0.25 }
    });
    const lowAuthoritySharp = lockRouteMotionProfile(
      { tick: 15, ship: lowAuthorityShip, target: sharpTarget, transitPolicy: "CrewSprint" },
      [
        { id: "sharp-entry", kind: "Avoidance", start: vec3(), end: vec3(30, 0, 0), desiredSpeed: 18, clearanceRadius: 6 },
        { id: "sharp-terminal", kind: "Terminal", start: vec3(30, 0, 0), end: sharpTarget.position, desiredSpeed: 12, clearanceRadius: 6 }
      ]
    );

    const sharpConstraint = motionFor(sharp.segments[0]);
    const shallowConstraint = motionFor(shallow.segments[0]);
    const lowAuthorityConstraint = motionFor(lowAuthoritySharp.segments[0]);
    expect(sharpConstraint.turnConstraint.kind).toBe("Corner");
    expect(sharpConstraint.turnConstraint.turnAngleRadians).toBeGreaterThan(shallowConstraint.turnConstraint.turnAngleRadians);
    expect(sharpConstraint.exitSpeedMps).toBeLessThan(shallowConstraint.exitSpeedMps);
    expect(lowAuthorityConstraint.exitSpeedMps).toBeLessThan(sharpConstraint.exitSpeedMps);
    expect(sharpConstraint.maximumPeakSpeedMps).toBeLessThan(shallowConstraint.maximumPeakSpeedMps ?? Number.MAX_VALUE);
    expect(sharpConstraint.turnConstraint.nextSegmentBrakingAccelerationMps2).toBe(sharp.motionProfile.plannedUsableBrakingAccelerationMps2);
  });

  it("locks constraints after obstacle geometry remains validated without moving route points", () => {
    const planner = new ObstacleAvoidanceLocalPlanner();
    const plan = planner.plan({
      tick: 16,
      ship: shipAtOrigin(),
      target: stopTarget("obstacle-target", vec3(120, 0, 0)),
      transitPolicy: "CrewSprint",
      obstacles: [{ id: "rock", center: vec3(60, 0, 0), radius: 10, padding: 5 }]
    });

    expect(plan.validation.ok).toBe(true);
    expect(plan.segments.some((segment) => segment.kind === "Avoidance")).toBe(true);
    expect(plan.segments.every((segment) => segment.motionConstraint !== undefined)).toBe(true);
    expect(findUnsafeRouteSegmentViolations(plan.segments, [{ id: "rock", center: vec3(60, 0, 0), radius: 10, padding: 5 }])).toEqual([]);
  });
});
