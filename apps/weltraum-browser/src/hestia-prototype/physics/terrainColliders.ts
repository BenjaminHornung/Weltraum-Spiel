import { meshHvpOccupancy,meshHvpOccupancySteps } from "../../hvp/hvpCoastMesher";
import type {StructuralOwnedReserve} from "../../voxel/structural/validation";

export interface HvpCollisionSource {
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  readonly cellMeters: number;
  readonly originMeters: Readonly<{ x: number; y: number; z: number }>;
  readSlot(x: number, y: number, z: number): number | undefined;
  /** Confirmed adjacent canonical coverage, used only for seam-face culling. */
  readHaloSlot?(x:number,y:number,z:number):number|undefined;
}
export interface HvpCollisionInput {
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  readonly originMeters: Readonly<{ x: number; y: number; z: number }>;
  /** One-cell halo preserves real seam faces, not walls between sectors. */
  readonly slots: Uint8Array;
}
export interface HvpCollisionSector {
  readonly vertices: Float32Array;
  readonly indices: Uint32Array;
}

export function* collisionInputs(source: HvpCollisionSource): Generator<HvpCollisionInput> {
  if (source.cellMeters !== 0.125 || ![source.sizeX, source.sizeY, source.sizeZ].every(v => Number.isSafeInteger(v) && v > 0 && v <= 256)
    || ![source.originMeters.x, source.originMeters.y, source.originMeters.z].every(Number.isFinite)) {
    throw new RangeError("Invalid canonical collision source");
  }
  for (let z0 = 0; z0 < source.sizeZ; z0 += 32) {
    for (let x0 = 0; x0 < source.sizeX; x0 += 32) {
      const sx = Math.min(32, source.sizeX - x0);
      const sz = Math.min(32, source.sizeZ - z0);
      const sy = source.sizeY;
      const slots = new Uint8Array((sx + 2) * (sy + 2) * (sz + 2));
      for (let z = -1; z <= sz; z += 1) {
        for (let y = -1; y <= sy; y += 1) {
          for (let x = -1; x <= sx; x += 1) {
            const gx = x0 + x, gz = z0 + z;
            if (gx >= 0 && gx < source.sizeX && y >= 0 && y < sy && gz >= 0 && gz < source.sizeZ) {
              const slot=source.readSlot(gx,y,gz);
              if(slot===undefined||!Number.isSafeInteger(slot)||slot<0){throw new Error("Unknown or invalid canonical collision coverage");}
              slots[(x + 1) + (y + 1) * (sx + 2) + (z + 1) * (sx + 2) * (sy + 2)] = slot === 0 ? 0 : 1;
            } else {
              const slot=source.readHaloSlot?.(gx,y,gz);
              if(slot!==undefined){
                if(!Number.isSafeInteger(slot)||slot<0){throw new Error("Invalid adjacent collision coverage");}
                slots[(x+1)+(y+1)*(sx+2)+(z+1)*(sx+2)*(sy+2)]=slot===0?0:1;
              }
            }
          }
        }
      }
      yield { sizeX: sx, sizeY: sy, sizeZ: sz, slots, originMeters: {
        x: source.originMeters.x + x0 * 0.125, y: source.originMeters.y, z: source.originMeters.z + z0 * 0.125
      } };
    }
  }
}

/** Pure bounded worker kernel: no Three.js mesh input and no heightfield. */
export const meshCollisionInput = (input: HvpCollisionInput): HvpCollisionSector => {
  const steps=collisionMeshSteps(input);for(;;){const step=steps.next();if(step.done){return step.value;}}
};
export const meshCollisionInputOwnedSteps=(input:HvpCollisionInput,reserve:StructuralOwnedReserve)=>collisionMeshSteps(input,reserve);
function* collisionMeshSteps(input:HvpCollisionInput,reserve?:StructuralOwnedReserve):Generator<string,HvpCollisionSector,unknown>{
  const { sizeX: sx, sizeY: sy, sizeZ: sz, slots } = input;
  if (![sx, sy, sz].every(v => Number.isSafeInteger(v) && v > 0) || sx > 32 || sz > 32 || sy > 256
    || slots.length !== (sx + 2) * (sy + 2) * (sz + 2)
    || ![input.originMeters.x, input.originMeters.y, input.originMeters.z].every(Number.isFinite)) {
    throw new RangeError("Invalid bounded collision sector/halo");
  }
  const slotAt = (x: number, y: number, z: number): number => slots[x + 1 + (y + 1) * (sx + 2) + (z + 1) * (sx + 2) * (sy + 2)]!;
  const occupancy={sizeX:sx,sizeY:sy,sizeZ:sz,cellMeters:.125,originMeters:input.originMeters,slotAt,ghostSlotAt:slotAt},
    budgets={maxVisitedCells:262144,maxQuads:50000,maxVertices:200000,maxIndices:300000};
  const mesh=reserve===undefined?meshHvpOccupancy(occupancy,budgets,"canonical-sector","hvp-collision-greedy-v1")
    :yield* meshHvpOccupancySteps(occupancy,budgets,"canonical-sector","hvp-collision-greedy-v1",{},reserve);
  reserve?.(8192+mesh.indices.length*4,true);
  let indices:Uint32Array;
  if(reserve){indices=new Uint32Array(mesh.indices.length);for(let i=0;i<indices.length;i+=1){indices[i]=mesh.indices[i]!;if((i+1)%4096===0){yield "collisionPackIndices";}}}
  else{indices=new Uint32Array(mesh.indices);}
  return {vertices:mesh.positions,indices};
}

/** Direct use for solver oracles; the browser submits these inputs to WorkerPool. */
export function* collisionSectors(source: HvpCollisionSource): Generator<HvpCollisionSector> {
  for (const input of collisionInputs(source)) { yield meshCollisionInput(input); }
}
