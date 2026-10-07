/** Private byte kernel for producer-owned complete slots; the caller retains all ownership checks. */
export const copyHvpOwnedSlotLeaf=(bytes:Uint8Array,sizeX:number,sizeY:number,sizeZ:number,lx:number,ly:number,lz:number):Uint8Array|undefined=>{
  if(![lx,ly,lz].every(Number.isSafeInteger)||lx<0||ly<0||lz<0||(lx+1)*16>sizeX||(ly+1)*16>sizeY||(lz+1)*16>sizeZ){return undefined;}
  const leaf=new Uint8Array(4096);
  for(let z=0;z<16;z+=1){for(let y=0;y<16;y+=1){const start=lx*16+(ly*16+y)*sizeX+(lz*16+z)*sizeX*sizeY;
    for(let x=0;x<16;x+=1){leaf[x+y*16+z*256]=bytes[start+x]!;}
  }}return leaf;
};
export type HvpOwnedLeafCopy=(x:number,y:number,z:number)=>Uint8Array|undefined;
export type HvpOwnedSlotBlockCopy=(target:Uint8Array,offset:number,length:number)=>void;
export const HVP_OWNED_SLOT_COPY_SCRATCH_BYTES=65_536+2048*128;
const NativeBytes=Uint8Array,nativeSet=Uint8Array.prototype.set;
const typedPrototype=Object.getPrototypeOf(Uint8Array.prototype);
const nativeBuffer=Object.getOwnPropertyDescriptor(typedPrototype,"buffer")!.get!;
const nativeOffset=Object.getOwnPropertyDescriptor(typedPrototype,"byteOffset")!.get!;
const nativeLength=Object.getOwnPropertyDescriptor(typedPrototype,"byteLength")!.get!;
/** Only producer-owned bytes reach this factory; views stay inside captured native calls. */
export const createHvpOwnedSlotBlockCopy=(bytes:Uint8Array):HvpOwnedSlotBlockCopy=>{
  const buffer=nativeBuffer.call(bytes) as ArrayBuffer,baseOffset=nativeOffset.call(bytes) as number,total=nativeLength.call(bytes) as number;
  return (target,offset,length)=>{
    if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<1||length>4096
      ||offset>total-length||nativeLength.call(target)!==total){throw new Error("Invalid owned terrain copy block");}
    nativeSet.call(target,new NativeBytes(buffer,baseOffset+offset,length),offset);
  };
};
