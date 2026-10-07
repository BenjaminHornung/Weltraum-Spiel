/** HVP-only mapper: refill at most two lanes, but drain every started callback on failure. */
export async function runHvpBounded<T, R>(
  items: readonly T[],
  parallel: number,
  run: (item: T, index: number) => Promise<R>,
  onFailure: (error: unknown) => void = () => {}
): Promise<R[]> {
  if (!Number.isInteger(parallel) || parallel < 1 || parallel > 2) {
    throw new Error("Invalid HVP concurrency");
  }
  const results = new Array<R>(items.length);
  let cursor = 0, failed = false;
  let firstError: unknown;
  const lane = async (): Promise<void> => {
    while (!failed && cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await run(items[index]!, index);
      } catch (error) {
        if (!failed) {
          failed = true;
          firstError = error;
          try { onFailure(error); } catch { /* Cancellation cannot replace the first failure. */ }
        }
        return;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, items.length) }, lane));
  if (failed) { throw firstError; }
  return results;
}

/** Private first-party body work: real task ports, 2ms quantum and bounded cursor cleanup. */
export const createHvpBodyMeshTaskPump=(assertCurrent:()=>void,observe?:((label:string,start:number,duration:number)=>void))=>{
  let disposed=false,channel:MessageChannel|undefined,waiting:{resolve:()=>void;reject:(error:Error)=>void}|undefined;
  let sliceStart=performance.now(),units=0;
  const current=()=>{if(disposed){throw new Error("Body mesh task pump disposed");}assertCurrent();};
  const host={assertCurrent:current,continuePlan:()=>++units<4096&&performance.now()-sliceStart<2,
    yieldTask:()=>new Promise<void>((resolve,reject)=>{
      current();if(waiting!==undefined){reject(new Error("Concurrent body mesh task yield"));return;}
      if(channel===undefined){channel=new MessageChannel();channel.port1.onmessage=()=>{
        const task=waiting;waiting=undefined;sliceStart=performance.now();units=0;task?.resolve();
      };}
      waiting={resolve,reject};channel.port2.postMessage(0);
    })};
  return {host,async run<T>(steps:Generator<string,T,unknown>):Promise<T>{
    let failed=false;
    try{for(;;){
      current();const start=observe===undefined?0:performance.now(),step=steps.next();
      if(observe!==undefined){try{observe(step.done?"meshComplete":step.value,start,performance.now()-start);}catch{observe=undefined;}}
      if(step.done){return step.value;}
      if(!host.continuePlan()){await host.yieldTask();}
    }}catch(error){failed=true;throw error;}
    finally{try{steps.return(undefined as never);}catch(error){if(!failed){throw error;}}}
  },dispose():void {
    if(disposed){return;}disposed=true;
    channel?.port1.close();channel?.port2.close();channel=undefined;
    const task=waiting;waiting=undefined;task?.reject(new Error("Body mesh task pump disposed"));
  }};
};
