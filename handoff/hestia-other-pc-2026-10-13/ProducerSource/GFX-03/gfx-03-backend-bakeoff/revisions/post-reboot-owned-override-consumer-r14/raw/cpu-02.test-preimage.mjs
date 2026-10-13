import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshBasicNodeMaterial,MeshStandardNodeMaterial,NodeMaterial} from 'three/webgpu';
import {float,uniform,vec3} from 'three/tsl';
import {withOwnedOverrideBinding,requireDefaultOverrideCache,overrideRestoreKeys} from '../dist/src/generic-mask-override.js';

const source=()=>{const m=new MeshStandardNodeMaterial();const mask=float(.5);m.maskNode=mask.greaterThanEqual(.5);m.opacityNode=mask;m.alphaTest=0;m.positionNode=vec3(uniform(1),0,0);return m;};
const values=m=>overrideRestoreKeys.map(k=>[k,Reflect.get(m,k),Object.getOwnPropertyDescriptor(m,k)]);

test('genuine owned override forwards graph identities and restores all public fields',()=>{
  const a=source(),b=new MeshBasicNodeMaterial();const before=values(b),v=b.version;
  withOwnedOverrideBinding(a,b,()=>{assert.equal(b.maskNode,a.maskNode);assert.equal(b.opacityNode,a.opacityNode);assert.equal(b.alphaTestNode,a.alphaTestNode);assert.equal(b.version,v+1);
    b.alphaTest=.75;b.transparent=true;b.positionNode=a.positionNode;b.colorNode=float(1);b.depthNode=float(1);b.side=2;
    Reflect.set(b,'displacementScale',7);Reflect.set(b,'displacementBias',9);Reflect.set(b,'displacementMap',null);});
  // Two explicit invalidations plus genuine alphaTest zero->positive->zero
  // setter invalidations. No renderer or shader cache was evaluated.
  assert.deepEqual(values(b),before);assert.equal(b.version,v+4);a.dispose();b.dispose();
});
test('original exception and field presence survive failure after renderer-style writes',()=>{
  const a=source(),b=new MeshBasicNodeMaterial();const before=values(b),failure=new Error('draw failed');
  assert.throws(()=>withOwnedOverrideBinding(a,b,()=>{b.alphaTest=.1;Reflect.set(b,'displacementScale',19);throw failure;}),e=>e===failure);
  assert.deepEqual(values(b),before);a.dispose();b.dispose();
});
test('cache hashes distinguish successive real mask graphs on one override',()=>{
  const a=source(),c=source(),b=new MeshBasicNodeMaterial();const baseline=b.customProgramCacheKey();let first,second;
  withOwnedOverrideBinding(a,b,()=>{first=b.customProgramCacheKey();});
  withOwnedOverrideBinding(c,b,()=>{second=b.customProgramCacheKey();});
  assert.notEqual(first,second);assert.equal(b.customProgramCacheKey(),baseline);a.dispose();c.dispose();b.dispose();
});
test('constant custom cache key is rejected without changing genuine material',()=>{
  const b=new MeshBasicNodeMaterial();assert.equal(b.customProgramCacheKey,NodeMaterial.prototype.customProgramCacheKey);requireDefaultOverrideCache(b);
  b.customProgramCacheKey=()=> 'constant';assert.throws(()=>requireDefaultOverrideCache(b),/default NodeMaterial cache/);b.dispose();
});
test('allowOverride false retains the actual override and performs no cache invalidation',()=>{
  const a=source(),b=new MeshBasicNodeMaterial();a.allowOverride=false;const before=values(b),v=b.version;
  let calls=0;withOwnedOverrideBinding(a,b,()=>{calls++;assert.notEqual(b.maskNode,a.maskNode);});
  assert.equal(calls,1);assert.deepEqual(values(b),before);assert.equal(b.version,v);a.dispose();b.dispose();
});
test('non-leaf source clears the previous mask during its own transaction',()=>{
  const a=source(),c=new MeshStandardNodeMaterial(),b=new MeshBasicNodeMaterial();b.maskNode=float(1).greaterThanEqual(.5);const prior=b.maskNode;
  withOwnedOverrideBinding(a,b,()=>assert.equal(b.maskNode,a.maskNode));
  withOwnedOverrideBinding(c,b,()=>{assert.equal(b.maskNode,null);assert.equal(b.opacityNode,null);});
  assert.equal(b.maskNode,prior);a.dispose();c.dispose();b.dispose();
});
test('a Promise result is rejected before a synchronous transaction can leak borrowed state',()=>{
  const a=source(),b=new MeshBasicNodeMaterial();const before=values(b);
  assert.throws(()=>withOwnedOverrideBinding(a,b,()=>Promise.resolve()),/synchronous/);assert.deepEqual(values(b),before);a.dispose();b.dispose();
});
