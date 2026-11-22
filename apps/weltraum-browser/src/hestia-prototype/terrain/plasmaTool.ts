import type {HvpPlayerEyeReceipt} from "../physics/publishedPlayerEye";
import { Vector3 } from "three";
import {createHvpRegionalCutRead,type HvpRegionalCutCoveragePort} from "./regionalCutCoverage";
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
  readAim: () => {origin:Vector3;direction:Vector3;eyeReceipt?:HvpPlayerEyeReceipt}|undefined,
  preview: (cells:readonly HvpCell[], allowed:boolean)=>void,
   supports: readonly Readonly<{x:number;z:number}>[],
   structure?:{physics:Pick<HvpPhysicsClient,"read"|"setCutAim">;consumer:ReturnType<typeof createHvpStructuralConsumer>;admit:()=>void},
   moving?:ReturnType<typeof createHvpBodyCutConsumer>,regional?:HvpRegionalCutCoveragePort,
   player?:{captureRay:()=>ReturnType<typeof readAim>; busy:()=>boolean; observe:(run:()=>void,stamp:number)=>void}) => {
  const coverage=regional?createHvpRegionalCutRead(root.read,regional):undefined;
  let mode=1, sequence=0, key="", target:HvpCutShape|undefined, message="Spielen: 1 Zelle · 2 Box · 3 Kugel · Linksklick";
  let terrainHit:Readonly<{cell:HvpCell;slot:number}>|undefined;
  let edges=0;
  let structureSequence=0;
  let movingSequence=0;
  let displayedBody:{ownerId:string;sourceDigest:string}|undefined;
  type PlayerRay=NonNullable<ReturnType<typeof readAim>>;
  type MovingIntent={ownerId:string;sourceDigest:string;mode:number;origin:PlayerRay["origin"];direction:PlayerRay["direction"];
    sessionId:string;epoch:number;stamp:number;expires:number;eyeReceipt?:HvpPlayerEyeReceipt};
  let pending:MovingIntent|undefined;
  let feedback:{text:string;until:number}|undefined;
  const explain=(text:string)=>{feedback={text,until:performance.now()+2000};};
  const hardStop=()=>{
    const state=structure!.physics.read();
    return state.status!=="Running"||state.moving?.state==="RecoveryHold"
      ||moving!.read().state==="RecoveryHold"||consumer.read().state==="RecoveryHold";
  };
  const writable=()=>!player!.busy()&&!!readAim()&&moving!.read().state==="Idle"&&structure!.consumer.read().state==="Ready"
    &&consumer.read().state!=="Pending";
  const submitMoving=async(intent:MovingIntent)=>{
    const {ownerId,sourceDigest,direction,origin}=intent;
    coverage?.cancel();feedback=undefined;
    try{
      await moving!.submit({id:`moving-cut-${++movingSequence}`,ownerId,sourceDigest,direction,expectedEye:origin,...(intent.eyeReceipt?{eyeReceipt:intent.eyeReceipt}:{}),
        edge:intent.mode===1?1:4,...(intent.mode===3?{brush:"Sphere" as const}:{})});
      const outcome=moving!.read().last;
      if(outcome?.status==="Rejected")explain(outcome.reason);
    }catch(error){explain(String(error));}
    key="";
  };
  const retryMoving=()=>{
    if(!pending)return;
    const intent=pending,snapshot=root.read();
    if(snapshot.sessionId!==intent.sessionId||snapshot.epoch!==intent.epoch||performance.now()>intent.expires||hardStop()||!player!.captureRay()){
      pending=undefined;explain("Schnitt verworfen. Fragment erneut anvisieren.");return;
    }
    if(!writable())return;
    pending=undefined;
    player!.observe(()=>{void submitMoving(intent);},intent.stamp);
  };
  const request=(shape:HvpCutShape,id:string)=>{
    const s=root.read();
    return {sessionId:s.sessionId,epoch:s.epoch,revision:s.revision,sourceDigest:s.sourceDigest,
      commandId:id,toolPolicy:"hvp-plasma-v1" as const,shape};
  };
  const update=():void=>{
    retryMoving();
    const aim=readAim();
    structure?.physics.setCutAim(aim?.direction);
    if(!aim) {
      if(coverage?.read()?.state==="PendingCoverage"&&!regional?.readAim())coverage.cancel();
      if(key!=="") { preview([],false);key=""; }
      displayedBody=undefined;target=undefined;terrainHit=undefined;message="Schnitt derzeit nicht verfügbar";return;
    }
    const state=structure?.physics.read(),body=state?.moving?.preview,branch=state?.structural;
    displayedBody=body?{ownerId:body.ownerId,sourceDigest:body.sourceDigest}:undefined;
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
    terrainHit=hit.kind==="Hit"?{cell:hit.cell,slot:hit.slot}:undefined;
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
    checkpoint():HvpToolCheckpoint{if(pending)throw Error("Schnitt wartet auf Bestätigung");coverage?.cancel();return Object.freeze({mode,sequence,structureSequence,movingSequence,edges});},
    restore(value:HvpToolCheckpoint):void{
      if(readAim()||![value.sequence,value.structureSequence,value.movingSequence,value.edges].every(n=>Number.isSafeInteger(n)&&n>=0)
        ||!Number.isInteger(value.mode)||value.mode<1||value.mode>3){throw new Error("Invalid paused tool checkpoint");}
      coverage?.cancel();pending=undefined;displayedBody=undefined;feedback=undefined;({mode,sequence,structureSequence,movingSequence,edges}=value);key="";target=undefined;preview([],false);
    },
    select(value:number):void { if(Number.isInteger(value)&&value>=1&&value<=3) { coverage?.cancel();mode=value;key="";update(); } },
    update,
    async confirm(eventStamp?:number):Promise<void> {
      if(player&&structure&&moving&&displayedBody){
        edges++;
        const ray=player.captureRay(),now=performance.now();
        if(!ray||hardStop()){explain("Schnitt nicht verfügbar ("+structure.physics.read().status+").");return;}
        if(pending){explain("Ein Fragmentschnitt wartet bereits.");return;}
        const state=root.read();
        const intent:MovingIntent={...displayedBody,origin:ray.origin.clone(),direction:ray.direction.clone(),mode,
          sessionId:state.sessionId,epoch:state.epoch,eyeReceipt:ray.eyeReceipt,stamp:eventStamp??now,expires:now+1500};
        if(!writable()){pending=intent;explain("Fragmentschnitt wartet auf die Weltfreigabe.");return;}
        await submitMoving(intent);return;
      }
      const inputAim=readAim();
      if(!inputAim){
        if(coverage?.tryRequest())edges+=1;else if(player){edges++;explain("Schnitt derzeit nicht verfügbar.");}
        return;
      }
      edges+=1;
      update();
      const body=structure?.physics.read().moving?.preview;
      if(moving&&body&&structure){
        coverage?.cancel();
        if(["Pending","RecoveryHold"].includes(consumer.read().state)||structure.consumer.read().state!=="Ready"){message="Andere Mutation Pending";return;}
        const aim=readAim();if(!aim){return;}
        try{await moving.submit({id:`moving-cut-${++movingSequence}`,ownerId:body.ownerId,sourceDigest:body.sourceDigest,edge:mode===1?1:4,direction:aim.direction,...(player?{expectedEye:inputAim.origin,eyeReceipt:inputAim.eyeReceipt}:{}),
          ...(mode===3?{brush:"Sphere" as const}:{})});}
        catch(error){message=String(error);}key="";return;
      }
      if(moving&&moving.read().state!=="Idle"){message="Moving cut Pending";return;}
      const branch=structure?.physics.read().structural;
      if(branch?.preview&&structure) {
        coverage?.cancel();
        if(mode!==(branch.cutEdge===1?1:2)){return;}
        if(["Pending","RecoveryHold"].includes(consumer.read().state)){message="Terrain Pending";return;}
        const aim=readAim();if(!aim){return;}
        try {structure.admit();await structure.consumer.submit({id:`branch-cut-${++structureSequence}`,generation:branch.generation,sourceDigest:branch.sourceDigest,direction:aim.direction});}
        catch(error){message=error instanceof Error?error.message:String(error);}key="";return;
      }
      if(structure&&structure.consumer.read().state!=="Ready"){message="Structural Pending";return;}
      if(!target||!terrainHit) { coverage?.tryRequest();return; }
      coverage?.cancel();
      const intent=request(target,`cut-${++sequence}`);
      const intendedHit=terrainHit;
      const origin:HvpCell=[inputAim.origin.x,inputAim.origin.y,inputAim.origin.z];
      const direction:HvpCell=[inputAim.direction.x,inputAim.direction.y,inputAim.direction.z];
      try { await consumer.submit(intent,current=>{
        if(current.sessionId!==intent.sessionId||current.epoch!==intent.epoch) throw new Error("Sitzung gewechselt");
        const hit=pickHvpCell(current,origin,direction,4);
        if(hit.kind!=="Hit"||hit.slot!==intendedHit.slot||hit.cell.some((v,i)=>v!==intendedHit.cell[i])
          ||structure?.physics.read().moving?.preview||structure?.physics.read().structural?.preview){
          throw new Error("Schnittziel hat sich geändert");
        }
        return {...intent,revision:current.revision,sourceDigest:current.sourceDigest};
      }); }
      catch(error) { message=error instanceof Error?error.message:String(error); }
      key="";
    },
    read:()=>{
      const regional=coverage?.read();
      const regionalFeedback=regional&&(regional.state==="PendingCoverage"||!terrainHit)?regional.reason:message;
      return Object.freeze({...(regional?{coverage:regional}:{}),mode:["","Zelle","Box 0,5 m","Kugel 0,25 m"][mode],edges,issued:sequence,message:feedback&&performance.now()<=feedback.until?feedback.text:regionalFeedback,...(player?{movingInputPending:!!pending,movingInputFeedback:feedback?.text}:{}),...consumer.read(),structural:structure?.consumer.read(),moving:moving?.read()});},
    dispose():void { pending=undefined;displayedBody=undefined;feedback=undefined;coverage?.cancel();preview([],false); }
  };
};
