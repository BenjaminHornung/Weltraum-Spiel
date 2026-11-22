import type {Vector3} from "three";
import type {HvpTerrainSnapshot} from "./cutPlan";
import {pickHvpCell,type HvpCell} from "./picking";

export interface HvpRegionalCutCoveragePort {
  readonly readAim:()=>{origin:Vector3;direction:Vector3}|undefined;
  readonly request:(primary:HvpTerrainSnapshot,eyeX:number)=>Promise<HvpTerrainSnapshot|undefined>;
}

interface Feedback {
  readonly state:"PendingCoverage"|"ProtectedRegion"|"Miss"|"CoverageUnavailable"|"Cancelled";
  readonly reason:string;
}

/** An east region has a separate source owner. This command can resolve the saved
 * ray against confirmed material, but cannot write either regional source. */
export function createHvpRegionalCutRead(primary:()=>HvpTerrainSnapshot,port:HvpRegionalCutCoveragePort){
  let ticket:object|undefined,feedback:Feedback|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  const finish=(state:Feedback["state"],reason:string)=>{
    if(timer!==undefined){clearTimeout(timer);timer=undefined;}
    ticket=undefined;feedback={state,reason};
  };
  const cancel=()=>{
    if(ticket){finish("Cancelled","Abfrage der Ostregion abgebrochen");}
    else feedback=undefined;
  };
  return {
    cancel,
    read:()=>feedback,
    tryRequest():boolean {
      if(ticket)return true;
      const aim=port.readAim();if(!aim)return false;
      const base=primary();
      const origin:HvpCell=[aim.origin.x,aim.origin.y,aim.origin.z],direction:HvpCell=[aim.direction.x,aim.direction.y,aim.direction.z];
      const unknown=pickHvpCell(base,origin,direction);
      if(unknown.kind!=="Unknown")return false;
      const [x,y,z]=unknown.cell;
      if(x<base.sizeX||x>=2*base.sizeX||y<0||y>=base.sizeY||z<0||z>=base.sizeZ)return false;
      const current={};ticket=current;
      feedback={state:"PendingCoverage",reason:"Ostregion wird für diesen Zielstrahl geladen"};
      timer=setTimeout(()=>{if(ticket===current)finish("CoverageUnavailable","Ostregion für diesen Zielstrahl noch nicht bestätigt");},5000);
      void (async()=>{
        try{
          const east=await port.request(base,origin[0]);
          if(ticket!==current)return;
          if(base!==primary()){finish("Cancelled","Weltstand während der Abfrage geändert");return;}
          if(!east||east.epoch!==base.epoch||east.sessionId!==base.sessionId+":east"||east.cellMeters!==base.cellMeters||
            east.sizeX!==base.sizeX||east.sizeY!==base.sizeY||east.sizeZ!==base.sizeZ||
            east.originMeters.x!==base.originMeters.x+base.cellMeters*base.sizeX||
            east.originMeters.y!==base.originMeters.y||east.originMeters.z!==base.originMeters.z){
            finish("CoverageUnavailable","Ostregion für diesen Zielstrahl noch nicht bestätigt");return;
          }
          const hit=pickHvpCell({...base,sizeX:base.sizeX+east.sizeX,
            readSlot:(a,b,c)=>a<base.sizeX?base.readSlot(a,b,c):east.readSlot(a-base.sizeX,b,c)},origin,direction);
          if(hit.kind==="Hit"&&hit.cell[0]>=base.sizeX){finish("ProtectedRegion","Ziel in der Ostregion bestätigt. Dort ist Schneiden gesperrt.");}
          else if(hit.kind==="Miss"){finish("Miss","Kein Ziel innerhalb 4 m");}
          else{finish("CoverageUnavailable","Zielstrahl reicht über die bestätigte Abdeckung hinaus");}
        }catch{if(ticket===current)finish("CoverageUnavailable","Abdeckung der Ostregion konnte nicht bestätigt werden");}
      })();
      return true;
    },
  };
}
