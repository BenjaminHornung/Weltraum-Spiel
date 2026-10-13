// Unchanged r33 validation bodies; isolate them from unrelated legacy physics imports.
import {HVP_COAST_REGISTRY_DIGEST} from "../oracle/hvp/hvpCoastSource";
import {hvpChunkCoordinates,type HvpChunkPayload} from "../oracle/hestia-prototype/terrain/terrainChunkInput";
import {contentRevision} from "../oracle/workers/ids";
const payloadKeys=["worldId","renderVersion","collisionVersion","sessionId","epoch","generation","sourceDigest","baseDigest","materialDigest","chunk","coreOrigin",
  "sizeX","sizeY","sizeZ","haloWidth","originMeters","sourceOrigin","haloBinding","physicalHalo","haloNeighbor"];
const resizableGetter=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,"resizable")?.get;
const readResizable=resizableGetter===undefined?undefined:Function.prototype.call.bind(resizableGetter);
export const validateHvpChunkBuffers=(buffers:readonly ArrayBuffer[]):void=>{
  if(!Array.isArray(buffers)||buffers.length<1||buffers.length>8){throw new Error("Invalid fixed chunk buffers");}
  for(const b of buffers){if(!(b instanceof ArrayBuffer)||readResizable?.(b)===true){throw new Error("Chunk buffers must be fixed ArrayBuffers");}}
};
export const validateHvpChunkPayload=(value:unknown):HvpChunkPayload=>{
  const p=value as HvpChunkPayload|null;
  if(!p||typeof p!=="object"||Object.keys(p).length!==payloadKeys.length||payloadKeys.some(k=>!Object.hasOwn(p,k))
    ||![p.worldId,p.sessionId,p.sourceDigest,p.baseDigest].every(v=>typeof v==="string"&&/^[-A-Za-z0-9:._]{1,128}$/.test(v))
    ||typeof p.haloBinding!=="string"||!/^[-A-Za-z0-9:._]{1,512}$/.test(p.haloBinding)
    ||!Number.isSafeInteger(p.epoch)||p.epoch<0||p.materialDigest!==HVP_COAST_REGISTRY_DIGEST
    ||p.sizeX!==32||p.sizeY!==32||p.sizeZ!==32||p.haloWidth!==1||p.renderVersion!=="hvp-terrain-chunk-v1"
    ||p.collisionVersion!=="hvp-collision-chunk-v1"){throw new Error("Invalid chunk manifest binding");}
  contentRevision(p.generation);const c=hvpChunkCoordinates(p.chunk);
  if(!Array.isArray(p.coreOrigin)||p.coreOrigin.length!==3||Object.keys(p.coreOrigin).length!==3
    ||[0,1,2].some(i=>!Object.hasOwn(p.coreOrigin,i)||p.coreOrigin[i]!==c[i]!*32)
    ||![p.originMeters,p.sourceOrigin].every(o=>o&&typeof o==="object"&&Object.keys(o).length===3
      &&Object.hasOwn(o,"x")&&Object.hasOwn(o,"y")&&Object.hasOwn(o,"z")&&[o.x,o.y,o.z].every(n=>Number.isSafeInteger(n*8)))
    ||p.sourceOrigin.y!==-8||p.sourceOrigin.z!==-16||p.originMeters.x!==p.sourceOrigin.x+c[0]*4
    ||p.originMeters.y!==p.sourceOrigin.y+c[1]*4||p.originMeters.z!==p.sourceOrigin.z+c[2]*4){throw new Error("Invalid chunk coverage binding");}
  const n=p.haloNeighbor;
  if(p.physicalHalo==="closed-exterior"){if(n!==null){throw new Error("Invalid chunk physical halo binding");}}
  else if(p.physicalHalo==="east"||p.physicalHalo==="west"){
    if(!n||typeof n!=="object"||Object.keys(n).sort().join(",")!=="baseDigest,epoch,generation,originMeters,sessionId,sourceDigest"
      ||![n.sessionId,n.sourceDigest,n.baseDigest].every(v=>typeof v==="string"&&/^[-A-Za-z0-9:._]{1,128}$/.test(v))
      ||![n.epoch,n.generation].every(v=>Number.isSafeInteger(v)&&v>=0)||!n.originMeters
      ||Object.keys(n.originMeters).sort().join(",")!=="x,y,z"||n.originMeters.x!==p.sourceOrigin.x+(p.physicalHalo==="east"?32:-32)
      ||n.originMeters.y!==p.sourceOrigin.y||n.originMeters.z!==p.sourceOrigin.z){throw new Error("Invalid chunk physical halo binding");}
  }else{throw new Error("Invalid chunk physical halo binding");}
  return p;
};
