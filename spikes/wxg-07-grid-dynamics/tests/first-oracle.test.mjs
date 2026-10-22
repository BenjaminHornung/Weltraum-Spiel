import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGrid} from '../dist/grid.js';
test('new 32² transport has complete paired seam topology',()=>{
  const g=buildGrid(32,8282000,100,{x:0.3,y:1,z:0.2});
  assert.equal(g.cells.length,6144);assert.equal(g.edges.length,12288);
  assert.ok(g.edges.every(e=>e.b>=0));
});
