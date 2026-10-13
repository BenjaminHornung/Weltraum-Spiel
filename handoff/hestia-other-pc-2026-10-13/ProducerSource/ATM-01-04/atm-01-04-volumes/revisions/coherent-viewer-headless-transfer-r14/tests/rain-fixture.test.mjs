import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {root,json} from '../scripts/bindings.mjs';
import {importFixture,createVoxelSourceIndex,sampleRainExposure,buildRainColumns,rainVelocityMps,createRainDepthProjection,compareRainDepthProjection} from '../.runtime/reuse.mjs';
async function load(name){const base='fixtures/authored-rain/',m=json(base+name+'.json');return importFixture(readFileSync(root+'/'+base+name+'.json'),new Map(m.payloads.map(p=>[p.id,new Uint8Array(readFileSync(root+'/'+base+p.path))])));}
test('actual generated closed/open RD source fixture: roof, overhang, cave opening, unknown and mesh/voxel parity',async()=>{
 const closed=await load('closed'),open=await load('open'),a=createVoxelSourceIndex(closed),b=createVoxelSourceIndex(open);
 try {
  for(const p of [[0,1,0],[7,1,0],[15,1,0]])assert.equal(sampleRainExposure(a,p,[0,-1,0],8).status,'shielded');
  for(const p of [[0,1,0],[15,1,0]])assert.equal(sampleRainExposure(b,p,[0,-1,0],8).status,'exposed');
  assert.equal(sampleRainExposure(a,[21,1,0],[0,-1,0],8).status,'unknown');
  const weather={windMps:[2,0,-1],rain01:0.8,cloud01:0.7,snow01:0},depth=createRainDepthProjection(closed);
  try {const control=buildRainColumns(a,rainVelocityMps(weather),4),candidate=buildRainColumns(a,rainVelocityMps(weather),4,depth);
   assert.equal(compareRainDepthProjection(control,candidate,0.5).decision,'FUNCTIONAL_PARITY_ONLY');}finally{depth.dispose();}
 }finally{a.dispose();b.dispose();}
});
