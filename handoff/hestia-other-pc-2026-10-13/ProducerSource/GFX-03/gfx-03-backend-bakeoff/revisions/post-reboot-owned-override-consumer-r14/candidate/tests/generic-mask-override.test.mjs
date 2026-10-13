import test from 'node:test';
import assert from 'node:assert/strict';
import {Object3D} from 'three';
import {MeshBasicNodeMaterial,MeshStandardNodeMaterial,NodeMaterial} from 'three/webgpu';
import {float,uniform,vec3} from 'three/tsl';
import {withOwnedOverrideBinding,requireDefaultOverrideCache,overrideRestoreKeys,replaceOwnedObjectCallback,requireSynchronousCallback} from '../dist/src/generic-mask-override.js';

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
test('genuine Object3D inherited callbacks regain exact own-property shape',()=>{
  const object=new Object3D(),before=object.onBeforeRender,after=object.onAfterRender;
  const a=replaceOwnedObjectCallback(object,'onBeforeRender',()=>{}),b=replaceOwnedObjectCallback(object,'onAfterRender',()=>{});
  assert.equal(Object.hasOwn(object,'onBeforeRender'),true);assert.equal(a(),true);assert.equal(b(),true);
  assert.equal(object.onBeforeRender,before);assert.equal(object.onAfterRender,after);
  assert.equal(Object.hasOwn(object,'onBeforeRender'),false);assert.equal(Object.hasOwn(object,'onAfterRender'),false);
});
test('own descriptor restores exactly while a later callback owner is preserved',()=>{
  const object=new Object3D(),original=()=>{},later=()=>{};
  Object.defineProperty(object,'onBeforeRender',{value:original,writable:true,configurable:true,enumerable:false});const descriptor=Object.getOwnPropertyDescriptor(object,'onBeforeRender');
  const release=replaceOwnedObjectCallback(object,'onBeforeRender',()=>{});assert.equal(release(),true);assert.deepEqual(Object.getOwnPropertyDescriptor(object,'onBeforeRender'),descriptor);
  const releaseLater=replaceOwnedObjectCallback(object,'onBeforeRender',()=>{});object.onBeforeRender=later;assert.equal(releaseLater(),false);assert.equal(object.onBeforeRender,later);
});
test('actual async functions are rejected before their body and material binding',()=>{
  const a=source(),b=new MeshBasicNodeMaterial(),v=b.version;let calls=0;const callback=async()=>{calls++;};
  assert.throws(()=>requireSynchronousCallback(callback),/synchronous/);assert.throws(()=>withOwnedOverrideBinding(a,b,callback),/synchronous/);assert.equal(calls,0);assert.equal(b.version,v);a.dispose();b.dispose();
});
test('restore attempts later public fields and retains primary error when one field cannot restore',()=>{
  const a=source(),b=new MeshBasicNodeMaterial(),primary=new Error('primary draw error'),priorMask=b.maskNode;
  assert.throws(()=>withOwnedOverrideBinding(a,b,()=>{Object.defineProperty(b,'alphaMap',{value:null,writable:false,configurable:false});b.side=2;Reflect.set(b,'displacementScale',99);throw primary;}),error=>{
    assert.equal(error instanceof AggregateError,true);assert.equal(error.cause,primary);assert.equal(error.errors[0],primary);assert.match(error.errors[1].message,/restore failed/);return true;
  });
  assert.equal(b.maskNode,priorMask);assert.equal(b.side,0);assert.equal(Object.hasOwn(b,'displacementScale'),false);a.dispose();b.dispose();
});
