import {afterEach,expect,it,vi} from "vitest";
import {createHvpBodyMeshTaskPump} from "../../src/workers/hvpBoundedPump";
afterEach(()=>vi.unstubAllGlobals());
it("posts one cancellable input task per yield and refuses late delivery after disposal",async()=>{
  let next:(()=>void)|undefined,signal:AbortSignal|undefined;
  const postTask=vi.fn((resume:()=>void,options:{priority:string;signal:AbortSignal})=>{
    expect(options.priority).toBe("user-blocking");
    next=resume;signal=options.signal;
    return Promise.resolve();
  });
  vi.stubGlobal("scheduler",{postTask});
  const pump=createHvpBodyMeshTaskPump(()=>{},undefined,true);
  const first=pump.host.yieldTask();next!();await first;
  const second=pump.host.yieldTask();pump.dispose();
  expect(signal!.aborted).toBe(true);
  await expect(second).rejects.toThrow("disposed");
  next!();expect(postTask).toHaveBeenCalledTimes(2);
});
it("uses a task port when the platform scheduler is unavailable",async()=>{
  vi.stubGlobal("scheduler",undefined);
  const pump=createHvpBodyMeshTaskPump(()=>{},undefined,true);
  try{await pump.host.yieldTask();expect(pump.host.continuePlan()).toBe(true);}finally{pump.dispose();}
});
