/** Opt-in User Timing, observable without commands or a gameplay TestBridge. */
export const createHvpMeasurements=(enabled:boolean,clock:Pick<Performance,"now"|"timeOrigin"|"measure"|"clearMeasures">=performance)=>{
  let samples=0,errors=0,dropped=0;
  const record=(metric:string,start:number,duration:number,detail?:unknown):void=>{
    if(!enabled){return;}
    if(!/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(metric)||!Number.isFinite(start)||start<0||!Number.isFinite(duration)||duration<0){errors+=1;return;}
    const name=`hvp.${metric}`;
    try{
      clock.measure(name,{start,duration,detail:{sampleId:`${metric}:${samples}`,data:detail}});samples+=1;
      // Observers receive queued entries; the application timeline does not grow.
      clock.clearMeasures(name);
    }catch{errors+=1;}
  };
  return {
    enabled,record,
    worker(batch:{origin:number;steps:readonly (readonly[number,number])[];dropped:number}):void{
      if(!enabled){return;}
      if(!batch||!Number.isFinite(batch.origin)||!Number.isSafeInteger(batch.dropped)||batch.dropped<0
        ||!Array.isArray(batch.steps)||batch.steps.length>1024){errors+=1;return;}
      dropped+=batch.dropped;
      for(const step of batch.steps){
        if(!Array.isArray(step)||step.length!==2){errors+=1;continue;}
        record("solverStepCpuMs",batch.origin-clock.timeOrigin+step[0],step[1]);
      }
    },
    read:()=>Object.freeze({enabled,samples,errors,dropped})
  };
};
