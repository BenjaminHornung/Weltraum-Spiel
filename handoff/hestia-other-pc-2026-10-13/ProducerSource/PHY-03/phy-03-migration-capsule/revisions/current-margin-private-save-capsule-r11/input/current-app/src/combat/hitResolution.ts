import {
  CombatContractError,
  add,
  createCollisionProxy,
  createHitResult,
  deepFreeze,
  deriveCombatId,
  magnitude,
  lexicalCompare,
  normalize,
  nonNegative,
  parseCombatId,
  positive,
  safeInteger,
  scale,
  subtract,
  tick,
  vec3,
  type CollisionProxy,
  type DamagePayload,
  type EntityId,
  type FrameId,
  type HitId,
  type HitResult,
  type ProjectileId,
  type ProjectileState,
  type RayDelivery,
  type Vec3,
  type WeaponId
} from "./contracts";
import { createHitEvent, createProjectileExpiredEvent, type HitEvent, type ProjectileExpiredEvent } from "./events";

const EPSILON = 1e-9;
interface Intersection { readonly distance: number; readonly normal: Readonly<Vec3>; readonly proxy: Readonly<CollisionProxy> }
const axisNormal = (axis: "x" | "y" | "z", sign: number): Vec3 => ({
  x: axis === "x" ? sign : 0,
  y: axis === "y" ? sign : 0,
  z: axis === "z" ? sign : 0
});

const validatePayload = (payload: DamagePayload): Readonly<DamagePayload> => {
  if (!["Kinetic", "Thermal", "ElectricalEmp", "Explosive", "Cutting"].includes(payload.damageType)) throw new CombatContractError("InvalidEnum", "payload.damageType", "is invalid.");
  return deepFreeze({ damageType: payload.damageType, rawDamage: nonNegative(payload.rawDamage, "payload.rawDamage") });
};

const validateProjectile = (input: ProjectileState): Readonly<ProjectileState> => deepFreeze({
  kind: input.kind === "Projectile" ? input.kind : (() => { throw new CombatContractError("InvalidEnum", "projectile.kind", "must be Projectile."); })(),
  projectileId: parseCombatId<ProjectileId>(input.projectileId, "projectile.projectileId"), sourceEntityId: parseCombatId<EntityId>(input.sourceEntityId, "projectile.sourceEntityId"), weaponId: parseCombatId<WeaponId>(input.weaponId, "projectile.weaponId"), frameId: parseCombatId<FrameId>(input.frameId, "projectile.frameId"),
  spawnTick: tick(input.spawnTick, "projectile.spawnTick"), shotSequence: safeInteger(input.shotSequence, "projectile.shotSequence"), position: vec3(input.position, "projectile.position"), velocity: vec3(input.velocity, "projectile.velocity"),
  radiusMeters: positive(input.radiusMeters, "projectile.radiusMeters"), massKilograms: positive(input.massKilograms, "projectile.massKilograms"), remainingLifetimeSeconds: nonNegative(input.remainingLifetimeSeconds, "projectile.remainingLifetimeSeconds"), remainingRangeMeters: nonNegative(input.remainingRangeMeters, "projectile.remainingRangeMeters"), traveledDistanceMeters: nonNegative(input.traveledDistanceMeters, "projectile.traveledDistanceMeters"), payload: validatePayload(input.payload)
});

const validateRay = (input: RayDelivery): Readonly<RayDelivery> => deepFreeze({
  kind: input.kind === "Beam" ? input.kind : (() => { throw new CombatContractError("InvalidEnum", "ray.kind", "must be Beam."); })(),
  sourceEntityId: parseCombatId<EntityId>(input.sourceEntityId, "ray.sourceEntityId"), weaponId: parseCombatId<WeaponId>(input.weaponId, "ray.weaponId"), frameId: parseCombatId<FrameId>(input.frameId, "ray.frameId"), tick: tick(input.tick, "ray.tick"), shotSequence: safeInteger(input.shotSequence, "ray.shotSequence"), origin: vec3(input.origin, "ray.origin"), direction: normalize(vec3(input.direction, "ray.direction"), "ray.direction"), maximumDistanceMeters: positive(input.maximumDistanceMeters, "ray.maximumDistanceMeters"), payload: validatePayload(input.payload)
});

const sphereIntersection = (origin: Vec3, direction: Vec3, maximumDistance: number, proxy: Extract<CollisionProxy, { kind: "Sphere" }>, expansion: number): Intersection | null => {
  const radius = proxy.radiusMeters + expansion; const offset = subtract(origin, proxy.center); const c = offset.x ** 2 + offset.y ** 2 + offset.z ** 2 - radius ** 2;
  let distance: number;
  if (c <= 0) distance = 0;
  else {
    const b = offset.x * direction.x + offset.y * direction.y + offset.z * direction.z; const discriminant = b * b - c;
    if (discriminant < 0) return null;
    distance = -b - Math.sqrt(discriminant);
    if (distance < -EPSILON || distance > maximumDistance + EPSILON) return null;
    distance = Math.max(0, Math.min(maximumDistance, distance));
  }
  const point = add(origin, scale(direction, distance)); const normalVector = subtract(point, proxy.center);
  const normal = magnitude(normalVector) <= EPSILON ? normalize(scale(direction, -1), "hit.normal") : normalize(normalVector, "hit.normal");
  return { distance, normal, proxy };
};

const aabbIntersection = (origin: Vec3, direction: Vec3, maximumDistance: number, proxy: Extract<CollisionProxy, { kind: "Aabb" }>, expansion: number): Intersection | null => {
  const minimum = { x: proxy.minimum.x - expansion, y: proxy.minimum.y - expansion, z: proxy.minimum.z - expansion };
  const maximum = { x: proxy.maximum.x + expansion, y: proxy.maximum.y + expansion, z: proxy.maximum.z + expansion };
  const startsInside = (["x", "y", "z"] as const).every((axis) => origin[axis] >= minimum[axis] && origin[axis] <= maximum[axis]);
  if (startsInside) return { distance: 0, normal: normalize(scale(direction, -1), "hit.normal"), proxy };
  let entry = 0; let exit = maximumDistance; let entryNormal: Vec3 | null = null;
  for (const axis of ["x", "y", "z"] as const) {
    const component = direction[axis];
    if (Math.abs(component) <= Number.EPSILON) {
      if (origin[axis] < minimum[axis] || origin[axis] > maximum[axis]) return null;
      continue;
    }
    let near = (minimum[axis] - origin[axis]) / component; let far = (maximum[axis] - origin[axis]) / component;
    let sign = -1;
    if (near > far) { [near, far] = [far, near]; sign = 1; }
    if (near > entry + EPSILON) {
      entry = near; entryNormal = axisNormal(axis, sign);
    } else if (Math.abs(near - entry) <= EPSILON && entryNormal === null) {
      entryNormal = axisNormal(axis, sign);
    }
    exit = Math.min(exit, far);
    if (entry > exit + EPSILON) return null;
  }
  if (entry < -EPSILON || entry > maximumDistance + EPSILON) return null;
  return { distance: Math.max(0, Math.min(maximumDistance, entry)), normal: entryNormal === null ? normalize(scale(direction, -1), "hit.normal") : vec3(entryNormal, "hit.normal"), proxy };
};

const nearestIntersection = (origin: Vec3, direction: Vec3, maximumDistance: number, frameId: FrameId, sourceEntityId: EntityId, input: readonly CollisionProxy[], expansion: number): Intersection | null => {
  if (maximumDistance <= 0) throw new CombatContractError("ZeroTravel", "maximumDistance", "must be positive.");
  const proxies = input.map(createCollisionProxy);
  for (const proxy of proxies) if (proxy.frameId !== frameId) throw new CombatContractError("FrameMismatch", "proxies", "all proxies must share the delivery frame.");
  const intersections: Intersection[] = [];
  for (const proxy of proxies) {
    if (proxy.entityId === sourceEntityId) continue;
    const intersection = proxy.kind === "Sphere" ? sphereIntersection(origin, direction, maximumDistance, proxy, expansion) : aabbIntersection(origin, direction, maximumDistance, proxy, expansion);
    if (intersection !== null) intersections.push(intersection);
  }
  if (intersections.length === 0) return null;
  const minimumDistance = Math.min(...intersections.map((intersection) => intersection.distance));
  const tieSet = intersections.filter((intersection) => intersection.distance <= minimumDistance + EPSILON);
  tieSet.sort((a, b) => lexicalCompare(a.proxy.proxyId, b.proxy.proxyId));
  return tieSet[0] ?? null;
};

const makeHit = (input: { readonly kind: "Projectile" | "Beam"; readonly sourceEntityId: EntityId; readonly weaponId: WeaponId; readonly projectileId: ProjectileId | null; readonly frameId: FrameId; readonly tick: number; readonly shotSequence: number; readonly origin: Vec3; readonly direction: Vec3; readonly maximumDistance: number; readonly speed: number | null; readonly intersection: Intersection }): Readonly<HitResult> => {
  const { intersection } = input; const point = vec3(add(input.origin, scale(input.direction, intersection.distance)), "hit.point");
  const identity = { deliveryKind: input.kind, sourceEntityId: input.sourceEntityId, targetEntityId: intersection.proxy.entityId, weaponId: input.weaponId, projectileId: input.projectileId, proxyId: intersection.proxy.proxyId, moduleId: intersection.proxy.moduleId, tick: input.tick, shotSequence: input.shotSequence, frameId: input.frameId, distanceMeters: intersection.distance };
  return createHitResult({ hitId: deriveCombatId<HitId>("hit", identity), deliveryKind: input.kind, sourceEntityId: input.sourceEntityId, targetEntityId: intersection.proxy.entityId, weaponId: input.weaponId, projectileId: input.projectileId, proxyId: intersection.proxy.proxyId, moduleId: intersection.proxy.moduleId, tick: input.tick, frameId: input.frameId, distanceMeters: intersection.distance, point, normal: intersection.normal, segmentFraction: intersection.distance / input.maximumDistance, incomingDirection: input.direction, incomingSpeedMetersPerSecond: input.speed });
};

export interface ResolvedHit { readonly hit: Readonly<HitResult>; readonly event: Readonly<HitEvent> }
export const resolveBeamHit = (rayInput: RayDelivery, proxies: readonly CollisionProxy[], resolutionTick: number): Readonly<ResolvedHit> | null => {
  const ray = validateRay(rayInput); const hitTick = tick(resolutionTick, "resolutionTick"); const intersection = nearestIntersection(ray.origin, ray.direction, ray.maximumDistanceMeters, ray.frameId, ray.sourceEntityId, proxies, 0);
  if (intersection === null) return null;
  const hit = makeHit({ kind: "Beam", sourceEntityId: ray.sourceEntityId, weaponId: ray.weaponId, projectileId: null, frameId: ray.frameId, tick: hitTick, shotSequence: ray.shotSequence, origin: ray.origin, direction: ray.direction, maximumDistance: ray.maximumDistanceMeters, speed: null, intersection });
  return deepFreeze({ hit, event: createHitEvent(hit) });
};

export type ProjectileAdvanceResult =
  | { readonly status: "Active"; readonly projectile: Readonly<ProjectileState>; readonly hit: null; readonly events: readonly [] }
  | { readonly status: "Hit"; readonly projectile: null; readonly hit: Readonly<HitResult>; readonly events: readonly [Readonly<HitEvent>] }
  | { readonly status: "Expired"; readonly projectile: null; readonly hit: null; readonly events: readonly [Readonly<ProjectileExpiredEvent>] };

export const advanceProjectile = (input: ProjectileState, dtSeconds: number, resolutionTick: number, proxies: readonly CollisionProxy[]): Readonly<ProjectileAdvanceResult> => {
  const projectile = validateProjectile(input); const dt = positive(dtSeconds, "dtSeconds"); const hitTick = tick(resolutionTick, "resolutionTick"); const speed = magnitude(projectile.velocity);
  if (!Number.isFinite(speed) || speed <= 0) throw new CombatContractError("ZeroTravel", "projectile.velocity", "must produce positive travel.");
  if (projectile.remainingLifetimeSeconds <= 0 || projectile.remainingRangeMeters <= 0) throw new CombatContractError("ExpiredProjectile", "projectile", "cannot be advanced after expiry.");
  const direction = normalize(projectile.velocity, "projectile.velocity"); const requestedDistance = speed * dt; const lifetimeDistance = speed * projectile.remainingLifetimeSeconds; const maximumDistance = Math.min(requestedDistance, lifetimeDistance, projectile.remainingRangeMeters);
  if (maximumDistance <= 0) throw new CombatContractError("ZeroTravel", "projectile", "must have positive capped travel.");
  const intersection = nearestIntersection(projectile.position, direction, maximumDistance, projectile.frameId, projectile.sourceEntityId, proxies, projectile.radiusMeters);
  if (intersection !== null) {
    const hit = makeHit({ kind: "Projectile", sourceEntityId: projectile.sourceEntityId, weaponId: projectile.weaponId, projectileId: projectile.projectileId, frameId: projectile.frameId, tick: hitTick, shotSequence: projectile.shotSequence, origin: projectile.position, direction, maximumDistance, speed, intersection });
    return deepFreeze({ status: "Hit", projectile: null, hit, events: [createHitEvent(hit)] });
  }
  const elapsed = maximumDistance / speed; const position = vec3(add(projectile.position, scale(direction, maximumDistance)), "projectile.position");
  const lifetimeReached = lifetimeDistance <= maximumDistance + EPSILON; const rangeReached = projectile.remainingRangeMeters <= maximumDistance + EPSILON;
  if (lifetimeReached || rangeReached) {
    const event = createProjectileExpiredEvent({ tick: hitTick, sourceEntityId: projectile.sourceEntityId, targetEntityId: null, weaponId: projectile.weaponId, projectileId: projectile.projectileId, moduleId: null, frameId: projectile.frameId, position, reason: lifetimeReached ? "Lifetime" : "Range" });
    return deepFreeze({ status: "Expired", projectile: null, hit: null, events: [event] });
  }
  return deepFreeze({ status: "Active", projectile: deepFreeze({ ...projectile, position, remainingLifetimeSeconds: Math.max(0, projectile.remainingLifetimeSeconds - elapsed), remainingRangeMeters: Math.max(0, projectile.remainingRangeMeters - maximumDistance), traveledDistanceMeters: projectile.traveledDistanceMeters + maximumDistance }), hit: null, events: [] });
};
