import {requireExactKeys,requirePlainRecord} from "../../voxel/adaptive/validation";
import {structuralDenseArray,type StructuralOwnedReserve} from "../../voxel/structural/validation";
import type {HvpCollisionSector} from "./terrainColliders";
import {validateHvpChunkStaticLayout} from "./staticTerrainLayout";

export type HvpLabTerrainReplacement=Readonly<{index:number;mesh:HvpCollisionSector}>;
type CaptureArrayKind="Float32Array"|"Uint32Array";
type CaptureArrayInfo=Readonly<{value:Float32Array|Uint32Array;kind:CaptureArrayKind;buffer:ArrayBuffer;
  length:number;byteOffset:number;byteLength:number;backingBytes:number}>;
export type CaptureReplacementPlan=Readonly<{index:number;vertices:CaptureArrayInfo;indices:CaptureArrayInfo}>;
export type PlannedLabReplacements=Readonly<{items:readonly CaptureReplacementPlan[];borrowedBytes:number;copyBytes:number}>;

const captureFloat32Array=Float32Array,captureUint32Array=Uint32Array,captureTypedSet=Float32Array.prototype.set;
const captureGetPrototypeOf=Object.getPrototypeOf,captureGetOwnPropertyDescriptor=Object.getOwnPropertyDescriptor;
const captureArrayBufferIsView=ArrayBuffer.isView,captureFloat32Prototype=captureFloat32Array.prototype,captureUint32Prototype=captureUint32Array.prototype;
const captureTypedArrayPrototype=captureGetPrototypeOf(captureFloat32Prototype);
const captureTypedTag=captureGetOwnPropertyDescriptor(captureTypedArrayPrototype,Symbol.toStringTag)!.get!;
const captureTypedLength=captureGetOwnPropertyDescriptor(captureTypedArrayPrototype,"length")!.get!;
const captureTypedBuffer=captureGetOwnPropertyDescriptor(captureTypedArrayPrototype,"buffer")!.get!;
const captureTypedOffset=captureGetOwnPropertyDescriptor(captureTypedArrayPrototype,"byteOffset")!.get!;
const captureTypedBytes=captureGetOwnPropertyDescriptor(captureTypedArrayPrototype,"byteLength")!.get!;
const captureArrayBufferBytes=captureGetOwnPropertyDescriptor(ArrayBuffer.prototype,"byteLength")!.get!;
const captureArrayBufferResizable=captureGetOwnPropertyDescriptor(ArrayBuffer.prototype,"resizable")?.get;
const captureDataValue=(record:Record<string,unknown>,key:string,path:string):unknown=>{
  const descriptor=captureGetOwnPropertyDescriptor(record,key);
  if(descriptor===undefined||!descriptor.enumerable||!("value" in descriptor)){throw new Error(`Invalid collision data property ${path}/${key}`);}
  return descriptor.value;
};
export const reserveCaptureBytes=(reserve:StructuralOwnedReserve,bytes:number):void=>{
  if(!Number.isSafeInteger(bytes)||bytes<0){throw new Error("Invalid LAB capture byte estimate");}
  if(bytes>0){reserve(bytes);}
};
const captureArrayInfo=(value:unknown,kind:CaptureArrayKind):CaptureArrayInfo=>{
  try{
    const expectedPrototype=kind==="Float32Array"?captureFloat32Prototype:captureUint32Prototype;
    if(!captureArrayBufferIsView(value)||captureGetPrototypeOf(value)!==expectedPrototype||captureTypedTag.call(value)!==kind){
      throw new Error("Exact collision typed-array prototype required");
    }
    for(const key of ["length","buffer","byteOffset","byteLength",Symbol.toStringTag]){
      if(captureGetOwnPropertyDescriptor(value,key)!==undefined){throw new Error("Exact collision typed-array fields required");}
    }
    const buffer=captureTypedBuffer.call(value) as ArrayBuffer;
    const length=captureTypedLength.call(value) as number,byteOffset=captureTypedOffset.call(value) as number;
    const byteLength=captureTypedBytes.call(value) as number,backingBytes=captureArrayBufferBytes.call(buffer) as number;
    if(captureArrayBufferResizable?.call(buffer)===true||!Number.isSafeInteger(length)||length<0
      ||!Number.isSafeInteger(byteOffset)||byteOffset<0||!Number.isSafeInteger(byteLength)
      ||byteLength!==length*4||byteOffset+byteLength>backingBytes){throw new Error("Fixed collision ArrayBuffer required");}
    return {value:value as Float32Array|Uint32Array,kind,buffer,length,byteOffset,byteLength,backingBytes};
  }catch(error){
    if(error instanceof Error&&error.message.startsWith("Exact collision")){throw error;}
    if(error instanceof Error&&error.message.startsWith("Fixed collision")){throw error;}
    throw new Error("Genuine fixed collision ArrayBuffer required",{cause:error});
  }
};
const sameCaptureArray=(left:CaptureArrayInfo,right:CaptureArrayInfo):boolean=>left.kind===right.kind&&left.buffer===right.buffer
  &&left.length===right.length&&left.byteOffset===right.byteOffset&&left.byteLength===right.byteLength&&left.backingBytes===right.backingBytes;
const copyCaptureArray=(expected:CaptureArrayInfo):Float32Array|Uint32Array=>{
  const before=captureArrayInfo(expected.value,expected.kind);
  if(!sameCaptureArray(before,expected)){throw new Error("Collision input changed during capture");}
  const copy=expected.kind==="Float32Array"?new captureFloat32Array(expected.length):new captureUint32Array(expected.length);
  captureTypedSet.call(copy,expected.value);
  if(!sameCaptureArray(captureArrayInfo(expected.value,expected.kind),expected)){throw new Error("Collision input changed during capture");}
  return copy;
};
export const copyHvpLabCollisionArray=(value:unknown,kind:CaptureArrayKind):Float32Array|Uint32Array=>copyCaptureArray(captureArrayInfo(value,kind));
export const inspectLabReplacementInputs=(input:unknown,reserve:StructuralOwnedReserve,limit=128):PlannedLabReplacements=>{
  if(!Array.isArray(input)){throw new Error("Invalid LAB replacement list");}
  const lengthDescriptor=captureGetOwnPropertyDescriptor(input,"length");
  if(lengthDescriptor===undefined||!("value" in lengthDescriptor)||!Number.isSafeInteger(lengthDescriptor.value)
    ||lengthDescriptor.value<0||lengthDescriptor.value>limit){throw new Error("Invalid LAB replacement list");}
  const length=lengthDescriptor.value as number;
  reserveCaptureBytes(reserve,64+length*128);reserveCaptureBytes(reserve,64+length*256);
  const plans=new Array<CaptureReplacementPlan>(length),seen=new Set<number>();let borrowedBytes=0,copyBytes=0;
  const add=(left:number,right:number):number=>{const value=left+right;if(!Number.isSafeInteger(value)){throw new Error("Invalid LAB replacement byte estimate");}return value;};
  for(let index=0;index<length;index+=1){
    const entry=captureGetOwnPropertyDescriptor(input,String(index));
    if(entry===undefined||!entry.enumerable||!("value" in entry)){throw new Error(`Invalid LAB replacement data property ${index}`);}
    const record=requirePlainRecord(entry.value,`LAB replacements/${index}`);requireExactKeys(record,["index","mesh"],`LAB replacements/${index}`);
    const replacementIndex=captureDataValue(record,"index",`LAB replacements/${index}`);
    if(typeof replacementIndex!=="number"||!Number.isSafeInteger(replacementIndex)||replacementIndex<0||seen.has(replacementIndex)){
      throw new Error("Invalid LAB replacement index");
    }
    seen.add(replacementIndex);
    const mesh=requirePlainRecord(captureDataValue(record,"mesh",`LAB replacements/${index}`),`LAB replacements/${index}/mesh`);
    requireExactKeys(mesh,["vertices","indices"],`LAB replacements/${index}/mesh`);
    const vertices=captureArrayInfo(captureDataValue(mesh,"vertices",`LAB replacements/${index}/mesh`),"Float32Array");
    const indices=captureArrayInfo(captureDataValue(mesh,"indices",`LAB replacements/${index}/mesh`),"Uint32Array");
    borrowedBytes=add(borrowedBytes,vertices.backingBytes);borrowedBytes=add(borrowedBytes,indices.backingBytes);
    copyBytes=add(copyBytes,vertices.byteLength);copyBytes=add(copyBytes,indices.byteLength);
    plans[index]=Object.freeze({index:replacementIndex,vertices,indices});
  }
  const dense=structuralDenseArray(input,"LAB replacements",limit);
  if(dense.length!==length){throw new Error("LAB replacement list changed during validation");}
  for(let index=0;index<length;index+=1){
    const record=requirePlainRecord(dense[index],`LAB replacements/${index}`);requireExactKeys(record,["index","mesh"],`LAB replacements/${index}`);
    const plan=plans[index]!,replacementIndex=captureDataValue(record,"index",`LAB replacements/${index}`);
    const mesh=requirePlainRecord(captureDataValue(record,"mesh",`LAB replacements/${index}/mesh`),`LAB replacements/${index}/mesh`);
    requireExactKeys(mesh,["vertices","indices"],`LAB replacements/${index}/mesh`);
    const vertices=captureArrayInfo(captureDataValue(mesh,"vertices",`LAB replacements/${index}/mesh`),"Float32Array");
    const indices=captureArrayInfo(captureDataValue(mesh,"indices",`LAB replacements/${index}/mesh`),"Uint32Array");
    if(replacementIndex!==plan.index||!sameCaptureArray(vertices,plan.vertices)||!sameCaptureArray(indices,plan.indices)){
      throw new Error("LAB replacement input changed during validation");
    }
  }
  return Object.freeze({items:Object.freeze(plans),borrowedBytes,copyBytes});
};
export const copyLabReplacementPlans=(items:readonly CaptureReplacementPlan[]):readonly HvpLabTerrainReplacement[]=>Object.freeze(items.map(plan=>{
  const vertices=copyCaptureArray(plan.vertices) as Float32Array,indices=copyCaptureArray(plan.indices) as Uint32Array;
  return Object.freeze({index:plan.index,mesh:Object.freeze({vertices,indices})});
}));
export const inspectLabCompleteCollisionInputs=(input:unknown,reserve:StructuralOwnedReserve):PlannedLabReplacements=>{
  if(!Array.isArray(input)){throw new Error("Invalid complete static collision coverage");}
  const lengthDescriptor=captureGetOwnPropertyDescriptor(input,"length");
  if(lengthDescriptor===undefined||!("value" in lengthDescriptor)||!Number.isSafeInteger(lengthDescriptor.value)
    ||lengthDescriptor.value<256||lengthDescriptor.value>4094){throw new Error("Invalid complete static collision coverage");}
  const length=lengthDescriptor.value as number;
  reserveCaptureBytes(reserve,64+length*256);
  const currentLength=captureGetOwnPropertyDescriptor(input,"length");
  if(currentLength===undefined||!("value" in currentLength)||currentLength.value!==length){throw new Error("LAB complete collision list changed during validation");}
  const dense=structuralDenseArray(input,"LAB complete collision",4094);
  if(dense.length!==length){throw new Error("LAB complete collision list changed during validation");}
  const records=new Array<{index:number;mesh:Record<string,unknown>}>(length);
  for(let index=0;index<length;index+=1){
    const mesh=requirePlainRecord(dense[index],`LAB complete collision/${index}`);requireExactKeys(mesh,["vertices","indices"],`LAB complete collision/${index}`);
    records[index]=Object.freeze({index,mesh});
  }
  return inspectLabReplacementInputs(records,reserve,4094);
};
export const copyLabCompleteCollisionPlans=(items:readonly CaptureReplacementPlan[]):readonly HvpCollisionSector[]=>{
  const owned=copyLabReplacementPlans(items),sectors=new Array<HvpCollisionSector>(owned.length);
  for(let index=0;index<owned.length;index+=1){sectors[index]=owned[index]!.mesh;}
  return Object.freeze(sectors);
};
/** @internal Pure buffer intake only; cannot issue a Session/capture capability. */
export const ownHvpLabReplacementMeshes=(input:unknown,reserve:StructuralOwnedReserve):readonly HvpLabTerrainReplacement[]=>{
  const plans=inspectLabReplacementInputs(input,reserve);
  reserveCaptureBytes(reserve,plans.borrowedBytes);reserveCaptureBytes(reserve,plans.copyBytes);reserveCaptureBytes(reserve,64+plans.items.length*128);
  return copyLabReplacementPlans(plans.items);
};
/** @internal Pure complete-catalogue copy only; cannot issue a Session/capture capability. */
export const ownHvpLabCompleteCollisionSectors=(input:unknown,reserve:StructuralOwnedReserve):readonly HvpCollisionSector[]=>{
  const plans=inspectLabCompleteCollisionInputs(input,reserve);
  reserveCaptureBytes(reserve,plans.borrowedBytes);reserveCaptureBytes(reserve,plans.copyBytes);
  reserveCaptureBytes(reserve,64+plans.items.length*128);reserveCaptureBytes(reserve,64+plans.items.length*16);
  return copyLabCompleteCollisionPlans(plans.items);
};
/** @internal Client-owned complete transfer; all arrays/backing/copies are reserved by the caller ledger first. */
export const ownHvpLabCompleteStaticCollision=(input:unknown,reserve:StructuralOwnedReserve)=>{
  const record=requirePlainRecord(input,"LAB complete collision");requireExactKeys(record,["layout","sectors"],"LAB complete collision");
  const rawLayout=captureDataValue(record,"layout","LAB complete collision"),layoutRecord=requirePlainRecord(rawLayout,"LAB complete layout");
  requireExactKeys(layoutRecord,["neighborTerrainCount","primaryTerrainCount","version"],"LAB complete layout");
  const layout=validateHvpChunkStaticLayout({version:captureDataValue(layoutRecord,"version","LAB complete layout"),
    primaryTerrainCount:captureDataValue(layoutRecord,"primaryTerrainCount","LAB complete layout"),
    neighborTerrainCount:captureDataValue(layoutRecord,"neighborTerrainCount","LAB complete layout")});
  reserveCaptureBytes(reserve,128);
  const sectors=ownHvpLabCompleteCollisionSectors(captureDataValue(record,"sectors","LAB complete collision"),reserve);
  reserveCaptureBytes(reserve,64+sectors.length*16);
  const transfers=sectors.flatMap(mesh=>[mesh.vertices.buffer as ArrayBuffer,mesh.indices.buffer as ArrayBuffer]);
  return Object.freeze({completeCollision:Object.freeze({sectors,layout}),transfers:Object.freeze(transfers)});
};
