import type {HvpCutOutcome} from "../terrain/terrainConsumer";

export interface HvpSimpleOutcome {readonly id:string;readonly status:string;readonly reason:string}
export interface HvpReceiptCheckpoint<T> {
  readonly version:"hvp-command-receipts-v1";readonly kind:"terrain"|"structural"|"moving";
  readonly entries:readonly Readonly<{id:string;signature:string;outcome:T}>[];readonly last:T|null;
}
const id=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9:._-]{1,128}$/.test(v);
export function decodeHvpReceipts(value:unknown,kind:"terrain",maxRevision:number):HvpReceiptCheckpoint<HvpCutOutcome>;
export function decodeHvpReceipts(value:unknown,kind:"structural"|"moving"):HvpReceiptCheckpoint<HvpSimpleOutcome>;
export function decodeHvpReceipts(value:unknown,kind:HvpReceiptCheckpoint<unknown>["kind"],maxRevision=0):HvpReceiptCheckpoint<HvpCutOutcome|HvpSimpleOutcome>{
  const p=value as HvpReceiptCheckpoint<HvpCutOutcome|HvpSimpleOutcome>|null;
  if(!p||p.version!=="hvp-command-receipts-v1"||p.kind!==kind||Object.keys(p).sort().join(",")!=="entries,kind,last,version"
    ||!Array.isArray(p.entries)||p.entries.length>256||!Number.isSafeInteger(maxRevision)||maxRevision<0){throw new Error("Invalid command receipt checkpoint");}
  const outcome=(value:unknown):HvpCutOutcome|HvpSimpleOutcome=>{
    const r=value as HvpCutOutcome&HvpSimpleOutcome|null;
    if(!r||typeof r.reason!=="string"||r.reason.length>2048||!(kind==="terrain"?["Applied","NoOp","Rejected"]:["Applied","Rejected"]).includes(r.status)){
      throw new Error("Only bounded completed command outcomes can be saved");
    }
    if(kind!=="terrain"){
      if(!id(r.id)||Object.keys(r).sort().join(",")!=="id,reason,status"){throw new Error("Invalid structural/moving outcome");}
      return Object.freeze({id:r.id,status:r.status,reason:r.reason});
    }
    if(!id(r.commandId)||!Number.isSafeInteger(r.revision)||r.revision<0||r.revision>maxRevision
      ||!Number.isSafeInteger(r.removedCells)||r.removedCells<0||r.removedCells>512
      ||Object.keys(r).some(k=>!["commandId","status","revision","removedCells","reason","transferredCells","transferredMassKg","materialRemovedKg"].includes(k))
      ||(r.status!=="Applied"&&r.removedCells!==0)) {throw new Error("Invalid terrain outcome");}
    if(r.transferredCells!==undefined&&(!Number.isSafeInteger(r.transferredCells)||r.transferredCells<1||r.transferredCells>32_768)){
      throw new Error("Invalid transferred cell count");
    }
    if([r.transferredMassKg,r.materialRemovedKg].some(n=>n!==undefined&&(!Number.isFinite(n)||n<=0))
      ||(r.transferredCells===undefined)!==(r.transferredMassKg===undefined)
      ||(r.transferredCells===undefined)!==(r.materialRemovedKg===undefined)){throw new Error("Invalid transferred mass receipt");}
    return Object.freeze({...r});
  };
  const seen=new Set<string>();
  const entries=p.entries.map(e=>{
    if(!e||!id(e.id)||seen.has(e.id)||typeof e.signature!=="string"||e.signature.length<1||e.signature.length>4096
      ||Object.keys(e).sort().join(",")!=="id,outcome,signature"){throw new Error("Invalid/duplicate command receipt");}
    seen.add(e.id);const result=outcome(e.outcome);
    if(("commandId"in result?result.commandId:result.id)!==e.id){throw new Error("Command outcome identity mismatch");}
    return Object.freeze({id:e.id,signature:e.signature,outcome:result});
  });
  return Object.freeze({version:"hvp-command-receipts-v1",kind,entries:Object.freeze(entries),last:p.last===null?null:outcome(p.last)});
}
