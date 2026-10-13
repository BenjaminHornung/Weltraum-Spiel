export function createSingleFlight<T extends {dispose():void}>(factory:(signal:AbortSignal)=>Promise<T>){
 let pending:Promise<T>|null=null,ready:T|null=null,controller:AbortController|null=null,disposed=false;
 return {
  get busy(){return pending!==null;},
  load():Promise<T>{
   if(disposed)return Promise.reject(Error('INIT_DISPOSED'));
   if(ready)return Promise.resolve(ready);
   if(pending)return pending;
   controller=new AbortController();const signal=controller.signal;
   pending=Promise.resolve().then(()=>factory(signal)).then(value=>{
    if(disposed||signal.aborted){value.dispose();throw Error('INIT_CANCELLED');}ready=value;return value;
   }).finally(()=>{pending=null;controller=null;});
   return pending;
  },
  async dispose(){if(disposed)return;disposed=true;controller?.abort();await pending?.catch(()=>{});ready?.dispose();ready=null;}
 };
}
