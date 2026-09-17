import type {HvpCompactMesh} from "../../hvp/hvpCoastMesher";

/** One bounded immutable binary cache/worker payload; no JSON-sized mesh arrays. */
export const HVP_PROJECTION_PACKET_LIMIT=32*1024*1024;
const magic=0x48565031,fields=15;
export const encodeHvpProjectionPacket=(meshes:readonly HvpCompactMesh[]):ArrayBuffer=>{
  if(meshes.length<1||meshes.length>7){throw new Error("Projection packet mesh count");}
  const headerBytes=8+meshes.length*fields*4;
  const bytes=headerBytes+meshes.reduce((n,m)=>n+4*(m.positions.length+m.normals.length+(m.colors?.length??0)+m.indices.length+m.materialRanges.length*3),0);
  if(!Number.isSafeInteger(bytes)||bytes>HVP_PROJECTION_PACKET_LIMIT){throw new Error("Projection packet BudgetExceeded");}
  const buffer=new ArrayBuffer(bytes),header=new Uint32Array(buffer,0,headerBytes/4);header[0]=magic;header[1]=meshes.length;
  let offset=headerBytes;
  for(const [i,m]of meshes.entries()){
    const row=2+i*fields,counts=[m.positions.length,m.indices.length,m.colors?.length??0,m.materialRanges.length,
      m.faceCount,m.unitFaceCount,m.outerFaceCount,m.cavityFaceCount,m.tempEstimateBytes];
    if(!counts.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff)||m.normals.length!==m.positions.length){throw new Error("Invalid projection metrics");}
    header.set(counts,row);
    for(const [index,array]of [m.positions,m.normals,m.colors??new Float32Array(0),m.indices].entries()){
      header[row+9+index]=offset;
      const output=index===3?new Uint32Array(buffer,offset,array.length):new Float32Array(buffer,offset,array.length);
      output.set(array);offset+=array.length*4;
    }
    header[row+13]=offset;const ranges=new Uint32Array(buffer,offset,m.materialRanges.length*3);
    for(const [n,r]of m.materialRanges.entries()){ranges.set([r.slot,r.startIndex,r.indexCount],n*3);}
    offset+=ranges.byteLength;header[row+14]=offset;
  }
  return buffer;
};
export const decodeHvpProjectionPacket=(buffer:ArrayBuffer,digest:string,algorithm="hvp-neighbour-projection-v1"):readonly HvpCompactMesh[]=>{
  if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<68||buffer.byteLength%4||buffer.byteLength>HVP_PROJECTION_PACKET_LIMIT){throw new Error("Invalid projection packet size");}
  const all=new Uint32Array(buffer),count=all[1]!;
  if(all[0]!==magic||count<1||count>7||8+count*fields*4>buffer.byteLength){throw new Error("Invalid projection packet header");}
  let offset=8+count*fields*4;
  const meshes:HvpCompactMesh[]=[];
  for(let i=0;i<count;i+=1){
    const row=2+i*fields,n=all[row]!,ni=all[row+1]!,nc=all[row+2]!,nr=all[row+3]!,faces=all[row+4]!,units=all[row+5]!;
    if(n>3_000_000||n%12||ni!==n/2||ni>1_500_000||(nc!==0&&nc!==n)||nr>faces||faces!==ni/6||units<faces
      ||all[row+6]!+all[row+7]!==faces||all[row+8]!>256*1024*1024){throw new Error("Invalid projection packet counts");}
    const lengths=[n,n,nc,ni,nr*3];
    for(let a=0;a<5;a+=1){if(all[row+9+a]!==offset){throw new Error("Noncanonical projection packet offsets");}offset+=lengths[a]!*4;}
    if(offset!==all[row+14]||offset>buffer.byteLength){throw new Error("Projection packet bounds");}
    const positions=new Float32Array(buffer,all[row+9],n),normals=new Float32Array(buffer,all[row+10],n);
    const colors=nc===0?null:new Float32Array(buffer,all[row+11],nc),indices=new Uint32Array(buffer,all[row+12],ni);
    const ranges=new Uint32Array(buffer,all[row+13],nr*3),materialRanges:{slot:number;startIndex:number;indexCount:number}[]=[];
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let a=0;a<n;a+=1){const p=positions[a]!;
      if(!Number.isFinite(p)||Math.abs(p)>1024||!Number.isInteger(p*8)||![0,-1,1].includes(normals[a]!)){throw new Error("Invalid projection packet geometry");}
      min[a%3]=Math.min(min[a%3]!,p);max[a%3]=Math.max(max[a%3]!,p);
    }
    for(let a=0;a<n;a+=3){if(normals[a]!**2+normals[a+1]!**2+normals[a+2]!**2!==1){throw new Error("Invalid projection face normal");}}
    if(colors?.some(c=>!Number.isFinite(c)||c<0||c>1)||indices.some(v=>v>=n/3)){throw new Error("Invalid projection colors/indices");}
    let end=0;
    for(let a=0;a<ranges.length;a+=3){const slot=ranges[a]!,startIndex=ranges[a+1]!,indexCount=ranges[a+2]!;
      if(slot<1||slot>4||startIndex!==end||indexCount<6||indexCount%6){throw new Error("Invalid projection material coverage");}
      end+=indexCount;materialRanges.push(Object.freeze({slot,startIndex,indexCount}));
    }
    if(end!==ni){throw new Error("Incomplete projection materials");}
    meshes.push(Object.freeze({positions,normals,colors,indices,materialRanges:Object.freeze(materialRanges),faceCount:faces,unitFaceCount:units,
      outerFaceCount:all[row+6]!,cavityFaceCount:all[row+7]!,tempEstimateBytes:all[row+8]!,sourceDigest:digest,algorithmVersion:algorithm,
      boundsMeters:{min:{x:n?min[0]!:0,y:n?min[1]!:0,z:n?min[2]!:0},max:{x:n?max[0]!:0,y:n?max[1]!:0,z:n?max[2]!:0}}}));
  }
  if(offset!==buffer.byteLength){throw new Error("Trailing projection payload");}return Object.freeze(meshes);
};
