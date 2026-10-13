import {beforeAll,it,expect} from "vitest";
import fs from "node:fs";
import {Candidate,recipe} from "../src/fork";
import {fixture} from "../previous/src/fixtures";
import {floorFixture,stairFixture} from "../src/fixtures";
beforeAll(()=>Candidate.init());
it("emits exact canonical fixtures and mature derived recipes",()=>{
  const fixtures=[...([.125,.25] as const).flatMap(s=>["box","perforated-wall","cave-overhang","fine-stair","one-voxel-bridge","rotated-body"].map(id=>fixture(id,s))),
    floorFixture(),...([1,2,4] as const).map(stairFixture)];
  const records=fixtures.map(f=>({fixture:f,recipes:(["triangles","multi-cuboid","voxels"] as const).map(kind=>{
    const r=recipe(f,kind);expect(r.binding.sourceDigest).toBeTruthy();return {kind,binding:r.binding,mass:r.mass,
      boxes:r.boxes?.length??null,vertices:r.triangles?.vertices.length??null,indices:r.triangles?.indices.length??null,voxelCoordinates:r.voxels?.length??null};
  })}));
  fs.writeFileSync(process.env.PHY02_FIXTURES!,JSON.stringify({status:"CANONICAL_INPUT_AND_DERIVED_BINDING_NOT_NEW_RUNTIME_PASS",records,
    autostepFixtures:"Exact stepFixture generator in bound matrix-kcc.test.ts, heights1/2/3cells; raw observations contain source/collider counts"},null,2)+"\n",{flag:"wx"});
});
