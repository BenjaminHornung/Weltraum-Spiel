import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {loadInputs} from '../inputs.mjs';
import {createSparseVolume,prepareDirty,ProjectionSet} from '../src/sparse.mts';
import {DdaBackend,createDepthCameraPort,validatePresentation} from '../src/port.mts';
import {bindSource} from '../imported/rt01/fixtures.mjs';
const {volumes,rays}=await loadInputs();
test('frozen GFX borrowed depth/camera/light/material port and real hit identity',async()=>{
 const v=volumes.get('grid-0.125'),s=await createSparseVolume(v,v.binding),backend=new DdaBackend(s);
 const camera=new T.PerspectiveCamera(60,1,.1,100);camera.position.set(1,2,3);camera.updateMatrixWorld();const depth=new T.DepthTexture(16,16);
 const port=createDepthCameraPort(camera,depth,4,v.binding),copied=port.projection.slice();camera.projectionMatrix.elements.fill(0);
 assert.deepEqual(port.projection,copied);assert.equal(validatePresentation(port,v.binding,4),port);
 assert.ok(port.depth===depth);assert.ok(port.materialProfiles.includes('HVP-strata'));assert.match(port.depthInterpretation,/WebGPU \[0,1\].*WebGL \[-1,1\]/);
 assert.throws(()=>validatePresentation(port,v.binding,5),/epoch/);
 assert.throws(()=>validatePresentation(port,{...v.binding,epoch:'reset'},4),/Stale/);
 const hit=rays.find(r=>r.volumeId===v.id&&r.expected.kind==='Hit');
 const p=backend.query(hit.ray,v.binding,'two-level',123,{port,currentEpoch:4});
 assert.equal(p.surface.cellId,hit.expected.cellId);assert.equal(p.surface.materialSource,hit.expected.materialSource);assert.equal(p.classification,'OCCUPIED');
 assert.equal(p.simulationTick,123);assert.equal(p.gpuMilliseconds,null);assert.equal(p.telemetry.t_lighting_current_visible,null);
 assert.throws(()=>backend.query(hit.ray,v.binding,'flat',-1));backend.dispose();assert.throws(()=>backend.query(hit.ray,v.binding,'flat'),/Disposed/);depth.dispose();
});
test('dirty generation exchange verifies real page changes, preserves old until adoption and rejects late results',async()=>{
 const v=volumes.get('grid-0.125'),after=volumes.get('after-cut'),s=await createSparseVolume(v,v.binding);
 const staged=await prepareDirty(s,after,v.binding,after.binding,[0]);
 assert.deepEqual(staged.dirtyPages,[0]);assert.equal(staged.candidate.slot([5,1,1]),0);assert.equal(s.slot([5,1,1]),2);
 assert.equal(staged.peak.currentGenerationBytes,1680);assert.equal(staged.peak.nextGenerationBytes,1168);assert.equal(staged.peak.peakBytes,2848,'Retained old plus shrinking next atlas');
 await assert.rejects(prepareDirty(s,after,v.binding,after.binding,[]),/Dirty pages/);
 await assert.rejects(prepareDirty(s,after,{...v.binding,epoch:'stale'},after.binding,[0]),/Stale/);
 await assert.rejects(prepareDirty(s,after,v.binding,after.binding,[0],AbortSignal.abort()),/Cancelled/);
 const forged=structuredClone(after);forged.binding.sourceGeneration=0;await assert.rejects(prepareDirty(s,forged,v.binding,forged.binding,[0]),/newer/);
 const set=new ProjectionSet();set.replace([s],[v.binding],0);set.reset();
 assert.throws(()=>set.replace([staged.candidate],[after.binding],0),/Stale/);
 staged.candidate.dispose();
});
test('material/profile/source byte changes cannot hide behind old binding',async()=>{
 const v=structuredClone(volumes.get('grid-0.125'));v.materials[0].source='forged';await assert.rejects(createSparseVolume(v,v.binding),/digest/);
 const x=structuredClone(volumes.get('grid-0.125'));x.cellIds[1]=x.cellIds[0];bindSource(x);await assert.rejects(createSparseVolume(x,x.binding),/identity|identities/);
});
