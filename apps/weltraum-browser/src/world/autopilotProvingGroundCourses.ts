import type { AutopilotProvingGroundCourse, ObstacleDescriptor, TargetDescriptor } from "../core";
import { createAuthorityState, vec3 } from "../core";
import { createShipState } from "./provingGroundWorld";

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
  | "off-route-disturbance-midcourse";

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

const baseAcceptance = {
  maxFinalDistance: 3,
  maxFinalSpeed: 0.5,
  minObstacleClearance: 0,
  maxTicks: 1_800,
  allowReplanRequired: false
} as const;

const passCourse = (course: AutopilotProvingGroundCourse): AutopilotProvingGroundCourse => course;

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
    expectedOutcome: "KnownStress",
    planner: "ObstacleAvoidanceLocal",
    acceptance: { ...baseAcceptance, minObstacleClearance: -8, maxTicks: 1_800 },
    notes: ["KnownStress: current local planner detours around the first blocking obstacle only."]
  }),
  passCourse({
    id: "narrow-corridor",
    label: "Narrow corridor stress",
    initialShip: createShipState({ fuel: { current: 140, capacity: 140, reserve: 5, burnRate: 0.02 } }),
    target: stopTarget("narrow-corridor", "Corridor Exit", vec3(170, 0, 0)),
    obstacles: [obstacle("corridor-upper-a", 70, 17, 0, 10, 4), obstacle("corridor-lower-a", 70, -17, 0, 10, 4), obstacle("corridor-center-b", 115, 0, 0, 9, 5)],
    expectedOutcome: "KnownStress",
    planner: "ObstacleAvoidanceLocal",
    acceptance: { ...baseAcceptance, minObstacleClearance: -6, maxTicks: 1_800 },
    notes: ["KnownStress: corridor geometry is intentionally tighter than the one-obstacle detour planner can fully classify."]
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
  })
];

export const getAutopilotProvingGroundCourse = (id: AutopilotProvingGroundCourseId): AutopilotProvingGroundCourse => {
  const course = autopilotProvingGroundCourses.find((candidate) => candidate.id === id);
  if (!course) {
    throw new Error(`Unknown autopilot proving-ground course: ${id}`);
  }
  return course;
};
