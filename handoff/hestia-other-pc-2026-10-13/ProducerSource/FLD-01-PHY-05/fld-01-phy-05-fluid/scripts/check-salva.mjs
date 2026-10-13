import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { root, verifyMembers, fileBinding } from './bindings.mjs';

const candidate = JSON.parse(readFileSync(resolve(root, 'SalvaCandidate.json')));
verifyMembers(candidate.sourceMembers);
const manifest = readFileSync(resolve(root, 'inputs/salva/build/salva3d/Cargo.toml'), 'utf8');
const coupling = readFileSync(resolve(root, 'inputs/salva/src/integrations/rapier/fluids_pipeline.rs'), 'utf8');
const lib = readFileSync(resolve(root, 'inputs/salva/src/lib.rs'), 'utf8');
assert.match(manifest, /version = "0\.10\.0"/);
assert.match(manifest, /rapier3d = \{ version = "0\.35\.1", optional = true \}/);
assert.match(manifest, /license = "Apache-2\.0"/);
assert.match(manifest, /path = "\.\.\/\.\.\/src\/lib\.rs"/);
assert.doesNotMatch(manifest, /^\s*crate-type\s*=/m);
assert.match(coupling, /bodies: &mut RigidBodySet/); assert.match(coupling, /colliders: &ColliderSet/);
assert.match(lib, /pub use crate::liquid_world::LiquidWorld/);
assert.notEqual(candidate.declaredRustRapier, candidate.hestiaRequiredRustRapier);
console.log(JSON.stringify({ status: 'PASS', check: 'PINNED_SOURCE_COMPATIBILITY_ASSESSMENT_ONLY', candidate: fileBinding('SalvaCandidate.json'),
  declaredRustRapier: '0.35.1', requiredRustRapier: '0.36.0', recommendation: candidate.status, rustBuild: 'NOT_RUN', wasmExports: 'NOT_RUN', runtimeCoupling: 'NOT_RUN' }));
