import {expect,it} from "vitest";
import {createHvpBodyCutConsumer} from "../../src/hestia-prototype/terrain/bodyCutConsumer";
import {HvpRenderStageRecoveryError} from "../../src/hestia-prototype/presentation/renderStageRecovery";
import type {HvpPhysicsClient} from "../../src/hestia-prototype/physics/client";
import type {HvpBodyCutProducts} from "../../src/workers/hvpBodyCutJob";

const request={id:"release-terminal",ownerId:"parent",sourceDigest:"source",edge:1,direction:{x:0,y:0,z:1}};
const source=()=>({read:()=>({moving:{state:"Idle"}}),beginBodyCut:async()=>({}),stageBodyCut:async()=>{},
  commitBodyCut:async()=>{},publishBodyCut:()=>{},finalizeBodyCut:async()=>{},rollbackBodyCut:async()=>{},command:async()=>{}} as unknown as HvpPhysicsClient);
const products={parts:[],removedCells:1,removedMassKg:1} as HvpBodyCutProducts;
const stage=()=>({publish(){},rollback(){},finish(){}});

it("shares one terminal disposed release across concurrent callers",async()=>{
  let complete!:()=>void;const pending=new Promise<void>(resolve=>{complete=resolve;});let releases=0;
  const consumer=createHvpBodyCutConsumer(source(),async()=>products,()=>{
    throw new HvpRenderStageRecoveryError([new Error("upload"),new Error("unproven resource")],"partial staging");
  },undefined,async()=>{releases++;await pending;});
  await consumer.submit(request);consumer.dispose();await consumer.whenIdle();
  const a=consumer.releaseDisposedResources(),b=consumer.releaseDisposedResources();
  await Promise.resolve();expect(releases).toBe(1);complete();await Promise.all([a,b]);
  await consumer.releaseDisposedResources();expect(releases).toBe(1);expect(consumer.read().state).toBe("RecoveryHold");
});

it("keeps primary and terminal release failures and never repeats the rejected release on Dispose",async()=>{
  const release=new Error("owner release failed");let releases=0;
  const consumer=createHvpBodyCutConsumer(source(),async()=>{throw null;},stage,undefined,async()=>{releases++;throw release;});
  await consumer.submit(request);expect(consumer.read().last).toMatchObject({status:"RecoveryHold"});
  expect(consumer.read().last!.reason).toBe("null; Mesh ownership release unproven: Error: owner release failed");
  consumer.dispose();await consumer.whenIdle();await expect(consumer.releaseDisposedResources()).rejects.toBe(release);
  expect(releases).toBe(1);
});

it("assigns a fresh terminal release to the next acknowledged command",async()=>{
  const released:string[]=[];
  const consumer=createHvpBodyCutConsumer(source(),async()=>products,stage,undefined,async id=>{released.push(id);});
  await consumer.submit(request);await consumer.submit({...request,id:"release-next"});
  expect(released).toEqual(["release-terminal","release-next"]);expect(consumer.checkpoint().entries).toHaveLength(2);consumer.dispose();
});
