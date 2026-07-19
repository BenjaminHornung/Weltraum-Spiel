import { DEFAULT_COURSE_MODEL } from "./course-model.js";

export const LOCOMOTION_UX_FIXTURE_NOTICE = "UX fixture — not final balance";

const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

/** Solver cadence and tolerances. Every meaningful numeric solver fixture is named here. */
export const LOCOMOTION_NUMERIC_CONSTANTS = deepFreeze({
  fixedDeltaSeconds: 1 / 60,
  maxFrameDeltaSeconds: 0.25,
  maxAccumulatedSeconds: 0.25,
  maxSubStepsPerAdvance: 8,
  maxManualStepsPerCall: 600,
  maxMicroSteps: 12,
  maxMicroStepDistance: 0.08,
  collisionIterations: 4,
  contactEpsilon: 1e-7,
  inputDeadZone: 1e-6
});

const groundedParameters = {
  radius: 0.35,
  standingHeight: 1.8,
  crouchedHeight: 1.18,
  walkSpeed: 4,
  sprintSpeed: 7,
  crouchSpeed: 2.2,
  groundAcceleration: 22,
  groundDeceleration: 26,
  airAcceleration: 8,
  airDeceleration: 1.5,
  airControl: 0.35,
  gravity: -9.81,
  jumpSpeed: 5.1,
  maxFallSpeed: 45,
  slopeLimitDegrees: 35,
  stepHeight: 0.36,
  tractionScale: 1,
  supportAdhesionDistance: 0.12
};

const fixture = (label, parameters) => ({
  label,
  notice: LOCOMOTION_UX_FIXTURE_NOTICE,
  parameters
});

/** Complete immutable parameter sets; none are production balance claims. */
export const LOCOMOTION_PRESETS = deepFreeze({
  Grounded: fixture("Grounded", groundedParameters),
  "Heavy suit": fixture("Heavy suit", {
    radius: 0.38,
    standingHeight: 1.82,
    crouchedHeight: 1.22,
    walkSpeed: 3.2,
    sprintSpeed: 5.5,
    crouchSpeed: 1.8,
    groundAcceleration: 16,
    groundDeceleration: 21,
    airAcceleration: 5,
    airDeceleration: 1,
    airControl: 0.22,
    gravity: -11.5,
    jumpSpeed: 4.5,
    maxFallSpeed: 48,
    slopeLimitDegrees: 32,
    stepHeight: 0.32,
    tractionScale: 1.08,
    supportAdhesionDistance: 0.1
  }),
  "Low gravity": fixture("Low gravity", {
    radius: 0.35,
    standingHeight: 1.8,
    crouchedHeight: 1.18,
    walkSpeed: 4.2,
    sprintSpeed: 7.4,
    crouchSpeed: 2.3,
    groundAcceleration: 21,
    groundDeceleration: 24,
    airAcceleration: 7,
    airDeceleration: 1,
    airControl: 0.48,
    gravity: -3.2,
    jumpSpeed: 3.3,
    maxFallSpeed: 22,
    slopeLimitDegrees: 35,
    stepHeight: 0.36,
    tractionScale: 0.95,
    supportAdhesionDistance: 0.14
  }),
  Slippery: fixture("Slippery", {
    radius: 0.35,
    standingHeight: 1.8,
    crouchedHeight: 1.18,
    walkSpeed: 4,
    sprintSpeed: 7,
    crouchSpeed: 2.1,
    groundAcceleration: 16,
    groundDeceleration: 7,
    airAcceleration: 8,
    airDeceleration: 0.8,
    airControl: 0.3,
    gravity: -9.81,
    jumpSpeed: 5.1,
    maxFallSpeed: 45,
    slopeLimitDegrees: 35,
    stepHeight: 0.36,
    tractionScale: 0.32,
    supportAdhesionDistance: 0.1
  }),
  Precision: fixture("Precision", {
    radius: 0.35,
    standingHeight: 1.8,
    crouchedHeight: 1.18,
    walkSpeed: 2.2,
    sprintSpeed: 3.6,
    crouchSpeed: 1.5,
    groundAcceleration: 18,
    groundDeceleration: 30,
    airAcceleration: 6,
    airDeceleration: 2,
    airControl: 0.3,
    gravity: -9.81,
    jumpSpeed: 4.6,
    maxFallSpeed: 40,
    slopeLimitDegrees: 38,
    stepHeight: 0.28,
    tractionScale: 1.15,
    supportAdhesionDistance: 0.1
  })
});

export const DEFAULT_LOCOMOTION_PRESET = "Grounded";
export const EMPTY_LOCOMOTION_INTENT = deepFreeze({ moveX: 0, moveZ: 0, sprint: false, crouch: false, jump: false });

const S = LOCOMOTION_NUMERIC_CONSTANTS;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const cloneVector = (v) => ({ x: v.x, y: v.y, z: v.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const horizontalSpeed = (velocity) => Math.hypot(velocity.x, velocity.z);

const cloneContact = (contact) => ({
  ...contact,
  normal: cloneVector(contact.normal),
  point: contact.point ? cloneVector(contact.point) : undefined
});

const cloneSupport = (support) => ({
  ...support,
  normal: cloneVector(support.normal),
  edgeNormal: cloneVector(support.edgeNormal)
});

const cloneState = (state) => ({
  ...state,
  position: cloneVector(state.position),
  velocity: cloneVector(state.velocity),
  support: cloneSupport(state.support),
  contacts: state.contacts.map(cloneContact),
  intent: { ...state.intent }
});

const makeBounds = (parameters, crouched) => ({
  shape: "vertical-capsule",
  radius: parameters.radius,
  height: crouched ? parameters.crouchedHeight : parameters.standingHeight,
  cylinderHeight: Math.max(0, (crouched ? parameters.crouchedHeight : parameters.standingHeight) - 2 * parameters.radius)
});

const finiteNumber = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

export const normalizeLocomotionIntent = (intent = EMPTY_LOCOMOTION_INTENT) => {
  let moveX = finiteNumber(Number(intent.moveX));
  let moveZ = finiteNumber(Number(intent.moveZ));
  const magnitude = Math.hypot(moveX, moveZ);
  if (magnitude <= S.inputDeadZone) {
    moveX = 0;
    moveZ = 0;
  } else if (magnitude > 1) {
    moveX /= magnitude;
    moveZ /= magnitude;
  }
  return { moveX, moveZ, sprint: intent.sprint === true, crouch: intent.crouch === true, jump: intent.jump === true };
};

const moveHorizontalToward = (velocity, target, maxDelta) => {
  const dx = target.x - velocity.x;
  const dz = target.z - velocity.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= maxDelta || distance <= S.contactEpsilon) return { ...velocity, x: target.x, z: target.z };
  const scale = maxDelta / distance;
  return { ...velocity, x: velocity.x + dx * scale, z: velocity.z + dz * scale };
};

/** Removes only the component moving into the supplied explicit contact normal. */
export const projectVelocityOutOfContact = (velocity, normal) => {
  const inwardSpeed = dot(velocity, normal);
  if (inwardSpeed >= 0) return cloneVector(velocity);
  return {
    x: velocity.x - inwardSpeed * normal.x,
    y: velocity.y - inwardSpeed * normal.y,
    z: velocity.z - inwardSpeed * normal.z
  };
};

const removeDownwardVerticalVelocity = (velocity) => ({
  ...velocity,
  y: Math.max(0, velocity.y)
});

const movementBlockingNormal = (dx, dz) => Math.abs(dx) >= Math.abs(dz)
  ? { x: dx >= 0 ? -1 : 1, y: 0, z: 0 }
  : { x: 0, y: 0, z: dz >= 0 ? -1 : 1 };

const contactPoint = (position, bounds, normal) => ({
  x: position.x - normal.x * bounds.radius,
  y: position.y + Math.min(bounds.radius, bounds.height),
  z: position.z - normal.z * bounds.radius
});

const addContact = (contacts, contact) => {
  const key = `${contact.kind}|${contact.surfaceId}|${contact.normal.x}|${contact.normal.y}|${contact.normal.z}`;
  if (!contacts.some((existing) => existing.key === key)) contacts.push({ ...contact, key });
};

const publicContacts = (contacts) => contacts.map(({ key: _key, ...contact }) => contact);

const resolvePreset = (presetName, overrides) => {
  const fixture = LOCOMOTION_PRESETS[presetName];
  if (!fixture) throw new RangeError(`Unknown locomotion preset: ${presetName}`);
  const parameters = { ...fixture.parameters, ...(overrides ?? {}) };
  for (const [name, value] of Object.entries(parameters)) {
    if (!Number.isFinite(value)) throw new TypeError(`Locomotion parameter ${name} must be finite.`);
  }
  if (parameters.radius <= 0 || parameters.crouchedHeight <= parameters.radius * 2 || parameters.standingHeight < parameters.crouchedHeight) {
    throw new RangeError("Locomotion capsule dimensions are invalid.");
  }
  if (parameters.stepHeight < 0 || parameters.slopeLimitDegrees < 0 || parameters.slopeLimitDegrees > 90) {
    throw new RangeError("Locomotion traversal parameters are invalid.");
  }
  return deepFreeze(parameters);
};

const telemetryIsFinite = (value) => {
  if (typeof value === "number") return Number.isFinite(value);
  if (value === null || typeof value !== "object") return true;
  return Object.values(value).every(telemetryIsFinite);
};

export const isFiniteLocomotionTelemetry = telemetryIsFinite;

export const createLocomotionModel = (options = {}) => {
  const course = options.course ?? DEFAULT_COURSE_MODEL;
  let presetName = options.preset ?? DEFAULT_LOCOMOTION_PRESET;
  let parameters = resolvePreset(presetName, options.parameterOverrides);
  let accumulatorSeconds = 0;
  let fixedStepsLastAdvance = 0;

  const supportAt = (position, bounds) => course.querySupport(position, {
    radius: bounds.radius,
    slopeLimitDegrees: parameters.slopeLimitDegrees
  });

  const resetState = () => {
    const start = course.getStart();
    const bounds = makeBounds(parameters, false);
    const position = { x: start.x, y: start.y, z: start.z };
    const support = supportAt(position, bounds);
    return {
      tick: 0,
      timeSeconds: 0,
      position,
      velocity: { x: 0, y: 0, z: 0 },
      grounded: true,
      crouched: false,
      standingBlocked: false,
      jumpedThisStep: false,
      landedThisStep: false,
      jumpReady: true,
      support,
      contacts: [{
        kind: "reset-support",
        surfaceId: support.surfaceId,
        normal: cloneVector(support.normal),
        point: { x: position.x, y: support.height, z: position.z },
        penetration: 0
      }],
      intent: { ...EMPTY_LOCOMOTION_INTENT },
      presetName
    };
  };

  let state = resetState();

  const resolveSideContacts = (position, velocity, bounds, contacts) => {
    let resolvedPosition = position;
    let resolvedVelocity = velocity;
    for (let iteration = 0; iteration < S.collisionIterations; iteration += 1) {
      const sideContacts = course.queryContacts(resolvedPosition, bounds).filter((contact) => contact.kind === "side");
      if (sideContacts.length === 0) break;
      let changed = false;
      for (const contact of sideContacts) {
        if (contact.penetration <= S.contactEpsilon) continue;
        resolvedPosition = {
          x: resolvedPosition.x + contact.normal.x * contact.penetration,
          y: resolvedPosition.y,
          z: resolvedPosition.z + contact.normal.z * contact.penetration
        };
        resolvedVelocity = projectVelocityOutOfContact(resolvedVelocity, contact.normal);
        addContact(contacts, contact);
        changed = true;
      }
      if (!changed) break;
    }
    return { position: resolvedPosition, velocity: resolvedVelocity };
  };

  const simulateFixedStep = (rawIntent) => {
    const intent = normalizeLocomotionIntent(rawIntent);
    let crouched = intent.crouch || state.crouched;
    let standingBlocked = false;
    const contacts = [];

    if (!intent.crouch && state.crouched) {
      const standingBounds = makeBounds(parameters, false);
      const clearance = course.queryClearance(state.position, standingBounds);
      if (clearance.clear) crouched = false;
      else {
        crouched = true;
        standingBlocked = true;
        for (const contact of clearance.contacts) addContact(contacts, { ...contact, kind: "standing-blocked" });
      }
    }

    const bounds = makeBounds(parameters, crouched);
    let position = cloneVector(state.position);
    let velocity = cloneVector(state.velocity);
    let grounded = state.grounded;
    let jumpedThisStep = false;
    let landedThisStep = false;
    let jumpReady = state.jumpReady;
    let support = supportAt(position, bounds);

    if (!intent.jump) jumpReady = true;
    if (intent.jump && jumpReady && grounded) {
      velocity.y = parameters.jumpSpeed;
      grounded = false;
      jumpedThisStep = true;
      jumpReady = false;
    }

    const requestedSpeed = crouched
      ? parameters.crouchSpeed
      : intent.sprint
        ? parameters.sprintSpeed
        : parameters.walkSpeed;
    const target = { x: intent.moveX * requestedSpeed, z: intent.moveZ * requestedSpeed };
    const hasMovementIntent = Math.hypot(intent.moveX, intent.moveZ) > S.inputDeadZone;
    const effectiveTraction = clamp(support.traction * parameters.tractionScale, 0, 2);
    if (grounded) {
      const rate = hasMovementIntent ? parameters.groundAcceleration : parameters.groundDeceleration;
      velocity = moveHorizontalToward(velocity, target, rate * effectiveTraction * S.fixedDeltaSeconds);
    } else {
      const rate = hasMovementIntent ? parameters.airAcceleration : parameters.airDeceleration;
      velocity = moveHorizontalToward(velocity, target, rate * parameters.airControl * S.fixedDeltaSeconds);
    }

    if (!grounded) velocity.y = Math.max(-parameters.maxFallSpeed, velocity.y + parameters.gravity * S.fixedDeltaSeconds);

    const intendedDistance = Math.hypot(
      velocity.x * S.fixedDeltaSeconds,
      velocity.y * S.fixedDeltaSeconds,
      velocity.z * S.fixedDeltaSeconds
    );
    const microSteps = clamp(Math.ceil(intendedDistance / S.maxMicroStepDistance), 1, S.maxMicroSteps);
    const microDelta = S.fixedDeltaSeconds / microSteps;

    for (let microStep = 0; microStep < microSteps; microStep += 1) {
      const dx = velocity.x * microDelta;
      const dz = velocity.z * microDelta;
      let candidate = { x: position.x + dx, y: position.y, z: position.z + dz };

      const currentClearance = course.queryClearance(position, bounds);
      const candidateClearance = course.queryClearance(candidate, bounds);
      if (currentClearance.clear && !candidateClearance.clear) {
        const normal = movementBlockingNormal(dx, dz);
        const contact = {
          kind: "clearance-blocked",
          surfaceId: candidateClearance.contacts[0].surfaceId,
          normal,
          point: contactPoint(candidate, bounds, normal),
          penetration: 0
        };
        addContact(contacts, contact);
        velocity = projectVelocityOutOfContact(velocity, normal);
        candidate = cloneVector(position);
      } else {
        const candidateSupport = supportAt(candidate, bounds);
        const rise = candidateSupport.height - position.y;
        if (rise > S.contactEpsilon) {
          const stepPosition = { ...candidate, y: candidateSupport.height };
          const canStep = grounded
            && candidateSupport.walkable
            && rise <= parameters.stepHeight + S.contactEpsilon
            && course.queryClearance(stepPosition, bounds).clear;
          if (canStep) {
            candidate = stepPosition;
            addContact(contacts, {
              kind: candidateSupport.kind === "ramp" ? "slope-support" : "step-up",
              surfaceId: candidateSupport.surfaceId,
              normal: cloneVector(candidateSupport.normal),
              point: { x: candidate.x, y: candidateSupport.height, z: candidate.z },
              penetration: rise
            });
          } else {
            const normal = cloneVector(candidateSupport.edgeNormal);
            addContact(contacts, {
              kind: candidateSupport.walkable ? "step-blocked" : "slope-blocked",
              surfaceId: candidateSupport.surfaceId,
              normal,
              point: contactPoint(candidate, bounds, normal),
              penetration: Math.max(0, rise)
            });
            velocity = projectVelocityOutOfContact(velocity, normal);
            candidate = cloneVector(position);
          }
        } else if (grounded) {
          const drop = position.y - candidateSupport.height;
          if (candidateSupport.walkable && drop <= parameters.supportAdhesionDistance + S.contactEpsilon) {
            candidate.y = candidateSupport.height;
            addContact(contacts, {
              kind: "support-follow",
              surfaceId: candidateSupport.surfaceId,
              normal: cloneVector(candidateSupport.normal),
              point: { x: candidate.x, y: candidateSupport.height, z: candidate.z },
              penetration: 0
            });
          } else if (drop > parameters.supportAdhesionDistance) {
            grounded = false;
          }
        }
      }

      ({ position: candidate, velocity } = resolveSideContacts(candidate, velocity, bounds, contacts));
      position = candidate;

      if (!grounded) position = { ...position, y: position.y + velocity.y * microDelta };
      support = supportAt(position, bounds);
      if (!grounded && velocity.y <= 0 && position.y <= support.height + S.contactEpsilon) {
        const supportPenetration = Math.max(0, support.height - position.y);
        position = { ...position, y: support.height };
        velocity = projectVelocityOutOfContact(
          support.walkable ? removeDownwardVerticalVelocity(velocity) : velocity,
          support.normal
        );
        addContact(contacts, {
          kind: support.walkable ? "landing" : "slope-blocked",
          surfaceId: support.surfaceId,
          normal: cloneVector(support.normal),
          point: { x: position.x, y: support.height, z: position.z },
          penetration: supportPenetration
        });
        grounded = support.walkable;
        landedThisStep = grounded;
      }

      const clearance = course.queryClearance(position, bounds);
      if (!clearance.clear) {
        for (const contact of clearance.contacts) {
          position = { ...position, y: position.y - contact.penetration };
          velocity = projectVelocityOutOfContact(velocity, contact.normal);
          addContact(contacts, contact);
        }
      }
      ({ position, velocity } = resolveSideContacts(position, velocity, bounds, contacts));
    }

    support = supportAt(position, bounds);
    const supportDistance = position.y - support.height;
    if (grounded && support.walkable && Math.abs(supportDistance) <= parameters.supportAdhesionDistance + S.contactEpsilon) {
      position = { ...position, y: support.height };
    } else if (grounded && (!support.walkable || supportDistance > parameters.supportAdhesionDistance)) {
      grounded = false;
    }

    state = {
      tick: state.tick + 1,
      timeSeconds: state.timeSeconds + S.fixedDeltaSeconds,
      position,
      velocity,
      grounded,
      crouched,
      standingBlocked,
      jumpedThisStep,
      landedThisStep,
      jumpReady,
      support,
      contacts: publicContacts(contacts),
      intent,
      presetName
    };
  };

  const getTelemetry = () => {
    const bounds = makeBounds(parameters, state.crouched);
    const telemetry = {
      tick: state.tick,
      timeSeconds: state.timeSeconds,
      position: cloneVector(state.position),
      velocity: cloneVector(state.velocity),
      horizontalSpeed: horizontalSpeed(state.velocity),
      speed: Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z),
      verticalVelocity: state.velocity.y,
      grounded: state.grounded,
      crouched: state.crouched,
      standingBlocked: state.standingBlocked,
      jumpedThisStep: state.jumpedThisStep,
      landedThisStep: state.landedThisStep,
      supportSurfaceId: state.support.surfaceId,
      slopeDegrees: state.support.slopeDegrees,
      traction: clamp(state.support.traction * parameters.tractionScale, 0, 2),
      contactCount: state.contacts.length,
      contacts: state.contacts.map(cloneContact),
      bounds,
      presetName,
      fixtureNotice: LOCOMOTION_UX_FIXTURE_NOTICE,
      fixedDeltaSeconds: S.fixedDeltaSeconds,
      fixedStepBacklogSeconds: accumulatorSeconds,
      fixedStepBacklogSteps: accumulatorSeconds / S.fixedDeltaSeconds,
      fixedStepsLastAdvance,
      finite: false
    };
    telemetry.finite = telemetryIsFinite(telemetry);
    return telemetry;
  };

  const step = (intent = EMPTY_LOCOMOTION_INTENT, count = 1) => {
    const stepCount = clamp(Math.trunc(finiteNumber(count, 1)), 0, S.maxManualStepsPerCall);
    for (let index = 0; index < stepCount; index += 1) simulateFixedStep(intent);
    fixedStepsLastAdvance = stepCount;
    return getTelemetry();
  };

  const advance = (elapsedSeconds, intent = EMPTY_LOCOMOTION_INTENT) => {
    const frameContribution = clamp(finiteNumber(elapsedSeconds), 0, S.maxFrameDeltaSeconds);
    accumulatorSeconds = Math.min(S.maxAccumulatedSeconds, accumulatorSeconds + frameContribution);
    let steps = 0;
    while (accumulatorSeconds + S.contactEpsilon >= S.fixedDeltaSeconds && steps < S.maxSubStepsPerAdvance) {
      simulateFixedStep(intent);
      accumulatorSeconds = Math.max(0, accumulatorSeconds - S.fixedDeltaSeconds);
      steps += 1;
    }
    fixedStepsLastAdvance = steps;
    return getTelemetry();
  };

  const reset = () => {
    accumulatorSeconds = 0;
    fixedStepsLastAdvance = 0;
    state = resetState();
    return getTelemetry();
  };

  const setPreset = (nextPresetName, setOptions = {}) => {
    presetName = nextPresetName;
    parameters = resolvePreset(presetName, setOptions.parameterOverrides);
    if (setOptions.reset === true) return reset();
    state = { ...state, presetName };
    return getTelemetry();
  };

  return Object.freeze({
    step,
    advance,
    reset,
    setPreset,
    getState: () => cloneState(state),
    getTelemetry,
    getBounds: () => ({ ...makeBounds(parameters, state.crouched) }),
    getParameters: () => ({ ...parameters }),
    getPresetName: () => presetName,
    isFinite: () => getTelemetry().finite,
    course
  });
};
