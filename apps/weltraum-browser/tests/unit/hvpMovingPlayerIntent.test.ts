import {afterEach,expect,it,vi} from "vitest";
import {Vector3} from "three";
import {createHvpPlasmaTool} from "../../src/hestia-prototype/terrain/plasmaTool";
import {rootFor} from "./componentIndex/compactFixtures";
import type {HvpMovingCutRequest} from "../../src/hestia-prototype/physics/bodyCutSession";
const owner={ownerId:"hvp:terrain-fragment:r1:1b4aa69d",sourceDigest:"hvp-material-cells-v1:02005d2b8da9f1c1"};
function setup(){
  const actual=rootFor([]);let epoch=actual.read().epoch;
  const root={...actual,read:()=>({...actual.read(),epoch})};
  let busy=false,locked=true,status="Running";
  const ray={origin:new Vector3(4,5,6),direction:new Vector3(0,0,-1)};
  const submit=vi.fn(async(_request:HvpMovingCutRequest)=>{});
  const consumer={read:()=>({state:"Applied"})}, moving={read:()=>({state:"Idle"}),submit};
  const structure={physics:{read:()=>({status,moving:{state:"Idle",preview:owner}}),setCutAim:()=>{}},consumer:{read:()=>({state:"Ready"})}};
  const observe=vi.fn((run:()=>void,_stamp:number)=>run());
  const tool=createHvpPlasmaTool(root,consumer as never,()=>busy?undefined:ray,()=>{},[],structure as never,moving as never,undefined,{
    captureRay:()=>locked?ray:undefined,busy:()=>busy,observe});
  tool.update();
  return {tool,ray,submit,observe,setBusy:(v:boolean)=>{busy=v;},setLocked:(v:boolean)=>{locked=v;},hold:()=>{status="SimulationHold";},swap:()=>{epoch++;}};
}
afterEach(()=>vi.useRealTimers());
it("preserves exactly one clicked eye, aim, owner, mode, session and event time during a temporary world transaction",async()=>{
  const f=setup();f.tool.select(2);f.setBusy(true);await f.tool.confirm(42);
  expect(f.tool.read()).toMatchObject({edges:1,movingInputPending:true});expect(f.submit).not.toHaveBeenCalled();
  expect(()=>f.tool.checkpoint()).toThrow();
  await f.tool.confirm(45);expect(f.submit).not.toHaveBeenCalled();
  f.ray.origin.set(3,4,5);f.ray.direction.set(1,0,0);f.tool.select(3);f.setBusy(false);f.tool.update();f.tool.update();
  expect(f.observe).toHaveBeenCalledTimes(1);expect(f.observe.mock.calls[0]![1]).toBe(42);
  expect(f.submit).toHaveBeenCalledTimes(1);
  expect(f.submit.mock.calls[0]![0]).toMatchObject({...owner,id:"moving-cut-1",edge:4,expectedEye:{x:4,y:5,z:6},direction:{x:0,y:0,z:-1}});
  expect(f.submit.mock.calls[0]![0].brush).toBeUndefined();expect(f.tool.read().movingInputPending).toBe(false);
});
it.each(["hold","unlock","new epoch","timeout","dispose"])("retires the original click after %s",async action=>{
  vi.useFakeTimers();const f=setup();f.setBusy(true);await f.tool.confirm(1);
  if(action==="hold")f.hold();if(action==="unlock")f.setLocked(false);if(action==="new epoch")f.swap();
  if(action==="timeout")vi.advanceTimersByTime(1600);
  if(action==="dispose")f.tool.dispose();f.setBusy(false);f.tool.update();
  expect(f.submit).not.toHaveBeenCalled();expect(f.tool.read().movingInputPending).toBe(false);
});
it("withdraws an unavailable green target and reports an unsupported click",async()=>{
  const f=setup();f.setBusy(true);f.tool.update();expect(f.tool.read().message).not.toContain("Loses Fragment");
  await f.tool.confirm(1);expect(f.tool.read().message).toContain("nicht verfügbar");expect(f.tool.read().edges).toBe(1);
});
