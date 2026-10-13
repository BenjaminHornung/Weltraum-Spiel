import assert from "node:assert/strict";
import test from "node:test";
import { analyticOracle, canonicalBytes, makeFixture, validateFixture } from "../src/fixtures.mjs";

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);
const closeVector = (actual, expected) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => close(value, expected[index]));
};

test("canonical fixtures are deterministic, property-order independent, and immutable", () => {
  const fixture = makeFixture(10);
  const reordered = {
    ...Object.fromEntries(Object.entries(fixture).reverse()),
    bodies: fixture.bodies.map((body) => Object.fromEntries(Object.entries(body).reverse())),
    geometryChanges: fixture.geometryChanges.map((change) => Object.fromEntries(Object.entries(change).reverse()))
  };

  assert.deepEqual(canonicalBytes(fixture), canonicalBytes(makeFixture(10)));
  assert.deepEqual(canonicalBytes(fixture), canonicalBytes(reordered));
  assert.equal(Object.isFrozen(fixture), true);
  assert.equal(Object.isFrozen(fixture.bodies), true);
  assert.equal(Object.isFrozen(fixture.bodies[0]), true);
  assert.equal(Object.isFrozen(fixture.bodies[0].position), true);
  assert.throws(() => fixture.bodies.push(fixture.bodies[0]));
});

test("10, 100, and 1000 bodies share the same ordered start conditions", () => {
  const baseline = makeFixture(10).bodies;
  for (const count of [10, 100, 1000]) {
    const fixture = makeFixture(count);
    assert.equal(fixture.bodies.length, count);
    assert.deepEqual(fixture.bodies.slice(0, 10), baseline);
    for (const [index, body] of fixture.bodies.entries()) {
      assert.equal(body.id, index);
      assert.equal(body.shape, "cuboid");
      assert.equal(body.mass, 2);
      assert.deepEqual(body.halfExtents, [0.25, 0.5, 0.75]);
      assert.deepEqual(body.rotation, [0, 0, 0, 1]);
      assert.deepEqual(body.angularVelocity, [0, 0, 0]);
      assert.ok(Math.hypot(...body.velocity) <= 1);
      assert.equal(body.position[1], 10);
    }
  }
});

test("freefall and zero-gravity results match the continuous analytic oracle", () => {
  const freefall = makeFixture(10);
  assert.equal(freefall.dt, 1 / 60);
  assert.equal(freefall.steps, 30);
  assert.deepEqual(freefall.gravity, [0, -9.81, 0]);
  const body = freefall.bodies[0];
  const result = analyticOracle(body, freefall.dt, freefall.steps, freefall.gravity);
  const elapsed = 0.5;
  close(result.position[0], body.position[0] + body.velocity[0] * elapsed);
  close(result.position[1], 10 + 0.5 * -9.81 * elapsed ** 2);
  close(result.velocity[0], body.velocity[0]);
  close(result.velocity[1], -9.81 * elapsed);

  const zeroGravity = makeFixture(10, "zeroGravity");
  const zeroBody = zeroGravity.bodies[0];
  const zeroResult = analyticOracle(zeroBody, zeroGravity.dt, zeroGravity.steps, zeroGravity.gravity);
  close(zeroResult.position[0], zeroBody.position[0] + zeroBody.velocity[0] * elapsed);
  assert.deepEqual(zeroResult.position.slice(1), [10, 0]);
  assert.deepEqual(zeroResult.velocity, zeroBody.velocity);
});

test("geometry change is an independent tick-10 event with fixed mass and updated inertia", () => {
  const freefall = makeFixture(10);
  const geometry = makeFixture(10, "dynamicGeometry");
  assert.deepEqual(geometry.bodies, freefall.bodies);
  assert.equal(freefall.geometryChanges.length, 0);
  assert.equal(geometry.geometryChanges.length, 1);
  assert.equal(geometry.geometryChanges[0].tick, 10);
  assert.equal(geometry.geometryChanges[0].bodyIndex, 0);
  assert.equal(geometry.geometryChanges[0].mass, 2);
  assert.deepEqual(geometry.geometryChanges[0].halfExtents, [0.125, 0.5, 0.75]);
  closeVector(geometry.geometryChanges[0].inertia, [13 / 24, 37 / 96, 17 / 96]);
  assert.deepEqual(geometry.bodies[0].halfExtents, [0.25, 0.5, 0.75]);
  closeVector(geometry.bodies[0].inertia, [13 / 24, 5 / 12, 5 / 24]);
  closeVector(analyticOracle({ ...geometry.bodies[0], halfExtents: geometry.geometryChanges[0].halfExtents }, 1 / 60, 30, [0, -9.81, 0]).inertia,
    geometry.geometryChanges[0].inertia);
});

test("validation rejects invalid counts, shapes, times, masses, and non-finite values", () => {
  for (const count of [0, 9, 11, 10.5, NaN, Infinity, "10"]) {
    assert.throws(() => makeFixture(count));
  }
  assert.throws(() => makeFixture(100, "dynamicGeometry"));
  assert.throws(() => makeFixture(10, "unsupported"));

  const fixture = makeFixture(10);
  assert.equal(validateFixture(fixture), fixture);
  assert.throws(() => validateFixture({ ...fixture, count: 100 }));
  assert.throws(() => validateFixture({ ...fixture, dt: NaN }));
  assert.throws(() => validateFixture({ ...fixture, steps: Infinity }));
  assert.throws(() => validateFixture({ ...fixture, gravity: [0, Infinity, 0] }));
  assert.throws(() => validateFixture({ ...fixture, bodies: [{ ...fixture.bodies[0], shape: "sphere" }, ...fixture.bodies.slice(1)] }));
  assert.throws(() => validateFixture({ ...fixture, bodies: [{ ...fixture.bodies[0], mass: 0 }, ...fixture.bodies.slice(1)] }));
  assert.throws(() => validateFixture({ ...fixture, bodies: [{ ...fixture.bodies[0], mass: NaN }, ...fixture.bodies.slice(1)] }));
  assert.throws(() => validateFixture({ ...fixture, bodies: [{ ...fixture.bodies[0], mass: Infinity }, ...fixture.bodies.slice(1)] }));
  assert.throws(() => validateFixture({ ...fixture, bodies: [{ ...fixture.bodies[0], mass: 2.1 }, ...fixture.bodies.slice(1)] }));
  assert.throws(() => validateFixture({ ...fixture, bodies: [{ ...fixture.bodies[0], halfExtents: [0.25, NaN, 0.75] }, ...fixture.bodies.slice(1)] }));
  assert.throws(() => validateFixture({ ...fixture, bodies: [{ ...fixture.bodies[0], position: [0, 10, Infinity] }, ...fixture.bodies.slice(1)] }));
  assert.throws(() => validateFixture({ ...fixture, geometryChanges: [{ tick: 10, bodyIndex: 0, mass: 2, halfExtents: [0.125, 0.5, 0.75], inertia: [NaN, 1, 1] }] }));

  const body = fixture.bodies[0];
  for (const [invalidBody, dt, steps, gravity] of [
    [body, Infinity, 30, [0, -9.81, 0]],
    [body, 1 / 60, NaN, [0, -9.81, 0]],
    [body, 1 / 60, 30, [0, -Infinity, 0]],
    [{ ...body, mass: -1 }, 1 / 60, 30, [0, -9.81, 0]],
    [{ ...body, shape: "sphere" }, 1 / 60, 30, [0, -9.81, 0]]
  ]) {
    assert.throws(() => analyticOracle(invalidBody, dt, steps, gravity));
  }
});
