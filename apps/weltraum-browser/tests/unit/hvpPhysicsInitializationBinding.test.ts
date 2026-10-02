import {expect,it,vi} from "vitest";
import {HVP_PHYSICS_PROTOCOL} from "../../src/hestia-prototype/physics/physicsProtocol";
import type {HvpPhysicsMessage,HvpPhysicsReply,HvpPhysicsSnapshot} from "../../src/hestia-prototype/physics/physicsWorker";
import type {HvpPhysicsSession} from "../../src/hestia-prototype/physics/session";

// Real Worker handler, synthetic deferred session factory: transport/lifecycle proof, not native physics.
it.each([false,true])("binds Initialize before await and never rebinds for foreign startup (dispose=%s)",async disposeDuringInit=>{
  vi.resetModules();
  let finish!:()=>void;
  let sessionDisposed=false;
  const dispose=vi.fn(()=>{sessionDisposed=true;});
  const session={dispose,terrainPrepareSpans:()=>undefined,bodyPrepareSpans:()=>undefined,
    read:()=>({status:sessionDisposed?"Disposed":"Running",bodyCount:sessionDisposed?0:1,colliderCount:0} as HvpPhysicsSnapshot)} as unknown as HvpPhysicsSession;
  const create=vi.fn(()=>new Promise<HvpPhysicsSession>(resolve=>{finish=()=>resolve(session);}));
  vi.doMock("../../src/hestia-prototype/physics/session",()=>({createHvpWorkerPhysicsSession:create}));
  const saved={onmessage:Object.getOwnPropertyDescriptor(globalThis,"onmessage"),postMessage:Object.getOwnPropertyDescriptor(globalThis,"postMessage")};
  const host=globalThis as typeof globalThis&{onmessage?:(event:MessageEvent<HvpPhysicsMessage>)=>Promise<void>;postMessage?:(reply:HvpPhysicsReply)=>void};
  const replies:HvpPhysicsReply[]=[];
  const interval=vi.spyOn(globalThis,"setInterval").mockReturnValue(1 as unknown as ReturnType<typeof setInterval>);
  const clear=vi.spyOn(globalThis,"clearInterval").mockImplementation(()=>undefined);
  let initializing:Promise<void>|undefined;
  const binding={protocol:HVP_PHYSICS_PROTOCOL,incarnation:"startup-owner"} as const;
  try{
    host.postMessage=reply=>{replies.push(reply);};
    await import("../../src/hestia-prototype/physics/physicsWorker");
    const send=(message:HvpPhysicsMessage)=>host.onmessage!({data:message} as MessageEvent<HvpPhysicsMessage>);
    const initialize:HvpPhysicsMessage={...binding,id:1,kind:"Initialize",sectors:[],spawn:{x:0,y:1,z:0},gravity:9.81,sessionId:"startup"};
    const incompatible={...initialize,id:0};Reflect.set(incompatible,"protocol","hvp-physics-owner-v2");
    await send(incompatible);
    expect(replies.at(-1)).toMatchObject({id:0,rejected:"Invalid physics initialization binding",incarnation:binding.incarnation});
    expect(create).not.toHaveBeenCalled();
    initializing=send(initialize);
    expect(create).toHaveBeenCalledTimes(1);expect(replies).toHaveLength(1);
    await send({...binding,id:2,kind:"Dispose",incarnation:"foreign-owner"});
    expect(replies.at(-1)).toMatchObject({id:2,rejected:"Invalid physics message binding",incarnation:"foreign-owner"});
    const mixed:HvpPhysicsMessage={...binding,id:3,kind:"Initialize",sectors:[],spawn:{x:0,y:1,z:0},gravity:9.81,sessionId:"mixed"};
    Reflect.set(mixed,"protocol","hvp-physics-owner-v2");
    await send(mixed);
    expect(replies.at(-1)).toMatchObject({id:3,rejected:"Invalid physics message binding",incarnation:binding.incarnation});
    expect(create).toHaveBeenCalledTimes(1);expect(dispose).not.toHaveBeenCalled();
    if(disposeDuringInit){await send({...binding,id:4,kind:"Dispose"});}
    finish();await initializing;
    const reply=replies.find(r=>r.id===1)!;
    expect(reply).toMatchObject({...binding,snapshot:{status:disposeDuringInit?"Disposed":"Running"},clock:{timers:disposeDuringInit?0:1}});
    expect(reply.sequence).toBeGreaterThan(replies.find(r=>r.id===3)!.sequence);
    expect(dispose).toHaveBeenCalledTimes(disposeDuringInit?1:0);
    if(!disposeDuringInit){await send({...binding,id:5,kind:"Dispose"});expect(dispose).toHaveBeenCalledTimes(1);}
  }finally{
    finish?.();await initializing?.catch(()=>undefined);
    interval.mockRestore();clear.mockRestore();
    if(saved.onmessage===undefined){Reflect.deleteProperty(globalThis,"onmessage");}else{Object.defineProperty(globalThis,"onmessage",saved.onmessage);}
    if(saved.postMessage===undefined){Reflect.deleteProperty(globalThis,"postMessage");}else{Object.defineProperty(globalThis,"postMessage",saved.postMessage);}
    vi.doUnmock("../../src/hestia-prototype/physics/session");vi.resetModules();
  }
});
