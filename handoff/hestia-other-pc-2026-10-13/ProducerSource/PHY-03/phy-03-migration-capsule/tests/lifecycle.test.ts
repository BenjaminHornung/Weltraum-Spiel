import {readFileSync} from "node:fs";
import {expect,it} from "vitest";
import {decodeHvpBody} from "../snapshot/src/hestia-prototype/persistence/bodyCheckpoint";
import {createHvpWorkerPhysicsSession} from "../snapshot/src/hestia-prototype/physics/session";
import {prepareHvpLocalBodyCut} from "../snapshot/src/hestia-prototype/physics/bodyCutPlan";
import {collisionSectors,type HvpCollisionSource} from "../snapshot/src/hestia-prototype/physics/terrainColliders";
import {ingestHvpStructuralCells} from "../snapshot/src/hestia-prototype/terrain/structuralIngest";
import {ADAPTIVE_BRICK_ESTIMATED_BYTES} from "../snapshot/src/voxel/adaptive";
import {decodeEnvelope,encodeEnvelope,migrateLegacy,sha256} from "../src/capsule";

const worldBytes=()=>new Uint8Array(readFileSync(new URL("../fixtures/legacy-world.json",import.meta.url)));
const geometryBytes=()=>new Uint8Array(readFileSync(new URL("../fixtures/legacy-collision.json",import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL("../fixtures/fixture-manifest.json",import.meta.url),"utf8")) as {
  version:string;sourceCommit:string;sourceFiles:string[];sourceTests:string[];
  capture:{entrypoint:string;solver:string};counts:{bodyOwners:number;collisionSectors:number;vertices:number;indices:number;parkedOwners:number;branchGeneration:number};
  personallyIdentifyingData:boolean;
  worldInputSha256:string;collisionSha256:string;
};
const floor:HvpCollisionSource={sizeX:256,sizeY:8,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-.125,z:-16},
  readSlot:(_x,y,_z)=>y===0?1:0};
const jsonCollision=(value:Uint8Array)=>JSON.parse(new TextDecoder().decode(value)) as {vertices:number[];indices:number[]}[];
const sectors=(value:ReturnType<typeof jsonCollision>)=>value.map(({vertices,indices})=>({vertices:new Float32Array(vertices),indices:new Uint32Array(indices)}));
const direction=(position:{x:number;y:number;z:number},target:{x:number;y:number;z:number})=>{
  const delta={x:target.x-position.x,y:target.y-(position.y+.75),z:target.z-position.z},length=Math.hypot(delta.x,delta.y,delta.z);
  return {x:delta.x/length,y:delta.y/length,z:delta.z/length};
};

it("pins and roundtrips the original branch and parked terrain world bytes",async()=>{
  const bytes=worldBytes(),geometry=geometryBytes();
  expect(manifest.version).toBe("phy03-fixture-manifest-v1");
  expect(manifest.sourceCommit).toBe("17b1db4201a28e7b607c30707bdc2b75e3484a10");
  expect(manifest.sourceFiles).toContain("snapshot/src/hestia-prototype/physics/session.ts");
  expect(manifest.sourceFiles).toContain("snapshot/src/hestia-prototype/persistence/worldCheckpoint.ts");
  expect(manifest.personallyIdentifyingData).toBe(false);
  expect(manifest.capture).toMatchObject({entrypoint:"src/legacyScenario.ts",solver:"rapier-0.12.0"});
  expect(manifest.sourceTests).toContain("snapshot/tests/unit/hvp-world-save.test.ts");
  expect(manifest.sourceTests).toContain("snapshot/tests/unit/hvp-residency-session.test.ts");
  expect(await sha256(bytes)).toBe(manifest.worldInputSha256);
  expect(await sha256(geometry)).toBe(manifest.collisionSha256);
  const source=JSON.parse(new TextDecoder().decode(bytes)),collisionFixture=jsonCollision(geometry);
  expect(source.solver).toBe("rapier-0.12.0");
  expect(source.branch.generation).toBe(1);
  expect(source.parked).toEqual(["hvp:terrain-fragment:r1:12345678"]);
  expect(manifest.counts).toMatchObject({bodyOwners:source.bodies.length,collisionSectors:collisionFixture.length,
    vertices:collisionFixture.reduce((count,sector)=>count+sector.vertices.length,0),
    indices:collisionFixture.reduce((count,sector)=>count+sector.indices.length,0),
    parkedOwners:source.parked.length,branchGeneration:1});
  const migrated=await migrateLegacy(bytes,"world"),restored=await decodeEnvelope(encodeEnvelope(migrated));
  expect(restored.legacy).toEqual(bytes);
  expect(restored.canonical).toEqual(migrated.canonical);
  expect(restored.envelope).toEqual(migrated);
},120_000);

it("cold-creates, wakes, ray-cuts and commits the migrated terrain owner",async()=>{
  const legacy=worldBytes(),checkpoint=JSON.parse(new TextDecoder().decode(legacy)),geometry=jsonCollision(geometryBytes());
  const migrated=await migrateLegacy(legacy,"world"),decoded=await decodeEnvelope(encodeEnvelope(migrated));
  const collision=sectors(geometry),baselineCollision=[...collisionSectors(floor)];
  expect(collision).toEqual(baselineCollision);
  const session=await createHvpWorkerPhysicsSession(collision,checkpoint.dropSpawn,checkpoint.gravity,undefined,undefined,
    undefined,checkpoint.sessionId,JSON.parse(new TextDecoder().decode(decoded.legacy)));
  const ownerId="hvp:terrain-fragment:r1:12345678";
  try{
    expect(session.read().parked.map(body=>body.ownerId)).toEqual([ownerId]);
    expect(session.checkpoint().branch?.generation).toBe(1);
    session.play();session.input({x:-1,z:0,sprint:false,jump:false});
    for(let i=0;i<300;i+=1){session.advance(1/60);}
    session.pause();session.restoreNearBodies();
    expect(session.read().parked).toEqual([]);
    expect(session.read().bodies.find(body=>body.ownerId===ownerId)?.ownerId).toBe(ownerId);

    const residentBefore=session.read(),saved=session.checkpoint().bodies.find(body=>body.ownerId===ownerId)!;
    const recipe=decodeHvpBody(saved).recipe;
    session.play();session.input({x:-1,z:0,sprint:false,jump:false});
    for(let i=0;i<180;i+=1){session.advance(1/60);}
    session.input({x:0,z:0,sprint:false,jump:false});
    const before=session.read(),parent=before.bodies.find(body=>body.ownerId===ownerId)!;
    const aim=direction(before.player!.position,parent.position);
    session.aimBranch(aim);
    const hit=session.read().moving.preview!;
    expect(hit.ownerId).toBe(ownerId);
    const preparation=session.beginBodyCut({id:"wake-recut",ownerId,sourceDigest:hit.sourceDigest,edge:1,direction:aim});
    const payload=preparation.payload,local=prepareHvpLocalBodyCut(
      ingestHvpStructuralCells(payload.sourceId,preparation.cells,payload.materials),payload.cell,payload.commandId,payload.edge);
    const admission={removedCells:local.plan.removedCells,removedMassKg:local.plan.removedMassKg,parts:local.plan.parts.map(part=>({
      ownerId:part.ownerId,sourceDigest:part.recipe.source.contentHash,massKg:part.recipe.mass.totalMassKg,
      center:part.recipe.mass.centerOfMassMeters!}))};
    await session.prepareBodyCutPlan("wake-recut");session.stageBodyCut("wake-recut",admission);
    session.commitBodyCut("wake-recut");session.finalizeBodyCut("wake-recut");session.pause();
    const after=session.checkpoint(),receipt=session.read().moving.last!;
    expect(receipt).toMatchObject({status:"Applied",parentId:ownerId,removedCells:1});
    expect(after.bodies.some(body=>body.ownerId===ownerId)).toBe(false);
    const children=after.bodies.filter(body=>receipt.children.includes(body.ownerId));
    expect(children).toHaveLength(receipt.children.length);
    const childRecipes=children.map(body=>decodeHvpBody(body).recipe);
    expect(childRecipes.every(child=>JSON.stringify(child.source.materials)===JSON.stringify(recipe.source.materials))).toBe(true);
    expect(childRecipes.reduce((mass,child)=>mass+child.mass.totalMassKg,receipt.removedMassKg)).toBeCloseTo(recipe.mass.totalMassKg,6);
    const childBytes=childRecipes.reduce((bytes,child)=>bytes+child.source.bricks.length*ADAPTIVE_BRICK_ESTIMATED_BYTES+4096+child.colliders.length*256,0);
    expect(session.read().bodySourceResidentBytes-residentBefore.bodySourceResidentBytes).toBe(childBytes);
  }finally{session.dispose();}
  expect(session.read()).toMatchObject({bodyCount:0,colliderCount:0,bodySourceResidentBytes:0,dormantCheckpointBytes:0});
},120_000);
