import {createHash} from "node:crypto";
import {existsSync,mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {expect,it} from "vitest";
import {captureLegacyWorld} from "../src/legacyScenario";

const json=(value:unknown)=>`${JSON.stringify(value,null,2)}\n`;
const sha256=(value:string)=>createHash("sha256").update(value).digest("hex");
const writeFrozen=(directory:URL,name:string,value:string)=>{
  const file=new URL(name,directory);
  if(existsSync(file)){
    if(readFileSync(file,"utf8")!==value){throw new Error(`Refusing to overwrite frozen fixture: ${name}`);}
    return;
  }
  writeFileSync(file,value);
};

it.skipIf(process.env.PHY03_EXPORT!=="1")("exports the real Rapier world and collision checkpoint",async()=>{
  const {checkpoint,collision}=await captureLegacyWorld(),directory=new URL("../fixtures/",import.meta.url);
  expect(checkpoint.solver).toBe("rapier-0.12.0");
  expect(checkpoint.branch?.generation).toBe(1);
  expect(checkpoint.parked).toEqual(["hvp:terrain-fragment:r1:12345678"]);
  mkdirSync(directory,{recursive:true});
  const world=json(checkpoint),geometry=json(collision);
  const manifest=json({version:"phy03-fixture-manifest-v1",sourceCommit:"17b1db4201a28e7b607c30707bdc2b75e3484a10",
    sourceFiles:["snapshot/src/hestia-prototype/physics/session.ts","snapshot/src/hestia-prototype/persistence/worldCheckpoint.ts",
      "snapshot/src/hestia-prototype/physics/bodyResidency.ts","snapshot/src/hestia-prototype/physics/bodyCutSession.ts"],
    sourceTests:["snapshot/tests/unit/hvp-world-save.test.ts","snapshot/tests/unit/hvp-residency-session.test.ts"],
    capture:{entrypoint:"src/legacyScenario.ts",solver:checkpoint.solver},personallyIdentifyingData:false,
    counts:{bodyOwners:checkpoint.bodies.length,collisionSectors:collision.length,
      vertices:collision.reduce((count,sector)=>count+sector.vertices.length,0),
      indices:collision.reduce((count,sector)=>count+sector.indices.length,0),
      parkedOwners:checkpoint.parked?.length??0,branchGeneration:checkpoint.branch?.generation??null},
    worldInputSha256:sha256(world),collisionSha256:sha256(geometry)});
  writeFrozen(directory,"legacy-world.json",world);
  writeFrozen(directory,"legacy-collision.json",geometry);
  writeFrozen(directory,"fixture-manifest.json",manifest);
});

it("refuses to replace an existing frozen fixture",()=>{
  expect(()=>writeFrozen(new URL("../fixtures/",import.meta.url),"legacy-world.json","changed bytes"))
    .toThrow(/Refusing to overwrite frozen fixture/);
});
