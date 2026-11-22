import {sameCompactBinding} from "./compactTerrainApply";
import type {HvpMovingForward,HvpTerrainBinding,HvpTerrainMotion} from "./session";

/** The transferred endpoint orders the two records independently of the ordinary ACK. */
export function readMovingPublication(port:MessagePort,id:number,incarnation:string,binding:HvpTerrainBinding,worldId:string){
  type Record={base:HvpTerrainMotion;forward?:HvpMovingForward};
  return new Promise<Record>((resolve,reject)=>{
    let base:HvpTerrainMotion|undefined;
    const close=()=>{port.removeEventListener("close",closed);port.onmessage=null;port.close();clearTimeout(timer);};
    const fail=()=>{close();reject(new Error("RecoveryHold: moving publication witness unavailable"));};
    const closed=()=>{if(base){close();resolve({base});}else fail();};
    const timer=setTimeout(fail,20_000);
    port.addEventListener("close",closed);
    port.onmessage=({data})=>{
      const motion=(data?.kind==="Forward"?data.forward?.motion:data?.motion) as HvpTerrainMotion|undefined;
      if(data?.id!==id||data.incarnation!==incarnation||!motion||!sameCompactBinding(motion.binding,binding)
        ||motion.worldId!==worldId||motion.revision!==binding.baseRevision||motion.tick.status!=="Paused"){fail();return;}
      if(data.kind==="Base"&&!base){base=motion;return;}
      const forward=data.forward as HvpMovingForward|undefined;
      if(data.kind==="Forward"&&base&&forward&&forward.motion.tick.ticks===base.tick.ticks
        &&forward.checkpoint.last?.id===binding.commandId&&forward.checkpoint.last.status==="Applied"){
        close();resolve({base,forward});return;
      }
      fail();
    };
  });
}
