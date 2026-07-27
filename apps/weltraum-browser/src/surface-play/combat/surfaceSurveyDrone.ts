import {
  applyDamage,
  createCollisionProxy,
  createCombatTarget,
  createDamageableSnapshot,
  deepFreeze,
  type CollisionProxy,
  type CombatTargetSnapshot,
  type DamageApplicationResult,
  type DamagePacket,
  type DamageableSnapshot,
  type Vec3
} from "../../combat";

export const SURFACE_SURVEY_DRONE_ID = "surface-target:survey-drone-v1";
export const SURFACE_SURVEY_DRONE_PROXY_ID = "surface-proxy:survey-drone-v1";
export const SURFACE_SURVEY_DRONE_OWNER_ID = "surface-owner:security";
export const SURFACE_SURVEY_DRONE_ARMOR = 15;
export const SURFACE_SURVEY_DRONE_HULL = 60;
export const SURFACE_SURVEY_DRONE_PROXY_RADIUS_METERS = 0.8;

export type SurfaceSurveyDroneMode = "Idle" | "Alerted" | "Damaged" | "Destroyed";

export interface SurfaceSurveyDroneState {
  readonly mode: SurfaceSurveyDroneMode;
  readonly frameId: string;
  readonly positionMeters: Readonly<Vec3>;
  readonly damageable: Readonly<DamageableSnapshot>;
}

const zeroResistances = () => ({
  Kinetic: 0,
  Thermal: 0,
  ElectricalEmp: 0,
  Explosive: 0,
  Cutting: 0
} as const);

export const createSurfaceSurveyDrone = (
  frameId: string,
  positionMeters: Vec3
): Readonly<SurfaceSurveyDroneState> => deepFreeze({
  mode: "Idle" as const,
  frameId,
  positionMeters,
  damageable: createDamageableSnapshot({
    targetEntityId: SURFACE_SURVEY_DRONE_ID,
    armor: {
      current: SURFACE_SURVEY_DRONE_ARMOR,
      maximum: SURFACE_SURVEY_DRONE_ARMOR,
      resistances: zeroResistances()
    },
    hull: {
      current: SURFACE_SURVEY_DRONE_HULL,
      maximum: SURFACE_SURVEY_DRONE_HULL,
      resistances: zeroResistances()
    },
    modules: []
  })
});

export const alertSurfaceSurveyDrone = (
  drone: Readonly<SurfaceSurveyDroneState>
): Readonly<SurfaceSurveyDroneState> => drone.mode === "Idle"
  ? deepFreeze({ ...drone, mode: "Alerted" as const })
  : drone;

export const createSurfaceSurveyDroneTarget = (
  drone: Readonly<SurfaceSurveyDroneState>,
  simulationTick: number
): Readonly<CombatTargetSnapshot> => createCombatTarget({
  targetId: SURFACE_SURVEY_DRONE_ID,
  ownerId: SURFACE_SURVEY_DRONE_OWNER_ID,
  frameId: drone.frameId,
  tick: simulationTick,
  position: drone.positionMeters,
  velocity: { x: 0, y: 0, z: 0 },
  targetable: drone.mode !== "Destroyed",
  lifecycle: drone.mode === "Destroyed" ? "Destroyed" : "Active"
});

export const createSurfaceSurveyDroneProxy = (
  drone: Readonly<SurfaceSurveyDroneState>
): Readonly<CollisionProxy> => createCollisionProxy({
  kind: "Sphere",
  proxyId: SURFACE_SURVEY_DRONE_PROXY_ID,
  entityId: SURFACE_SURVEY_DRONE_ID,
  moduleId: null,
  frameId: drone.frameId,
  center: drone.positionMeters,
  radiusMeters: SURFACE_SURVEY_DRONE_PROXY_RADIUS_METERS
});

const modeAfterDamage = (
  damageable: Readonly<DamageableSnapshot>
): SurfaceSurveyDroneMode => {
  if (damageable.hull.current === 0) return "Destroyed";
  if (
    damageable.armor.current < damageable.armor.maximum
    || damageable.hull.current < damageable.hull.maximum
  ) return "Damaged";
  return "Alerted";
};

export interface SurfaceSurveyDroneDamageResult {
  readonly drone: Readonly<SurfaceSurveyDroneState>;
  readonly damage: Readonly<DamageApplicationResult>;
}

export const applySurfaceSurveyDroneDamage = (
  drone: Readonly<SurfaceSurveyDroneState>,
  packet: Readonly<DamagePacket>
): Readonly<SurfaceSurveyDroneDamageResult> => {
  const damage = applyDamage(packet, drone.damageable);
  const mode = drone.mode === "Destroyed" ? "Destroyed" : modeAfterDamage(damage.after);
  return deepFreeze({
    drone: {
      ...drone,
      mode,
      damageable: damage.after
    },
    damage
  });
};
