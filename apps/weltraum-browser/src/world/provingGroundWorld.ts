import type { AuthorityState, ObstacleDescriptor, ShipState, TargetDescriptor } from "../core";
import { vec3 } from "../core";

export const autopilotAuthority: AuthorityState = {
  mode: "Autopilot",
  mainThrusters: true,
  rcs: true,
  autopilot: true
};

export const noAutopilotAuthority: AuthorityState = {
  mode: "Manual",
  mainThrusters: true,
  rcs: true,
  autopilot: false
};

export const createShipState = (overrides: Partial<ShipState> = {}): ShipState => ({
  position: vec3(0, 0, 0),
  velocity: vec3(0, 0, 0),
  fuel: 100,
  authority: autopilotAuthority,
  ...overrides
});

export const provingGroundTargets = {
  nearArrival: {
    id: "arrival-near",
    label: "Direct arrival marker",
    position: vec3(1.5, 0, 0),
    arrivalRadius: 2
  },
  navigationAlpha: {
    id: "nav-alpha",
    label: "Navigation Alpha",
    position: vec3(120, 0, -30),
    arrivalRadius: 3
  },
  navigationBeta: {
    id: "nav-beta",
    label: "Navigation Beta",
    position: vec3(90, 0, 0),
    arrivalRadius: 3
  }
} satisfies Record<string, TargetDescriptor>;

export const defaultObstacles: readonly ObstacleDescriptor[] = [
  {
    id: "rock-a",
    center: vec3(58, 0, -14),
    radius: 11,
    padding: 8
  }
];

export const blockingCorridorObstacles: readonly ObstacleDescriptor[] = [
  {
    id: "corridor-rock",
    center: vec3(45, 0, 0),
    radius: 10,
    padding: 6
  }
];
