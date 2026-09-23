import {expect,it,vi} from "vitest";
import {R} from "../../src/hestia-prototype/physics/rapierPort";
import {createHvpPhysicsSession} from "../../src/hestia-prototype/physics/session";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";
import {meshHvpTerrainFragment} from "../../src/hestia-prototype/presentation/terrainFragment";
import {createHvpCompactLookTerrain} from "../../src/hvp/hvpBootstrap";
import {createHvpLookProfile} from "../../src/hestia-prototype/presentation/look";
import {createMeshArtifact,representationKey,frameId,sourceRevision,artifactRevision} from "../../src/presentation";
import {materializeHvpCoastSource,prepareHvpCoastSource} from "../../src/hvp/hvpCoastSource";
import {createHvpTerrainRoot} from "../../src/hestia-prototype/terrain/cutPlan";
import {analyzeHvpTerrainSupport} from "../../src/hestia-prototype/terrain/supportPlan";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {hvpRigidColliderBoxes,prepareHvpRigidBody} from "../../src/hestia-prototype/physics/rigidRecipe";
import {HVP_COAST_MATERIAL_REGISTRY} from "../../src/hvp/hvpCoastSource";
const floor={sizeX:4,sizeY:16,sizeZ:4,cellMeters:.125,originMeters:{x:0,y:0,z:0},readSlot:(_x:number,y:number,_z:number)=>y===0?1:0};
const roof={...floor,readSlot:(x:number,y:number,z:number)=>y===0||(x<2&&z===0&&y===12)?1:0};
const fragmentCells=[{x:128,y:76,z:128,materialId:1},{x:129,y:76,z:128,materialId:1}];
const fragmentMaterials=HVP_COAST_MATERIAL_REGISTRY.map(m=>({materialId:m.slot,densityKgPerCubicMeter:m.densityKgPerM3,
  structuralClass:m.role,destructible:true,tags:null}));
const fragmentBoxes=hvpRigidColliderBoxes(prepareHvpRigidBody(ingestHvpStructuralCells("test-fragment",fragmentCells,fragmentMaterials)));
const fragment={ownerId:"hvp:terrain-fragment:r1:12345678",origin:{x:-16,y:-8,z:-16},massKg:2*2400*.125**3,
  cells:fragmentCells,colliderBoxes:fragmentBoxes};
const prepare=async()=>({session:await createHvpPhysicsSession([...collisionSectors(roof)],{x:.4,y:2,z:.4}),
  replacements:[{index:0,mesh:[...collisionSectors(floor)][0]!}]});

it("bounds the actual Float32 render vertices after mixed-density native COM recentering",async()=>{
  const {session,replacements}=await prepare();try{
    const root=createHvpTerrainRoot(prepareHvpCoastSource(materializeHvpCoastSource()),"render",0),before=root.read();
    const cut=root.prepare({sessionId:before.sessionId,epoch:before.epoch,revision:before.revision,sourceDigest:before.sourceDigest,
      commandId:"roof",toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[176,78,76],max:[180,82,80]}});
    const part=analyzeHvpTerrainSupport(cut).fragments[0]!;
    const request={...fragment,massKg:part.massKg,cells:part.cells,colliderBoxes:part.colliderBoxes};
    session.prepareTerrain("mixed",0,replacements,[request]);
    const mesh=meshHvpTerrainFragment({request,state:session.read().preparedTerrainFragments[0]!});
    for(let i=0;i<mesh.positions.length;i+=3){
      expect(mesh.positions[i]).toBeGreaterThanOrEqual(mesh.boundsMeters.min.x);expect(mesh.positions[i]).toBeLessThanOrEqual(mesh.boundsMeters.max.x);
      expect(mesh.positions[i+1]).toBeGreaterThanOrEqual(mesh.boundsMeters.min.y);expect(mesh.positions[i+1]).toBeLessThanOrEqual(mesh.boundsMeters.max.y);
      expect(mesh.positions[i+2]).toBeGreaterThanOrEqual(mesh.boundsMeters.min.z);expect(mesh.positions[i+2]).toBeLessThanOrEqual(mesh.boundsMeters.max.z);
    }
    const group=createHvpCompactLookTerrain(mesh,createHvpLookProfile("readable"),{allowPartialRoles:true});
    expect(()=>createMeshArtifact({representationKey:representationKey(request.ownerId),frameId:frameId("hvp:frame"),
      sourceRevision:sourceRevision(1),artifactRevision:artifactRevision(1),algorithmVersion:mesh.algorithmVersion,
      positions:mesh.positions,normals:mesh.normals,indices:group.indices,attributes:{color:mesh.colors!},materialRanges:group.materialRanges,bounds:mesh.boundsMeters})).not.toThrow();
  }finally{session.dispose();}
});

it("holds old terrain and staged bodies until one generation commits, then falls on the remaining real floor",async()=>{
  const {session,replacements}=await prepare();try{
    const before=session.read();session.prepareTerrain("transfer",0,replacements,[fragment]);
    expect(session.read()).toMatchObject({terrainGeneration:0,terrainTransaction:"PreparedHeld",terrainFragments:[]});
    expect(session.read().preparedTerrainFragments[0]).toMatchObject({massKg:9.375,cellCount:2,colliders:1});
    session.advance(1);expect(session.read().ticks).toBe(before.ticks);
    session.commitTerrain("transfer");session.advance(1);expect(session.read().ticks).toBe(before.ticks);
    expect(session.read().terrainFragments).toHaveLength(1);
    const initial=session.read().bodies.find(b=>b.ownerId===fragment.ownerId)!;
    expect(initial.position.y).toBeCloseTo(1.5625,6);
    session.finalizeTerrain("transfer");
    for(let i=0;i<120;i+=1){session.advance(1/60);}
    const body=session.read().bodies.find(b=>b.ownerId===fragment.ownerId)!;
    expect(body.position.y).toBeLessThan(initial.position.y-.5);
    expect(body.position.y).toBeCloseTo(.1875,2);expect(body.massKg).toBeCloseTo(9.375,5);
    expect(session.read()).toMatchObject({terrainGeneration:1,terrainTransaction:"Idle",bodyCount:2,colliderCount:3});
  }finally{session.dispose();}
});
it("restores native membership on rollback and rejects forged mass before publication",async()=>{
  const {session,replacements}=await prepare();try{
    const before=session.read();
    expect(()=>session.prepareTerrain("bad",0,replacements,[{...fragment,massKg:10}])).toThrow(/mass mismatch/);
    expect(session.read()).toMatchObject({terrainGeneration:0,bodyCount:before.bodyCount,colliderCount:before.colliderCount,terrainTransaction:"Idle"});
    session.prepareTerrain("rollback",0,replacements,[fragment]);session.commitTerrain("rollback");session.rollbackTerrain("rollback");
    expect(session.read()).toMatchObject({terrainGeneration:0,bodyCount:before.bodyCount,colliderCount:before.colliderCount,terrainFragments:[],terrainTransaction:"Idle"});
  }finally{session.dispose();}
});
it("cleans actual post-create faults, and freezes rather than claiming rollback when cleanup fails",async()=>{
  const {session,replacements}=await prepare();const original=R.World.prototype.createRigidBody;
  const create=vi.spyOn(R.World.prototype,"createRigidBody").mockImplementation(function(this:R.World,desc){original.call(this,desc);throw new Error("post-create");});
  try{
    expect(()=>session.prepareTerrain("creation",0,replacements,[fragment])).toThrow(/post-create/);
    expect(session.read()).toMatchObject({terrainTransaction:"Idle",terrainGeneration:0,bodyCount:1,colliderCount:2});
    create.mockRestore();session.prepareTerrain("cleanup",0,replacements,[fragment]);session.commitTerrain("cleanup");
    const remove=vi.spyOn(R.World.prototype,"removeCollider").mockImplementation(()=>{throw new Error("cleanup failure");});
    try{
      expect(()=>session.rollbackTerrain("cleanup")).toThrow(/cleanup failure/);
      const ticks=session.read().ticks;session.advance(10);
      expect(session.read()).toMatchObject({terrainTransaction:"RecoveryHold",ticks});expect(()=>session.resume()).toThrow(/RecoveryHold/);
    }finally{remove.mockRestore();}
  }finally{create.mockRestore();session.dispose();}
});
