import {expect,it} from "vitest";
import {createPublishedPlayerEyes} from "../../src/hestia-prototype/physics/publishedPlayerEye";
const origin={x:1,y:1.75,z:2};
it("retains the exact reported ray origin while a normal controller moves between snapshots",()=>{
  let now=0;const eyes=createPublishedPlayerEyes("game",()=>now);
  const first=eyes.record(10,1,0,origin);now+=17;
  eyes.record(11,1,0,{...origin,y:1.7497});
  expect(eyes.resolve(structuredClone(first),origin,11,1,0)).toEqual(origin);
});
it.each(["session","world","epoch","foreign origin","terrain revision","body revision","age","wrap","pause","warp","cold"])("rejects a changed binding: %s",change=>{
  let now=0;const eyes=createPublishedPlayerEyes("game",()=>now);
  const first=structuredClone(eyes.record(9,1,0,origin));let tick=9,terrain=1,moving=0,eye=origin;
  if(change==="session")Object.assign(first,{session:"other"});
  if(change==="world")Object.assign(first,{world:"other"});
  if(change==="epoch")Object.assign(first,{epoch:99});
  if(change==="foreign origin")eye={...origin,x:4};
  if(change==="terrain revision")terrain++;if(change==="body revision")moving++;
  if(change==="age")now+=1501;
  if(change==="wrap"){tick+=256;eyes.record(tick,terrain,moving,origin);}
  if(change==="pause")eyes.clear();
  if(change==="warp"){now+=16;tick++;eyes.record(tick,terrain,moving,{...origin,x:14});}
  const current=change==="cold"?createPublishedPlayerEyes("game",()=>now):eyes;
  expect(()=>current.resolve(first,eye,tick,terrain,moving)).toThrow();
});
