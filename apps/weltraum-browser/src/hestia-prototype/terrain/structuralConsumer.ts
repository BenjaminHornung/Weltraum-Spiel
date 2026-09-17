import type {HvpPhysicsClient} from "../physics/client";
import type {HvpBranchRequest} from "../physics/branchSession";
import type {HvpBranchSnapshot} from "../presentation/structuralPart";
import {decodeHvpReceipts,type HvpSimpleOutcome} from "../persistence/receiptCheckpoint";

export interface HvpStagedBranch {publish():void;rollback():void;finish():void}
/** Same-tick visual publication while the actual single World remains held. */
export const createHvpStructuralConsumer=(physics:HvpPhysicsClient,stageRender:(state:HvpBranchSnapshot)=>HvpStagedBranch)=>{
  let pending=false,hold=false,disposed=false;
  let last:Readonly<{status:string;reason:string;id:string}>|null=null;
  const receipts=new Map<string,{signature:string;promise:Promise<void>;outcome?:HvpSimpleOutcome}>();
  return {
    checkpoint(){
      if(pending||hold||disposed){throw new Error("Structural commands are not at a save boundary");}
      return decodeHvpReceipts({version:"hvp-command-receipts-v1",kind:"structural",
        entries:[...receipts].map(([id,r])=>({id,signature:r.signature,outcome:r.outcome})),last},"structural");
    },
    restoreReceipts(value:unknown):void{
      if(pending||hold||disposed){throw new Error("Structural commands are not at a restore boundary");}
      const saved=decodeHvpReceipts(value,"structural");receipts.clear();
      for(const r of saved.entries){receipts.set(r.id,{signature:r.signature,promise:Promise.resolve(),outcome:r.outcome});}last=saved.last;
    },
    submit(input:HvpBranchRequest):Promise<void>{
      if(!/^[A-Za-z0-9:._-]{1,128}$/.test(input.id)||!Number.isSafeInteger(input.generation)||input.generation<0
        ||typeof input.sourceDigest!=="string"||input.sourceDigest.length>128
        ||![input.direction.x,input.direction.y,input.direction.z].every(Number.isFinite)
        ||Math.abs(Math.hypot(input.direction.x,input.direction.y,input.direction.z)-1)>1e-6){return Promise.reject(new Error("Invalid structural request"));}
      const request={id:input.id,generation:input.generation,sourceDigest:input.sourceDigest,direction:{x:input.direction.x,y:input.direction.y,z:input.direction.z}};
      const signature=JSON.stringify(request),old=receipts.get(request.id);
      if(old){return old.signature===signature?old.promise:Promise.reject(new Error("Structural command id conflict"));}
      if(disposed||hold||pending||receipts.size>=256){return Promise.reject(new Error(hold?"RecoveryHold":"Structural Pending/backpressure"));}
      pending=true;
      const promise=(async()=>{
        let prepared=false,finished=false,render:HvpStagedBranch|undefined;
        try {
          const products=await physics.prepareBranch(request);prepared=true;
          if(disposed){throw new Error("Structural consumer disposed");}
          render=stageRender(products);await physics.commitBranch(request.id);
          if(disposed){throw new Error("Structural consumer disposed");}
          physics.publishBranch();render.publish();
          await physics.finalizeBranch(request.id);finished=true;render.finish();
          last=Object.freeze({id:request.id,status:"Applied",reason:"Canonical split and actual World published"});
        }catch(error){
          let restored=!finished;
          if(!finished){
            try{render?.rollback();}catch{restored=false;}
            // Restore graphics before the worker can resume the old World.
            if(prepared){try{await physics.rollbackBranch(request.id);}catch{restored=false;}}
          }
          try {if(physics.read().structural?.state==="RecoveryHold"){restored=false;}}catch{restored=false;}
          if(!restored) {hold=true;try{await physics.command("Pause");}catch{/* World unavailable: do not report restoration. */}}
          last=Object.freeze({id:request.id,status:hold?"RecoveryHold":"Rejected",reason:error instanceof Error?error.message:String(error)});
        }finally{const receipt=receipts.get(request.id);if(receipt&&last){receipt.outcome=last;}pending=false;}
      })();
      receipts.set(request.id,{signature,promise,...(!pending&&last?.id===request.id?{outcome:last}:{})});return promise;
    },
    read:()=>Object.freeze({state:hold?"RecoveryHold":pending?"Pending":"Ready",issued:receipts.size,last}),
    dispose():void{disposed=true;}
  };
};
