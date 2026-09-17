import {createMissionOffer,acceptMission,activateMission,applyObjectiveProgress,completeObjective,completeMission,
  validateMissionDefinition,type MissionCommandResult,type MissionInstance} from "../../missions";
import {canonicalizePersistenceValue,createPersistenceSignature,createMissionTime,createSimulationTick,createUniverseClock,
  parseExternalReferenceId,parseMissionId,parsePlayerId,parseSiteId} from "../../persistence";
import {fnv1aHash} from "../../core/hash";
import {HVP_SALVAGE_ZONE} from "../physics/profile";
import type {decodeHvpWorld} from "../persistence/worldCheckpoint";

type Vec=Readonly<{x:number;y:number;z:number}>;
type Part=Readonly<{ownerId:string;sourceDigest:string;anchored:boolean;cellCount:number;massKg:number;position:Vec;velocity:Vec;sleeping:boolean}>;
export interface HvpSalvageObservation {
  readonly ticks:number;readonly status:string;readonly terrainTransaction:string;readonly movingState:string;
  readonly player:Readonly<{status:string;position:Vec}>|null;
  readonly branch:Readonly<{kind?:string;origin:Vec;generation:number;state:string;
    last:Readonly<{id:string;status:string;removedCells:number;removedMassKg:number}>|null;parts:readonly Part[]}>|null;
  readonly lastImpulse:Readonly<{status:string;target?:string;point?:Vec;impulse?:Vec}>|null;readonly lastImpulseTick:number|null;
}
type Event=
  |Readonly<{kind:"Found";tick:number;position:Vec;origin:Vec}>
  |Readonly<{kind:"Cut";tick:number;commandId:string;ownerId:string;sourceDigest:string}>
  |Readonly<{kind:"Impulse";tick:number;ownerId:string;point:Vec;impulse:Vec}>
  |Readonly<{kind:"Delivered";tick:number;ownerId:string;position:Vec}>
  |Readonly<{kind:"Saved";tick:number;worldSignature:string}>;
export interface HvpSalvageCheckpoint {
  readonly version:"hvp-salvage-v1";readonly sessionId:string;readonly definition:string;readonly events:readonly Event[];
  readonly receiptHash:string;readonly missionRevision:number;readonly missionSignature:string;
}
const labels=["Bergungsplatz erreichen","Markierte Verbindung schneiden","Mit etwas Abstand per F in die blaue Ablage schieben","Spielstand sichern"];
const targets=["site","link","depot","save"].map(id=>parseSiteId(`site:hvp-salvage-${id}`));
const objectiveIds=targets.map((_,i)=>parseExternalReferenceId(`objective:hvp-salvage-${i}`));
const definition=validateMissionDefinition({definitionId:parseExternalReferenceId("mission-definition:hvp-salvage"),schemaVersion:1,
  missionKind:"Recovery",issuerId:targets[0]!,contentKey:"hvp.salvage",eligibilityRequirements:[],
  objectiveGraph:{mode:"Sequential",objectives:objectiveIds.map((objectiveId,i)=>({objectiveId,requirementMode:"Required",
    hiddenUntilPrerequisitesMet:false,prerequisiteObjectiveIds:i===0?[]:[objectiveIds[i-1]!],
    descriptor:{kind:i===0?"ReachTarget":"InteractWithTarget",targetId:targets[i]!}}))},
  failureConditions:[],expiryPolicy:{kind:"None"},rewardDescriptors:[],penaltyDescriptors:[],legalityTags:[],definitionsVersion:"hvp-salvage-v1"});
const definitionHash=createPersistenceSignature({definition,zone:HVP_SALVAGE_ZONE});
const result=(r:MissionCommandResult):MissionInstance=>{if(!r.ok){throw new Error(`Mission ${r.rejection.code}: ${r.rejection.message}`);}return r.instance;};
const integer=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER/2;
const id=(s:unknown):s is string=>typeof s==="string"&&/^[A-Za-z0-9:_-]{1,128}$/.test(s);
const vec=(p:Vec)=>p&&Object.keys(p).sort().join(",")==="x,y,z"&&[p.x,p.y,p.z].every(n=>Number.isFinite(n)&&Math.abs(n)<1_000_000);
const inZone=(p:Vec,origin:Vec)=>vec(p)&&p.x>=HVP_SALVAGE_ZONE.minX&&p.x<HVP_SALVAGE_ZONE.maxX
  &&p.z>=HVP_SALVAGE_ZONE.minZ&&p.z<HVP_SALVAGE_ZONE.maxZ&&p.y>=origin.y-.25&&p.y<=origin.y+.75;
const at=(tick:number)=>createUniverseClock(createSimulationTick(tick*2));
const site=(origin:Vec)=>({x:origin.x+.1875,y:origin.y+.9375,z:origin.z+.0625});
const nearSite=(p:Vec,o:Vec)=>{const s=site(o);return Math.hypot(p.x-s.x,p.y-s.y,p.z-s.z)<=1.5;};

function replay(sessionId:string,events:readonly Event[]):MissionInstance {
  const missionId=parseMissionId(`mission:hvp-salvage-${fnv1aHash(sessionId)}`);
  const commandId=(s:string)=>parseExternalReferenceId(`hvp-command:${s}`);
  let instance=result(createMissionOffer({definition,missionId,ownerId:parsePlayerId("player:hvp"),facts:{},
    commandId:commandId("offer"),expectedRevision:0,at:at(0)}));
  instance=result(acceptMission({definition,instance,commandId:commandId("accept"),expectedRevision:instance.revision,at:at(0)}));
  instance=result(activateMission({definition,instance,commandId:commandId("activate"),expectedRevision:instance.revision,at:at(0),missionTime:createMissionTime(createSimulationTick(0))}));
  for(const event of events){
    const i={Found:0,Cut:1,Impulse:-1,Delivered:2,Saved:3}[event.kind];if(i<0){continue;}
    const hash=createPersistenceSignature(event).slice("fnv1a32:".length);
    instance=result(applyObjectiveProgress({definition,instance,commandId:commandId(`e-${hash}`),expectedRevision:instance.revision,at:at(event.tick),
      objectiveId:objectiveIds[i]!,progress:{kind:"Target",targetId:targets[i]!}}));
    instance=result(completeObjective({definition,instance,commandId:commandId(`c-${hash}`),expectedRevision:instance.revision,at:at(event.tick),objectiveId:objectiveIds[i]!}));
  }
  if(events.length===5){instance=result(completeMission({definition,instance,commandId:commandId("complete"),expectedRevision:instance.revision,at:at(events[4]!.tick)}));}
  return instance;
}
const pack=(sessionId:string,events:readonly Event[]):HvpSalvageCheckpoint=>{
  const m=replay(sessionId,events);return canonicalizePersistenceValue({version:"hvp-salvage-v1",sessionId,definition:definitionHash,events,
    receiptHash:createPersistenceSignature(events),missionRevision:m.revision,missionSignature:m.signature}) as unknown as HvpSalvageCheckpoint;
};
function validate(value:unknown):HvpSalvageCheckpoint {
  const c=value as HvpSalvageCheckpoint|null;
  if(!c||Object.keys(c).sort().join(",")!=="definition,events,missionRevision,missionSignature,receiptHash,sessionId,version"
    ||c.version!=="hvp-salvage-v1"||!id(c.sessionId)||c.definition!==definitionHash||!Array.isArray(c.events)||c.events.length>5){throw new Error("Invalid salvage checkpoint");}
  let last=0;const keys=["kind,origin,position,tick","commandId,kind,ownerId,sourceDigest,tick","impulse,kind,ownerId,point,tick","kind,ownerId,position,tick","kind,tick,worldSignature"];
  for(const [i,e] of c.events.entries()){
    if(!e||e.kind!==["Found","Cut","Impulse","Delivered","Saved"][i]||Object.keys(e).sort().join(",")!==keys[i]||!integer(e.tick)||e.tick<last){throw new Error("Invalid salvage receipt chain");}last=e.tick;
    if(e.kind==="Found"&&(!vec(e.position)||!vec(e.origin)||e.origin.x!==-12||e.origin.z!==-13.5||!nearSite(e.position,e.origin))){throw new Error("Missing site receipt");}
    if(e.kind==="Cut"&&(!id(e.commandId)||!id(e.ownerId)||!e.ownerId.startsWith("hvp-salvage:")||typeof e.sourceDigest!=="string"||!/^fnv1a64-v1:[0-9a-f]{16}$/.test(e.sourceDigest))){throw new Error("Missing marked cut receipt");}
    if((e.kind==="Impulse"||e.kind==="Delivered")&&e.ownerId!==(c.events[1] as Extract<Event,{kind:"Cut"}>).ownerId){throw new Error("Foreign salvage owner");}
    if(e.kind==="Impulse"&&(!vec(e.point)||!vec(e.impulse)||Math.hypot(e.impulse.x,e.impulse.y,e.impulse.z)<=0||Math.hypot(e.impulse.x,e.impulse.y,e.impulse.z)>15+1e-6)){throw new Error("Missing bounded contact impulse");}
    if(e.kind==="Delivered"&&!inZone(e.position,(c.events[0] as Extract<Event,{kind:"Found"}>).origin)){throw new Error("Invalid delivery receipt");}
    if(e.kind==="Saved"&&!/^fnv1a32:[0-9a-f]{8}$/.test(e.worldSignature)){throw new Error("Invalid save receipt");}
  }
  const expected=pack(c.sessionId,c.events);
  if(createPersistenceSignature(expected)!==createPersistenceSignature(c)){throw new Error("Salvage objective/receipt mismatch");}
  return expected;
}
const cargo=(s:HvpSalvageObservation,c:HvpSalvageCheckpoint)=>{
  const cut=c.events[1] as Extract<Event,{kind:"Cut"}>|undefined;
  return cut?s.branch?.parts.find(p=>p.ownerId===cut.ownerId&&p.sourceDigest===cut.sourceDigest&&!p.anchored&&p.cellCount===8&&Math.abs(p.massKg-9.375)<1e-6):undefined;
};
const delivered=(s:HvpSalvageObservation,c:HvpSalvageCheckpoint)=>{
  const p=cargo(s,c);return !!p&&p.sleeping&&Math.hypot(p.velocity.x,p.velocity.y,p.velocity.z)<.2&&inZone(p.position,s.branch!.origin);
};
export const validateHvpSalvageCheckpoint=(value:unknown,s:HvpSalvageObservation,worldSignature?:string):HvpSalvageCheckpoint=>{
  const c=validate(value),cut=c.events[1] as Extract<Event,{kind:"Cut"}>|undefined;
  if(s.branch?.kind!=="salvage"||c.events.some(e=>e.tick>s.ticks)){throw new Error("Salvage/world mismatch");}
  if(cut&&(s.branch.generation!==1||s.branch.last?.status!=="Applied"||s.branch.last.id!==cut.commandId||s.branch.last.removedCells!==1)){throw new Error("Saved marked cut is not in this World");}
  if(c.events.length>=4&&!delivered(s,c)){throw new Error("Saved delivery is not present in this World");}
  if(c.events.length===5&&(c.events[4] as Extract<Event,{kind:"Saved"}>).worldSignature!==worldSignature){throw new Error("Saved completion belongs to another save");}
  return c;
};
/** Restore validation uses artifact-owned sources and motion, not HUD completion. */
export const savedHvpSalvageObservation=(world:ReturnType<typeof decodeHvpWorld>):HvpSalvageObservation=>{
  const c=world.checkpoint,b=c.branch;
  return {ticks:c.tick.ticks,status:"Paused",terrainTransaction:"Idle",movingState:"Idle",
    player:c.player?{position:c.player.position,status:"Inspection"}:null,
    lastImpulse:c.lastImpulse,lastImpulseTick:c.lastImpulseTick,
    branch:b?{kind:b.kind,origin:b.origin,generation:b.generation,state:"Idle",last:b.last,
      parts:world.bodies.filter(p=>p.checkpoint.family==="branch").map(p=>({ownerId:p.checkpoint.ownerId,sourceDigest:p.recipe.source.contentHash,
        anchored:!p.checkpoint.dynamic,cellCount:p.recipe.mass.occupiedVoxelCount,massKg:p.recipe.mass.totalMassKg,
        position:p.motion.translationMeters,velocity:p.motion.linvelMetersPerSecond,sleeping:p.checkpoint.sleeping}))}:null};
};

/** Private objective state consumes confirmed domain snapshots, never HUD flags. */
export const createHvpSalvageLoop=(sessionId:string,restored?:unknown)=>{
  if(!id(sessionId)){throw new Error("Invalid salvage session");}
  let checkpoint=restored===undefined?pack(sessionId,[]):validate(restored);
  if(checkpoint.sessionId!==sessionId){throw new Error("Foreign salvage session");}
  let mission=replay(sessionId,checkpoint.events);
  let last:HvpSalvageObservation|undefined;
  const pending=new WeakMap<object,HvpSalvageCheckpoint>();
  const add=(e:Event)=>{checkpoint=pack(sessionId,[...checkpoint.events,e]);mission=replay(sessionId,checkpoint.events);};
  return {
    observe(s:HvpSalvageObservation):void {
      if(!integer(s.ticks)){throw new Error("Invalid observation tick");}last=s;
      const branch=s.branch;
      if(branch?.kind!=="salvage"||branch.state!=="Idle"||s.terrainTransaction!=="Idle"||s.movingState!=="Idle"){return;}
      if(checkpoint.events.length===0&&s.player?.status==="Walking"&&nearSite(s.player.position,branch.origin)){
        add({kind:"Found",tick:s.ticks,position:{...s.player.position},origin:{...branch.origin}});
      }
      if(checkpoint.events.length===1&&branch.generation===1&&branch.last?.status==="Applied"&&branch.last.removedCells===1
        &&Math.abs(branch.last.removedMassKg-600*.125**3)<1e-8){
        const p=branch.parts.find(p=>!p.anchored&&p.cellCount===8&&Math.abs(p.massKg-9.375)<1e-6&&p.ownerId.startsWith("hvp-salvage:"));
        if(p){add({kind:"Cut",tick:s.ticks,commandId:branch.last.id,ownerId:p.ownerId,sourceDigest:p.sourceDigest});}
      }
      if(checkpoint.events.length===2&&s.lastImpulse?.status==="Applied"&&s.lastImpulse.target===cargo(s,checkpoint)?.ownerId
        &&s.lastImpulseTick!==null&&integer(s.lastImpulseTick)&&s.lastImpulseTick<=s.ticks&&s.lastImpulse.point&&s.lastImpulse.impulse){
        // Receipt time is the observed World tick: cut and impulse may arrive
        // together in one readback, but the unique child cannot predate its cut.
        add({kind:"Impulse",tick:s.ticks,ownerId:s.lastImpulse.target!,point:{...s.lastImpulse.point},impulse:{...s.lastImpulse.impulse}});
      }
      if(checkpoint.events.length===3&&delivered(s,checkpoint)){add({kind:"Delivered",tick:s.ticks,ownerId:cargo(s,checkpoint)!.ownerId,position:{...cargo(s,checkpoint)!.position}});}
    },
    checkpoint:()=>checkpoint,
    prepareSave(worldSignature:string):HvpSalvageCheckpoint {
      if(!last||checkpoint.events.length<4||!delivered(last,checkpoint)){throw new Error("Confirmed physical delivery required");}
      const candidate=pack(sessionId,[...checkpoint.events.slice(0,4),{kind:"Saved",tick:last.ticks,worldSignature}]);
      validate(candidate);pending.set(candidate,checkpoint);return candidate;
    },
    commitSave(candidate:HvpSalvageCheckpoint,stored:unknown):void {
      if(pending.get(candidate)!==checkpoint||createPersistenceSignature(validate(stored))!==createPersistenceSignature(candidate)){throw new Error("Unconfirmed save candidate");}
      checkpoint=candidate;mission=replay(sessionId,checkpoint.events);pending.delete(candidate);
    },
    read(){const n=checkpoint.events.length,index=n<2?n:n<4?2:3;
      return Object.freeze({stage:n===5?"Completed":(["Find","Cut","Deliver","Save"] as const)[index],
        instruction:n===5?"Bergung gesichert. Neuer Durchlauf über bestätigten Neustart.":labels[index],mission,
        targetOwnerId:(checkpoint.events[1] as Extract<Event,{kind:"Cut"}>|undefined)?.ownerId??null,
        targetLost:checkpoint.events.length>=2&&last!==undefined&&!cargo(last,checkpoint)});}
  };
};
