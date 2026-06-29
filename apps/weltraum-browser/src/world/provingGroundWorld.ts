import type { AuthorityState, FuelState, ObstacleDescriptor, ShipState, TargetDescriptor } from "../core";
import { createAuthorityState, createShipStateV2, vec3 } from "../core";

export const autopilotAuthority: AuthorityState = createAuthorityState({ mode: "Autopilot" });

export const noAutopilotAuthority: AuthorityState = createAuthorityState({
  mode: "Manual",
  mainThrustersAvailable: true,
  rcsAvailable: true,
  sasAvailable: true,
  autopilotAvailable: false
});

export const noMainThrustersAuthority: AuthorityState = createAuthorityState({
  mode: "Autopilot",
  mainThrustersAvailable: false,
  rcsAvailable: true,
  sasAvailable: true,
  autopilotAvailable: true
});

export const createShipState = (overrides: Partial<Omit<ShipState, "fuel">> & { readonly fuel?: Partial<FuelState> | number } = {}): ShipState =>
  createShipStateV2({
    position: overrides.position ?? vec3(0, 0, 0),
    velocity: overrides.velocity ?? vec3(0, 0, 0),
    fuel: overrides.fuel ?? 100,
    dryMass: overrides.mass?.dryMass,
    cargoMass: overrides.mass?.cargoMass,
    authority: overrides.authority ?? autopilotAuthority
  });

export const provingGroundTargets = {
  nearArrival: {
    id: "arrival-near",
    label: "Direct arrival marker",
    kind: "Waypoint",
    position: vec3(1.5, 0, 0),
    arrivalEnvelope: { radius: 2, stopBehavior: "NoStopRequired" }
  },
  navigationAlpha: {
    id: "nav-alpha",
    label: "Navigation Alpha",
    kind: "Waypoint",
    position: vec3(120, 0, -30),
    arrivalEnvelope: { radius: 3, terminalSpeed: 8, stopBehavior: "MatchTerminalSpeed" }
  },
  navigationBeta: {
    id: "nav-beta",
    label: "Navigation Beta",
    kind: "Point",
    position: vec3(90, 0, 0),
    arrivalEnvelope: { radius: 3, terminalSpeed: 8, stopBehavior: "MatchTerminalSpeed" }
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
