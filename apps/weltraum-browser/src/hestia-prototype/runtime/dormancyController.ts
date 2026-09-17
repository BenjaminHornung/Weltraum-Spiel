import type {HvpPhysicsClient} from "../physics/client";
import type {HvpStagedTerrain} from "../terrain/terrainConsumer";

/** Native checkpoint before eviction; graphics and World change at a held tick. */
export const createHvpDormancyController=(options:{physics:Pick<HvpPhysicsClient,"read"|"prepareBodyResidency"|"commitBodyResidency"|"publishBodyResidency"|"finalizeBodyResidency"|"rollbackBodyResidency"|"command">;
  blocked:()=>boolean;current:()=>boolean;admit:()=>void;stage:(snapshot:ReturnType<HvpPhysicsClient["read"]>)=>HvpStagedTerrain})=>{
  let pending:Promise<void>|undefined,disposed=false,hold=false,error="",sequence=0,changes=0;
  const valid=()=>!disposed&&options.current();
  const run=async()=>{
    const id=`body-residency-${++sequence}`;let render:HvpStagedTerrain|undefined,prepared=false,finalized=false;
    try{
      options.admit();const candidate=await options.physics.prepareBodyResidency(id);prepared=true;
      if(!valid()){throw new Error("Residency owner disposed");}
      render=options.stage(candidate);await options.physics.commitBodyResidency(id);
      if(!valid()){throw new Error("Residency owner disposed before publication");}
      options.physics.publishBodyResidency(id);render.publish();
      await options.physics.finalizeBodyResidency(id);finalized=true;render.finish();changes+=1;
    }catch(failure){
      let restored=!finalized;
      if(!finalized){try{render?.rollback();}catch{restored=false;}
        if(prepared){try{await options.physics.rollbackBodyResidency(id);}catch{restored=false;}}}
      hold=!restored||String(failure).includes("RecoveryHold");error=String(failure);
      if(hold){try{await options.physics.command("Pause");}catch{/* No restoration claim. */}}
    }
  };
  return {
    update():void{
      if(!valid()||pending||hold||error||options.blocked()){return;}
      const s=options.physics.read(),p=s.player?.position;
      if(!p||s.status!=="Running"||s.player?.status!=="Walking"||s.bodyResidencyTransaction!=="Idle"){return;}
      const distance=(q:Readonly<{x:number;z:number}>)=>Math.hypot(q.x-p.x,q.z-p.z);
      const terrain=new Set(s.terrainFragments.map(f=>f.ownerId));
      if(!s.parked.some(b=>distance(b.position)<12)&&!s.bodies.some(b=>terrain.has(b.ownerId)&&b.sleeping&&distance(b.position)>18)){return;}
      pending=run().finally(()=>{pending=undefined;});
    },
    read:()=>Object.freeze({busy:pending!==undefined,recoveryHold:hold,error,changes}),
    retry(){if(!hold&&!pending){error="";}},
    async dispose(){disposed=true;await pending;}
  };
};
