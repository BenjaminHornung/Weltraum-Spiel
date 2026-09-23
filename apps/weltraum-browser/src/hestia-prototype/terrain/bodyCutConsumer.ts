import type {HvpPhysicsClient} from "../physics/client";
import type {HvpMovingCutRequest,HvpMovingCutPreparation} from "../physics/bodyCutSession";
import type {HvpBodyCutProducts} from "../../workers/hvpBodyCutJob";
import type {HvpStagedTerrain} from "./terrainConsumer";
import {decodeHvpReceipts,type HvpSimpleOutcome} from "../persistence/receiptCheckpoint";
import type {HvpCutTrace} from "../runtime/cutTrace";

/** The local worker does not pause or own a moving parent. Only the commit does. */
export const createHvpBodyCutConsumer=(physics:HvpPhysicsClient,compile:(source:HvpMovingCutPreparation)=>Promise<HvpBodyCutProducts>,
  stage:(parentId:string,products:HvpBodyCutProducts)=>HvpStagedTerrain,traceInput?:HvpCutTrace)=>{
  let disposed=false,busy=false,held=false;
  let trace=traceInput;
  const emit=(id:string,phase:string,start?:number):number|undefined=>{
    let now:number|undefined;
    if(trace){try{now=performance.now();trace({commandId:id,thread:"main",phase,origin:performance.timeOrigin,
      start:start??now,duration:start===undefined?0:now-start});}catch{/* Observation cannot change the command. */}}
    return now;
  };
  let last:Readonly<{id:string;status:string;reason:string}>|null=null;
  const receipts=new Map<string,{signature:string;promise:Promise<void>;outcome?:HvpSimpleOutcome}>();
  return {
    read:()=>Object.freeze({state:held?"RecoveryHold":busy?"Pending":"Idle",last,issued:receipts.size}),
    checkpoint(){
      if(busy||held||disposed){throw new Error("Moving commands are not at a save boundary");}
      return decodeHvpReceipts({version:"hvp-command-receipts-v1",kind:"moving",
        entries:[...receipts].map(([id,r])=>({id,signature:r.signature,outcome:r.outcome})),last},"moving");
    },
    restoreReceipts(value:unknown):void{
      if(busy||held||disposed){throw new Error("Moving commands are not at a restore boundary");}
      const saved=decodeHvpReceipts(value,"moving");receipts.clear();
      for(const r of saved.entries){receipts.set(r.id,{signature:r.signature,promise:Promise.resolve(),outcome:r.outcome});}last=saved.last;
    },
    submit(input:HvpMovingCutRequest):Promise<void>{
      if(!input||![input.id,input.ownerId,input.sourceDigest].every(v=>typeof v==="string"&&v.length>0&&v.length<=128)
        ||(input.brush!==undefined&&input.brush!=="Box"&&input.brush!=="Sphere")
        ||!input.direction||![input.direction.x,input.direction.y,input.direction.z].every(Number.isFinite)
        ||Math.abs(Math.hypot(input.direction.x,input.direction.y,input.direction.z)-1)>1e-6||!Number.isSafeInteger(input.edge)||input.edge<1||input.edge>8){
        return Promise.reject(new Error("Invalid moving intent"));
      }
      const request={id:input.id,ownerId:input.ownerId,sourceDigest:input.sourceDigest,edge:input.edge,direction:{x:input.direction.x,y:input.direction.y,z:input.direction.z},
        ...(input.brush==="Sphere"?{brush:"Sphere" as const}:{})};
      const signature=JSON.stringify(request),old=receipts.get(request.id);
      if(old){return old.signature===signature?old.promise:Promise.reject(new Error("Moving command id conflict"));}
      if(disposed||busy||held||receipts.size>=256){
        const error=new Error(held?"RecoveryHold":"Moving cut Pending or disposed");
        const submitted=emit(request.id,"cutBodySubmittedMs");
        if(submitted!==undefined){emit(request.id,held?"cutBodyTotalRecoveryHoldMs":"cutBodyTotalRejectedMs",submitted);}
        return Promise.reject(error);
      }
      busy=true;
      const submitted=emit(request.id,"cutBodySubmittedMs");
      const promise=(async()=>{
        let begun=false,finished=false,render:HvpStagedTerrain|undefined;
        try{
          const source=await physics.beginBodyCut(request);begun=true;
          const products=await compile(source);
          if(disposed){throw new Error("Moving preparation cancelled");}
          render=stage(request.ownerId,products); // New local geometry stays hidden.
          await physics.stageBodyCut(request.id,products); // Now hold CURRENT pose/motion.
          if(disposed){throw new Error("Moving commit cancelled");}
          await physics.commitBodyCut(request.id);
          if(disposed){throw new Error("Moving publication cancelled");}
          physics.publishBodyCut();render.publish();
          await physics.finalizeBodyCut(request.id);finished=true;
          render.finish();last=Object.freeze({id:request.id,status:"Applied",reason:"Current-pose fragment replacement"});
          if(submitted!==undefined){emit(request.id,"cutBodyTotalAppliedMs",submitted);}
        }catch(error){
          let restored=!finished;
          if(!finished){
            try{render?.rollback();}catch{restored=false;}
            if(begun){try{await physics.rollbackBodyCut(request.id);}catch{restored=false;}}
          }
          try{if(physics.read().moving.state==="RecoveryHold"){restored=false;}}catch{restored=false;}
          if(!restored){held=true;try{await physics.command("Pause");}catch{/* Never assert restoration without the World. */}}
          last=Object.freeze({id:request.id,status:held?"RecoveryHold":"Rejected",reason:String(error)});
          if(submitted!==undefined){emit(request.id,held?"cutBodyTotalRecoveryHoldMs":"cutBodyTotalRejectedMs",submitted);}
        }finally{const receipt=receipts.get(request.id);if(receipt&&last){receipt.outcome=last;}busy=false;}
      })();
      receipts.set(request.id,{signature,promise,...(!busy&&last?.id===request.id?{outcome:last}:{})});return promise;
    },
    disableTrace():void {trace=undefined;},
    dispose():void {disposed=true;trace=undefined;}
  };
};
