import {strict as assert} from "node:assert";
import test from "node:test";
import {cutWork} from "./cut-work.mjs";
const entry=(name,count=1,activeMs)=>({name:"hvp."+name,duration:0,detail:{data:{commandId:"T",count,activeMs}}});
const core=[entry("cutPhysicsDispatch"),entry("cutPhysicsReply"),entry("cutPhysicsPlanTaskResumes",0,2.25),entry("cutStaticCollisionWorkMs")];
test("single round trip and no resumed tasks occupy three stages",()=>{
  const work=cutWork(core,"T");
  assert.equal(work.observedStages,3);
  assert.equal(work.withinStageBudget,true);
  assert.equal(work.activeElapsedMs.nativePlan,2.25);
});
test("counts physical handoffs, including independent recovery messages and worker resumes",()=>{
  const work=cutWork([...core.slice(0,2),entry("cutPhysicsPlanTaskResumes",3),core[3],
    entry("cutCollisionTaskResume"),entry("cutRecoverySideband"),entry("cutInputCopyTaskResume"),
    {name:"hvp.cutPhysicsReply",detail:{data:{commandId:"other",count:1}}}],"T");
  assert.equal(work.observedStages,9);
  assert.equal(work.withinStageBudget,false);
});
test("old or incomplete recordings cannot qualify",()=>{
  assert.equal(cutWork([],"T").withinStageBudget,false);
  assert.equal(cutWork(core.slice(1),"T").complete,false);
  assert.equal(cutWork(core,"T","oracle").withinStageBudget,false);
});

import {summarizeCutBrowserTrace} from "./cut-browser-trace.mjs";
test("clips nested main tasks, excludes other threads and keeps inter-slice gaps separate",()=>{
  const main=(name,ts,dur,tid=8)=>({name,ts,dur,pid:1,tid,ph:"X"});
  const events=[{name:"hvpProbeClockSync",pid:1,tid:8,ts:100000,cat:"blink.user_timing"},
    main("RunTask",100000,6000),main("RunTask",101000,2500),main("RunTask",108000,4000),
    main("V8.GC",101000,4000),main("MajorGC",102000,1000),main("Paint",104000,2000),
    main("Paint",100000,10000,42)];
  const labels={commandId:"T"},stat=t=>({name:"hvp.cutStaticCollisionWorkMs",detail:{data:labels},startTime:t,duration:1});
  const state={clockSync:5,eventTimeStamp:5,metrics:{"hvp.cutDomInputToPhysicsPublishedMs":{startTime:5,duration:10},
    "hvp.cutFirstCommittedRenderSubmitMs":{startTime:5,duration:12}},phases:[stat(5),stat(11)],result:labels};
  const d=summarizeCutBrowserTrace(events,state);
  assert.equal(d.inputToAck.mainTaskElapsedMs,8);
  assert.equal(d.inputToAck.mainGcElapsedMs,4);
  assert.equal(d.inputToAck.mainPaintAndCompositingMs,2);
  assert.equal(d.staticCollisionGaps[0].elapsedMs,5);
  assert.equal(d.ackToRenderSubmit.mainTaskElapsedMs,2);
});
