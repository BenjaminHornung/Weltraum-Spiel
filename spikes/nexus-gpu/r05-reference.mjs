// Run with Node 24 after installing the app dependencies: node spikes/nexus-gpu/r05-reference.mjs /path/to/nexus
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire, registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const app = new URL("../../apps/weltraum-browser/", import.meta.url);
const handoff = new URL("../../handoff/hestia-other-pc-2026-10-13/ProducerSource/", import.meta.url);
const fixtureModule = new URL("PHY-04/phy-04-nexus-gpu/src/fixtures.mjs", handoff);
const numerics = new URL("PLT-01-02/plt-01-02-numerics/src/numerics.mjs", handoff);
const vendorPath = "/vendor/rapier-phy01-positive-margin-r05/src/";
const vendor = new URL(vendorPath.slice(1), app);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const wasmSha256 = "f26e8ca898782fc1d903971bfa5c71a4b92bd7ed4c32df05e677faee9e18d0bb";
const glueSha256 = "3352d74638111c659bf50566af2be3f151040b1cd6a22310542ce3c5c46d2fea";
const fixtureSourceSha256 = "790922b86ac4b0f948f5e7e1aa672b18db3ec9e91c7f49bdf6b32cc9dd3e2b9f";
const numericsSha256 = "bbb02b325d728c836ef780be9a60e4d210c8bbe4b62a8ade7a477e7a24ead48a";
const contactSource = "src_rbd/pipeline/test_batched_stacks.rs";
const contactSourceSha256 = "29fe55de5c402365a853d90cd9ab178d44b4687d84c97b68e3a4b2d63e6dd379";
assert.ok(process.argv[2], "Pass the path to the pinned Nexus checkout (7c94a966).");
assert.equal(digest(await readFile(join(process.argv[2], contactSource))), contactSourceSha256);
const wasm = await readFile(new URL("rapier_wasm3d_bg.wasm", vendor));
assert.equal(digest(wasm), wasmSha256);
assert.equal(digest(await readFile(new URL("rapier_wasm3d.js", vendor))), glueSha256);
assert.equal(digest(await readFile(fixtureModule)), fixtureSourceSha256);
assert.equal(digest(await readFile(numerics)), numericsSha256);

// The handoff archives the numerics producer separately from the historical fixture's snapshot path.
const hook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === fixtureModule.href && specifier === "../snapshot/plt/src/numerics.mjs") {
    return { url: numerics.href, shortCircuit: true };
  }
  return next(specifier, context);
} });
const { makeFixture, canonicalBytes, analyticOracle } = await import(fixtureModule.href);
hook.deregister();

const { createServer } = await import(createRequire(new URL("package.json", app)).resolve("vite"));
const server = await createServer({ root: fileURLToPath(app), configFile: false, logLevel: "error",
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true } });
try {
  const R = await server.ssrLoadModule(vendorPath + "rapier.ts");
  const raw = await server.ssrLoadModule(vendorPath + "rapier_wasm3d.js");
  raw.initSync({ module: wasm });

  const vector = ([x, y, z]) => ({ x, y, z });
  const array = ({ x, y, z }) => [x, y, z];
  const maxError = (actual, expected) => Math.max(...actual.map((v, i) => Math.abs(v - expected[i])));

  function reference(count, scenario) {
    const fixture = makeFixture(count, scenario);
    const world = new R.World(vector(fixture.gravity));
    try {
      world.timestep = fixture.dt;
      const entries = fixture.bodies.map(source => {
        const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...source.position)
          .setLinvel(...source.velocity).setCanSleep(false).setLinearDamping(0).setAngularDamping(0));
        body.enableGyroscopicForces(false);
        const collider = world.createCollider(R.ColliderDesc.cuboid(...source.halfExtents).setMass(source.mass), body);
        return { body, collider };
      });
      for (let tick = 0; tick < fixture.steps; tick++) {
        for (const change of fixture.geometryChanges.filter(change => change.tick === tick)) {
          const { body, collider } = entries[change.bodyIndex];
          const before = array(body.translation());
          collider.setShape(new R.Cuboid(...change.halfExtents));
          collider.setMass(change.mass);
          body.recomputeMassPropertiesFromColliders();
          assert.deepEqual(array(body.translation()), before);
          assert.equal(body.mass(), change.mass);
          assert.ok(maxError(array(body.principalInertia()), change.inertia) < 1e-6);
        }
        world.step();
      }
      let maxPositionError = 0;
      let maxVelocityError = 0;
      const rows = entries.map(({ body }, id) => {
        const position = array(body.translation());
        const velocity = array(body.linvel());
        const oracle = analyticOracle(fixture.bodies[id], fixture.dt, fixture.steps, fixture.gravity);
        maxPositionError = Math.max(maxPositionError, maxError(position, oracle.position));
        maxVelocityError = Math.max(maxVelocityError, maxError(velocity, oracle.velocity));
        return { id, position, velocity };
      });
      assert.ok(maxPositionError <= Math.abs(fixture.gravity[1]) * fixture.dt ** 2 * fixture.steps / 2 + 0.003);
      assert.ok(maxVelocityError <= 0.0002);
      return { count, scenario, steps: fixture.steps, dt: fixture.dt, fixtureSha256: digest(canonicalBytes(fixture)),
        maxPositionError, maxVelocityError, rows };
    } finally { world.free(); }
  }

  // Mirrors build_env(1, 4) and run_case(1, 1, 4, 64) in the bound Nexus contact test.
  function tinyStack() {
    const world = new R.World({ x: 0, y: -9.81, z: 0 });
    try {
      world.timestep = 1 / 60;
      const ground = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
      const floor = world.createCollider(R.ColliderDesc.cuboid(50, 0.5, 50), ground);
      const boxes = Array.from({ length: 4 }, (_, id) => {
        const initialY = Math.fround(0.25 + Math.fround(id * Math.fround(0.45)));
        const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, initialY, 0));
        const collider = world.createCollider(R.ColliderDesc.cuboid(0.2, 0.2, 0.2), body);
        return { body, collider, initialY };
      });
      const contacts = boxes.map(() => ({ firstContactTick: null, peakPointNormalImpulse: 0, finalContactPoints: 0 }));
      for (let tick = 1; tick <= 250; tick++) {
        world.step();
        boxes.forEach(({ collider }, i) => {
          const pair = contacts[i];
          pair.finalContactPoints = 0;
          world.contactPair(i ? boxes[i - 1].collider : floor, collider, manifold => {
            pair.finalContactPoints += manifold.numContacts();
            for (let j = 0; j < manifold.numContacts(); j++) {
              pair.peakPointNormalImpulse = Math.max(pair.peakPointNormalImpulse, manifold.contactImpulse(j));
            }
          });
          if (pair.finalContactPoints > 0) pair.firstContactTick ??= tick;
        });
      }
      const rows = boxes.map(({ initialY, body }, id) => {
        const position = array(body.translation());
        const velocity = array(body.linvel());
        assert.ok(Math.abs(position[1] - (0.2 + id * 0.4)) < 0.1, "Nexus tiny stack rest-height bound");
        assert.ok(Math.max(...velocity.map(Math.abs)) < 0.01);
        const pair = contacts[id];
        assert.ok(pair.firstContactTick > 1 && pair.firstContactTick < 250);
        assert.ok(pair.finalContactPoints > 0 && pair.peakPointNormalImpulse > 0);
        return { id: id + 1, initialY, position, velocity, contactWithBody: id, ...pair };
      });
      return { upstream: "7c94a9664ddd6468de892c2bad6f56db8f992ed7", case: "test_stacks_1_tiny",
        contactSource, contactSourceSha256, steps: 250, dt: world.timestep, rows };
    } finally { world.free(); }
  }

  const matrix = [10, 100, 1000].flatMap(count => ["zeroGravity", "freefall"].map(scenario => reference(count, scenario)));
  matrix.push(reference(10, "dynamicGeometry"));
  process.stdout.write(JSON.stringify({ backend: "Rapier R05 CPU/WASM", wasmSha256, glueSha256,
    fixtureSourceSha256, numericsSha256, matrix, tinyStack: tinyStack() }) + "\n");
} finally {
  await server.close();
}
