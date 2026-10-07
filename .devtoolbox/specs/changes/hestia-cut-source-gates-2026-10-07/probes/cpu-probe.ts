// Diagnostic only: public CDP V8 sampling and actual postMessage transfer lists.
// No raw profiles, target URLs, message payloads or voxel buffers are persisted.
import type {Page} from '../../../../../apps/weltraum-browser/node_modules/@playwright/test';

const hook=`(()=>{if(globalThis.CutProbeWire)return;globalThis.CutProbeWire={calls:0,arrayBufferBytes:0,arrayBuffers:0};
 const port=typeof document==='undefined'?globalThis:Worker.prototype,original=port.postMessage;
 port.postMessage=function(...args){const options=args[1],list=Array.isArray(options)?options:options?.transfer??[];
 let bytes=0,buffers=0;for(const item of list){if(item instanceof ArrayBuffer){bytes+=item.byteLength;buffers++;}}
 const result=Reflect.apply(original,port===globalThis?globalThis:this,args);const s=globalThis.CutProbeWire;s.calls++;s.arrayBufferBytes+=bytes;s.arrayBuffers+=buffers;return result;};})()`;
const clear=`globalThis.CutProbeWire={calls:0,arrayBufferBytes:0,arrayBuffers:0}`;
const path=(url:string)=>{if(/\/physicsWorker-[^/]+\.js/.test(url)){return '/physics/physicsWorker.ts (built asset)';}
  if(/\/streamingWorker-[^/]+\.js/.test(url)){return '/workers/streamingWorker.ts (built asset)';}
  const index=url.indexOf('/src/');return index<0?'runtime-or-dependency':url.slice(index).split('?')[0]!;};
export async function createCutCpuProbe(page:Page){
  const cdp=await page.context().newCDPSession(page),failures:string[]=[];
  const pending=new Map<string,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  let serial=0,active=false,nativeCloseRequested=false,nativeExitObserved=false;
  const threads=new Map<string,{role:string;send:(method:string,params?:any)=>Promise<any>;started:boolean}>();
  threads.set('main',{role:'main',send:(method,params)=>cdp.send(method as any,params),started:false});
  const setups=new Set<Promise<void>>();
  cdp.on('Target.receivedMessageFromTarget',(event:any)=>{const message=JSON.parse(event.message),key=event.sessionId+':'+message.id,waiter=pending.get(key);
    if(waiter){pending.delete(key);clearTimeout(waiter.timer);if(message.error){waiter.reject(new Error('CDP '+message.error.code));}else{waiter.resolve(message.result);}}});
  cdp.on('Target.detachedFromTarget',(event:any)=>{const thread=threads.get(event.sessionId);
    if(nativeCloseRequested&&thread?.role.includes('/physics/physicsWorker.ts')){nativeExitObserved=true;}
    if(thread?.started){failures.push(thread.role+':DetachedDuringCapture');}threads.delete(event.sessionId);
    for(const [key,waiter] of pending){if(key.startsWith(event.sessionId+':')){pending.delete(key);clearTimeout(waiter.timer);waiter.reject(new Error('Worker target retired'));}}});
  cdp.on('Target.attachedToTarget',(event:any)=>{
    const send=(method:string,params:any={})=>new Promise<any>((resolve,reject)=>{const id=++serial,key=event.sessionId+':'+id;
      const timer=setTimeout(()=>{pending.delete(key);reject(new Error('CDP reply timeout'));},10000);pending.set(key,{resolve,reject,timer});
      void cdp.send('Target.sendMessageToTarget',{sessionId:event.sessionId,message:JSON.stringify({id,method,params})}).catch(error=>{
        pending.delete(key);clearTimeout(timer);reject(error);});});
    const task=(async()=>{try{
      if(event.targetInfo.type==='worker'){
        const thread={role:'worker-'+(threads.size)+' '+path(event.targetInfo.url??''),send,started:false};threads.set(event.sessionId,thread);
        await send('Profiler.enable');await send('Profiler.setSamplingInterval',{interval:1000});await send('Runtime.evaluate',{expression:hook});
        if(active){await send('Profiler.start');thread.started=true;}
      }
    }catch(error){failures.push('worker-setup:'+(error instanceof Error?error.name:'Unknown'));}
    finally{await send('Runtime.runIfWaitingForDebugger').catch(()=>failures.push('worker-resume:Unsupported'));}})();
    setups.add(task);void task.finally(()=>setups.delete(task));
  });
  await page.addInitScript(hook);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});
  await cdp.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:false});
  return {
    nativeFaultObserved:()=>nativeExitObserved,
    async closeNativeWorkerUnexpectedly(){const native=[...threads.values()].find(t=>t.role.includes('/physics/physicsWorker.ts'));
      if(!native){throw new Error('Actual native worker target missing');}
      nativeCloseRequested=true;await native.send('Runtime.evaluate',{expression:'setTimeout(()=>self.close(),0)'});},
    async begin(){active=true;await Promise.all([...setups]);for(const thread of threads.values()){
      try{await thread.send('Runtime.evaluate',{expression:clear});if(!thread.started){await thread.send('Profiler.start');thread.started=true;}}
      catch(error){failures.push(thread.role+':BeginUnsupported');}}},
    async end(){active=false;await Promise.all([...setups]);const results=[];
      for(const thread of threads.values()){if(!thread.started){continue;}thread.started=false;
        try{const wire=(await thread.send('Runtime.evaluate',{expression:'globalThis.CutProbeWire',returnByValue:true})).result.value;
          const profile=(await thread.send('Profiler.stop')).profile;
          const nodes=new Map<number,any>(profile.nodes.map((node:any)=>[node.id,node.callFrame])),self=new Map<string,number>();
          for(let i=0;i<(profile.samples??[]).length;i++){const node=nodes.get(profile.samples[i]);if(!node){continue;}
            const key=(node.functionName||'(anonymous)')+' '+path(node.url??'');self.set(key,(self.get(key)??0)+(profile.timeDeltas[i]??0)/1000);}
          results.push({role:thread.role,status:'SAMPLED',intervalMicroseconds:1000,profileWallMs:(profile.endTime-profile.startTime)/1000,
            samples:profile.samples?.length??0,selfSampleMs:[...self].map(([functionAndSource,ms])=>({functionAndSource,ms})).sort((a,b)=>b.ms-a.ms),
            transport:wire,transportScope:'ArrayBuffer backing bytes in successful outgoing postMessage transfer lists; strings/structured clones/physical IPC bytes unsupported'});
        }catch(error){failures.push(thread.role+':'+(error instanceof Error?error.name:'Unknown'));results.push({role:thread.role,status:'UNSUPPORTED'});}}
      return {classification:'separate-profile-diagnostic',method:'V8 leaf self samples; approximate attribution, not exact CPU clock',threads:results,failures:[...failures]};},
    async dispose(){active=false;await cdp.send('Target.setAutoAttach',{autoAttach:false,waitForDebuggerOnStart:false,flatten:false});
      for(const waiter of pending.values()){clearTimeout(waiter.timer);waiter.reject(new Error('Probe disposed'));}pending.clear();await cdp.detach();}
  };
}
