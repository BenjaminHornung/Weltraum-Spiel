import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {MeshStandardNodeMaterial} from 'three/webgpu';
import {surfaceMaterial, setWind, materialUniforms, glUniforms} from '../build-input/src/b2-materials.ts';
import {surfaceMaterial as originalMaterial} from '../control/src/materials.ts';
import {windInputs, assertOwner} from '../build-input/src/port.ts';
import {windInputs as originalWind} from '../control/src/port.ts';
import type {MaterialData} from '../build-input/src/port.ts';

// Prepared source only. TS/Node material construction has NOT_RUN; no renderer is created.
const leaf:MaterialData = {id:'leaf', role:'foliage', colorLinearRgb:[0.19,0.48,0.11]};

test('leaf retains opacity, wind/normal/material factors while selecting shared mask', () => {
  const candidate = surfaceMaterial(T, true, leaf, false, true);
  const control = originalMaterial(T, true, leaf, false, true);
  assert.ok(candidate instanceof MeshStandardNodeMaterial);
  assert.ok(control instanceof MeshStandardNodeMaterial);
  assert.equal(candidate.alphaTest, 0);
  assert.equal(control.alphaTest, .5);
  assert.ok(candidate.maskNode?.isNode);
  assert.equal(control.maskNode, null);
  assert.ok(candidate.opacityNode?.isNode);
  assert.ok(candidate.positionNode?.isNode);
  assert.equal(candidate.normalNode, control.normalNode);
  assert.deepEqual(candidate.color.toArray(), control.color.toArray());
  assert.deepEqual(candidate.emissive.toArray(), control.emissive.toArray());
  assert.equal(candidate.opacity, control.opacity);
  assert.equal(candidate.roughness, control.roughness);
  assert.equal(candidate.metalness, control.metalness);
  assert.equal(candidate.side, control.side);
  assert.equal(candidate.transparent, control.transparent);
  assert.equal(candidate.depthWrite, control.depthWrite);
  assert.equal(candidate.vertexColors, control.vertexColors);
  candidate.dispose(); control.dispose();
});

test('tick120/180 preserve control wind inputs and update existing position uniforms', () => {
  const pose120 = windInputs('rt01-decor-leaf',120,.35,[4,0,2],[0,0,0,1]);
  const pose180 = windInputs('rt01-decor-leaf',180,.35,[4,0,2],[0,0,0,1]);
  assert.deepEqual(pose120,originalWind('rt01-decor-leaf',120,.35,[4,0,2],[0,0,0,1]));
  assert.deepEqual(pose180,originalWind('rt01-decor-leaf',180,.35,[4,0,2],[0,0,0,1]));
  assert.notDeepEqual(pose120,pose180);
  const material = surfaceMaterial(T,true,leaf,false,true);
  assert.ok(material instanceof MeshStandardNodeMaterial);
  const position = material.positionNode;
  for(const pose of [pose120,pose180]){
    setWind(pose.x,pose.z);
    assert.deepEqual(materialUniforms.wind.value.toArray(),[pose.x,pose.z]);
    assert.deepEqual(glUniforms.wind.value.toArray(),[pose.x,pose.z]);
    assert.equal(material.positionNode,position);
  }
  material.dispose();
});

test('owner validation and owner-local rotated wind remain original contract', () => {
  const before={owner:'terrain',generation:0};
  const after={owner:'fragment-1',generation:1};
  assert.doesNotThrow(()=>assertOwner(before,{...before}));
  assert.doesNotThrow(()=>assertOwner(after,{...after}));
  assert.throws(()=>assertOwner(after,before),/Stale owner projection/);
  const rotation:[number,number,number,number]=[0,Math.SQRT1_2,0,Math.SQRT1_2];
  const rotated=windInputs('rt01-decor-leaf',120,.35,[4,0,2],rotation);
  assert.deepEqual(rotated,originalWind('rt01-decor-leaf',120,.35,[4,0,2],rotation));
  assert.notDeepEqual(rotated,windInputs('rt01-decor-leaf',120,.35,[4,0,2],[0,0,0,1]));
});
