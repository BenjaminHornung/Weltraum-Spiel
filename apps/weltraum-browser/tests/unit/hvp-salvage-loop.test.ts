import {expect,it} from "vitest";
import {createHvpSalvageLoop,validateHvpSalvageCheckpoint,type HvpSalvageObservation} from "../../src/hestia-prototype/gameplay/salvageLoop";
import {createHvpSalvageMarker,createHvpSalvageLink} from "../../src/hestia-prototype/presentation/salvageMarker";

const origin={x:-12,y:.5,z:-13.5},owner="hvp-salvage:r1:p1";
const observation=(ticks=10):HvpSalvageObservation=>({ticks,status:"Running",terrainTransaction:"Idle",movingState:"Idle",
  player:{status:"Walking",position:{x:-12.3,y:1.42,z:-13.4375}},
  branch:{kind:"salvage",origin,generation:0,state:"Idle",last:null,parts:[]},lastImpulse:null,lastImpulseTick:null});
const separated=(ticks=20):HvpSalvageObservation=>({...observation(ticks),branch:{...observation().branch!,generation:1,
  last:{id:"branch-cut-1",status:"Applied",removedCells:1,removedMassKg:600*.125**3},
  parts:[{ownerId:owner,sourceDigest:"fnv1a64-v1:1234567890abcdef",anchored:false,cellCount:8,massKg:9.375,sleeping:true,
    position:{x:-11.5,y:.635,z:-13.4375},velocity:{x:0,y:0,z:0}}]}});
const deposited=(ticks=40):HvpSalvageObservation=>{const s=separated(ticks);return {...s,
  branch:{...s.branch!,parts:[{...s.branch!.parts[0]!,position:{x:-11.5,y:.635,z:-12.7}}]},
   lastImpulseTick:30,lastImpulse:{status:"Applied",target:owner,point:{x:-11.7,y:.7,z:-13.4},impulse:{x:0,y:0,z:15}}};};
it("uses bounded presentation-only depot and link markers with exact Float32 bounds",()=>{
  const meshes=[createHvpSalvageMarker(.5),createHvpSalvageLink()];
  expect(meshes.reduce((n,m)=>n+m.indices.length/3,0)).toBe(60);
  for(const mesh of meshes){
    expect(mesh.materialRanges).toHaveLength(1);
    for(let i=0;i<mesh.positions.length;i+=1){const axis=(["x","y","z"] as const)[i%3]!;
      expect(mesh.positions[i]).toBeGreaterThanOrEqual(mesh.boundsMeters.min[axis]);expect(mesh.positions[i]).toBeLessThanOrEqual(mesh.boundsMeters.max[axis]);}
  }
});
it("uses the existing four sequential objectives and actual cut/motion evidence, not click counts",()=>{
  const loop=createHvpSalvageLoop("session");
  loop.observe({...observation(),player:{...observation().player!,status:"Inspection"}});expect(loop.read().stage).toBe("Find");
  loop.observe(observation());expect(loop.read().stage).toBe("Cut");
  const wrong=separated();loop.observe({...wrong,branch:{...wrong.branch!,kind:"branch"}});expect(loop.read().stage).toBe("Cut");
  loop.observe(separated());expect(loop.read().stage).toBe("Deliver");
  const elsewhere=separated(40);loop.observe({...elsewhere,lastImpulse:deposited().lastImpulse,lastImpulseTick:30});expect(loop.read().stage).toBe("Deliver");
  loop.observe(deposited());expect(loop.read().stage).toBe("Save");
  expect(loop.read().mission.objectiveStates.map(s=>s.state)).toEqual(["Completed","Completed","Completed","Active"]);
});
it("cannot finish without a contact impulse on the right body and a slow body inside the real zone",()=>{
  const loop=createHvpSalvageLoop("session");loop.observe(observation());loop.observe(separated());
  const s=deposited();loop.observe({...s,lastImpulse:{...s.lastImpulse!,target:"unrelated"}});expect(loop.read().stage).toBe("Deliver");
  loop.observe({...s,branch:{...s.branch!,parts:[{...s.branch!.parts[0]!,velocity:{x:2,y:0,z:0}}]}});expect(loop.read().stage).toBe("Deliver");
  loop.observe(deposited(50));expect(loop.read().stage).toBe("Save");
});
it("publishes completion only after the matching durable artifact is acknowledged",()=>{
  const loop=createHvpSalvageLoop("session");expect(()=>loop.prepareSave("fnv1a32:12345678")).toThrow(/delivery/);
  loop.observe(observation());loop.observe(separated());loop.observe(deposited());
  const before=loop.checkpoint(),candidate=loop.prepareSave("fnv1a32:12345678");
  expect(loop.read().stage).toBe("Save");expect(loop.checkpoint()).toEqual(before); // Failed write leaves progress intact.
  expect(()=>loop.commitSave({...candidate},candidate)).toThrow(/candidate/);
  loop.commitSave(candidate,JSON.parse(JSON.stringify(candidate)));expect(loop.read().stage).toBe("Completed");
  expect(loop.read().mission.state).toBe("Completed");expect(loop.read().mission.rewardClaimState).not.toBe("Claimed");
});
it("restores a half-finished receipt chain and rejects invented completion or mismatched saved world",()=>{
  const loop=createHvpSalvageLoop("session");loop.observe(observation());loop.observe(separated());
  const saved=loop.checkpoint(),restored=createHvpSalvageLoop("session",JSON.parse(JSON.stringify(saved)));
  expect(restored.read().mission).toEqual(loop.read().mission);
  restored.observe(deposited());const candidate=restored.prepareSave("fnv1a32:12345678");
  expect(()=>validateHvpSalvageCheckpoint({...candidate,completed:true},deposited(),"fnv1a32:12345678")).toThrow();
  expect(()=>validateHvpSalvageCheckpoint(candidate,separated(50),"fnv1a32:12345678")).toThrow(/delivery/);
  expect(()=>validateHvpSalvageCheckpoint(candidate,deposited(),"fnv1a32:00000000")).toThrow(/save/);
  expect(validateHvpSalvageCheckpoint(candidate,deposited(),"fnv1a32:12345678")).toEqual(candidate);
});
