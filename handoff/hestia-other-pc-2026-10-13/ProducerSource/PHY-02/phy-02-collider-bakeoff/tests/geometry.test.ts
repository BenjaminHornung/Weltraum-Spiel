import test from "node:test";
import assert from "node:assert/strict";
import {fixture,fixtures} from "../src/fixtures.js";
import {recipe,canonical,massProperties,type Kind} from "../src/geometry.js";
const near=(a:number,b:number)=>assert(Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-10,a+" != "+b);
test("recipes reject malformed bounds, grid origin, duplicate/outside cells, size and rotation",()=>{
  const f=fixture("box",.125);
  for(const bad of [
    {...f,cellSize:0},{...f,origin:[.01,0,0] as const},{...f,bounds:[0,4,4] as const},
    {...f,cells:[...f.cells,f.cells[0]]},{...f,cells:[[4,0,0] as const]},
    {...f,rotation:{x:0,y:0,z:0,w:2}},
    {...f,rotation:{x:"0",y:0,z:0,w:1} as unknown as typeof f.rotation},
    {...f,rotation:{w:1} as typeof f.rotation},{...f,cells:[]}])assert.throws(()=>canonical(bad));
  assert.throws(()=>recipe(f,"unsupported" as Kind),/kind/);
});
test("A/B greedy products exactly cover canonical cells without duplicating mass authority",()=>{
  for(const f of fixtures()){
    const r=recipe(f,"multi-cuboid"),covered:string[]=[];
    for(const b of r.boxes!)for(let z=b.min.z;z<b.max.z;z++)for(let y=b.min.y;y<b.max.y;y++)for(let x=b.min.x;x<b.max.x;x++)covered.push([x,y,z].join(":"));
    assert.equal(new Set(covered).size,f.cells.length);assert.deepEqual(covered.sort(),f.cells.map(c=>c.join(":")).sort());
    assert(Object.isFrozen(r.fixture.cells));assert.throws(()=>{(r.fixture.cells as unknown as number[][])[0][0]=99;});
    const old=r.binding.sourceDigest;f.cells[0];assert.equal(r.binding.sourceDigest,old);
  }
});
test("triangle controls reuse current collision greedy product: box has six quads, not per-voxel faces",()=>{
  for(const size of [.125,.25]){
    const f=fixture("box",size),r=recipe(f,"triangles");
    assert.equal(r.triangles!.indices.length,36);assert.equal(r.triangles!.vertices.length,72);
    assert.equal(r.binding.algorithm,"hvp-collision-greedy-v1");
  }
});
test("full mass/COM/tensor matches independent analytic solid box, L and hollow box",()=>{
  const box=fixture("box",.25),m=massProperties(box),s=box.cellSize;
  near(m.mass,2400);near(m.center.x,.5);near(m.center.y,.5);near(m.center.z,.5);
  near(m.tensor.xx,m.mass/6);near(m.tensor.yy,m.mass/6);near(m.tensor.zz,m.mass/6);
  near(m.tensor.xy,0);near(m.tensor.xz,0);near(m.tensor.yz,0);
  // Three disjoint unit cubes form an L; direct second moments include xy coupling.
  const L={...box,id:"L",bounds:[2,2,1] as const,cells:[[0,0,0],[1,0,0],[0,1,0]] as const},lm=massProperties(L),u=2400*s**3;
  near(lm.mass,3*u);near(lm.center.x,5*s/6);near(lm.center.y,5*s/6);near(lm.center.z,s/2);
  near(lm.tensor.xx,7*u*s*s/6);near(lm.tensor.yy,7*u*s*s/6);near(lm.tensor.zz,11*u*s*s/6);
  near(lm.tensor.xy,u*s*s/3);near(lm.tensor.xz,0);near(lm.tensor.yz,0);
  const hollow={...box,id:"hollow",cells:box.cells.filter(c=>c.some(n=>n===0||n===3))},hm=massProperties(hollow);
  const innerMass=8*u,outerMass=64*u;
  near(hm.mass,outerMass-innerMass);near(hm.tensor.xx,(outerMass*(4*s)**2-innerMass*(2*s)**2)/6);
  near(hm.tensor.yy,hm.tensor.xx);near(hm.tensor.zz,hm.tensor.xx);near(hm.tensor.xy,0);
});
