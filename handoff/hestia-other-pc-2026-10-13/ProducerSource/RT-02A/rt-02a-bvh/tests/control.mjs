import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { traceBruteForce } from '../dist/imports/rt/src/bruteForce.mjs';
import { traceDda } from '../dist/imports/rt/src/dda.mjs';
const rays=JSON.parse(await readFile(new URL('../fixtures/rays/golden-1000.json',import.meta.url)));
const volumes=new Map();
export function parity(actual,expected){
  assert.ok(Math.abs(actual.distance-expected.distance)<=1e-9,`distance ${actual.distance}/${expected.distance}`);
  actual.normal.forEach((n,i)=>assert.ok(Math.abs(n-expected.normal[i])<=1e-9));
  assert.deepEqual({...actual,distance:0,normal:[]},{...expected,distance:0,normal:[]});
}
const outcomes={};
for(const row of rays.rays??rays){
  if(!volumes.has(row.volumeId))volumes.set(row.volumeId,JSON.parse(await readFile(new URL(`../fixtures/voxels/${row.volumeId}.json`,import.meta.url))));
  const volume=volumes.get(row.volumeId);
  parity(traceBruteForce(volume,row.ray),row.expected);parity(traceDda(volume,row.ray),row.expected);
  outcomes[row.expected.kind]=(outcomes[row.expected.kind]??0)+1;
}
const result={status:'PASS',oracle:'UNCHANGED_RT01_BRUTEFORCE_AND_DDA',count:(rays.rays??rays).length,outcomes,executionLocation:'LOCAL_WINDOWS_ISOLATED',hardware:'NOT_RUN'};
const out=new URL('../../../.devtoolbox/specs/changes/rt-02a-2026-10-09/tests/',import.meta.url);
await mkdir(out,{recursive:true});await writeFile(new URL('control.json',out),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
