import {expect,it,vi} from "vitest";
import {createHvpChunkPoolObservation} from "../../src/hestia-prototype/terrain/terrainProducts";
import {workerJobId,workerEpoch} from "../../src/workers/ids";

it("contains two overlapping jobs in fixed queue/transport/acceptance aggregates",()=>{
  const now=vi.spyOn(performance,"now");let time=0;now.mockImplementation(()=>++time);
  try{
    const observation=createHvpChunkPoolObservation(),a=workerJobId("a"),b=workerJobId("b");
    observation.observe({type:"Queued",jobId:a,queueDepth:1});
    observation.observe({type:"Queued",jobId:b,queueDepth:2});
    observation.observe({type:"Dispatched",jobId:a,workerEpoch:workerEpoch(1),inputBytes:1});
    observation.observe({type:"Dispatched",jobId:b,workerEpoch:workerEpoch(1),inputBytes:1});
    observation.observe({type:"OutputTransferred",jobId:b,outputBytes:1});
    observation.observe({type:"Completed",jobId:b,outputBytes:1});
    observation.observe({type:"OutputTransferred",jobId:a,outputBytes:1});
    observation.observe({type:"Completed",jobId:a,outputBytes:1});
    expect(observation.read(2)).toEqual({jobs:2,queuedMs:4,workerTransportMs:5,acceptanceMs:2,complete:true});
    expect(Object.isFrozen(observation.read(2))).toBe(true);expect(observation.read(3).complete).toBe(false);
  }finally{now.mockRestore();}
});

it.each(["third","duplicate","missing","order","cancel","clock"] as const)("fails closed on %s observation without throwing into the pool",kind=>{
  const now=vi.spyOn(performance,"now").mockReturnValue(1);
  try{
    const observation=createHvpChunkPoolObservation(),a=workerJobId("a");
    if(kind==="clock"){now.mockImplementation(()=>{throw new Error("clock failure");});}
    expect(()=>{
      if(kind!=="missing"){observation.observe({type:"Queued",jobId:a,queueDepth:1});}
      if(kind==="third"){for(const id of ["b","c"]){observation.observe({type:"Queued",jobId:workerJobId(id),queueDepth:2});}}
      else if(kind==="duplicate"){observation.observe({type:"Queued",jobId:a,queueDepth:1});}
      else if(kind==="cancel"){observation.observe({type:"Cancelled",jobId:a});}
      else{observation.observe({type:"Completed",jobId:a,outputBytes:1});}
    }).not.toThrow();
    expect(observation.read(1).complete).toBe(false);
  }finally{now.mockRestore();}
});
