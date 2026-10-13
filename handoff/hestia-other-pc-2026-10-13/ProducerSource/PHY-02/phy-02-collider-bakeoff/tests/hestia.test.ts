import test from "node:test";
import assert from "node:assert/strict";
import {rockarm384,moving352} from "../src/hestiaFixtures.js";
import {recipe} from "../src/geometry.js";
import {engine,newWorld,install,stageEdit} from "../src/native.js";
test("source roof384 and literal moving384→352 probe preserve explicit mass, moving pose and zero density contribution",async()=>{
  for(const mode of ["A","B","C"] as const){
    const e=await engine(mode);
    for(const cellSize of [.125,.25] as const){
      const source=rockarm384(cellSize),next=moving352(source);assert.equal(source.cells.length,384);assert.equal(next.cells.length,352);
      const kind=mode==="C"?"voxels":"multi-cuboid",w=newWorld(e);
      try{
        const installed=install(e,w,recipe(source,kind),true);installed.body.setLinvel({x:.2,y:.1,z:0},true);w.step();
        const before={...installed.body.translation()},velocity={...installed.body.linvel()};
        const staged=stageEdit(installed,next,mode==="C");
        assert.equal(installed.recipe.fixture.cells.length,384);assert(!staged.candidate.body.isEnabled());
        const changed=staged.commit();assert.deepEqual({...changed.body.translation()},before);assert.deepEqual({...changed.body.linvel()},velocity);
        w.step();const expected=352*2400*cellSize**3;
        assert(Math.abs(changed.body.mass()-expected)<1e-3);assert(changed.colliders.every(c=>c.density()===0));
        assert.equal(w.bodies.len(),1);assert.equal(w.colliders.len(),changed.colliders.length);
      }finally{w.free();}
    }
  }
});
