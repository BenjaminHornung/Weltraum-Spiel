/** Attempt every owned release; preserve each failure instead of abandoning later resources. */
export function disposeOwned(actions:readonly (()=>void)[]){
 const errors:unknown[]=[];for(const action of [...actions].reverse())try{action();}catch(error){errors.push(error);}
 if(errors.length)throw new AggregateError(errors,'ATM_CLEANUP_FAILED');
}
export async function disposeOwnedAsync(actions:readonly (()=>void|Promise<void>)[]){
 const errors:unknown[]=[];for(const action of [...actions].reverse())try{await action();}catch(error){errors.push(error);}
 if(errors.length)throw new AggregateError(errors,'ATM_CLEANUP_FAILED');
}
export function createSingleFlight<T extends {dispose():void}>(factory:(signal:AbortSignal)=>Promise<T>){
 let pending:Promise<T>|null=null,ready:T|null=null,controller:AbortController|null=null,disposed=false,cancelReleaseError:{error:unknown}|null=null;
 return {
  get busy(){return pending!==null;},
  load():Promise<T>{
   if(disposed)return Promise.reject(Error('INIT_DISPOSED'));
   if(ready)return Promise.resolve(ready);
   if(pending)return pending;
   controller=new AbortController();const signal=controller.signal;
   pending=Promise.resolve().then(()=>factory(signal)).then(value=>{
    if(disposed||signal.aborted){try{value.dispose();}catch(error){cancelReleaseError={error};throw error;}throw Error('INIT_CANCELLED');}ready=value;return value;
   }).finally(()=>{pending=null;controller=null;});
   return pending;
  },
  async dispose(){if(disposed)return;disposed=true;controller?.abort();await pending?.catch(()=>{});const value=ready;ready=null;if(cancelReleaseError)throw cancelReleaseError.error;value?.dispose();}
 };
}
