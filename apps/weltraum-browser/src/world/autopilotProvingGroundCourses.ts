import type { AutopilotCourseCategory, AutopilotProvingGroundCourse, AutopilotSpeedProfileId, FuelState, ObstacleDescriptor, TargetDescriptor } from "../core";
import { createAuthorityState, distance, vec3 } from "../core";
import { createShipState, noAutopilotAuthority, noMainThrustersAuthority } from "./provingGroundWorld";

export type AutopilotProvingGroundCourseId =
  | "direct-long"
  | "s-curve-obstacles"
  | "narrow-corridor"
  | "offset-gates"
  | "target-behind-obstacle"
  | "target-near-obstacle"
  | "high-initial-speed"
  | "lateral-initial-velocity"
  | "low-authority-terminal"
  | "low-fuel-long-route"
  | "off-route-disturbance-midcourse"
  | "direct-short-stop"
  | "direct-medium-stop"
  | "direct-long-stop"
  | "direct-very-long-stop"
  | "direct-very-long-fast-stress"
  | "single-blocking-obstacle-long"
  | "s-curve-obstacles-long"
  | "narrow-corridor-long"
  | "offset-gates-long"
  | "target-behind-obstacle-long"
  | "target-near-obstacle-long"
  | "low-main-thrust-long"
  | "low-rcs-terminal-long"
  | "no-main-thrusters-negative"
  | "no-autopilot-authority-negative"
  | "midcourse-position-disturbance"
  | "midcourse-velocity-disturbance"
  | "terminal-overspeed-disturbance"
  | "off-route-fail-closed"
  | "direct-long-safe"
  | "direct-long-balanced"
  | "direct-long-fast"
  | "corridor-safe"
  | "corridor-balanced"
  | "multi-rock-field-1000m"
  | "multi-rock-field-2500m"
  | "unsolvable-blocked-corridor-negative";

const stopTarget = (id: AutopilotProvingGroundCourseId, label: string, position: TargetDescriptor["position"]): TargetDescriptor => ({
  id,
  label,
  kind: "Point",
  position,
  arrivalEnvelope: { radius: 3, terminalSpeed: 0.5, stopBehavior: "StopWithinEnvelope" }
});

const obstacle = (id: string, x: number, y: number, z: number, radius: number, padding: number): ObstacleDescriptor => ({
  id,
  center: vec3(x, y, z),
  radius,
  padding
});

const fuel = (current: number, reserve = 10, burnRate = 0.02): Partial<FuelState> => ({
  current,
  capacity: current,
  reserve,
  burnRate
});

const baseAcceptance = {
  maxFinalDistance: 3,
  maxFinalSpeed: 0.5,
  minObstacleClearance: 0,
  maxTicks: 1_800,
  allowReplanRequired: false
} as const;

type CourseMetadata = {
  readonly category: AutopilotCourseCategory;
  readonly speedProfile?: AutopilotSpeedProfileId;
};

const courseMetadata: Readonly<Record<AutopilotProvingGroundCourseId, CourseMetadata>> = {
  "direct-long": { category: "DirectLong", speedProfile: "Balanced" },
  "s-curve-obstacles": { category: "ObstacleStress", speedProfile: "Balanced" },
  "narrow-corridor": { category: "ObstacleStress", speedProfile: "Safe" },
  "offset-gates": { category: "ObstacleSingle", speedProfile: "Balanced" },
  "target-behind-obstacle": { category: "ObstacleSingle", speedProfile: "Balanced" },
  "target-near-obstacle": { category: "ObstacleSingle", speedProfile: "Balanced" },
  "high-initial-speed": { category: "HighInitialSpeed", speedProfile: "Balanced" },
  "lateral-initial-velocity": { category: "LateralInitialVelocity", speedProfile: "Balanced" },
  "low-authority-terminal": { category: "LowAuthorityTerminal", speedProfile: "Safe" },
  "low-fuel-long-route": { category: "LowFuelExpectedFail", speedProfile: "Balanced" },
  "off-route-disturbance-midcourse": { category: "OffRouteDisturbanceExpectedFail", speedProfile: "Balanced" },
  "direct-short-stop": { category: "DirectShort", speedProfile: "Balanced" },
  "direct-medium-stop": { category: "DirectMedium", speedProfile: "Balanced" },
  "direct-long-stop": { category: "DirectLong", speedProfile: "Balanced" },
  "direct-very-long-stop": { category: "DirectExtreme", speedProfile: "Balanced" },
  "direct-very-long-fast-stress": { category: "DirectExtreme", speedProfile: "Fast" },
  "single-blocking-obstacle-long": { category: "ObstacleSingle", speedProfile: "Balanced" },
  "s-curve-obstacles-long": { category: "ObstacleStress", speedProfile: "Balanced" },
  "narrow-corridor-long": { category: "ObstacleStress", speedProfile: "Safe" },
  "offset-gates-long": { category: "ObstacleSingle", speedProfile: "Balanced" },
  "target-behind-obstacle-long": { category: "ObstacleSingle", speedProfile: "Balanced" },
  "target-near-obstacle-long": { category: "ObstacleSingle", speedProfile: "Balanced" },
  "low-main-thrust-long": { category: "LowAuthorityTerminal", speedProfile: "Safe" },
  "low-rcs-terminal-long": { category: "LowAuthorityTerminal", speedProfile: "Safe" },
  "no-main-thrusters-negative": { category: "NoMainThrusterExpectedFail", speedProfile: "Balanced" },
  "no-autopilot-authority-negative": { category: "NoAuthorityExpectedFail", speedProfile: "Balanced" },
  "midcourse-position-disturbance": { category: "OffRouteDisturbanceExpectedFail", speedProfile: "Balanced" },
  "midcourse-velocity-disturbance": { category: "OffRouteDisturbanceExpectedFail", speedProfile: "Balanced" },
  "terminal-overspeed-disturbance": { category: "TerminalOverspeedExpectedFail", speedProfile: "Balanced" },
  "off-route-fail-closed": { category: "OffRouteDisturbanceExpectedFail", speedProfile: "Balanced" },
  "direct-long-safe": { category: "DirectLong", speedProfile: "Safe" },
  "direct-long-balanced": { category: "DirectLong", speedProfile: "Balanced" },
  "direct-long-fast": { category: "DirectLong", speedProfile: "Fast" },
  "corridor-safe": { category: "ObstacleStress", speedProfile: "Safe" },
  "corridor-balanced": { category: "ObstacleStress", speedProfile: "Balanced" },
  "multi-rock-field-1000m": { category: "ObstacleStress", speedProfile: "Balanced" },
  "multi-rock-field-2500m": { category: "ObstacleStress", speedProfile: "Balanced" },
  "unsolvable-blocked-corridor-negative": { category: "ObstacleStress", speedProfile: "Balanced" }
};

type CourseWithoutDerivedMetadata = Omit<AutopilotProvingGroundCourse, "category" | "distanceMeters" | "speedProfile"> & {
  readonly id: AutopilotProvingGroundCourseId;
};

const passCourse = (course: CourseWithoutDerivedMetadata): AutopilotProvingGroundCourse => ({
  ...course,
  category: courseMetadata[course.id].category,
  distanceMeters: Math.round(distance(course.initialShip.position, course.target.position)),
  speedProfile: courseMetadata[course.id].speedProfile ?? "Balanced"
});

export const autopilotProvingGroundCourses: readonly AutopilotProvingGroundCourse[] = [
  passCourse({
    id: "direct-long",
    label: "Direct long terminal capture",
    initialShip: createShipState({ fuel: { current: 140, capacity: 140, reserve: 5, burnRate: 0.02 } }),
    target: stopTarget("direct-long", "Direct Long", vec3(220, 0, 0)),
    obstacles: [],
    expectedOutcome: "Pass",
    planner: "DirectLocal",
    acceptance: { ...baseAcceptance, maxTicks: 1_400, maxFuelUsed: 35 },
    notes: ["Baseline browser-native long route used to compare Safe and Balanced profiles."]
  }),
  passCourse({
    id: "s-curve-obstacles",
    label: "S-curve multi-obstacle stress",
    initialShip: createShipState({ fuel: { current: 150, capacity: 150, reserve: 5, burnRate: 0.02 } }),
    target: stopTarget("s-curve-obstacles", "S-Curve Exit", vec3(180, 0, 0)),
    obstacles: [obstacle("s-rock-a", 50, 0, 0, 10, 6), obstacle("s-rock-b", 90, 22, 0, 10, 6), obstacle("s-rock-c", 130, -20, 0, 10, 6)],
    expectedOutcome: "Pass",
    planner: "ObstacleAvoidanceLocal",
    acceptance: { ...baseAcceptance, minObstacleClearance: 0, maxTicks: 3_200, maxFuelUsed: 40 },
    notes: ["Reclassified Pass: deterministic multi-obstacle route validation preserves terminal capture, planHash stability, and no silent replan on the S-curve course."]
  }),
  passCourse({
    id: "narrow-corridor",
    label: "Narrow corridor stress",
    initialShip: createShipState({ fuel: { current: 140, capacity: 140, reserve: 5, burnRate: 0.02 } }),
    target: stopTarget("narrow-corridor", "Corridor Exit", vec3(170, 0, 0)),
    obstacles: [obstacle("corridor-upper-a", 70, 17, 0, 10, 4), obstacle("corridor-lower-a", 70, -17, 0, 10, 4), obstacle("corridor-center-b", 115, 0, 0, 9, 5)],
    expectedOutcome: "Pass",
    planner: "ObstacleAvoidanceLocal",
    acceptance: { ...baseAcceptance, minObstacleClearance: 0, maxTicks: 3_200, maxFuelUsed: 40 },
    notes: ["Reclassified Pass: corridor evidence now keeps the locked route stable while satisfying terminal distance, terminal speed, and no-replan gates."]
  }),
  passCourse({
    id: "offset-gates",
    label: "Offset gate transit",
    initialShip: createShipState({ fuel: { current: 130, capacity: 130, reserve: 5, burnRate: 0.02 } }),
    target: stopTarget("offset-gates", "Offset Gates", vec3(160, 18, 0)),
    obstacles: [obstacle("gate-left", 62, -18, 0, 8, 5), obstacle("gate-right", 108, 30, 0, 8, 5)],
    expectedOutcome: "Pass",
    planner: "ObstacleAvoidanceLocal",
    acceptance: { ...baseAcceptance, minObstacleClearance: 0, maxTicks: 1_400 },
    notes: ["Offset obstacles should not require a replan or renderer-dependent truth."]
  }),
  passCourse({
    id: "target-behind-obstacle",
    label: "Target behind obstacle",
    initialShip: createShipState({ fuel: { current: 130, capacity: 130, reserve: 5, burnRate: 0.02 } }),
    target: stopTarget("target-behind-obstacle", "Behind Rock", vec3(150, 0, 0)),
    obstacles: [obstacle("front-rock", 75, 0, 0, 12, 7)],
    expectedOutcome: "Pass",
    planner: "ObstacleAvoidanceLocal",
    acceptance: { ...baseAcceptance, minObstacleClearance: 0, maxTicks: 1_500 },
    notes: ["Single blocking obstacle is the current supported avoidance shape."]
  }),
  passCourse({
    id: "target-near-obstacle",
    label: "Target near obstacle",
    initialShip: createShipState({ fuel: { current: 130, capacity: 130, reserve: 5, burnRate: 0.02 } }),
    target: stopTarget("target-near-obstacle", "Near Rock", vec3(155, 0, 0)),
    obstacles: [obstacle("near-rock", 132, 16, 0, 8, 4)],
    expectedOutcome: "Pass",
    planner: "ObstacleAvoidanceLocal",
    acceptance: { ...baseAcceptance, minObstacleClearance: 0, maxTicks: 1_500 },
    notes: ["Target envelope remains outside the obstacle safety radius."]
  }),
  passCourse({
    id: "high-initial-speed",
    label: "High initial speed terminal capture",
    initialShip: createShipState({ velocity: vec3(26, 0, 0), fuel: { current: 150, capacity: 150, reserve: 5, burnRate: 0.02 } }),
    target: stopTarget("high-initial-speed", "High Speed Stop", vec3(210, 0, 0)),
    obstacles: [],
    expectedOutcome: "Pass",
    planner: "DirectLocal",
    acceptance: { ...baseAcceptance, maxTicks: 1_500, maxFuelUsed: 40 },
    notes: ["Starts fast to prove terminalSpeed remains the capture gate."]
  }),
  passCourse({
    id: "lateral-initial-velocity",
    label: "Lateral initial velocity capture",
    initialShip: createShipState({ velocity: vec3(4, 12, 0), fuel: { current: 150, capacity: 150, reserve: 5, burnRate: 0.02 } }),
    target: stopTarget("lateral-initial-velocity", "Lateral Stop", vec3(190, 0, 0)),
    obstacles: [],
    expectedOutcome: "Pass",
    planner: "DirectLocal",
    acceptance: { ...baseAcceptance, maxTicks: 1_600, maxFuelUsed: 40 },
    notes: ["Measures tangential velocity removal without snapping to the target."]
  }),
  passCourse({
    id: "low-authority-terminal",
    label: "Low authority terminal capture",
    initialShip: createShipState({ mass: { dryMass: 2_800, fuelMass: 160, totalMass: 2_960 }, fuel: { current: 160, capacity: 160, reserve: 5, burnRate: 0.02 }, authority: createAuthorityState({ mode: "Autopilot" }) }),
    target: stopTarget("low-authority-terminal", "Low Authority Stop", vec3(150, 0, 0)),
    obstacles: [],
    expectedOutcome: "Pass",
    planner: "DirectLocal",
    acceptance: { ...baseAcceptance, maxTicks: 1_900, maxFuelUsed: 45 },
    notes: ["Lower acceleration from mass only; maxAcceleration is not raised globally."]
  }),
  passCourse({
    id: "low-fuel-long-route",
    label: "Low fuel long route expected fail",
    initialShip: createShipState({ fuel: { current: 7, capacity: 100, reserve: 5, burnRate: 0.08 } }),
    target: stopTarget("low-fuel-long-route", "Low Fuel Long", vec3(260, 0, 0)),
    obstacles: [],
    expectedOutcome: "ExpectedFail",
    planner: "DirectLocal",
    acceptance: { ...baseAcceptance, maxTicks: 1_200, maxFuelUsed: 10, allowReplanRequired: true, expectedFailureReasonCodes: ["FuelInsufficient"] },
    notes: ["ExpectedFail documents the fuel contract instead of hiding it as a route success."]
  }),
  passCourse({
    id: "off-route-disturbance-midcourse",
    label: "Off-route disturbance midcourse",
    initialShip: createShipState({ fuel: { current: 140, capacity: 140, reserve: 5, burnRate: 0.02 } }),
    target: stopTarget("off-route-disturbance-midcourse", "Disturbance Target", vec3(180, 0, 0)),
    obstacles: [],
    expectedOutcome: "ExpectedFail",
    planner: "DirectLocal",
    disturbance: { tick: 40, positionOffset: vec3(0, 60, 0) },
    acceptance: { ...baseAcceptance, maxTicks: 1_500, allowReplanRequired: true, expectedFailureReasonCodes: ["OffLockedRoute"] },
    notes: ["ExpectedFail proves explicit replanRequired signaling without silent replanning."]
  }),

  passCourse({
    id: "direct-short-stop",
    label: "Direct short 80m stop",
    initialShip: createShipState({ fuel: fuel(120, 8) }),
    target: stopTarget("direct-short-stop", "Direct Short Stop", vec3(80, 0, 0)),
    obstacles: [],
    expectedOutcome: "Pass",
    planner: "DirectLocal",
    acceptance: { ...baseAcceptance, maxTicks: 900, maxFuelUsed: 25 },
    notes: ["Basic distance tier: approximately 80m direct StopWithinEnvelope capture."]
  }),
  passCourse({
    id: "direct-medium-stop",
    label: "Direct medium 500m stop",
    initialShip: createShipState({ fuel: fuel(180, 10) }),
    target: stopTarget("direct-medium-stop", "Direct Medium Stop", vec3(500, 0, 0)),
    obstacles: [],
    expectedOutcome: "Pass",
    planner: "DirectLocal",
    acceptance: { ...baseAcceptance, maxTicks: 2_000, maxFuelUsed: 55 },
    notes: ["Basic distance tier: approximately 500m direct StopWithinEnvelope capture."]
  }),
  passCourse({
    id: "direct-long-stop",
    label: "Direct long 1000m stop",
    initialShip: createShipState({ fuel: fuel(240, 12) }),
    target: stopTarget("direct-long-stop", "Direct Long Stop", vec3(1_000, 0, 0)),
    obstacles: [],
    expectedOutcome: "Pass",
    planner: "DirectLocal",
    acceptance: { ...baseAcceptance, maxTicks: 3_300, maxFuelUsed: 90 },
    notes: ["Basic distance tier: approximately 1000m direct StopWithinEnvelope capture."]
  }),
  passCourse({
    id: "direct-very-long-stop",
    label: "Direct very long 2500m stop",
    initialShip: createShipState({ fuel: fuel(360, 16) }),
    target: stopTarget("direct-very-long-stop", "Direct Very Long Stop", vec3(2_500, 0, 0)),
    obstacles: [],
    expectedOutcome: "Pass",
    planner: "DirectLocal",
    acceptance: { ...baseAcceptance, maxTicks: 7_400, maxFuelUsed: 160 },
    notes: ["Basic distance tier: approximately 2500m direct StopWithinEnvelope capture."]
  }),
  passCourse({
    id: "direct-very-long-fast-stress",
    label: "Direct very long fast profile stress",
    initialShip: createShipState({ fuel: fuel(380, 16) }),
    target: stopTarget("direct-very-long-fast-stress", "Very Long Fast Stress", vec3(2_500, 0, 0)),
    obstacles: [],
    expectedOutcome: "Pass",
    planner: "DirectLocal",
    acceptance: { ...baseAcceptance, maxTicks: 7_200, maxFuelUsed: 170 },
    notes: ["Speed-profile stress row for running the same 2500m StopWithinEnvelope course with the Fast profile."]
  }),
  passCourse({
    id: "single-blocking-obstacle-long",
    label: "Single blocking obstacle long",
    initialShip: createShipState({ fuel: fuel(260, 12) }),
    target: stopTarget("single-blocking-obstacle-long", "Single Obstacle Long", vec3(1_000, 0, 0)),
    obstacles: [obstacle("long-blocking-rock", 760, 0, 0, 12, 7)],
    expectedOutcome: "Pass",
    planner: "ObstacleAvoidanceLocal",
    acceptance: { ...baseAcceptance, minObstacleClearance: 0, maxTicks: 3_900, maxFuelUsed: 110 },
    notes: ["Single blocking obstacle remains inside the current planner's supported avoidance shape."]
  }),
  passCourse({
    id: "s-curve-obstacles-long",
    label: "S-curve obstacles long stress",
    initialShip: createShipState({ fuel: fuel(280, 12) }),
    target: stopTarget("s-curve-obstacles-long", "S-Curve Long Exit", vec3(500, 0, 0)),
    obstacles: [obstacle("long-s-a", 140, 0, 0, 10, 6), obstacle("long-s-b", 250, 22, 0, 10, 6), obstacle("long-s-c", 360, -20, 0, 10, 6)],
    expectedOutcome: "Pass",
    planner: "ObstacleAvoidanceLocal",
    acceptance: { ...baseAcceptance, minObstacleClearance: 0, maxTicks: 5_200, maxFuelUsed: 95 },
    notes: ["Reclassified Pass: long S-curve route remains deterministic with stable planHash and StopWithinEnvelope terminal capture."]
  }),
  passCourse({
    id: "narrow-corridor-long",
    label: "Narrow corridor long stress",
    initialShip: createShipState({ fuel: fuel(280, 12) }),
    target: stopTarget("narrow-corridor-long", "Long Corridor Exit", vec3(1_000, 0, 0)),
    obstacles: [obstacle("long-corridor-upper-a", 330, 28, 0, 18, 8), obstacle("long-corridor-lower-a", 330, -28, 0, 18, 8), obstacle("long-corridor-center-b", 620, 0, 0, 20, 8)],
    expectedOutcome: "Pass",
    planner: "ObstacleAvoidanceLocal",
    acceptance: { ...baseAcceptance, minObstacleClearance: 0, maxTicks: 5_200, maxFuelUsed: 120 },
    notes: ["Reclassified Pass: long corridor route satisfies terminal capture, planHash, and no-silent-replan hard gates under the multi-obstacle planner."]
  }),
  passCourse({
    id: "offset-gates-long",
    label: "Offset gates long",
    initialShip: createShipState({ fuel: fuel(260, 12) }),
    target: stopTarget("offset-gates-long", "Offset Gates Long", vec3(950, 70, 0)),
    obstacles: [obstacle("long-gate-left", 330, -34, 0, 18, 8), obstacle("long-gate-right", 650, 104, 0, 18, 8)],
    expectedOutcome: "Pass",
    planner: "ObstacleAvoidanceLocal",
    acceptance: { ...baseAcceptance, minObstacleClearance: 0, maxTicks: 3_900, maxFuelUsed: 110 },
    notes: ["Offset gates are long-range clearance observations without renderer-authoritative truth."]
  }),
  passCourse({
    id: "target-behind-obstacle-long",
    label: "Target behind obstacle long",
    initialShip: createShipState({ fuel: fuel(260, 12) }),
    target: stopTarget("target-behind-obstacle-long", "Behind Long Rock", vec3(1_000, 0, 0)),
    obstacles: [obstacle("long-front-rock", 780, 0, 0, 24, 12)],
    expectedOutcome: "Pass",
    planner: "ObstacleAvoidanceLocal",
    acceptance: { ...baseAcceptance, minObstacleClearance: 0, maxTicks: 4_000, maxFuelUsed: 115 },
    notes: ["Long single-obstacle target-behind case for the supported first-blocking-obstacle detour."]
  }),
  passCourse({
    id: "target-near-obstacle-long",
    label: "Target near obstacle long",
    initialShip: createShipState({ fuel: fuel(260, 12) }),
    target: stopTarget("target-near-obstacle-long", "Near Long Rock", vec3(1_000, 0, 0)),
    obstacles: [obstacle("long-near-rock", 970, 34, 0, 18, 8)],
    expectedOutcome: "Pass",
    planner: "ObstacleAvoidanceLocal",
    acceptance: { ...baseAcceptance, minObstacleClearance: 0, maxTicks: 3_800, maxFuelUsed: 110 },
    notes: ["Target envelope remains clear of the nearby obstacle safety radius at long range."]
  }),
  passCourse({
    id: "low-main-thrust-long",
    label: "Low main thrust long via high mass",
    initialShip: createShipState({ mass: { dryMass: 5_000, fuelMass: 420, totalMass: 5_420 }, fuel: fuel(420, 18) }),
    target: stopTarget("low-main-thrust-long", "Low Main Thrust Long", vec3(1_000, 0, 0)),
    obstacles: [],
    expectedOutcome: "Pass",
    planner: "DirectLocal",
    acceptance: { ...baseAcceptance, maxTicks: 5_000, maxFuelUsed: 130 },
    notes: ["Long-range low acceleration is modeled through mass; global executor acceleration is unchanged."]
  }),
  passCourse({
    id: "low-rcs-terminal-long",
    label: "Low RCS terminal long",
    initialShip: createShipState({ fuel: fuel(260, 12), authority: createAuthorityState({ mode: "Autopilot", rcsAvailable: false, sasAvailable: true }) }),
    target: stopTarget("low-rcs-terminal-long", "Low RCS Terminal Long", vec3(800, 0, 0)),
    obstacles: [],
    expectedOutcome: "Pass",
    planner: "DirectLocal",
    acceptance: { ...baseAcceptance, maxTicks: 3_200, maxFuelUsed: 100 },
    notes: ["Terminal StopWithinEnvelope remains enforced when RCS is unavailable but main-thrust autopilot authority remains valid."]
  }),
  passCourse({
    id: "no-main-thrusters-negative",
    label: "No main thrusters negative",
    initialShip: createShipState({ fuel: fuel(180, 10), authority: noMainThrustersAuthority }),
    target: stopTarget("no-main-thrusters-negative", "No Main Thrusters", vec3(500, 0, 0)),
    obstacles: [],
    expectedOutcome: "ExpectedFail",
    planner: "DirectLocal",
    acceptance: { ...baseAcceptance, maxTicks: 200, allowReplanRequired: true, expectedFailureReasonCodes: ["MainThrustersUnavailable"] },
    notes: ["ExpectedFail keeps missing main-thruster authority as an explicit route/flight blocker."]
  }),
  passCourse({
    id: "no-autopilot-authority-negative",
    label: "No autopilot authority negative",
    initialShip: createShipState({ fuel: fuel(180, 10), authority: noAutopilotAuthority }),
    target: stopTarget("no-autopilot-authority-negative", "No Autopilot Authority", vec3(500, 0, 0)),
    obstacles: [],
    expectedOutcome: "ExpectedFail",
    planner: "DirectLocal",
    acceptance: { ...baseAcceptance, maxTicks: 200, allowReplanRequired: true, expectedFailureReasonCodes: ["AutopilotUnavailable"] },
    notes: ["ExpectedFail keeps missing autopilot authority as an explicit route/flight blocker."]
  }),
  passCourse({
    id: "midcourse-position-disturbance",
    label: "Midcourse position disturbance",
    initialShip: createShipState({ fuel: fuel(220, 10) }),
    target: stopTarget("midcourse-position-disturbance", "Position Disturbance", vec3(700, 0, 0)),
    obstacles: [],
    expectedOutcome: "ExpectedFail",
    planner: "DirectLocal",
    disturbance: { tick: 120, positionOffset: vec3(0, 75, 0) },
    acceptance: { ...baseAcceptance, maxTicks: 2_400, allowReplanRequired: true, expectedFailureReasonCodes: ["OffLockedRoute"] },
    notes: ["ExpectedFail verifies off-route disturbance fail-closed behavior without silently replanning."]
  }),
  passCourse({
    id: "midcourse-velocity-disturbance",
    label: "Midcourse velocity disturbance",
    initialShip: createShipState({ fuel: fuel(220, 10) }),
    target: stopTarget("midcourse-velocity-disturbance", "Velocity Disturbance", vec3(700, 0, 0)),
    obstacles: [],
    expectedOutcome: "ExpectedFail",
    planner: "DirectLocal",
    disturbance: { tick: 120, velocityOffset: vec3(0, 28, 0) },
    acceptance: { ...baseAcceptance, maxTicks: 2_600, allowReplanRequired: true, expectedFailureReasonCodes: ["OffLockedRoute"] },
    notes: ["ExpectedFail verifies a lateral velocity kick becomes an explicit off-route signal rather than a silent replan."]
  }),
  passCourse({
    id: "terminal-overspeed-disturbance",
    label: "Terminal overspeed disturbance",
    initialShip: createShipState({ fuel: { ...fuel(12, 5, 0.08), capacity: 120 } }),
    target: stopTarget("terminal-overspeed-disturbance", "Terminal Overspeed", vec3(500, 0, 0)),
    obstacles: [],
    expectedOutcome: "ExpectedFail",
    planner: "DirectLocal",
    disturbance: { tick: 80, velocityOffset: vec3(80, 0, 0) },
    acceptance: { ...baseAcceptance, maxTicks: 2_000, allowReplanRequired: true, expectedFailureReasonCodes: ["FuelInsufficient", "BrakeReserveInsufficient"] },
    notes: ["ExpectedFail verifies terminal overspeed with insufficient braking reserve is surfaced explicitly."]
  }),
  passCourse({
    id: "off-route-fail-closed",
    label: "Off-route fail closed",
    initialShip: createShipState({ fuel: fuel(220, 10) }),
    target: stopTarget("off-route-fail-closed", "Off Route Fail Closed", vec3(700, 0, 0)),
    obstacles: [],
    expectedOutcome: "ExpectedFail",
    planner: "DirectLocal",
    disturbance: { tick: 90, positionOffset: vec3(0, -85, 0) },
    acceptance: { ...baseAcceptance, maxTicks: 2_400, allowReplanRequired: true, expectedFailureReasonCodes: ["OffLockedRoute"] },
    notes: ["ExpectedFail proves off-route detection fails closed and preserves the locked plan hash."]
  }),
  passCourse({
    id: "direct-long-safe",
    label: "Direct long safe profile row",
    initialShip: createShipState({ fuel: fuel(240, 12) }),
    target: stopTarget("direct-long-safe", "Direct Long Safe", vec3(1_000, 0, 0)),
    obstacles: [],
    expectedOutcome: "Pass",
    planner: "DirectLocal",
    acceptance: { ...baseAcceptance, maxTicks: 3_700, maxFuelUsed: 90 },
    notes: ["SpeedProfile row intended to be executed with the Safe profile; terminal capture gates are unchanged."]
  }),
  passCourse({
    id: "direct-long-balanced",
    label: "Direct long balanced profile row",
    initialShip: createShipState({ fuel: fuel(240, 12) }),
    target: stopTarget("direct-long-balanced", "Direct Long Balanced", vec3(1_000, 0, 0)),
    obstacles: [],
    expectedOutcome: "Pass",
    planner: "DirectLocal",
    acceptance: { ...baseAcceptance, maxTicks: 3_300, maxFuelUsed: 90 },
    notes: ["SpeedProfile row intended to be executed with the Balanced profile; terminal capture gates are unchanged."]
  }),
  passCourse({
    id: "direct-long-fast",
    label: "Direct long fast profile row",
    initialShip: createShipState({ fuel: fuel(240, 12) }),
    target: stopTarget("direct-long-fast", "Direct Long Fast", vec3(1_000, 0, 0)),
    obstacles: [],
    expectedOutcome: "Pass",
    planner: "DirectLocal",
    acceptance: { ...baseAcceptance, maxTicks: 3_000, maxFuelUsed: 95 },
    notes: ["SpeedProfile row intended to be executed with the Fast profile; terminal capture gates are unchanged."]
  }),
  passCourse({
    id: "corridor-safe",
    label: "Corridor safe profile stress",
    initialShip: createShipState({ fuel: fuel(280, 12) }),
    target: stopTarget("corridor-safe", "Corridor Safe", vec3(1_000, 0, 0)),
    obstacles: [obstacle("safe-corridor-upper", 400, 28, 0, 18, 8), obstacle("safe-corridor-lower", 400, -28, 0, 18, 8), obstacle("safe-corridor-center", 690, 0, 0, 20, 8)],
    expectedOutcome: "Pass",
    planner: "ObstacleAvoidanceLocal",
    acceptance: { ...baseAcceptance, minObstacleClearance: 0, maxTicks: 5_200, maxFuelUsed: 125 },
    notes: ["Reclassified Pass: Safe corridor row remains stable without weakening terminal capture or executor physics."]
  }),
  passCourse({
    id: "corridor-balanced",
    label: "Corridor balanced profile stress",
    initialShip: createShipState({ fuel: fuel(280, 12) }),
    target: stopTarget("corridor-balanced", "Corridor Balanced", vec3(1_000, 0, 0)),
    obstacles: [obstacle("balanced-corridor-upper", 400, 28, 0, 18, 8), obstacle("balanced-corridor-lower", 400, -28, 0, 18, 8), obstacle("balanced-corridor-center", 690, 0, 0, 20, 8)],
    expectedOutcome: "Pass",
    planner: "ObstacleAvoidanceLocal",
    acceptance: { ...baseAcceptance, minObstacleClearance: 0, maxTicks: 5_200, maxFuelUsed: 125 },
    notes: ["Reclassified Pass: Balanced corridor row remains stable without weakening terminal capture or executor physics."]
  }),
  passCourse({
    id: "multi-rock-field-1000m",
    label: "Multi-rock field 1000m",
    initialShip: createShipState({ fuel: fuel(300, 12) }),
    target: stopTarget("multi-rock-field-1000m", "Multi-Rock Field 1000m", vec3(1_000, 0, 0)),
    obstacles: [
      obstacle("field-1000-rock-a", 250, 0, 0, 14, 8),
      obstacle("field-1000-rock-b", 430, 30, 0, 15, 7),
      obstacle("field-1000-rock-c", 620, -30, 0, 15, 7),
      obstacle("field-1000-rock-d", 790, 0, 0, 14, 8)
    ],
    expectedOutcome: "Pass",
    planner: "ObstacleAvoidanceLocal",
    acceptance: { ...baseAcceptance, minObstacleClearance: 0, maxTicks: 5_200, maxFuelUsed: 135 },
    notes: ["Pass: dense 1000m field proves bounded deterministic multi-obstacle routing with stable planHash and no silent replan."]
  }),
  passCourse({
    id: "multi-rock-field-2500m",
    label: "Multi-rock field 2500m",
    initialShip: createShipState({ fuel: fuel(520, 18) }),
    target: stopTarget("multi-rock-field-2500m", "Multi-Rock Field 2500m", vec3(2_500, 0, 0)),
    obstacles: [
      obstacle("field-2500-rock-a", 700, 0, 0, 9, 5),
      obstacle("field-2500-rock-b", 1_080, 42, 0, 10, 5),
      obstacle("field-2500-rock-c", 1_460, -42, 0, 10, 5),
      obstacle("field-2500-rock-d", 1_850, 0, 0, 9, 5),
      obstacle("field-2500-rock-e", 2_180, 44, 0, 9, 5)
    ],
    expectedOutcome: "ExpectedFail",
    planner: "ObstacleAvoidanceLocal",
    acceptance: { ...baseAcceptance, minObstacleClearance: 0, maxTicks: 9_800, maxFuelUsed: 230, allowReplanRequired: true, expectedFailureReasonCodes: ["OffLockedRoute"] },
    notes: ["ExpectedFail: 2500m dense field still diverges from the locked route under current executor hard gates, so it is not hidden as Pass."]
  }),
  passCourse({
    id: "unsolvable-blocked-corridor-negative",
    label: "Unsolvable blocked corridor negative",
    initialShip: createShipState({ fuel: fuel(180, 10) }),
    target: stopTarget("unsolvable-blocked-corridor-negative", "Blocked Corridor Negative", vec3(1_000, 0, 0)),
    obstacles: [
      obstacle("blocked-corridor-rock-a", 120, 0, 0, 18, 10),
      obstacle("blocked-corridor-rock-b", 240, 0, 0, 18, 10),
      obstacle("blocked-corridor-rock-c", 360, 0, 0, 18, 10),
      obstacle("blocked-corridor-rock-d", 480, 0, 0, 18, 10),
      obstacle("blocked-corridor-rock-e", 600, 0, 0, 18, 10),
      obstacle("blocked-corridor-rock-f", 720, 0, 0, 18, 10),
      obstacle("blocked-corridor-rock-g", 840, 0, 0, 18, 10),
      obstacle("blocked-corridor-rock-h", 940, 0, 0, 18, 10),
      obstacle("blocked-corridor-target-seal", 1_000, 0, 0, 28, 8)
    ],
    expectedOutcome: "ExpectedFail",
    planner: "ObstacleAvoidanceLocal",
    acceptance: { ...baseAcceptance, maxTicks: 1_200, allowReplanRequired: true, expectedFailureReasonCodes: ["UnsafeObstacle"] },
    notes: ["ExpectedFail: blocked corridor seals the target envelope and must reject before a locked route is synthesized."]
  })
];

export const getAutopilotProvingGroundCourse = (id: AutopilotProvingGroundCourseId): AutopilotProvingGroundCourse => {
  const course = autopilotProvingGroundCourses.find((candidate) => candidate.id === id);
  if (!course) {
    throw new Error(`Unknown autopilot proving-ground course: ${id}`);
  }
  return course;
};
