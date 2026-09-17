import { fnv1aHash } from "../../core/hash";
import { HVP_COAST_SEED_NAME, HVP_SOURCE_CELL_METERS, readHvpSourceColumnWorld } from "../../hvp/hvpCoastSource";
import { meshHvpOccupancy, type HvpCompactMesh, type HvpMeshOccupancy } from "../../hvp/hvpCoastMesher";
import {
  artifactRevision, createMaterialProfile, createMeshArtifact, frameId, materialProfileId,
  representationKey, sourceRevision, type MaterialProfile, type MeshArtifact,
  type RepresentationTransformSnapshot, type Vector3Snapshot, type QuaternionSnapshot
} from "../../presentation";
import { HVP_FRAME_ID, HVP_TERRAIN_REPRESENTATION_KEY } from "../../hvp/hvpTerrain";

export const HVP_VEGETATION_VERSION = "hvp-root-umbrella-v3";
const cell = HVP_SOURCE_CELL_METERS;
type Q = readonly [number, number, number];
const TREE_HALF = [48, 40, 34, 30] as const;
const TREE_HEIGHT = [120, 104, 90, 80] as const;
const BED_ORIGIN: Q = [-11, -16, -11];
const BED_SIZE: Q = [22, 48, 22];
export type HvpPlantKind = "tree" | "reed" | "broadleaf" | "violet" | "amber";
export interface HvpPlantInstance {
  readonly id: string;
  readonly kind: HvpPlantKind;
  readonly variant: number;
  readonly position: Vector3Snapshot;
}
export interface HvpPlantVolume extends HvpMeshOccupancy {
  readonly byteLength: number;
  copySlots(): Uint8Array;
}
export interface HvpPlantSource {
  readonly instance: HvpPlantInstance;
  readonly wood: HvpPlantVolume | null;
  readonly decoration: HvpPlantVolume;
  readonly anchors: readonly { readonly id: string; readonly cell: Q }[];
  readonly attachments: readonly HvpPlantAttachment[];
  readonly decorationPhysics: "none";
  readonly digest: string;
}

export interface HvpPlantAttachment {
  readonly id: string;
  /** Presentation owner; not a claim that a solver body already exists. */
  readonly ownerId: string;
  readonly supportOwnerId: string;
  readonly supportKind: "wood" | "terrain";
  readonly supportCell: Q;
}

export const hvpPlantSourceDigest=(id:string,volumes:readonly (HvpPlantVolume|null)[]):string=>{
  let digest=2166136261;
  for(const volume of volumes){if(volume===null){continue;}for(const byte of volume.copySlots()){digest=Math.imul(digest^byte,16777619)>>>0;}}
  return fnv1aHash(`${HVP_VEGETATION_VERSION}:${id}:${digest}`);
};

/** The same bounded grids reserve payload before allocating any authored slots. */
export const estimateHvpVegetationSourceBytes = (plants: readonly HvpPlantInstance[]): number =>
  plants.reduce((bytes, plant) => bytes + (plant.kind === "tree"
    ? 2 * (TREE_HALF[plant.variant]! * 2) ** 2 * TREE_HEIGHT[plant.variant]!
    : BED_SIZE[0] * BED_SIZE[1] * BED_SIZE[2]), 0);

const groundAt = (x: number, z: number): number => readHvpSourceColumnWorld(x + cell / 2, z + cell / 2).topMeters;
const hash = (key: string): number => Number.parseInt(fnv1aHash(`${HVP_COAST_SEED_NAME}:${key}`), 16) >>> 0;
const clearing = (x: number, z: number): boolean => Math.hypot(x + 9, z + 9) <= 3.25;

/** Authored habitat boundary; a valid grid address alone does not permit planting. */
export const isHvpPlantHabitat = (kind: HvpPlantKind, x: number, z: number): boolean => {
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) >= 16 || Math.abs(z) >= 16 || clearing(x, z)) {
    return false;
  }
  const y = groundAt(x, z);
  if (kind === "tree") { return y > 0; }
  const slope = Math.max(...[[-0.5,0],[0.5,0],[0,-0.5],[0,0.5]].map(([dx,dz]) => Math.abs(groundAt(x+dx!,z+dz!) - y)));
  if (slope > 0.5) { return false; }
  return kind === "reed" ? y >= -0.5 && y <= 0.25 : y > 0.25 && y <= 3;
};

/** Stateless authored features plus habitat-filtered clusters; never frame-time RNG. */
export const planHvpVegetation = (leaf?: readonly [number, number]): readonly HvpPlantInstance[] => {
  if (leaf !== undefined && !leaf.every(Number.isSafeInteger)) { throw new TypeError("Vegetation leaf coordinates must be integers"); }
  const result: HvpPlantInstance[] = [];
  const add = (id: string, kind: HvpPlantKind, variant: number, x: number, z: number): void => {
    result.push(Object.freeze({ id: `hvp:flora:${id}`, kind, variant,
      position: Object.freeze({ x, y: groundAt(x, z), z }) }));
  };
  for (const [id, variant, x, z] of [
    ["hero", 0, 8, 7], ["west-frame", 1, -11, 3], ["east-young", 2, 12, -6], ["north-young", 3, -6, 12]
  ] as const) {
    if (!isHvpPlantHabitat("tree", x, z)) { throw new Error(`Invalid tree habitat: ${id}`); }
    add(id, "tree", variant, x, z);
  }
  // Deliberately unequal planted beds separated by open rock/water and the salvage clearing.
  const beds = [[-6,-10,3.5],[-6,-2,4],[7,-7,3.5],[6,9,4],[-9,10,4],[11,1,4],[1,12,3],[-12,-4,3],[4,-12,4]] as const;
  for (let z = -14; z <= 14; z += 1.5) {
    for (let x = -14; x <= 14; x += 1.5) {
      if (clearing(x,z) || !beds.some(([bx,bz,r]) => Math.hypot(x-bx,z-bz) < r)) { continue; }
      if (result.some((p) => p.kind === "tree" && Math.hypot(x-p.position.x,z-p.position.z) < 2.25)) { continue; }
      const y = groundAt(x,z);
      const seed = hash(`${x},${z}`);
      const kind: HvpPlantKind = y <= 0.25 ? "reed" : seed % 5 === 0 ? "amber" : seed % 3 === 0 ? "violet" : "broadleaf";
      if (!isHvpPlantHabitat(kind, x, z)) { continue; }
      add(`bed-${(x+16)*8}-${(z+16)*8}`, kind, seed % 3, x, z);
    }
  }
  return Object.freeze(leaf === undefined ? result : result.filter((p) => Math.floor(p.position.x / 2) === leaf[0] && Math.floor(p.position.z / 2) === leaf[1]));
};

/** Bounded local authored cells, not an invented Adaptive/Structural source binding. */
const volumeBuilder = (origin: Q, size: Q) => {
  const [sx,sy,sz] = size;
  const slots = new Uint8Array(sx * sy * sz);
  const index = (x: number,y: number,z: number): number => x + sx * (y + sy*z);
  const put = (x: number,y: number,z: number,slot: number): void => {
    const ix=x-origin[0], iy=y-origin[1], iz=z-origin[2];
    if (ix<0 || iy<0 || iz<0 || ix>=sx || iy>=sy || iz>=sz) { throw new RangeError("Authored vegetation exceeds its local volume"); }
    slots[index(ix,iy,iz)] = slot;
  };
  const line = (a: Q,b: Q,radius: number,slot: number): void => {
    const steps=Math.max(...a.map((v,i)=>Math.abs(v-b[i]!)))*2;
    for (let i=0;i<=steps;i+=1) {
      const t=steps===0?0:i/steps;
      const center = a.map((v,j)=>Math.round(v+(b[j]!-v)*t));
      for (let z = -radius; z <= radius; z += 1) {
        for (let y = -radius; y <= radius; y += 1) {
          for (let x = -radius; x <= radius; x += 1) {
            if (x*x + y*y + z*z <= radius*radius + 0.5) { put(center[0]! + x, center[1]! + y, center[2]! + z, slot); }
          }
        }
      }
    }
  };
  const volume: HvpPlantVolume = Object.freeze({
    sizeX:sx,sizeY:sy,sizeZ:sz,cellMeters:cell,
    originMeters:Object.freeze({x:origin[0]*cell,y:origin[1]*cell,z:origin[2]*cell}),
    byteLength:slots.byteLength,
    slotAt:(x:number,y:number,z:number)=>!Number.isInteger(x)||!Number.isInteger(y)||!Number.isInteger(z)||x<0||y<0||z<0||x>=sx||y>=sy||z>=sz?0:slots[index(x,y,z)]!,
    copySlots:()=>slots.slice()
  });
  const exclude = (other: Uint8Array): void => {
    if (other.length !== slots.length) { throw new Error("Plant component grids must agree"); }
    for (let i = 0; i < slots.length; i += 1) {
      if (other[i] !== 0) { slots[i] = 0; }
    }
  };
  return {volume,put,line,exclude,toCell:(q:Q):Q=>Object.freeze([q[0]-origin[0],q[1]-origin[1],q[2]-origin[2]])};
};

export const buildHvpPlant = (instance: HvpPlantInstance): HvpPlantSource => {
  representationKey(instance.id);
  if (!Number.isInteger(instance.variant) || instance.variant < 0 || instance.variant > 3
    || ![instance.position.x,instance.position.y,instance.position.z].every((v)=>Number.isFinite(v)&&Number.isSafeInteger(v*8))) {
    throw new TypeError("Vegetation requires a finite quantized authored pose and supported variant");
  }
  if (!["tree", "reed", "broadleaf", "violet", "amber"].includes(instance.kind)
    || !isHvpPlantHabitat(instance.kind, instance.position.x, instance.position.z)
    || instance.position.y !== groundAt(instance.position.x, instance.position.z)) {
    throw new Error("Vegetation source requires its valid terrain-bound habitat");
  }
  const tree = instance.kind === "tree";
  const half = TREE_HALF[instance.variant]!;
  const origin: Q = tree ? [-half, -32, -half] : BED_ORIGIN;
  const size: Q = tree ? [half * 2, TREE_HEIGHT[instance.variant]!, half * 2] : BED_SIZE;
  const wood = tree?volumeBuilder(origin,size):null;
  const decor = volumeBuilder(origin,size);
  const anchors: Array<{id:string;cell:Q}> = [];
  const attachments: HvpPlantAttachment[] = [];
  const localGround = (x:number,z:number):number => Math.round((groundAt(instance.position.x+x*cell,instance.position.z+z*cell)-instance.position.y)*8);
  if (wood !== null) {
    const scale = [1,0.82,0.65,0.54][instance.variant]!;
    const q=(v:number):number=>Math.round(v*scale);
    const junction:Q=[0,q(28),0];
    for (const [i,foot] of ([[-24,-16],[24,-8],[8,24],[-16,24]] as const).entries()) {
      const x=q(foot[0]),z=q(foot[1]),y=localGround(x,z);
      const start:Q=[x,y,z];
      // An exact terrain-contact cell; rising buttresses leave the central passage open.
      const radius = i === instance.variant ? 3 : 2;
      const knee: Q = [q(foot[0]*0.8), Math.max(y+5,q(12)), q(foot[1]*0.8)];
      const shoulder: Q = [q(foot[0]*0.45), Math.max(y+8,q(25)), q(foot[1]*0.45)];
      wood.line(start,knee,radius,1);
      wood.line(knee,shoulder,2,1);
      wood.line(shoulder,junction,2,1);
      anchors.push(Object.freeze({id:`${instance.id}:root:${i}`,cell:wood.toCell(start)}));
    }
    const bend: Q = [q(instance.variant % 2 === 0 ? 5 : -6),q(43),q(3)];
    wood.line(junction,bend,Math.max(2,q(4)),1);
    wood.line(bend,[q(-2),q(59),q(2)],Math.max(2,q(3)),1);
    // Unequal lateral boughs and low, lobed layered crowns, not spheres or one solid cap.
    const crowns = [
      [[-25,49,-10,17,12],[19,59,-15,20,14],[7,55,22,19,16],[-19,65,15,17,13],[0,69,0,20,17]],
      [[-22,51,-14,20,14],[24,58,8,18,20],[-3,68,8,26,21]],
      [[-25,45,-10,17,12],[18,49,-17,18,13],[24,60,14,18,15],[-18,60,20,20,14],[0,69,0,23,19],[0,40,26,14,12]],
      [[-22,53,15,21,16],[21,59,-15,20,18],[0,69,0,23,20],[18,42,17,15,11]]
    ][instance.variant]!;
    for (const [i,lobe] of crowns.entries()) {
      const [lx,ly,lz,rx,rz] = lobe.map(q);
      const tip:Q=[lx!,ly!,lz!];
      const fork: Q = [Math.round(lx!*0.5),ly!-q(8),Math.round(lz!*0.5)];
      wood.line(bend,fork,Math.max(1,q(2)),1);
      wood.line(fork,tip,1,1);
      attachments.push(Object.freeze({id:`${instance.id}:crown:${i}`,ownerId:instance.id,
        supportOwnerId:instance.id,supportKind:"wood",supportCell:wood.toCell(tip)}));
      for(let z=-rz!;z<=rz!;z+=1) {
        for(let x=-rx!;x<=rx!;x+=1) {
          const angle=Math.atan2(z,x);
          const radius=(x/rx!)**2+(z/rz!)**2;
          const edge=0.86+0.12*Math.sin(5*angle+i)+0.08*Math.cos(9*angle-i);
          if(radius>edge) { continue; }
           const cluster = hash(`${instance.id}:crown:${i}:${Math.floor(x/3)}:${Math.floor(z/3)}`);
           if (radius > edge - 0.25 && cluster % 3 === 0) { continue; }
           const relief = Math.round(2*Math.sin(x*0.31+i)+2*Math.cos(z*0.27-i));
           const top=ly!+q(2)+Math.floor((1-radius)*q(4))+cluster%4+relief;
           const tone=1+cluster%3;
           const bottom=ly!-1-Math.round((1-radius)*q(3))+(cluster%3);
           for(let y=bottom;y<=Math.max(bottom,top);y+=1) { decor.put(lx!+x,y,lz!+z,tone); }
           if(radius>edge-0.16 && hash(`vine:${i}:${x}:${z}`)%17===0) {
             const end=bottom-q(9+hash(`${instance.id}:${x}:${z}`)%14);
             decor.line([lx!+x,bottom,lz!+z],[lx!+x,end,lz!+z],0,3);
             for(let y=end+2;y<bottom;y+=4) { decor.put(lx!+x+1,y,lz!+z,2); }
          }
        }
      }
    }
  } else {
    const stalkCount = 5 + hash(instance.id) % 3;
    const bases = [[-4,-4],[0,-4],[4,-3],[-4,1],[1,0],[4,4],[-1,4]] as const;
    for (let i = 0; i < stalkCount; i += 1) {
      const seed = hash(`${instance.id}:${i}`);
      const x = bases[i]![0] + seed % 3 - 1;
      const z = bases[i]![1] + (seed >>> 8) % 3 - 1;
      const y = localGround(x, z);
      if (instance.kind === "broadleaf") {
        // Basal fern-like fronds: no bare trunk and no raised miniature crown.
        decor.put(x, y, z, 1);
        for (let leaf = 0; leaf < 5 + instance.variant; leaf += 1) {
          const angle = leaf * 2.399 + seed % 17;
          const length = 3 + (seed + leaf) % 3;
          const dx = Math.round(length * Math.cos(angle)), dz = Math.round(length * Math.sin(angle));
          // A herb stays on its terrace rather than bridging a cliff like a bough.
          let onTerrace = true;
          for (let px = Math.min(x, x + dx); px <= Math.max(x, x + dx); px += 1) {
            for (let pz = Math.min(z, z + dz); pz <= Math.max(z, z + dz); pz += 1) {
              if (Math.abs(localGround(px, pz) - y) > 2) { onTerrace = false; }
            }
          }
          if (!onTerrace) { continue; }
          const middle: Q = [x + Math.round(dx / 2), y + 2 + leaf % 2, z + Math.round(dz / 2)];
          const tip: Q = [x + dx, Math.min(y + 1, localGround(x + dx, z + dz) + 1), z + dz];
          const tone = 1 + leaf % 2;
          decor.line([x, y, z], middle, 0, tone);
          decor.line(middle, tip, 0, tone);
          // Small alternating leaflets, rather than solid horizontal plates.
          const sx = Math.abs(dz) >= Math.abs(dx) ? 1 : 0, sz = sx === 0 ? 1 : 0;
          for (const side of [-1, 1]) {
            if (Math.abs(localGround(middle[0] + side * sx, middle[2] + side * sz) - y) <= 2) {
              decor.put(middle[0] + side * sx, middle[1] - 1, middle[2] + side * sz, tone);
            }
          }
        }
      } else {
        const height = instance.kind === "amber" ? 7 + seed % 5
          : instance.kind === "reed" ? 5 + seed % 5 : 3 + seed % 4;
        const desiredLean = (seed >>> 16) % 3 - 1;
        const lean = Math.abs(localGround(x + desiredLean, z) - y) <= 1 ? desiredLean : 0;
        const tip: Q = [x + lean, y + height, z];
        decor.line([x, y, z], tip, 0, 1);
        // Narrow ground-emergent blades keep reed/flower silhouettes herbaceous.
        decor.line([x, y, z], [x - 2, y + Math.min(4, height - 1), z + 1], 0, 1);
        decor.line([x, y, z], [x + 1, y + Math.min(3, height - 1), z - 2], 0, 1);
        if (instance.kind === "amber") {
          // One-cell-wide orange spike, not a 0.375 m thick yellow column.
          decor.line([tip[0], tip[1] - 2, tip[2]], tip, 0, 2);
        } else if (instance.kind === "violet") {
          decor.put(tip[0], tip[1], tip[2], 2);
          decor.put(tip[0] + 1, tip[1] - 2, tip[2], 2);
        } else {
          decor.put(tip[0], tip[1], tip[2], 2);
        }
      }
    }
    attachments.push(Object.freeze({id:`${instance.id}:bed`,ownerId:instance.id,
      supportOwnerId:HVP_TERRAIN_REPRESENTATION_KEY,supportKind:"terrain",
      supportCell:Object.freeze([(instance.position.x+16)*8,(instance.position.y+8)*8-1,(instance.position.z+16)*8] as const)}));
  }
  if (wood !== null) { decor.exclude(wood.volume.copySlots()); }
  // Digest the actual generated bytes plus version/identity; presentation colors are separate.
  return Object.freeze({instance:Object.freeze({...instance,position:Object.freeze({...instance.position})}),wood:wood?.volume??null,decoration:decor.volume,
    anchors:Object.freeze(anchors),attachments:Object.freeze(attachments),decorationPhysics:"none",
    digest:hvpPlantSourceDigest(instance.id,[wood?.volume??null,decor.volume])});
};

/** Proposed HVP wood tuning, not calibrated material physics; decor has no mass. */
export const measureHvpWood = (wood: HvpPlantVolume) => {
  let count=0,x=0,y=0,z=0;
  const bytes=wood.copySlots();
  for(let i=0;i<bytes.length;i+=1) {
    if(bytes[i]===0) { continue; }
    count+=1;
    x+=wood.originMeters.x+(i%wood.sizeX+0.5)*cell;
    y+=wood.originMeters.y+(Math.floor(i/wood.sizeX)%wood.sizeY+0.5)*cell;
    z+=wood.originMeters.z+(Math.floor(i/(wood.sizeX*wood.sizeY))+0.5)*cell;
  }
  if(count===0) { throw new Error("Wood source must not be empty"); }
  return Object.freeze({massKg:count*600*cell**3,centerOfMass:Object.freeze({x:x/count,y:y/count,z:z/count})});
};

export interface HvpVegetationProduct {
  readonly ownerId:string;
  readonly artifact:MeshArtifact;
  readonly profiles:readonly MaterialProfile[];
  readonly mesh:HvpCompactMesh;
}
const colors = {
  wood:[[0.32,0.21,0.10]],
  tree:[[0.13,0.37,0.11],[0.22,0.46,0.13],[0.09,0.30,0.15]],
  reed:[[0.07,0.43,0.39],[0.11,0.55,0.40]],
  broadleaf:[[0.15,0.35,0.12],[0.27,0.47,0.15]],
  violet:[[0.13,0.36,0.19],[0.59,0.28,0.65]],
  amber:[[0.12,0.36,0.24],[0.78,0.29,0.035]]
} as const;

export const meshHvpVegetation = (
  source:HvpPlantSource,
  canopyPalette: readonly (readonly [number, number, number])[] = colors.tree
):readonly HvpVegetationProduct[] => {
  const result:HvpVegetationProduct[]=[];
  for(const [part,volume] of [["wood",source.wood],[source.instance.kind,source.decoration]] as const) {
    if(volume===null) { continue; }
    const occupancy = part === "wood" ? volume : {
      ...volume, slotAt:(x:number,y:number,z:number)=>volume.slotAt(x,y,z) === 0 ? 0 : 1
    };
    const raw=meshHvpOccupancy(occupancy,undefined,source.digest,HVP_VEGETATION_VERSION,{ao:part==="wood"});
    // Flat voxel faces own their vertices. Bake cosmetic colors without merging
    // object ownership; palette variety costs no extra material groups/draws.
    let vertexColors=raw.colors;
    if(part!=="wood") {
      vertexColors=new Float32Array(raw.positions.length);
      for(let face=0;face<raw.positions.length;face+=12) {
        const center=[0,1,2].map((axis)=>(raw.positions[face+axis]!+raw.positions[face+3+axis]!
          +raw.positions[face+6+axis]!+raw.positions[face+9+axis]!)/4);
        for(let vertex=face;vertex<face+12;vertex+=3) {
          // Sample just inside the occupied face corner; the source palette does
          // not force otherwise merge-compatible cosmetic faces to split.
          const sample=[0,1,2].map((axis)=>Math.floor((raw.positions[vertex+axis]!
            -raw.normals[vertex+axis]!*cell/2+(center[axis]!-raw.positions[vertex+axis]!)*0.001
            -[volume.originMeters.x,volume.originMeters.y,volume.originMeters.z][axis]!)/cell));
          const slot=volume.slotAt(sample[0]!,sample[1]!,sample[2]!);
          const rgb=(part==="tree"?canopyPalette:colors[part])[slot-1];
          if(rgb===undefined || rgb.length!==3 || !rgb.every((v)=>Number.isFinite(v)&&v>=0&&v<=1)) {
            throw new Error("Invalid vegetation presentation palette or face sample");
          }
          vertexColors.set(rgb,vertex);
        }
      }
    }
    const mesh:HvpCompactMesh={...raw,colors:vertexColors,materialRanges:[{slot:1,startIndex:0,indexCount:raw.indices.length}]};
    const rgb=part==="wood"?colors.wood[0]:[1,1,1];
    const profiles=[createMaterialProfile({id:materialProfileId(`hvp:flora:${part}:vertex-palette-v2`),kind:"BasicLit",
      baseColor:{r:rgb[0]!,g:rgb[1]!,b:rgb[2]!},opacity:1,doubleSided:false,wireframe:false,depthWrite:true})];
    result.push(Object.freeze({ownerId:source.instance.id,mesh,profiles:Object.freeze(profiles),artifact:createMeshArtifact({
      representationKey:representationKey(`${source.instance.id}:${part}`),frameId:frameId(HVP_FRAME_ID),
      sourceRevision:sourceRevision(1),artifactRevision:artifactRevision(0),algorithmVersion:HVP_VEGETATION_VERSION,
      positions:mesh.positions,normals:mesh.normals,indices:mesh.indices,
      attributes:mesh.colors===null?undefined:{color:mesh.colors},bounds:mesh.boundsMeters,
      materialRanges:mesh.materialRanges.map((range,i)=>({materialProfileId:profiles[i]!.id,startIndex:range.startIndex,indexCount:range.indexCount}))
    })}));
  }
  return Object.freeze(result);
};

export interface HvpVegetationPose { readonly ownerId:string; readonly position:Vector3Snapshot; readonly orientation:QuaternionSnapshot; }
/** Same consumer for initial authored placement and later owner-pose snapshots. */
export const projectHvpVegetation = (products:readonly HvpVegetationProduct[],poses:readonly HvpVegetationPose[]):readonly RepresentationTransformSnapshot[] => {
  const byOwner=new Map(poses.map((pose)=>[pose.ownerId,pose]));
  if(byOwner.size!==poses.length) { throw new Error("Duplicate vegetation owner pose"); }
  return Object.freeze(products.map((product)=>{
    const pose=byOwner.get(product.ownerId);
    if(pose===undefined) { throw new Error(`Missing vegetation owner pose: ${product.ownerId}`); }
    if (![pose.position.x, pose.position.y, pose.position.z,
      pose.orientation.x, pose.orientation.y, pose.orientation.z, pose.orientation.w].every(Number.isFinite)
      || Math.abs(pose.orientation.x ** 2 + pose.orientation.y ** 2 + pose.orientation.z ** 2 + pose.orientation.w ** 2 - 1) > 1e-6) {
      throw new Error("Vegetation pose must be finite with a unit quaternion");
    }
    return Object.freeze({representationKey:product.artifact.representationKey,positionRelative:Object.freeze({...pose.position}),
      orientation:Object.freeze({...pose.orientation}),scale:Object.freeze({x:1,y:1,z:1})});
  }));
};
