import {expect,it} from "vitest";
import * as supports from "../../src/hestia-prototype/terrain/supportPlan";

type Credits={readonly remainingBytes:number;beginLane:(parallel:number)=>{readonly bytes:number};endLane:(token:{readonly bytes:number},retained:number)=>void;nativeGrant:(copy:number)=>number;release:()=>void};
type Create=(persistent:number,resident:number)=>Credits;
const create=(...args:Parameters<Create>)=>(supports as unknown as {createHvpSupportPhaseCredits:Create}).createHvpSupportPhaseCredits(...args);
it("adds concurrent lane grants and retained products under the same original Prepare96/CPU256 envelope",()=>{
  const initial=2*8_388_608+90_112,c=create(initial,128*1024*1024),before=c.remainingBytes;
  const a=c.beginLane(2),b=c.beginLane(2);expect(a.bytes+b.bytes).toBeLessThanOrEqual(before);
  expect(c.remainingBytes).toBe(before-a.bytes-b.bytes);expect(()=>c.nativeGrant(4096)).toThrow(/pending|active/);
  c.endLane(b,1024);c.endLane(a,2048);expect(c.remainingBytes).toBe(before-3072);
  expect(c.nativeGrant(4096)).toBe(before-3072-4096);expect(()=>c.endLane(a,0)).toThrow();
  c.release();expect(()=>c.beginLane(1)).toThrow();
});
it("rejects foreign or overspent grants and invalid scene/copy credits before allocation",()=>{
  expect(()=>create(96*1024*1024+1,0)).toThrow();expect(()=>create(0,161*1024*1024)).toThrow();
  const c=create(4096,0),a=c.beginLane(1);expect(()=>c.endLane({...a},0)).toThrow();
  expect(()=>c.endLane(a,a.bytes+1)).toThrow();expect(()=>c.nativeGrant(-1)).toThrow();c.release();
});
