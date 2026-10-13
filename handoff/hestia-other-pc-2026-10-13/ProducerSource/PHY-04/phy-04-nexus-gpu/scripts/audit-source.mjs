import assert from 'node:assert/strict';
import { readFileSync, readdirSync, lstatSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root, sha256 } from './commands.mjs';
import { verifyInputs } from './verify-inputs.mjs';
export function auditSource() {
  verifyInputs();
  const prefix='upstream/source/nexus-7c94a9664ddd6468de892c2bad6f56db8f992ed7/';
  const read=path=>readFileSync(resolve(root,prefix+path),'utf8');
  function witness(path,pattern) {
    const text=read(path); const index=text.search(pattern);
    assert.ok(index>=0,'MISSING_SOURCE_WITNESS:'+path);
    return {path:prefix+path,line:text.slice(0,index).split('\n').length,sha256:sha256(Buffer.from(text))};
  }
  function sources(dir) {
    return readdirSync(resolve(root,prefix+dir)).flatMap(name=>{
      const path=dir+'/'+name; return lstatSync(resolve(root,prefix+path)).isDirectory()?sources(path):
        path.endsWith('.rs')?[{path,text:read(path)}]:[];
    });
  }
  const files=[...sources('src'),...sources('src_rbd'),...sources('src_rbd_shaders')];
  const feature=(name,status,evidence,reason)=>({name,status,evidenceType:'PINNED_STATIC_SOURCE',
    runtime:'NOT_RUN',evidence,reason});
  const shape=read('src_rbd/shapes/shape.rs');
  assert.match(shape,/TypedShape::HeightField\(_shape\) => \{\s*todo!\(\)/);
  assert.match(shape,/_ => None/);
  assert.ok(!shape.includes('TypedShape::Voxels')&&!shape.includes('TypedShape::Compound'));
  const ccd=files.filter(x=>/\bccd\b|continuous.collision/i.test(x.text));
  assert.equal(ccd.length,0,'CCD_ABSENCE_CHANGED_REQUIRES_REVIEW');
  const worldQuery=files.filter(x=>/pub (?:async )?fn (?:cast_ray|cast_shape|create_character_controller)\b/.test(x.text));
  assert.equal(worldQuery.length,0,'WORLD_QUERY_API_CHANGED_REQUIRES_REVIEW');
  return {status:'PASS',meaning:'SOURCE_WITNESSES_ONLY_NOT_BACKEND_FUNCTIONAL_PASS',
    repository:'https://github.com/dimforge/nexus',commit:'7c94a9664ddd6468de892c2bad6f56db8f992ed7',
    scannedRustFiles:files.length,features:[
      feature('cuboid/ball/capsule/trimesh/convex','API_FOUND',
        [witness('src_rbd/shapes/shape.rs',/TypedShape::Cuboid/)],'Converter exists; runtime support still needs real shaders. Trimesh pseudo-normals required.'),
      feature('heightfield','UNSUPPORTED',
        [witness('src_rbd/shapes/shape.rs',/TypedShape::HeightField/)],'Both dimension branches call todo!().'),
      feature('compound/native voxels','UNSUPPORTED',
        [witness('src_rbd/shapes/shape.rs',/_ => None/)],'No TypedShape converter arms; unsupported shapes return None. Multiple colliders on a body are a different representation.'),
      feature('world ray/shape casts and character controller','UNSUPPORTED',[],'No such public world API in the scanned host/high-level/shader closure; per-shape ray kernels are not a world query service.'),
      feature('continuous collision detection','UNSUPPORTED',[],'No CCD implementation/name in pinned rigid-body host and shader closure. This absence scan is not an execution test.'),
      feature('contacts','API_FOUND',[witness('src_rbd/pipeline/rbd_state.rs',/pub async fn debug_contacts/)],'Real contact buffers/readback exist, not executed here.'),
      feature('canonical mass/COM/inertia','API_FOUND',[witness('src_rbd/pipeline/rbd_state_from_rapier.rs',/all_local_mprops/)],'Imports Rapier CPU descriptors and mass properties; Hestia canonical parity not established.'),
      feature('kinematics','LIMITED_API_FOUND',[witness('src_rbd/dynamics/multibody/multibody_set.rs',/pub fn set_link_kinematic_state/)],'Multibody-link kinematics exist; this is not HVP character/kinematic body parity.'),
      feature('insertion/removal and geometry','API_FOUND',[witness('src_rbd/pipeline/insertion_removal.rs',/pub fn append_bodies/)],'Explicit append/remove/rebuild paths; dynamic-geometry GPU case remains unrun.'),
      feature('same-machine deterministic mode','API_FOUND',[witness('src_rbd/pipeline/rbd_state.rs',/pub fn set_deterministic/)],'Ordering mode exists; no same-machine or cross-device equality established.'),
      feature('MPM directional coupling','ONE_WAY_SOURCE',
        [witness('README.md',/one-way coupling/),witness('src_mpm/solver/rigid_particle_update.rs',/&bodies\.poses/),
          witness('src_mpm_shaders/lib.rs',/pub const TWO_WAYS_COUPLING_ENABLED: bool = false/),
          witness('src_mpm_shaders/solver/p2g.rs',/if TWO_WAYS_COUPLING_ENABLED && collider_id != NONE/)],
        'TWO_WAYS_COUPLING_ENABLED=false disables the existing guarded return-impulse branches. Rigid->particle transformation exists. No bidirectional force proof.'),
      feature('device lifecycle','REQUIRES_RUNTIME_PROOF',[witness('src_rbd/pipeline/rbd_step.rs',/pub fn new/)],
        'Construction/step return backend errors. Genuine device loss, clean restart and browser cleanup remain NOT_RUN.')
    ],recommendation:'NO_ADOPTION_FOR_HVP',productIntegration:'NO',
    recommendationBasis:'Heightfield/voxel/compound converter gaps, absent CCD/world-query/character APIs; mandatory Rapier .21 migration unaffected.'};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/audit-source.mjs')){
  const r=auditSource();writeFileSync(resolve(root,'tests/source-audit.json'),JSON.stringify(r,null,2)+'\n');
  console.log(JSON.stringify({status:r.status,scannedRustFiles:r.scannedRustFiles,recommendation:r.recommendation}));
}
