import { Vector3 } from "three";
import { pickHvpCell, type HvpCell } from "./picking";
import { assertHvpSafeQuarry, selectHvpCutCells, type HvpCutShape, createHvpTerrainRoot } from "./cutPlan";
import type { createHvpTerrainConsumer } from "./terrainConsumer";
import type {HvpPhysicsClient} from "../physics/client";
import type {createHvpStructuralConsumer} from "./structuralConsumer";
import {isHvpRockArmCut} from "./terrainTransfer";
import type {createHvpBodyCutConsumer} from "./bodyCutConsumer";
import type {HvpToolCheckpoint} from "../persistence/gameCheckpoint";

/** Canonical intent only: no mouse ray ever edits a render buffer or collider. */
export const createHvpPlasmaTool = (root: ReturnType<typeof createHvpTerrainRoot>,
  consumer: ReturnType<typeof createHvpTerrainConsumer>,
  readAim: () => {origin:Vector3;direction:Vector3}|undefined,
  preview: (cells:readonly HvpCell[], allowed:boolean)=>void,
   supports: readonly Readonly<{x:number;z:number}>[],
   structure?:{physics:HvpPhysicsClient;consumer:ReturnType<typeof createHvpStructuralConsumer>;admit:()=>void},
   moving?:ReturnType<typeof createHvpBodyCutConsumer>) => {
  let mode=1, sequence=0, key="", target:HvpCutShape|undefined, message="Spielen: 1 Zelle · 2 Box · 3 Kugel · Linksklick";
  let edges=0;
  let structureSequence=0;
  let movingSequence=0;
  const request=(shape:HvpCutShape,id:string)=>{
    const s=root.read();
    return {sessionId:s.sessionId,epoch:s.epoch,revision:s.revision,sourceDigest:s.sourceDigest,
      commandId:id,toolPolicy:"hvp-plasma-v1" as const,shape};
  };
  const update=():void=>{
    const aim=readAim();
    structure?.physics.setCutAim(aim?.direction);
    if(!aim) { if(key!=="") { preview([],false);key=""; }target=undefined;return; }
    const state=structure?.physics.read(),body=state?.moving?.preview,branch=state?.structural;
    if(body&&moving){
      target=undefined;const next=JSON.stringify(["moving",mode,body.ownerId,body.sourceDigest,body.cell]);
      if(next===key){return;}key=next;message="Loses Fragment: Linksklick schneidet erneut (auch nach dem Fallen)";
      preview([],false);return;
    }
    if(branch?.preview) {
      target=undefined;
      const next=JSON.stringify(["branch",mode,branch.generation,branch.preview.cell]);
      if(next===key){return;}key=next;
      const required=branch.cutEdge===1?1:2;
      message=mode===required?(required===1?"Bergung: markierte Verbindung · 1 Zelle":"Holz: Box 0,5 m · verankerten Ast trennen"):`Holz: Taste ${required}`;
      preview([],false);return;
    }
    const hit=pickHvpCell(root.read(),[aim.origin.x,aim.origin.y,aim.origin.z],[aim.direction.x,aim.direction.y,aim.direction.z],4);
    const next=JSON.stringify([root.read().revision,mode,hit.kind==="Hit"?hit.cell:hit.kind]);
    if(next===key) { return; } key=next;target=undefined;
    if(hit.kind!=="Hit") { message=hit.kind==="Unknown"?"Keine bestätigte Zellabdeckung":"Kein Ziel innerhalb 4 m";preview([],false);return; }
    const [x,y,z]=hit.cell;
    target=mode===3?{kind:"Sphere",center2:[2*x+1,2*y+1,2*z+1],radius2:4}
      :mode===2?{kind:"Box",min:[x-1,y-3,z-1],max:[x+3,y+1,z+3]}
       :{kind:"Box",min:[x,y,z],max:[x+1,y+1,z+1]};
    // In the authored support, the half-metre brush spans the pillar's full
    // X/Z grid cross-section; its Y interval still ends at the real hit cell.
    if(mode===2&&x>=176&&x<180&&z>=76&&z<80&&y>=65&&y<82){
      target={kind:"Box",min:[176,y-3,76],max:[180,y+1,80]};
    }
    const cells=selectHvpCutCells(target);
    let allowed=false;
    try { const plan=root.prepare(request(target,"preview"));
      if(isHvpRockArmCut(plan)){message=`${plan.changed.length} Stützzellen · Zusammenhang wird vor Commit geprüft`;}
      else{assertHvpSafeQuarry(plan,supports);message=`${plan.changed.length} Zellen · sicherer Steinbruch`;}
      allowed=true;
    }
    catch(error) { message=error instanceof Error?error.message:String(error); }
    preview(cells,allowed);
  };
  return {
    checkpoint():HvpToolCheckpoint{return Object.freeze({mode,sequence,structureSequence,movingSequence,edges});},
    restore(value:HvpToolCheckpoint):void{
      if(readAim()||![value.sequence,value.structureSequence,value.movingSequence,value.edges].every(n=>Number.isSafeInteger(n)&&n>=0)
        ||!Number.isInteger(value.mode)||value.mode<1||value.mode>3){throw new Error("Invalid paused tool checkpoint");}
      ({mode,sequence,structureSequence,movingSequence,edges}=value);key="";target=undefined;preview([],false);
    },
    select(value:number):void { if(Number.isInteger(value)&&value>=1&&value<=3) { mode=value;key="";update(); } },
    update,
    async confirm():Promise<void> {
      if(!readAim()) { return; } edges+=1;key="";update();
      const body=structure?.physics.read().moving?.preview;
      if(moving&&body&&structure){
        if(["Pending","RecoveryHold"].includes(consumer.read().state)||structure.consumer.read().state!=="Ready"){message="Andere Mutation Pending";return;}
        const aim=readAim();if(!aim){return;}
        try{await moving.submit({id:`moving-cut-${++movingSequence}`,ownerId:body.ownerId,sourceDigest:body.sourceDigest,edge:mode===1?1:4,direction:aim.direction,
          ...(mode===3?{brush:"Sphere" as const}:{})});}
        catch(error){message=String(error);}key="";return;
      }
      if(moving&&moving.read().state!=="Idle"){message="Moving cut Pending";return;}
      const branch=structure?.physics.read().structural;
      if(branch?.preview&&structure) {
        if(mode!==(branch.cutEdge===1?1:2)){return;}
        if(["Pending","RecoveryHold"].includes(consumer.read().state)){message="Terrain Pending";return;}
        const aim=readAim();if(!aim){return;}
        try {structure.admit();await structure.consumer.submit({id:`branch-cut-${++structureSequence}`,generation:branch.generation,sourceDigest:branch.sourceDigest,direction:aim.direction});}
        catch(error){message=error instanceof Error?error.message:String(error);}key="";return;
      }
      if(structure&&structure.consumer.read().state!=="Ready"){message="Structural Pending";return;}
      if(!target) { return; }
      try { await consumer.submit(request(target,`cut-${++sequence}`)); }
      catch(error) { message=error instanceof Error?error.message:String(error); }
      key="";
    },
    read:()=>Object.freeze({mode:["","Zelle","Box 0,5 m","Kugel 0,25 m"][mode],edges,issued:sequence,message,...consumer.read(),structural:structure?.consumer.read(),moving:moving?.read()}),
    dispose():void { preview([],false); }
  };
};
