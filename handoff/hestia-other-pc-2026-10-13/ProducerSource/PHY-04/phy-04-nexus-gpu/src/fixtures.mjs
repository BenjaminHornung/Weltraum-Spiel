import { encodeNumbers, threefry2x32 } from "../snapshot/plt/src/numerics.mjs";

const COUNTS = new Set([10, 100, 1000]);
const SCENARIOS = Object.freeze({ freefall: 1, zeroGravity: 2, dynamicGeometry: 3 });
const DT = 1 / 60;
const STEPS = 30;
const MASS = 2;
const HALF_EXTENTS = Object.freeze([0.25, 0.5, 0.75]);
const CHANGED_HALF_EXTENTS = Object.freeze([0.125, 0.5, 0.75]);
const IDENTITY_ROTATION = Object.freeze([0, 0, 0, 1]);
const ZERO_ANGULAR_VELOCITY = Object.freeze([0, 0, 0]);
const GRID_SPACING = 4;
const GRID_WIDTH = 32; // Fixed width keeps the first bodies identical across count fixtures.

const assertKeys = (value, expected, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (actual.length !== sortedExpected.length || actual.some((key, index) => key !== sortedExpected[index])) {
    throw new TypeError(`${label} fields are invalid.`);
  }
};

const assertFinite = (value, label) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite.`);
  }
  return value;
};

const assertVector = (value, length, label, positive = false) => {
  if (!Array.isArray(value) || value.length !== length) {
    throw new TypeError(`${label} must contain ${length} values.`);
  }
  value.forEach((component, index) => {
    assertFinite(component, `${label}[${index}]`);
    if (positive && component <= 0) throw new RangeError(`${label}[${index}] must be positive.`);
  });
  return value;
};

const assertVectorEquals = (actual, expected, label) => {
  assertVector(actual, expected.length, label);
  if (actual.some((value, index) => value !== expected[index])) {
    throw new RangeError(`${label} does not match the canonical fixture.`);
  }
};

const inertiaFor = (mass, [hx, hy, hz]) => [
  mass / 3 * (hy * hy + hz * hz),
  mass / 3 * (hx * hx + hz * hz),
  mass / 3 * (hx * hx + hy * hy)
];

const freezeVector = (value) => Object.freeze([...value]);

const velocityFor = (index) => {
  const [word] = threefry2x32([index, 0], [4, 21]);
  return [(word / 0xffffffff) * 2 - 1, 0, 0];
};

const positionFor = (index) => [
  (index % GRID_WIDTH) * GRID_SPACING,
  10,
  Math.floor(index / GRID_WIDTH) * GRID_SPACING
];

export function makeFixture(count, scenario = "freefall") {
  if (!COUNTS.has(count)) throw new RangeError("Count must be 10, 100, or 1000.");
  if (!Object.hasOwn(SCENARIOS, scenario)) throw new RangeError("Scenario is unsupported.");
  if (scenario === "dynamicGeometry" && count !== 10) {
    throw new RangeError("Dynamic geometry is defined only for the 10-body fixture.");
  }

  const bodies = Object.freeze(Array.from({ length: count }, (_, id) => {
    const halfExtents = freezeVector(HALF_EXTENTS);
    return Object.freeze({
      id,
      shape: "cuboid",
      mass: MASS,
      halfExtents,
      position: freezeVector(positionFor(id)),
      rotation: freezeVector(IDENTITY_ROTATION),
      velocity: freezeVector(velocityFor(id)),
      angularVelocity: freezeVector(ZERO_ANGULAR_VELOCITY),
      inertia: freezeVector(inertiaFor(MASS, halfExtents))
    });
  }));
  const geometryChanges = scenario === "dynamicGeometry"
    ? Object.freeze([Object.freeze({
      tick: 10,
      bodyIndex: 0,
      mass: MASS,
      halfExtents: freezeVector(CHANGED_HALF_EXTENTS),
      inertia: freezeVector(inertiaFor(MASS, CHANGED_HALF_EXTENTS))
    })])
    : Object.freeze([]);
  const fixture = Object.freeze({
    scenario,
    count,
    dt: DT,
    steps: STEPS,
    gravity: freezeVector(scenario === "zeroGravity" ? [0, 0, 0] : [0, -9.81, 0]),
    bodies,
    geometryChanges
  });
  return validateFixture(fixture);
}

export function validateFixture(fixture) {
  assertKeys(fixture, ["scenario", "count", "dt", "steps", "gravity", "bodies", "geometryChanges"], "Fixture");
  if (!Object.hasOwn(SCENARIOS, fixture.scenario)) throw new RangeError("Scenario is unsupported.");
  if (!COUNTS.has(fixture.count)) throw new RangeError("Count must be 10, 100, or 1000.");
  if (fixture.scenario === "dynamicGeometry" && fixture.count !== 10) {
    throw new RangeError("Dynamic geometry is defined only for the 10-body fixture.");
  }
  assertFinite(fixture.dt, "dt");
  if (fixture.dt !== DT) throw new RangeError("dt does not match the canonical fixture.");
  if (!Number.isSafeInteger(fixture.steps) || fixture.steps !== STEPS) {
    throw new RangeError("steps does not match the canonical fixture.");
  }
  const expectedGravity = fixture.scenario === "zeroGravity" ? [0, 0, 0] : [0, -9.81, 0];
  assertVectorEquals(fixture.gravity, expectedGravity, "gravity");
  if (!Array.isArray(fixture.bodies) || fixture.bodies.length !== fixture.count) {
    throw new RangeError("Body count does not match the fixture count.");
  }

  fixture.bodies.forEach((body, index) => {
    assertKeys(body, ["id", "shape", "mass", "halfExtents", "position", "rotation", "velocity", "angularVelocity", "inertia"], `body[${index}]`);
    if (body.id !== index || body.shape !== "cuboid") throw new RangeError(`body[${index}] identity or shape is invalid.`);
    assertFinite(body.mass, `body[${index}].mass`);
    if (body.mass !== MASS) throw new RangeError(`body[${index}].mass must be ${MASS} kg.`);
    assertVectorEquals(body.halfExtents, HALF_EXTENTS, `body[${index}].halfExtents`);
    assertVectorEquals(body.position, positionFor(index), `body[${index}].position`);
    assertVectorEquals(body.rotation, IDENTITY_ROTATION, `body[${index}].rotation`);
    assertVectorEquals(body.velocity, velocityFor(index), `body[${index}].velocity`);
    assertVectorEquals(body.angularVelocity, ZERO_ANGULAR_VELOCITY, `body[${index}].angularVelocity`);
    assertVectorEquals(body.inertia, inertiaFor(MASS, HALF_EXTENTS), `body[${index}].inertia`);
  });

  if (!Array.isArray(fixture.geometryChanges)) throw new TypeError("geometryChanges must be an array.");
  if (fixture.scenario === "dynamicGeometry") {
    if (fixture.geometryChanges.length !== 1) throw new RangeError("Dynamic geometry requires one change.");
    const change = fixture.geometryChanges[0];
    assertKeys(change, ["tick", "bodyIndex", "mass", "halfExtents", "inertia"], "geometry change");
    if (change.tick !== 10 || change.bodyIndex !== 0) throw new RangeError("Geometry change timing or target is invalid.");
    assertFinite(change.mass, "geometry change mass");
    if (change.mass !== MASS) throw new RangeError("Geometry change must preserve mass.");
    assertVectorEquals(change.halfExtents, CHANGED_HALF_EXTENTS, "geometry change halfExtents");
    assertVectorEquals(change.inertia, inertiaFor(MASS, CHANGED_HALF_EXTENTS), "geometry change inertia");
  } else if (fixture.geometryChanges.length !== 0) {
    throw new RangeError("This scenario cannot contain geometry changes.");
  }
  return fixture;
}

// Continuous closed-form reference; this does not execute or validate a physics engine.
export function analyticOracle(body, dt, steps, gravity) {
  assertKeys(body, ["id", "shape", "mass", "halfExtents", "position", "rotation", "velocity", "angularVelocity", "inertia"], "Body");
  if (body.shape !== "cuboid") throw new RangeError("Oracle supports cuboids only.");
  assertFinite(body.mass, "mass");
  if (body.mass <= 0) throw new RangeError("mass must be positive.");
  const halfExtents = assertVector(body.halfExtents, 3, "halfExtents", true);
  const position = assertVector(body.position, 3, "position");
  const velocity = assertVector(body.velocity, 3, "velocity");
  assertFinite(dt, "dt");
  if (dt <= 0) throw new RangeError("dt must be positive.");
  if (!Number.isSafeInteger(steps) || steps < 0) throw new RangeError("steps must be a nonnegative safe integer.");
  assertVector(gravity, 3, "gravity");
  const elapsed = dt * steps;
  assertFinite(elapsed, "elapsed time");
  const finalPosition = position.map((value, axis) => value + velocity[axis] * elapsed + 0.5 * gravity[axis] * elapsed * elapsed);
  const finalVelocity = velocity.map((value, axis) => value + gravity[axis] * elapsed);
  const inertia = inertiaFor(body.mass, halfExtents);
  finalPosition.forEach((value, axis) => assertFinite(value, `final position[${axis}]`));
  finalVelocity.forEach((value, axis) => assertFinite(value, `final velocity[${axis}]`));
  inertia.forEach((value, axis) => assertFinite(value, `inertia[${axis}]`));
  return Object.freeze({
    position: freezeVector(finalPosition),
    velocity: freezeVector(finalVelocity),
    inertia: freezeVector(inertia)
  });
}

export function canonicalBytes(fixture) {
  validateFixture(fixture);
  const records = [];
  const append = (tag, tick, value) => records.push(encodeNumbers({ u32: tag, tick, f64: value }));
  const appendVector = (tag, tick, values) => values.forEach((value, axis) => append(tag + axis, tick, value));

  append(1, 0, SCENARIOS[fixture.scenario]);
  append(2, 0, fixture.count);
  append(3, 0, fixture.dt);
  append(4, 0, fixture.steps);
  appendVector(10, 0, fixture.gravity);
  for (const body of fixture.bodies) {
    append(20, body.id, body.id);
    append(21, body.id, body.mass);
    append(22, body.id, 1);
    appendVector(30, body.id, body.halfExtents);
    appendVector(40, body.id, body.position);
    appendVector(50, body.id, body.rotation);
    appendVector(60, body.id, body.velocity);
    appendVector(70, body.id, body.angularVelocity);
    appendVector(80, body.id, body.inertia);
  }
  for (const change of fixture.geometryChanges) {
    append(100, change.bodyIndex, change.tick);
    append(101, change.tick, change.bodyIndex);
    append(102, change.bodyIndex, change.mass);
    appendVector(110, change.bodyIndex, change.halfExtents);
    appendVector(120, change.bodyIndex, change.inertia);
  }
  const bytes = new Uint8Array(records.length * 24);
  records.forEach((record, index) => bytes.set(record, index * 24));
  return bytes;
}
