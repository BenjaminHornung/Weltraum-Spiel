import {createHash} from 'node:crypto';
import {encodeNumbers,decodeNumbers} from '../inputs/plt/src/numerics.mjs';
const hash=b=>createHash('sha256').update(b).digest();
export const digest=b=>'sha256:'+hash(b).toString('hex');
export function encodeCheckpoint(model,state,binding){
  model.validate(state);if(!/^sha256:[0-9a-f]{64}$/.test(binding))throw Error('BINDING');
  const meta=Buffer.from(JSON.stringify({schema:'wxg07.checkpoint/v1',binding,dtTicks:model.dtTicks,cursor:state.cursor,steps:state.steps,added:state.added,removed:state.removed}));
  const bytes=Buffer.alloc(28+meta.length+8*state.values.length);
  bytes.set(encodeNumbers({u32:model.grid.n,tick:state.tick,f64:model.grid.radius}));bytes.writeUInt32LE(meta.length,24);bytes.set(meta,28);
  state.values.forEach((x,i)=>bytes.writeDoubleLE(x,28+meta.length+8*i));return Buffer.concat([bytes,hash(bytes)]);
}
export function decodeCheckpoint(model,bytes,binding){
  if(!(bytes instanceof Uint8Array)||bytes.length<60)throw Error('CHECKPOINT_LENGTH');
  const b=Buffer.from(bytes),payload=b.subarray(0,-32);if(!hash(payload).equals(b.subarray(-32)))throw Error('CHECKPOINT_CHECKSUM');
  const numeric=decodeNumbers(payload.subarray(0,24)),size=payload.readUInt32LE(24);
  if(numeric.u32!==model.grid.n||numeric.f64!==model.grid.radius||size>4096||payload.length!==28+size+model.grid.cells.length*16)throw Error('CHECKPOINT_LAYOUT');
  const m=JSON.parse(payload.subarray(28,28+size).toString('utf8'));
  if(m.schema!=='wxg07.checkpoint/v1'||m.binding!==binding||m.dtTicks!==model.dtTicks||!Array.isArray(m.added)||!Array.isArray(m.removed)||m.added.length!==2||m.removed.length!==2)throw Error('CHECKPOINT_IDENTITY');
  const values=new Float64Array(model.grid.cells.length*2);for(let i=0;i<values.length;i++)values[i]=payload.readDoubleLE(28+size+i*8);
  const state={tick:numeric.tick,cursor:m.cursor,steps:m.steps,added:m.added,removed:m.removed,values};model.validate(state);
  if(!encodeCheckpoint(model,state,binding).equals(b))throw Error('NONCANONICAL_CHECKPOINT');return state;
}
export class CatchUp {
  #model;#state;#target;#binding;
  constructor(model,checkpoint,binding,target){this.#model=model;this.#state=decodeCheckpoint(model,checkpoint,binding);this.#binding=binding;this.#target=target;if(!Number.isSafeInteger(target)||target<this.#state.tick||target%model.dtTicks)throw Error('UNALIGNED_TARGET');}
  read(){return this.#state.tick===this.#target?{status:'Ready',tick:this.#target,checkpoint:encodeCheckpoint(this.#model,this.#state,this.#binding)}:{status:'Pending',targetTick:this.#target,completedTick:this.#state.tick};}
  pump(maxSteps){if(!Number.isInteger(maxSteps)||maxSteps<1)throw Error('PUMP_BUDGET');for(let i=0;i<maxSteps&&this.#state.tick<this.#target;i++)this.#state=this.#model.step(this.#state);return this.read();}
}
export class ResultAdmission {
  #identity;#model;#binding;#accepted=false;
  constructor(identity,model,binding){
    const keys=['authorityEpoch','sourceRevision','sourceSnapshotDigest','modelDigest','requestId','weatherTick'];
    if(keys.some(k=>identity[k]===undefined)||!Number.isSafeInteger(identity.weatherTick)||identity.weatherTick<0)throw Error('REQUEST_IDENTITY');
    this.#identity={...identity};this.#model=model;this.#binding=binding;
  }
  accept(result){
    try{
      if(this.#accepted||!result||!(result.checkpoint instanceof Uint8Array)||!Object.keys(this.#identity).every(k=>result[k]===this.#identity[k])||digest(result.checkpoint)!==result.snapshotDigest)return false;
      const state=decodeCheckpoint(this.#model,result.checkpoint,this.#binding);if(state.tick!==this.#identity.weatherTick)return false;this.#accepted=true;return true;
    }catch{return false;}
  }
}
