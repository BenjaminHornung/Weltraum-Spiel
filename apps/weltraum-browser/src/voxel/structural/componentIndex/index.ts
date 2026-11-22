import type { HvpPreparedCut, HvpTerrainSnapshot } from "../../../hestia-prototype/terrain/cutPlan";
import type { HvpCell } from "../../../hestia-prototype/terrain/picking";
import type { HvpStructuralCell } from "../../../hestia-prototype/terrain/structuralIngest";
import { buildBlock, DIRECTIONS, localOffset, readSeam, SIDE, UNKNOWN, VOLUME, type ComponentBlock, type SeamCache } from "./block";

import { buildFragment, handoffCounters, materializeCompactCells, type CompactTerrainFragment } from "./fragment";
export { compactSupportReport, materializeCompactCells, type CompactTerrainFragment } from "./fragment";
export type { CompactTerrainPart } from "./exactShapes";
export type { CompactMass } from "./partFacts";

type Limits = { maxComponents?: number; maxFragmentCells?: number; maxBlocksBuilt?: number; tryFloorColumn?: boolean };
type Status = "Ready" | "NoChange" | "UnknownBoundary" | "OverBudget" | "FragmentOverBudget";
const countersForCut = () => ({
  ...handoffCounters(), workingBytes: 0, floorColumnReads: 0,
  blocksBuilt: 0, dirtyBlocksBuilt: 0, sourceCellsScanned: 0, seamPairsBuilt: 0,
  componentsVisited: 0, edgesVisited: 0, outputCells: 0,
  blockTypedArrayBytesAllocated: 0, localComponentsBuilt: 0,
});
type Counters = ReturnType<typeof countersForCut>;
export interface CompactIndexedSupport {
  readonly status:Status;
  readonly counters:Readonly<Counters>;
  readonly workingBytes:number;
  readonly fragments:readonly CompactTerrainFragment[];
}
export interface IndexedSupport {
  readonly status: Status;
  readonly counters: Readonly<Counters>;
  readonly fragments: readonly (readonly HvpStructuralCell[])[];
}
type Vertex = { block: ComponentBlock; label: number };
const vertexId = ({block,label}: Vertex) => block.key * VOLUME + label;
const BLOCK_LIMIT = Symbol("topology block budget");

function bounded(value: number, limit: number): number {
  if (!Number.isInteger(value) || value < 1 || value > limit) throw new RangeError("Invalid component index budget");
  return value;
}

/** Derived topology of one immutable, owner-issued terrain snapshot. The owner
 * replaces the instance on new source/coverage, restore, rollback or session change. */
export function createTerrainComponentIndex(initial: HvpTerrainSnapshot, capacity = 128) {
  bounded(capacity, 4096);
  let snapshot:HvpTerrainSnapshot|undefined=initial;
  function currentSnapshot():HvpTerrainSnapshot {
    if(!snapshot) throw new Error("Disposed component index");
    return snapshot;
  }
  const cache = new Map<number, ComponentBlock>();
  const nx = Math.ceil(initial.sizeX / SIDE), ny = Math.ceil(initial.sizeY / SIDE), nz = Math.ceil(initial.sizeZ / SIDE);
  const key = (x: number,y: number,z: number) => x + nx * (y + ny * z);
  const inGrid = (x: number,y: number,z: number) => x >= 0 && x < nx && y >= 0 && y < ny && z >= 0 && z < nz;

  // Charge JavaScript records, array slack, typed storage and at most one directed seam per face.
  const seamBytes=(block:ComponentBlock)=>[...block.seams.values()].reduce((n,s)=>n+s.bytes,0);
  let retained=2048;
  const residentBytes=()=>retained;
  const evict=(id:number)=>{
    const block=cache.get(id);
    if(block) {
      retained-=block.retainedBytes+seamBytes(block);
      cache.delete(id);
    }
  };
  const isResident=(block:ComponentBlock)=>cache.get(block.key)===block;
  const workingLimit=96*1024*1024;
  const trim=()=>{
    while(cache.size>capacity || retained>32*1024*1024) evict(cache.keys().next().value!);
  };

  function getBlock(x: number, y: number, z: number, source: HvpTerrainSnapshot, stats: Counters,
    maxBuilt: number, overlay?: Map<number,ComponentBlock>): ComponentBlock {
    const current=currentSnapshot();
    const id = key(x,y,z);
    // A prepared cut can be abandoned. Speculative leaf versions never enter the committed cache.
    const dirty = source !== current && source.leafRevision(x,y,z) !== current.leafRevision(x,y,z);
    const storage = dirty ? overlay! : cache;
    const cached = storage.get(id);
    if (cached) return cached;
    if (stats.blocksBuilt >= maxBuilt) throw BLOCK_LIMIT;
    // Bound the pending allocation too. A local checkerboard has at most 2,048 singleton components.
    if (overlay && stats.workingBytes+8*1024*1024>workingLimit) throw BLOCK_LIMIT;
    const start=performance.now();
    const block = buildBlock(dirty ? source : current, id, [x*SIDE,y*SIDE,z*SIDE]);
    stats.blockBuildMs+=performance.now()-start;
    stats.workingBytes+=block.retainedBytes+block.typedBytesAllocated+4096*128;
    stats.partDescriptorsPrepared+=block.parts.reduce((sum,p)=>sum+(p.shapes?.length??0),0);
    stats.blocksBuilt++;
    stats.blockTypedArrayBytesAllocated += block.typedBytesAllocated;
    stats.localComponentsBuilt += block.components.length;
    if (dirty) stats.dirtyBlocksBuilt++;
    stats.sourceCellsScanned += Math.min(SIDE, source.sizeX - x*SIDE) * Math.min(SIDE, source.sizeY - y*SIDE)
      * Math.min(SIDE, source.sizeZ - z*SIDE);
    storage.set(id,block);
    if (storage === cache) {
      retained+=block.retainedBytes;
      trim();
    }
    return block;
  }

  function assertBase(cut: HvpPreparedCut): void {
    const current=currentSnapshot();
    if (cut.before !== current || cut.after.epoch !== current.epoch || cut.after.sessionId !== current.sessionId
      || cut.after.baseDigest !== current.baseDigest || cut.after.revision !== current.revision + Number(cut.changed.length > 0)) {
      throw new Error("Stale component index or cut");
    }
  }

  function prepareCompact(cut: HvpPreparedCut, limits: Limits = {}): CompactIndexedSupport {
    assertBase(cut);
    if (cut.changed.length > 512) throw new RangeError("Indexed support expects the tool cut before ownership transfer");
    const maxComponents = bounded(limits.maxComponents ?? 262144, 262144);
    const maxFragment = bounded(limits.maxFragmentCells ?? 32768, 32768);
    const maxBuilt = bounded(limits.maxBlocksBuilt ?? 64, 4096);
    const counters = countersForCut(), fragments:CompactTerrainFragment[] = [];
    counters.workingBytes=8192+cut.changed.length*2048;
    const finish = (status: Status): CompactIndexedSupport => {
      trim();
      return Object.freeze({status,counters:Object.freeze(counters),workingBytes:counters.workingBytes,
        fragments:Object.freeze(status === "Ready" ? fragments : [])});
    };
    if (!cut.changed.length) return finish("NoChange");
    const source = cut.after;
    const overlay = new Map<number,ComponentBlock>();
    const privateSeams = new WeakMap<ComponentBlock,SeamCache>();
    const visitedBlocks = new Map<number,ComponentBlock>();
    const read = (x:number,y:number,z:number)=>{
      const id=key(x,y,z);
      let block=visitedBlocks.get(id);
      if (!block) {
        if(counters.workingBytes+4096>workingLimit) throw BLOCK_LIMIT;
        block=getBlock(x,y,z,source,counters,maxBuilt,overlay);
        visitedBlocks.set(id,block);
        // A borrowed block can be evicted by later reads while the traversal still holds it.
        counters.workingBytes+=block.retainedBytes+seamBytes(block)+256;
        if(counters.workingBytes>workingLimit) throw BLOCK_LIMIT;
      }
      return block;
    };
    try {
      // Canonical first source cell order also fixes component/fragment order for the old planner.
      const seedCells = new Set<number>();
      for (const {cell: [x,y,z]} of cut.changed) {
        for (const [dx,dy,dz] of DIRECTIONS) {
          const sx = x+dx, sy = y+dy, sz = z+dz;
          if (sx < 0 || sy < 0 || sz < 0 || sx >= source.sizeX || sy >= source.sizeY || sz >= source.sizeZ) return finish("UnknownBoundary");
          seedCells.add(sx + source.sizeX * (sy + source.sizeY * sz));
        }
      }
      const seeds = new Map<number,Vertex>();
      const anchored = new Set<number>(), detached = new Set<number>();
      // Only a complete solid column is a positive witness. Unknowns, gaps and
      // the probe ceiling leave the component to the ordinary connectivity search.
      const hasFloorColumn=(x:number,y:number,z:number):boolean=>{
        for(let h=y;h>=0;h--){
          if(counters.floorColumnReads>=8192) return false;
          counters.floorColumnReads++;
          const material=source.readSlot(x,h,z);
          if(material===undefined || material===0) return false;
          if(!Number.isInteger(material)||material<1||material>4) throw new Error("Invalid support material");
        }
        return true;
      };
      for (const cell of [...seedCells].sort((a,b)=>a-b)) {
        const x = cell % source.sizeX, y = Math.floor(cell/source.sizeX) % source.sizeY, z = Math.floor(cell/(source.sizeX*source.sizeY));
        if(limits.tryFloorColumn&&source.readSlot(x,y,z)===0) continue;
        const block = read(x>>4,y>>4,z>>4);
        const label = block.labels[localOffset(x,y,z)];
        if (label === UNKNOWN) return finish("UnknownBoundary");
        if(label!==0){
          const vertex={block,label},id=vertexId(vertex);
          if(!seeds.has(id)&&limits.tryFloorColumn&&hasFloorColumn(x,y,z)){
            anchored.add(id);counters.anchoredWitnesses++;
          }
          seeds.set(id,vertex);
        }
      }

      for (const [id,seed] of seeds) {
        if (anchored.has(id) || detached.has(id)) continue;
        const visited = new Set<number>([id]), queue = [seed];
        let supported = false, unknown = false, members = 0;
        for (let cursor = 0; cursor < queue.length && !supported; cursor++) {
          counters.workingBytes+=384;
          if (++counters.componentsVisited > maxComponents || counters.workingBytes>workingLimit) return finish("OverBudget");
          const {block,label} = queue[cursor];
          const component = block.components[label-1];
          if (component.atFloor) { supported = true; break; }
          unknown ||= component.touchesUnknown;
          members += component.length;
          for (let d = 0; d < DIRECTIONS.length && !supported; d++) {
            if (!(component.faceMask & (1<<d))) continue;
            const [dx,dy,dz] = DIRECTIONS[d];
            const bx = (block.origin[0]>>4)+dx, by = (block.origin[1]>>4)+dy, bz = (block.origin[2]>>4)+dz;
            if (!inGrid(bx,by,bz)) { unknown = true; continue; }
            const other = read(bx,by,bz);
            let cache = block.seams;
            if (overlay.has(block.key) || overlay.has(other.key)) {
              cache = privateSeams.get(block) ?? new Map();
              privateSeams.set(block,cache);
            }
            const previous=cache.get(d);
            const rebuild=previous?.other.deref()!==other;
            if(rebuild && counters.workingBytes+96*1024>workingLimit) throw BLOCK_LIMIT;
            const links = readSeam(block,other,d,cache).get(label);
            if(rebuild) {
              counters.seamPairsBuilt++;
              const bytes=cache.get(d)!.bytes;
              counters.workingBytes+=bytes;
              if(cache===block.seams && isResident(block)) retained+=bytes-(previous?.bytes??0);
            }
            if (!links) continue;
            for (const link of links) {
              if (link === UNKNOWN) { unknown = true; continue; }
              counters.edgesVisited++;
              const next = {block:other,label:link}, nextId = vertexId(next);
              if (other.components[link-1].atFloor || anchored.has(nextId)) { supported = true; break; }
              if (!visited.has(nextId)) {
                if (counters.componentsVisited + queue.length - cursor > maxComponents) return finish("OverBudget");
                visited.add(nextId);
                queue.push(next);
              }
            }
          }
        }
        if (supported) { counters.anchoredWitnesses++; for (const v of visited) anchored.add(v); continue; }
        if (unknown) return finish("UnknownBoundary");
        // The current terrain transfer accepts at most 32,768 cells across the entire cut.
        if (members > maxFragment || members + counters.outputCells > 32768 || fragments.length >= 32) {
          return finish("FragmentOverBudget");
        }
        for (const v of visited) detached.add(v);
        const facts=queue.map(({block,label})=>block.parts[label-1]);
        const runCount=facts.reduce((sum,f)=>sum+f.part.runs.length,0);
        const transferQuote=65536+facts.length*2048+runCount*512;
        if(counters.workingBytes+transferQuote>workingLimit) return finish("OverBudget");
        counters.workingBytes+=transferQuote;
        const fragment=buildFragment(source,facts,counters);
        if(!fragment) return finish("FragmentOverBudget");
        counters.outputCells+=members;
        fragments.push(fragment);
      }
      return finish("Ready");
    } catch (error) {
      if (error === BLOCK_LIMIT) return finish("OverBudget");
      throw error;
    }
  }

  return {
    prepareCompact, residentBytes,
    dispose():void { cache.clear();snapshot=undefined;retained=0; },
    prepare(cut:HvpPreparedCut,limits:Limits={}):IndexedSupport {
      const result=prepareCompact(cut,limits);
      return {status:result.status,counters:result.counters,fragments:result.fragments.map(materializeCompactCells)};
    },
    warm(blocks: readonly HvpCell[]): Readonly<Counters> {
      const current=currentSnapshot();
      const stats = countersForCut();
      for (const [x,y,z] of blocks) {
        if (![x,y,z].every(Number.isSafeInteger) || !inGrid(x,y,z)) throw new RangeError("Invalid block coordinates");
        getBlock(x,y,z,current,stats,Infinity);
      }
      return stats;
    },
    commit(cut: HvpPreparedCut, published: HvpTerrainSnapshot): void {
      assertBase(cut);
      if (published !== cut.after) throw new Error("Component index requires the published cut snapshot");
      for (const leaf of cut.contentLeaves) {
        const [x,y,z] = leaf.split(":").map(Number);
        evict(key(x,y,z));
      }
      snapshot = published;
    },
  };
}
