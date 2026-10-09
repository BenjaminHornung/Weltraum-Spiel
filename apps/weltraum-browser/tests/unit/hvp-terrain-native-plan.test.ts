import {expect,it,vi} from "vitest";
import {createHvpWorkerPhysicsSession} from "../../src/hestia-prototype/physics/session";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";
import {createHvpBodyMeshTaskPump} from "../../src/workers/hvpBoundedPump";
import {createHvpBodyMeshPhaseReserve} from "../../src/hestia-prototype/presentation/bodyMeshAdmission";

const floor={sizeX:4,sizeY:16,sizeZ:4,cellMeters:.125,originMeters:{x:0,y:0,z:0},readSlot:(_x:number,y:number)=>y===0?1:0};
const cells=Array.from({length:128},(_,i)=>({x:128+i%16,y:76,z:128+Math.floor(i/16),materialId:1}));
const fragment={ownerId:"hvp:terrain-fragment:r1:12345678",origin:{x:-16,y:-8,z:-16},massKg:128*2400*.125**3,
  cells,colliderBoxes:[{min:[128,76,128] as const,max:[144,77,136] as const}]};
const open=async(measure=false)=>({session:await createHvpWorkerPhysicsSession([...collisionSectors(floor)],{x:.4,y:2,z:.4},undefined,undefined,undefined,undefined,"hvp-world",undefined,"branch",measure),
  replacements:[{index:0,mesh:[...collisionSectors(floor)][0]!}]});

it.each([false,true])("separates contiguous work from long yield waits and honors opt-out mid-yield (%s)",async disable=>{
  const {session,replacements}=await open(true);let now=10,yields=0,readsAtOptOut=0;
  const clock=vi.spyOn(performance,"now").mockImplementation(()=>now);
  const host={assertCurrent(){},continuePlan:()=>false,yieldTask:async()=>{yields++;now+=100;if(disable&&yields===1){session.disableBodyPlanTrace();readsAtOptOut=clock.mock.calls.length;}}};
  try{
    const ticket=await session.prepareTerrainPlan("timed",0,replacements,[fragment],createHvpBodyMeshPhaseReserve(48*1024*1024),host);
    expect(session.terrainPlanSourceViews(ticket)[0]).toMatchObject({cellCount:128,massKg:600});
    if(disable){expect(ticket.sourceTiming).toBeUndefined();expect(ticket.spans).toBeUndefined();
      const afterOptOut=clock.mock.calls.length-readsAtOptOut;
      const control=await open(false);let firstControlYield=true,controlReads=0;
      try{const unmeasured=await control.session.prepareTerrainPlan("untimed",0,control.replacements,[fragment],createHvpBodyMeshPhaseReserve(48*1024*1024),
        {assertCurrent(){},continuePlan:()=>false,yieldTask:async()=>{now+=100;if(firstControlYield){firstControlYield=false;controlReads=clock.mock.calls.length;}}});
        expect(unmeasured.spans).toBeUndefined();expect(clock.mock.calls.length-controlReads).toBe(afterOptOut);
      }finally{control.session.dispose();}
    }
    else{
      expect(ticket.sourceTiming).toMatchObject({workElapsedMs:0,yieldWaitMs:yields*100,workSteps:yields+1,taskYields:yields,maxWork:{duration:0},maxYield:{duration:100}});
      expect(ticket.sourceTiming!.maxYield.start).toBeGreaterThanOrEqual(10);expect(JSON.stringify(ticket.sourceTiming).length).toBeLessThanOrEqual(1536);
      expect(Object.isFrozen(ticket.sourceTiming)).toBe(true);
    }
  }finally{clock.mockRestore();session.dispose();}
});

it("prepares full native recipes while real solver ticks continue, then stages the exact local ticket",async()=>{
  const {session,replacements}=await open();let yields=0;
  const fragments=[fragment];
  const host={assertCurrent:()=>{},continuePlan:()=>false,yieldTask:async()=>{yields+=1;session.advance(1/60);}};
  try{
    const before=session.read();
    const ticket=await session.prepareTerrainPlan("owned",0,replacements,fragments,createHvpBodyMeshPhaseReserve(48*1024*1024),host);
    expect(yields).toBeGreaterThan(1);expect(session.read().ticks).toBeGreaterThan(before.ticks);
    expect(session.read()).toMatchObject({terrainTransaction:"Idle",bodyCount:before.bodyCount,colliderCount:before.colliderCount});
    expect(session.terrainPrepareSpans()).toBeUndefined();
    const views=session.terrainPlanSourceViews(ticket);
    expect(views).toHaveLength(1);expect(views[0]).toMatchObject({ownerId:fragment.ownerId,cellCount:128,massKg:600,colliders:1});
    expect(Object.isFrozen(views)).toBe(true);expect(Object.isFrozen(views[0])).toBe(true);
    expect(session.read().preparedTerrainFragments).toEqual([]);
    expect(()=>session.terrainPlanSourceViews({...ticket})).toThrow(/ticket/);
    session.prepareTerrain("owned",0,replacements,fragments,ticket);
    expect(session.read().preparedTerrainFragments).toEqual(views);
    expect(()=>session.terrainPlanSourceViews(ticket)).toThrow(/ticket/);
    expect(session.read().preparedTerrainFragments[0]).toMatchObject({cellCount:128,massKg:600,colliders:1});
    const held=session.read().ticks;session.advance(1);expect(session.read().ticks).toBe(held);
    session.commitTerrain("owned");session.finalizeTerrain("owned");
    expect(()=>session.prepareTerrain("owned",1,replacements,[fragment],ticket)).toThrow(/ticket/);
  }finally{session.dispose();}
});
it("rejects forged native claims and foreign ticket references before a hold or World mutation",async()=>{
  const {session,replacements}=await open(),pump=createHvpBodyMeshTaskPump(()=>{});
  try{
    const before=session.read();
    await expect(session.prepareTerrainPlan("bad",0,replacements,[{...fragment,massKg:1}],createHvpBodyMeshPhaseReserve(48*1024*1024),pump.host)).rejects.toThrow(/mass mismatch/);
    expect(session.read()).toMatchObject({terrainTransaction:"Idle",bodyCount:before.bodyCount,colliderCount:before.colliderCount});
    const ticket=await session.prepareTerrainPlan("good",0,replacements,[fragment],createHvpBodyMeshPhaseReserve(48*1024*1024),pump.host);
    expect(()=>session.prepareTerrain("good",0,[...replacements],[fragment],ticket)).toThrow(/ticket/);
    expect(session.read().terrainTransaction).toBe("Idle");
  }finally{pump.dispose();session.dispose();}
});
it("closes actual yielded source work on cancellation or owner disposal before any late Stage",async()=>{
  for(const dispose of [false,true]){
    const {session,replacements}=await open();let yields=0;
    const sentinel=new Error("cancelled native source");
    const host={assertCurrent:()=>{},continuePlan:()=>false,yieldTask:async()=>{yields+=1;if(dispose){session.dispose();}else{throw sentinel;}}};
    try{
      await expect(session.prepareTerrainPlan("cancel",0,replacements,[fragment],createHvpBodyMeshPhaseReserve(48*1024*1024),host)).rejects.toThrow(dispose?/disposed/:sentinel);
      expect(yields).toBe(1);expect(session.read().terrainTransaction).toBe("Idle");
      if(dispose){expect(session.read()).toMatchObject({status:"Disposed",bodyCount:0,colliderCount:0});}
    }finally{session.dispose();}
  }
});
