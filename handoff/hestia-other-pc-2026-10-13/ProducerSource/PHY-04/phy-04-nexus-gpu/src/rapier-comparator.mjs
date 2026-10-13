import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { makeFixture, validateFixture, analyticOracle, canonicalBytes } from './fixtures.mjs';

const packageUrl = new URL('../snapshot/phy01/upstream/candidate-package/migration2/dist/rapier.js', import.meta.url);
const profile = JSON.parse(readFileSync(new URL('../snapshot/phy01/upstream/candidate-package/migration2/profile.json', import.meta.url)));
const hash = data => createHash('sha256').update(data).digest('hex');
const jsBytes = readFileSync(packageUrl);
const encoded = jsBytes.toString().match(/var wasmBase64 = "([A-Za-z0-9+/=]+)";/);
assert.ok(encoded, 'ACTUAL_EMBEDDED_WASM_REQUIRED');
assert.equal(hash(Buffer.from(encoded[1], 'base64')), 'ed3c8933d523eafb7d4d7a9a8efa04dd0da9d2279d4ae8cefb794c276ee98ea9');
assert.equal(profile.id, 'rapier-0.21.0-phy01.migration2');
assert.equal(profile.vanillaNpmBytes, false);
const R = await import(packageUrl.href);
await R.init();
const vector = ([x,y,z]) => ({ x,y,z });
const array = v => [v.x,v.y,v.z];

export function runComparator(fixture) {
  validateFixture(fixture);
  const world = new R.World(vector(fixture.gravity));
  const bodies = [], colliders = [];
  try {
    world.timestep = fixture.dt;
    for (const source of fixture.bodies) {
      const rb = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...source.position)
        .setLinvel(...source.velocity).setCanSleep(false).setLinearDamping(0).setAngularDamping(0));
      rb.enableGyroscopicForces(false);
      const co = world.createCollider(R.ColliderDesc.cuboid(...source.halfExtents).setMass(source.mass), rb);
      bodies.push(rb); colliders.push(co);
      assert.equal(rb.mass(), source.mass);
      array(rb.principalInertia()).forEach((v,i) => assert.ok(Math.abs(v-source.inertia[i]) < 1e-6, 'MASS_TENSOR'));
    }
    world.updateSceneQueries();
    const query = world.castRay(new R.Ray(vector([0,20,0]), vector([0,-1,0])), 30, true);
    assert.ok(query && Math.abs(query.timeOfImpact - 9.5) < 1e-5, 'FRESH_WORLD_QUERY');
    let geometryChanged = false;
    for (let tick = 0; tick < fixture.steps; tick++) {
      for (const change of fixture.geometryChanges.filter(x => x.tick === tick)) {
        const rb = bodies[change.bodyIndex], co = colliders[change.bodyIndex];
        const before = array(rb.translation());
        co.setShape(new R.Cuboid(...change.halfExtents)); co.setMass(change.mass);
        rb.recomputeMassPropertiesFromColliders();
        assert.deepEqual(array(rb.translation()), before, 'NO_POSE_SNAP');
        assert.equal(rb.mass(), change.mass);
        array(rb.principalInertia()).forEach((v,i) => assert.ok(Math.abs(v-change.inertia[i]) < 1e-6, 'EDIT_INERTIA'));
        geometryChanged = true;
      }
      world.step();
    }
    let maxPositionError = 0, maxVelocityError = 0;
    for (let index = 0; index < bodies.length; index++) {
      const actual = bodies[index];
      const oracle = analyticOracle(fixture.bodies[index], fixture.dt, fixture.steps, fixture.gravity);
      array(actual.translation()).forEach((v,i) => maxPositionError = Math.max(maxPositionError, Math.abs(v-oracle.position[i])));
      array(actual.linvel()).forEach((v,i) => maxVelocityError = Math.max(maxVelocityError, Math.abs(v-oracle.velocity[i])));
    }
    // First-order integration envelope fixed before observing outputs; f32 absolute position error allowed separately.
    const positionTolerance = Math.abs(fixture.gravity[1]) * fixture.dt ** 2 * fixture.steps / 2 + 0.003;
    assert.ok(maxPositionError <= positionTolerance, 'ANALYTIC_POSITION_BOUND:' + maxPositionError);
    assert.ok(maxVelocityError <= 0.0002, 'ANALYTIC_VELOCITY_BOUND:' + maxVelocityError);
    return { status: 'PASS', purpose: 'FUNCTIONAL_CPU_DIAGNOSTIC_NOT_BENCHMARK',
      profile: profile.id + ':legacy-impulse-v1', dynamicGyroscopicForces: false,
      wasmSha256: profile.wasmSha256, count: fixture.count, scenario: fixture.scenario,
      steps: fixture.steps, fixtureSha256: hash(canonicalBytes(fixture)),
      maxPositionError, positionTolerance, maxVelocityError, velocityTolerance: 0.0002,
      freshWorldRay: 'PASS', canonicalMassInertia: 'PASS', geometryChanged, teardown: 'WORLD_FREE_IN_FINALLY' };
  } finally { world.free(); }
}
export function comparatorMatrix() {
  return [...[10,100,1000].flatMap(count => ['freefall','zeroGravity'].map(scenario => runComparator(makeFixture(count,scenario)))),
    runComparator(makeFixture(10,'dynamicGeometry'))];
}
