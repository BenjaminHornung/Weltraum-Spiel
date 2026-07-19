/** Pure analytic proving-ground geometry. No renderer or DOM owns these values. */

export const COURSE_UX_FIXTURE_NOTICE = "UX fixture — not final balance";

const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

export const COURSE_NUMERIC_CONSTANTS = deepFreeze({
  world: { minX: -18, maxX: 18, minZ: -10, maxZ: 48, floorY: 0 },
  start: { x: 0, y: 0, z: 0, yawRadians: 0 },
  normalTraction: 1,
  slipperyTraction: 0.16,
  platformTraction: 0.86,
  rockTraction: 0.72,
  ramps: {
    minZ: 5,
    maxZ: 11,
    width: 4,
    lanes: [
      { id: "ramp-10", minX: -14, degrees: 10 },
      { id: "ramp-20", minX: -7, degrees: 20 },
      { id: "ramp-35", minX: 0, degrees: 35 },
      { id: "ramp-50", minX: 7, degrees: 50 }
    ]
  },
  stairs: [
    { id: "stairs-low", minX: -10, maxX: -7, minZ: 14, stepRise: 0.16, stepDepth: 1, stepCount: 4 },
    { id: "stairs-passable", minX: -3, maxX: 0, minZ: 14, stepRise: 0.3, stepDepth: 1, stepCount: 4 },
    { id: "stairs-blocked", minX: 4, maxX: 7, minZ: 14, stepRise: 0.5, stepDepth: 1, stepCount: 3 }
  ],
  tunnel: { id: "crouch-tunnel", minX: -2, maxX: 2, minZ: 22, maxZ: 30, ceilingY: 1.42, ceilingThickness: 0.22 },
  narrowPlatform: { id: "narrow-platform", minX: 6, maxX: 7, minZ: 24, maxZ: 34, topY: 1.1 },
  slipperyPatch: { id: "slippery-patch", minX: -12, maxX: -6, minZ: 24, maxZ: 32 },
  unevenRock: {
    id: "uneven-rock-surface",
    minX: -3,
    maxX: 3,
    minZ: 36,
    maxZ: 44,
    baseHeight: 0.08,
    xAmplitude: 0.1,
    zAmplitude: 0.07,
    crossAmplitude: 0.04,
    xFrequency: 1.7,
    zFrequency: 1.25,
    crossFrequency: 0.65
  },
  query: { epsilon: 1e-9, defaultRadius: 0, defaultSlopeLimitDegrees: 90 },
  priority: { floor: 0, tractionPatch: 10, ramp: 20, stairs: 30, platform: 40, uneven: 50 }
});

const C = COURSE_NUMERIC_CONSTANTS;

const rampCatalog = C.ramps.lanes.map((lane) => deepFreeze({
  id: lane.id,
  kind: "ramp",
  degrees: lane.degrees,
  bounds: { minX: lane.minX, maxX: lane.minX + C.ramps.width, minZ: C.ramps.minZ, maxZ: C.ramps.maxZ },
  baseY: C.world.floorY,
  traction: C.normalTraction
}));

const stairCatalog = C.stairs.map((stairs) => deepFreeze({
  ...stairs,
  kind: "stairs",
  maxZ: stairs.minZ + stairs.stepDepth * stairs.stepCount,
  traction: C.normalTraction
}));

/** The sole named catalog used by both collision queries and future rendering. */
export const COURSE_CATALOG = deepFreeze({
  notice: COURSE_UX_FIXTURE_NOTICE,
  id: "first-person-locomotion-sandbox-v1",
  start: { id: "start", kind: "start", ...C.start },
  floor: { id: "flat-ground", kind: "plane", bounds: { ...C.world }, height: C.world.floorY, traction: C.normalTraction },
  ramps: rampCatalog,
  stairs: stairCatalog,
  tunnel: { ...C.tunnel, kind: "overhead-clearance", traction: C.normalTraction },
  narrowPlatform: { ...C.narrowPlatform, kind: "platform", traction: C.platformTraction },
  slipperyPatch: { ...C.slipperyPatch, kind: "traction-patch", height: C.world.floorY, traction: C.slipperyTraction },
  unevenRock: { ...C.unevenRock, kind: "analytic-heightfield", traction: C.rockTraction }
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const length3 = (v) => Math.hypot(v.x, v.y, v.z);
const normalize3 = (v) => {
  const length = length3(v);
  return length <= C.query.epsilon ? { x: 0, y: 1, z: 0 } : { x: v.x / length, y: v.y / length, z: v.z / length };
};
const slopeDegrees = (normal) => Math.acos(clamp(normal.y, -1, 1)) * 180 / Math.PI;
const clone = (value) => Array.isArray(value)
  ? value.map(clone)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]))
    : value;

const circleIntersectsRect = (x, z, radius, bounds) => {
  const dx = x - clamp(x, bounds.minX, bounds.maxX);
  const dz = z - clamp(z, bounds.minZ, bounds.maxZ);
  return dx * dx + dz * dz <= radius * radius + C.query.epsilon;
};

const closestBoundaryNormal = (x, z, bounds) => {
  const distances = [
    { distance: Math.abs(x - bounds.minX), normal: { x: -1, y: 0, z: 0 } },
    { distance: Math.abs(bounds.maxX - x), normal: { x: 1, y: 0, z: 0 } },
    { distance: Math.abs(z - bounds.minZ), normal: { x: 0, y: 0, z: -1 } },
    { distance: Math.abs(bounds.maxZ - z), normal: { x: 0, y: 0, z: 1 } }
  ];
  distances.sort((a, b) => a.distance - b.distance);
  return distances[0].normal;
};

const rampSurface = (ramp, position, radius) => {
  if (!circleIntersectsRect(position.x, position.z, radius, ramp.bounds)) return null;
  const sampleZ = clamp(position.z, ramp.bounds.minZ, ramp.bounds.maxZ);
  const risePerMetre = Math.tan(ramp.degrees * Math.PI / 180);
  const height = ramp.baseY + (sampleZ - ramp.bounds.minZ) * risePerMetre;
  return {
    id: ramp.id,
    kind: ramp.kind,
    height,
    normal: normalize3({ x: 0, y: 1, z: -risePerMetre }),
    traction: ramp.traction,
    priority: C.priority.ramp,
    edgeNormal: closestBoundaryNormal(position.x, position.z, ramp.bounds)
  };
};

const stairSteps = stairCatalog.flatMap((stairs) => Array.from({ length: stairs.stepCount }, (_, index) => {
  const bounds = {
    minX: stairs.minX,
    maxX: stairs.maxX,
    minZ: stairs.minZ + index * stairs.stepDepth,
    maxZ: stairs.minZ + (index + 1) * stairs.stepDepth
  };
  return deepFreeze({
    id: `${stairs.id}-step-${index + 1}`,
    groupId: stairs.id,
    kind: "stair-step",
    bounds,
    bottomY: C.world.floorY,
    topY: (index + 1) * stairs.stepRise,
    traction: stairs.traction
  });
}));

const unevenSample = (position, radius) => {
  const rock = COURSE_CATALOG.unevenRock;
  const bounds = rock;
  if (!circleIntersectsRect(position.x, position.z, radius, bounds)) return null;
  const x = clamp(position.x, bounds.minX, bounds.maxX);
  const z = clamp(position.z, bounds.minZ, bounds.maxZ);
  const localZ = z - bounds.minZ;
  const height = rock.baseHeight
    + rock.xAmplitude * Math.sin(x * rock.xFrequency)
    + rock.zAmplitude * Math.sin(localZ * rock.zFrequency)
    + rock.crossAmplitude * Math.sin((x + localZ) * rock.crossFrequency);
  const dx = rock.xAmplitude * rock.xFrequency * Math.cos(x * rock.xFrequency)
    + rock.crossAmplitude * rock.crossFrequency * Math.cos((x + localZ) * rock.crossFrequency);
  const dz = rock.zAmplitude * rock.zFrequency * Math.cos(localZ * rock.zFrequency)
    + rock.crossAmplitude * rock.crossFrequency * Math.cos((x + localZ) * rock.crossFrequency);
  return {
    id: rock.id,
    kind: rock.kind,
    height,
    normal: normalize3({ x: -dx, y: 1, z: -dz }),
    traction: rock.traction,
    priority: C.priority.uneven,
    edgeNormal: closestBoundaryNormal(position.x, position.z, bounds)
  };
};

const circleBoxContact = (position, bounds, solid) => {
  const foot = position.y;
  const head = position.y + bounds.height;
  if (foot >= solid.topY - C.query.epsilon || head <= solid.bottomY + C.query.epsilon) return null;

  const closestX = clamp(position.x, solid.bounds.minX, solid.bounds.maxX);
  const closestZ = clamp(position.z, solid.bounds.minZ, solid.bounds.maxZ);
  const dx = position.x - closestX;
  const dz = position.z - closestZ;
  const distance = Math.hypot(dx, dz);
  if (distance >= bounds.radius - C.query.epsilon) return null;

  let normal;
  let penetration;
  let point = { x: closestX, y: clamp(foot + bounds.radius, solid.bottomY, solid.topY), z: closestZ };
  if (distance > C.query.epsilon) {
    normal = { x: dx / distance, y: 0, z: dz / distance };
    penetration = bounds.radius - distance;
  } else {
    const side = [
      { distance: position.x - solid.bounds.minX, normal: { x: -1, y: 0, z: 0 }, x: solid.bounds.minX, z: position.z },
      { distance: solid.bounds.maxX - position.x, normal: { x: 1, y: 0, z: 0 }, x: solid.bounds.maxX, z: position.z },
      { distance: position.z - solid.bounds.minZ, normal: { x: 0, y: 0, z: -1 }, x: position.x, z: solid.bounds.minZ },
      { distance: solid.bounds.maxZ - position.z, normal: { x: 0, y: 0, z: 1 }, x: position.x, z: solid.bounds.maxZ }
    ].sort((a, b) => a.distance - b.distance)[0];
    normal = side.normal;
    penetration = bounds.radius + side.distance;
    point = { x: side.x, y: point.y, z: side.z };
  }

  return {
    id: `contact-${solid.id}`,
    kind: "side",
    surfaceId: solid.id,
    normal,
    point,
    penetration,
    topHeight: solid.topY,
    stepCandidate: solid.kind === "stair-step"
  };
};

const platformSolid = deepFreeze({
  id: COURSE_CATALOG.narrowPlatform.id,
  kind: "platform",
  bounds: COURSE_CATALOG.narrowPlatform,
  bottomY: C.world.floorY,
  topY: COURSE_CATALOG.narrowPlatform.topY
});
const horizontalSolids = [...stairSteps, platformSolid];

const makeSupport = (candidate, slopeLimitDegrees, position) => {
  const angle = slopeDegrees(candidate.normal);
  return {
    surfaceId: candidate.id,
    kind: candidate.kind,
    height: candidate.height,
    normal: { ...candidate.normal },
    slopeDegrees: angle,
    traction: candidate.traction,
    walkable: angle <= slopeLimitDegrees + C.query.epsilon,
    distance: position.y - candidate.height,
    edgeNormal: { ...candidate.edgeNormal }
  };
};

export const getCourseRenderDescriptors = () => clone(COURSE_CATALOG);

export const createCourseModel = () => {
  const querySupport = (position, options = {}) => {
    const radius = Number.isFinite(options.radius) ? Math.max(0, options.radius) : C.query.defaultRadius;
    const slopeLimit = Number.isFinite(options.slopeLimitDegrees)
      ? options.slopeLimitDegrees
      : C.query.defaultSlopeLimitDegrees;
    const candidates = [{
      id: COURSE_CATALOG.floor.id,
      kind: COURSE_CATALOG.floor.kind,
      height: COURSE_CATALOG.floor.height,
      normal: { x: 0, y: 1, z: 0 },
      traction: COURSE_CATALOG.floor.traction,
      priority: C.priority.floor,
      edgeNormal: { x: 0, y: 0, z: -1 }
    }];

    for (const ramp of rampCatalog) {
      const surface = rampSurface(ramp, position, radius);
      if (surface) candidates.push(surface);
    }
    for (const step of stairSteps) {
      if (circleIntersectsRect(position.x, position.z, radius, step.bounds)) {
        candidates.push({
          id: step.id,
          kind: step.kind,
          height: step.topY,
          normal: { x: 0, y: 1, z: 0 },
          traction: step.traction,
          priority: C.priority.stairs,
          edgeNormal: closestBoundaryNormal(position.x, position.z, step.bounds)
        });
      }
    }
    const platform = COURSE_CATALOG.narrowPlatform;
    if (circleIntersectsRect(position.x, position.z, radius, platform)) {
      candidates.push({
        id: platform.id,
        kind: platform.kind,
        height: platform.topY,
        normal: { x: 0, y: 1, z: 0 },
        traction: platform.traction,
        priority: C.priority.platform,
        edgeNormal: closestBoundaryNormal(position.x, position.z, platform)
      });
    }
    const slippery = COURSE_CATALOG.slipperyPatch;
    if (circleIntersectsRect(position.x, position.z, radius, slippery)) {
      candidates.push({
        id: slippery.id,
        kind: slippery.kind,
        height: slippery.height,
        normal: { x: 0, y: 1, z: 0 },
        traction: slippery.traction,
        priority: C.priority.tractionPatch,
        edgeNormal: closestBoundaryNormal(position.x, position.z, slippery)
      });
    }
    const rock = unevenSample(position, radius);
    if (rock) candidates.push(rock);

    candidates.sort((a, b) => b.height - a.height || b.priority - a.priority || a.id.localeCompare(b.id));
    return makeSupport(candidates[0], slopeLimit, position);
  };

  const queryClearance = (position, bounds) => {
    const contacts = [];
    const tunnel = COURSE_CATALOG.tunnel;
    if (circleIntersectsRect(position.x, position.z, bounds.radius, tunnel)) {
      const headY = position.y + bounds.height;
      if (headY > tunnel.ceilingY + C.query.epsilon && position.y < tunnel.ceilingY + tunnel.ceilingThickness) {
        contacts.push({
          id: `contact-${tunnel.id}-ceiling`,
          kind: "ceiling",
          surfaceId: tunnel.id,
          normal: { x: 0, y: -1, z: 0 },
          point: { x: position.x, y: tunnel.ceilingY, z: position.z },
          penetration: headY - tunnel.ceilingY
        });
      }
    }
    return {
      clear: contacts.length === 0,
      availableHeight: contacts.length === 0 ? Infinity : Math.max(0, tunnel.ceilingY - position.y),
      contacts
    };
  };

  const queryContacts = (position, bounds) => {
    const contacts = horizontalSolids
      .map((solid) => circleBoxContact(position, bounds, solid))
      .filter(Boolean);
    contacts.push(...queryClearance(position, bounds).contacts);
    contacts.sort((a, b) => a.surfaceId.localeCompare(b.surfaceId) || a.kind.localeCompare(b.kind));
    return contacts;
  };

  return Object.freeze({
    catalog: COURSE_CATALOG,
    getStart: () => clone(COURSE_CATALOG.start),
    getRenderDescriptors: getCourseRenderDescriptors,
    querySupport,
    queryClearance,
    queryContacts
  });
};

export const DEFAULT_COURSE_MODEL = createCourseModel();
