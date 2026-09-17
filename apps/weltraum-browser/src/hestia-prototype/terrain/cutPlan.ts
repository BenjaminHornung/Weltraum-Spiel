import { fnv1aHash } from "../../core/hash";
import { fnv1aBytes } from "../../workers/protocol";
import type { HvpCell, HvpCellReader } from "./picking";
import {encodeHvpGridChunks,decodeHvpGrid,type HvpGridCheckpoint} from "../persistence/gridCheckpoint";

export interface HvpTerrainCheckpoint {
  readonly version:"hvp-terrain-checkpoint-v1";
  readonly sessionId:string;readonly epoch:number;readonly revision:number;
  readonly baseDigest:string;readonly sourceDigest:string;readonly base:HvpGridCheckpoint;
  readonly leaves:readonly {readonly key:readonly[number,number,number];readonly revision:number;readonly grid:HvpGridCheckpoint}[];
}
const terrainOwners=new WeakSet<object>();
const terrainSnapshots=new WeakSet<object>();
export const assertHvpTerrainSnapshot=(snapshot:HvpTerrainSnapshot):void=>{
  if(!terrainSnapshots.has(snapshot)){throw new Error("Unvalidated terrain snapshot");}
};

export type HvpCutShape = { readonly kind: "Box"; readonly min: HvpCell; readonly max: HvpCell }
  | { readonly kind: "Sphere"; readonly center2: HvpCell; readonly radius2: number };
export interface HvpCutRequest {
  readonly sessionId: string; readonly epoch: number; readonly revision: number; readonly sourceDigest: string;
  readonly commandId: string; readonly toolPolicy: "hvp-plasma-v1"; readonly shape: HvpCutShape;
}
export interface HvpTerrainSnapshot extends HvpCellReader {
  readonly baseDigest:string;
  readonly sessionId: string; readonly epoch: number; readonly revision: number; readonly sourceDigest: string;
  readonly overlayBytes: number;
  copyLeaf(x: number, y: number, z: number): Uint8Array;
  leafRevision(x: number, y: number, z: number): number;
}
export interface HvpPreparedCut {
  readonly before: HvpTerrainSnapshot; readonly after: HvpTerrainSnapshot;
  readonly request: HvpCutRequest; readonly signature: string;
  readonly changed: readonly { readonly cell: HvpCell; readonly before: number; readonly after: 0 }[];
  readonly contentLeaves: readonly string[]; readonly dependencyLeaves: readonly string[];
}
const integerCell = (p: HvpCell): boolean => Array.isArray(p) && p.length === 3
  && p.every(v => Number.isSafeInteger(v) && Math.abs(v) <= 1_000_000);
const leafKey = (x: number, y: number, z: number): string => `${Math.floor(x / 16)}:${Math.floor(y / 16)}:${Math.floor(z / 16)}`;
const leafIndex = (x: number, y: number, z: number): number => x % 16 + (y % 16) * 16 + (z % 16) * 256;

/** At most 8^3 candidates; inclusive integer sphere boundary, half-open box. */
export const selectHvpCutCells = (shape: HvpCutShape): readonly HvpCell[] => {
  let min: HvpCell, max: HvpCell;
  if (shape.kind === "Box") {
    if (!integerCell(shape.min) || !integerCell(shape.max)) { throw new RangeError("Invalid cut box"); }
    min = shape.min; max = shape.max;
  } else if (shape.kind === "Sphere") {
    if (!integerCell(shape.center2) || !Number.isSafeInteger(shape.radius2) || shape.radius2 < 1 || shape.radius2 > 8) {
      throw new RangeError("Invalid cut sphere BudgetExceeded");
    }
    min = shape.center2.map(c => Math.ceil((c - shape.radius2 - 1) / 2)) as unknown as HvpCell;
    max = shape.center2.map(c => Math.floor((c + shape.radius2 - 1) / 2) + 1) as unknown as HvpCell;
  } else { throw new RangeError("Unknown cut shape"); }
  const sizes = max.map((v, a) => v - min[a]!);
  if (sizes.some(n => n <= 0 || n > 9) || sizes.reduce((a,b) => a*b, 1) > (shape.kind === "Sphere" ? 729 : 512)
    || (shape.kind === "Box" && sizes.some(n => n > 8))) { throw new RangeError("Cut BudgetExceeded"); }
  const cells: HvpCell[] = [];
  const leaves = new Set<string>();
  for (let z = min[2]; z < max[2]; z += 1) { for (let y = min[1]; y < max[1]; y += 1) { for (let x = min[0]; x < max[0]; x += 1) {
    if (shape.kind === "Sphere" && (2*x+1-shape.center2[0])**2 + (2*y+1-shape.center2[1])**2 + (2*z+1-shape.center2[2])**2 > shape.radius2**2) { continue; }
    leaves.add(leafKey(x,y,z));
    if (cells.length >= 512 || leaves.size > 8) { throw new RangeError("Cut BudgetExceeded"); }
    cells.push(Object.freeze([x,y,z]));
  } } }
  return Object.freeze(cells);
};

/** Bound and copy only the supported wire fields before asynchronous queueing. */
export const snapshotHvpCutRequest = (request: HvpCutRequest): HvpCutRequest => {
  if (!request || typeof request.sessionId !== "string" || !/^[A-Za-z0-9:._-]{1,128}$/.test(request.sessionId)
    || typeof request.commandId !== "string" || !/^[A-Za-z0-9:._-]{1,128}$/.test(request.commandId)
    || typeof request.sourceDigest !== "string" || !/^[a-f0-9]{8}$/.test(request.sourceDigest)
    || !Number.isSafeInteger(request.epoch) || request.epoch < 0 || !Number.isSafeInteger(request.revision) || request.revision < 0
    || request.toolPolicy !== "hvp-plasma-v1") { throw new Error("Invalid tool command boundary"); }
  selectHvpCutCells(request.shape);
  const shape: HvpCutShape = request.shape.kind === "Box"
    ? Object.freeze({kind:"Box",min:Object.freeze([...request.shape.min]) as HvpCell,max:Object.freeze([...request.shape.max]) as HvpCell})
    : Object.freeze({kind:"Sphere",center2:Object.freeze([...request.shape.center2]) as HvpCell,radius2:request.shape.radius2});
  return Object.freeze({sessionId:request.sessionId,epoch:request.epoch,revision:request.revision,
    sourceDigest:request.sourceDigest,commandId:request.commandId,toolPolicy:request.toolPolicy,shape});
};

/** Sparse immutable COW leaf generations over the validated authored base. */
export const createHvpTerrainRoot = (base: HvpCellReader & { sourceDigest: string }, sessionId: string, epoch: number,
  protectedCell: (x: number, y: number, z: number) => boolean = (_x, y) => y === 0,
  checkpoint?:HvpTerrainCheckpoint) => {
  if (!/^[A-Za-z0-9:._-]{1,128}$/.test(sessionId) || !Number.isSafeInteger(epoch) || epoch < 0 || base.cellMeters !== 0.125
    || ![base.sizeX,base.sizeY,base.sizeZ].every(n => Number.isSafeInteger(n) && n > 0 && n <= 256)) {
    throw new Error("Invalid terrain root boundary");
  }
  type Leaf = { slots: Uint8Array; revision: number; digest: string };
  const maps = new WeakMap<HvpTerrainSnapshot, ReadonlyMap<string, Leaf>>();
  const issued = new WeakSet<HvpPreparedCut>();
  const inside = (x: number, y: number, z: number): boolean => x >= 0 && x < base.sizeX && y >= 0 && y < base.sizeY && z >= 0 && z < base.sizeZ;
  const make = (leaves: ReadonlyMap<string, Leaf>, revision: number): HvpTerrainSnapshot => {
    const leafCountX=Math.ceil(base.sizeX/16),leafCountY=Math.ceil(base.sizeY/16);
    const changedLeaves=leaves.size===0?null:(()=>{
      const present=new Uint8Array(leafCountX*leafCountY*Math.ceil(base.sizeZ/16));
      for(const key of leaves.keys()){
        const separator1=key.indexOf(":"),separator2=key.indexOf(":",separator1+1);
        const lx=Number(key.slice(0,separator1)),ly=Number(key.slice(separator1+1,separator2)),lz=Number(key.slice(separator2+1));
        if(Number.isSafeInteger(lx)&&Number.isSafeInteger(ly)&&Number.isSafeInteger(lz)){
          present[lx+ly*leafCountX+lz*leafCountX*leafCountY]=1;
        }
      }
      return present;
    })();
    const readSlot = (x: number, y: number, z: number): number | undefined => {
      if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !Number.isSafeInteger(z)) { throw new RangeError("Integer cell required"); }
      if (!inside(x,y,z)) { return undefined; }
      if (changedLeaves===null) { return base.readSlot(x,y,z); }
      const lx=(x/16)|0,ly=(y/16)|0,lz=(z/16)|0;
      if(changedLeaves[lx+ly*leafCountX+lz*leafCountX*leafCountY]===0){return base.readSlot(x,y,z);}
      return leaves.get(leafKey(x,y,z))?.slots[leafIndex(x,y,z)] ?? base.readSlot(x,y,z);
    };
    const snapshot: HvpTerrainSnapshot = Object.freeze({ sizeX: base.sizeX, sizeY: base.sizeY, sizeZ: base.sizeZ,
      cellMeters: base.cellMeters, originMeters: Object.freeze({ ...base.originMeters }), sessionId, epoch, revision,
      baseDigest:base.sourceDigest,
      sourceDigest: leaves.size === 0 ? base.sourceDigest : fnv1aHash(JSON.stringify([base.sourceDigest,
        [...leaves].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, leaf]) => [key,leaf.digest])])),
      overlayBytes: leaves.size * 4096, readSlot,
      leafRevision: (x: number, y: number, z: number) => leaves.get(`${x}:${y}:${z}`)?.revision ?? 0,
      copyLeaf(x: number, y: number, z: number): Uint8Array {
        if (![x,y,z].every(Number.isSafeInteger)) { throw new RangeError("Integer leaf required"); }
        const changed=leaves.get(`${x}:${y}:${z}`);
        if(changed){return changed.slots.slice();}
        const data = new Uint8Array(4096);
        for (let z1=0;z1<16;z1+=1) { for (let y1=0;y1<16;y1+=1) { for (let x1=0;x1<16;x1+=1) {
          const gx=x*16+x1, gy=y*16+y1, gz=z*16+z1;
          const slot = inside(gx,gy,gz) ? base.readSlot(gx,gy,gz) : 0;
          if (slot === undefined) { throw new Error("Unknown leaf coverage"); }
          data[x1+y1*16+z1*256] = slot;
        } } }
        return data;
      }
    });
    maps.set(snapshot, leaves);
    terrainSnapshots.add(snapshot);
    return snapshot;
  };
  const restored=new Map<string,Leaf>();
  if(checkpoint){
    if(checkpoint.sessionId!==sessionId||checkpoint.epoch!==epoch||checkpoint.baseDigest!==base.sourceDigest
      ||!Number.isSafeInteger(checkpoint.revision)||checkpoint.revision<0||!Array.isArray(checkpoint.leaves)
      ||checkpoint.leaves.length>Math.ceil(base.sizeX/16)*Math.ceil(base.sizeY/16)*Math.ceil(base.sizeZ/16)){
      throw new Error("Invalid checkpoint revision or leaf coverage");
    }
    for(const leaf of checkpoint.leaves){
      if(!Array.isArray(leaf.key)||leaf.key.length!==3||!leaf.key.every((n:number,a:number)=>Number.isSafeInteger(n)&&n>=0&&n<Math.ceil([base.sizeX,base.sizeY,base.sizeZ][a]!/16))
        ||!Number.isSafeInteger(leaf.revision)||leaf.revision<1||leaf.revision>checkpoint.revision){throw new Error("Invalid checkpoint leaf revision/address");}
      const [lx,ly,lz]=leaf.key,key=leaf.key.join(":");
      if(restored.has(key)||JSON.stringify(leaf.grid.size)!=="[16,16,16]"){throw new Error("Duplicate or malformed checkpoint leaf");}
      const grid=decodeHvpGrid(leaf.grid);
      if(grid.originMeters.x!==base.originMeters.x+lx*2||grid.originMeters.y!==base.originMeters.y+ly*2||grid.originMeters.z!==base.originMeters.z+lz*2){throw new Error("Checkpoint leaf frame mismatch");}
      const slots=grid.copySlots();let differences=0;
      for(let z=0;z<16;z+=1){for(let y=0;y<16;y+=1){for(let x=0;x<16;x+=1){
        const gx=lx*16+x,gy=ly*16+y,gz=lz*16+z,slot=slots[x+y*16+z*256]!;
        const old=inside(gx,gy,gz)?base.readSlot(gx,gy,gz):0;
        if(old===undefined||(slot!==0&&slot!==old)||(slot!==old&&protectedCell(gx,gy,gz))){throw new Error("Invalid checkpoint material/ownership change");}
        if(slot!==old){differences+=1;}
      }}}
      if(differences===0){throw new Error("Checkpoint leaf revision without content change");}
      restored.set(key,{slots,revision:leaf.revision,digest:fnv1aBytes([slots.buffer as ArrayBuffer])});
    }
    if((checkpoint.revision===0)!==(restored.size===0)){throw new Error("Checkpoint revision mismatch");}
  }
  let current = make(restored, checkpoint?.revision??0);
  if(checkpoint&&current.sourceDigest!==checkpoint.sourceDigest){throw new Error("Checkpoint source digest mismatch");}
  let lastCommit: HvpPreparedCut | undefined;
  function* checkpointChunks():Generator<void,HvpTerrainCheckpoint>{
    const captured=current,entries=[...maps.get(captured)!].sort(([a],[b])=>a<b?-1:a>b?1:0);
    const grid=yield* encodeHvpGridChunks(base),leaves: HvpTerrainCheckpoint["leaves"][number][]=[];
    for(const [key,leaf] of entries){
      const [x,y,z]=key.split(":").map(Number);
      const value=yield* encodeHvpGridChunks({sizeX:16,sizeY:16,sizeZ:16,cellMeters:.125,
        originMeters:{x:base.originMeters.x+x!*2,y:base.originMeters.y+y!*2,z:base.originMeters.z+z!*2},
        readSlot:(a,b,c)=>leaf.slots[a+b*16+c*256]});
      leaves.push(Object.freeze({key:Object.freeze([x!,y!,z!]) as readonly[number,number,number],revision:leaf.revision,grid:value}));
      if(leaves.length%4===0){yield;}
    }
    return Object.freeze({version:"hvp-terrain-checkpoint-v1",sessionId,epoch,revision:captured.revision,
      baseDigest:base.sourceDigest,sourceDigest:captured.sourceDigest,base:grid,leaves:Object.freeze(leaves)});
  }
  const owner={
    read: () => current,
    checkpoint():HvpTerrainCheckpoint {
      const chunks=checkpointChunks();for(;;){const next=chunks.next();if(next.done){return next.value;}}
    },
    async checkpointAsync(signal?:AbortSignal):Promise<HvpTerrainCheckpoint>{
      const chunks=checkpointChunks();
      for(;;){signal?.throwIfAborted();const next=chunks.next();if(next.done){return next.value;}
        await new Promise<void>(resolve=>setTimeout(resolve,0));}
    },
    prepare(request: HvpCutRequest): HvpPreparedCut {
      if (request.sessionId !== sessionId || request.epoch !== epoch || request.revision !== current.revision || request.sourceDigest !== current.sourceDigest) {
        throw new Error("StaleRevision or foreign session");
      }
      if (request.toolPolicy !== "hvp-plasma-v1" || !/^[A-Za-z0-9:._-]{1,128}$/.test(request.commandId)) { throw new Error("Invalid tool command"); }
      const selected = selectHvpCutCells(request.shape);
      const changed: { cell: HvpCell; before: number; after: 0 }[] = [];
      const content = new Set<string>(), dependencies = new Set<string>();
      for (const cell of selected) {
        const slot = current.readSlot(...cell);
        if (slot === undefined) { throw new Error("Unknown cut coverage"); }
        if (slot !== 0 && (slot < 1 || slot > 4 || protectedCell(...cell))) { throw new Error("ProtectedMaterial"); }
        if (slot !== 0) {
          changed.push(Object.freeze({ cell, before: slot, after: 0 })); content.add(leafKey(...cell));
          for (let z=-1;z<=1;z+=1) { for (let y=-1;y<=1;y+=1) { for (let x=-1;x<=1;x+=1) {
            if (inside(cell[0]+x,cell[1]+y,cell[2]+z)) { dependencies.add(leafKey(cell[0]+x,cell[1]+y,cell[2]+z)); }
          } } }
        }
      }
      const leaves = new Map(maps.get(current)!);
      for (const key of content) {
        const [x,y,z] = key.split(":").map(Number);
        const slots = current.copyLeaf(x!,y!,z!);
        for (const delta of changed) { if (leafKey(...delta.cell) === key) { slots[leafIndex(...delta.cell)] = 0; } }
        leaves.set(key, { slots, revision: (leaves.get(key)?.revision ?? 0) + 1, digest: fnv1aBytes([slots.buffer as ArrayBuffer]) });
      }
      const shape: HvpCutShape = request.shape.kind === "Box"
        ? Object.freeze({ kind: "Box", min: Object.freeze([...request.shape.min]) as HvpCell, max: Object.freeze([...request.shape.max]) as HvpCell })
        : Object.freeze({ kind: "Sphere", center2: Object.freeze([...request.shape.center2]) as HvpCell, radius2: request.shape.radius2 });
      const boundRequest = Object.freeze({ sessionId, epoch, revision: request.revision, sourceDigest: request.sourceDigest,
        commandId: request.commandId, toolPolicy: request.toolPolicy, shape });
      const plan: HvpPreparedCut = Object.freeze({ before: current, after: changed.length === 0 ? current : make(leaves, current.revision + 1),
        request: boundRequest, signature: JSON.stringify(boundRequest), changed: Object.freeze(changed),
        contentLeaves: Object.freeze([...content].sort()), dependencyLeaves: Object.freeze([...dependencies].sort()) });
      issued.add(plan);
      return plan;
    },
    commit(plan: HvpPreparedCut): void {
      if (!issued.has(plan) || plan.before !== current) { throw new Error("Stale cut plan"); }
      issued.delete(plan); lastCommit = plan; current = plan.after;
    },
    /** Clear cells transferred to a body without counting them as deleted material. */
    prepareTransfer(cut:HvpPreparedCut,cells:readonly Readonly<{x:number;y:number;z:number;materialId:number}>[]):HvpPreparedCut {
      if(!issued.has(cut)||cut.before!==current||cut.after===current){throw new Error("Stale transfer cut");}
      if(cells.length<1||cells.length>32_768){throw new Error("Transfer BudgetExceeded");}
      const changed=[...cut.changed],content=new Set(cut.contentLeaves),dependencies=new Set(cut.dependencyLeaves);
      const seen=new Set<string>();
      for(const c of cells){
        const cell=Object.freeze([c.x,c.y,c.z]) as HvpCell;
        if(!integerCell(cell)||!Number.isInteger(c.materialId)||c.materialId<1||c.materialId>4
          ||cut.after.readSlot(...cell)!==c.materialId||protectedCell(...cell)||seen.has(cell.join(":"))){throw new Error("Invalid transfer occupancy");}
        seen.add(cell.join(":"));content.add(leafKey(...cell));
        if(content.size>8){throw new Error("Transfer leaf BudgetExceeded");}
        changed.push(Object.freeze({cell,before:c.materialId,after:0}));
        for(let z=-1;z<=1;z+=1){for(let y=-1;y<=1;y+=1){for(let x=-1;x<=1;x+=1){
          if(inside(c.x+x,c.y+y,c.z+z)){dependencies.add(leafKey(c.x+x,c.y+y,c.z+z));}
        }}}
      }
      const leaves=new Map(maps.get(cut.after)!);
      for(const key of content){
        const [x,y,z]=key.split(":").map(Number),slots=cut.after.copyLeaf(x!,y!,z!);
        for(const c of cells){if(leafKey(c.x,c.y,c.z)===key){slots[leafIndex(c.x,c.y,c.z)]=0;}}
        leaves.set(key,{slots,revision:(maps.get(current)!.get(key)?.revision??0)+1,digest:fnv1aBytes([slots.buffer as ArrayBuffer])});
      }
      changed.sort((a,b)=>a.cell[2]-b.cell[2]||a.cell[1]-b.cell[1]||a.cell[0]-b.cell[0]);
      const result:HvpPreparedCut=Object.freeze({before:current,after:make(leaves,current.revision+1),request:cut.request,
        signature:JSON.stringify([cut.signature,cells.map(c=>[c.x,c.y,c.z,c.materialId])]),changed:Object.freeze(changed),
        contentLeaves:Object.freeze([...content].sort()),dependencyLeaves:Object.freeze([...dependencies].sort())});
      issued.add(result);return result;
    },
    rollback(plan: HvpPreparedCut): void {
      if (lastCommit !== plan || current !== plan.after) { throw new Error("RecoveryHold: rollback generation mismatch"); }
      current = plan.before; lastCommit = undefined;
    }
  };
  terrainOwners.add(owner);return owner;
};

/** Stable command port; a validated restore swaps the root, not its consumers. */
export const createHvpTerrainOwner=(initial:ReturnType<typeof createHvpTerrainRoot>)=>{
  let current=initial;
  if(!terrainOwners.has(initial)){throw new Error("Unvalidated initial terrain owner");}
  return {
    read:()=>current.read(),checkpoint:()=>current.checkpoint(),checkpointAsync:(signal?:AbortSignal)=>current.checkpointAsync(signal),
    prepare:(request:HvpCutRequest)=>current.prepare(request),
    prepareTransfer:(cut:HvpPreparedCut,cells:Parameters<typeof initial.prepareTransfer>[1])=>current.prepareTransfer(cut,cells),
    commit:(plan:HvpPreparedCut)=>current.commit(plan),rollback:(plan:HvpPreparedCut)=>current.rollback(plan),
    replace(expected:HvpTerrainSnapshot,next:ReturnType<typeof createHvpTerrainRoot>){
      if(current.read()!==expected||!terrainOwners.has(next)){throw new Error("Stale or unvalidated terrain replacement");}
      const old=current;current=next;return old;
    }
  };
};

export const restoreHvpTerrainRoot=(value:unknown)=>{
  const saved=value as HvpTerrainCheckpoint|null;
  if(!saved||saved.version!=="hvp-terrain-checkpoint-v1"||Object.keys(saved).sort().join(",")!=="base,baseDigest,epoch,leaves,revision,sessionId,sourceDigest,version"
    ||typeof saved.sessionId!=="string"||!/^[A-Za-z0-9:._-]{1,128}$/.test(saved.sessionId)||!Number.isSafeInteger(saved.epoch)||saved.epoch<0
    ||typeof saved.baseDigest!=="string"||!/^[a-f0-9]{8}$/.test(saved.baseDigest)||typeof saved.sourceDigest!=="string"||!/^[a-f0-9]{8}$/.test(saved.sourceDigest)){
    throw new Error("Unsupported terrain checkpoint version/identity");
  }
  const base=decodeHvpGrid(saved.base);
  return createHvpTerrainRoot({...base,sourceDigest:saved.baseDigest},saved.sessionId,saved.epoch,undefined,saved);
};

/** Initial top-only quarry contract. Other support/detachment awaits HVP-09B. */
export const assertHvpSafeQuarry = (plan: HvpPreparedCut, supports: readonly Readonly<{ x: number; z: number }>[] = []): void => {
  const source = plan.before;
  const columns = new Map<string, number[]>();
  for (const { cell: [x,y,z] } of plan.changed) {
    const wx = source.originMeters.x + (x + 0.5) * 0.125, wz = source.originMeters.z + (z + 0.5) * 0.125;
    if (wx < -12 || wx >= -10 || wz < -10 || wz >= -8 || supports.some(p => Math.abs(p.x-wx) <= 0.5 && Math.abs(p.z-wz) <= 0.5)) {
      throw new Error("Protected: outside SafeQuarry or supported object");
    }
    const key = `${x}:${z}`;
    const ys = columns.get(key) ?? []; ys.push(y); columns.set(key, ys);
  }
  for (const [key, ys] of columns) {
    const [x,z] = key.split(":").map(Number);
    let top = 0, airSeen = false;
    for (let y = 0; y < source.sizeY; y += 1) {
      const slot = source.readSlot(x!,y,z!);
      if (slot === undefined) { throw new Error("Unknown quarry column"); }
      if (slot === 0) { airSeen = true; }
      else { if (airSeen) { throw new Error("Protected: quarry cavity or overhang"); } top = y + 1; }
    }
    ys.sort((a,b) => a-b);
    if (ys.length > 4 || ys[ys.length-1] !== top-1 || ys.some((y,i) => y !== top-ys.length+i)) {
      throw new Error("Protected: top-only quarry depth exceeds 0.5m");
    }
    // This dry-quarry phase never silently changes water coverage or base support.
    if (source.originMeters.y + ys[0]! * 0.125 < 0.125) { throw new Error("Protected: quarry waterline/base support"); }
  }
};
