import type { HvpPreparedCut, HvpTerrainSnapshot } from "../../../hestia-prototype/terrain/cutPlan";
import type { HvpCell } from "../../../hestia-prototype/terrain/picking";
import type { HvpStructuralCell } from "../../../hestia-prototype/terrain/structuralIngest";
import { buildBlock, DIRECTIONS, localOffset, readSeam, SIDE, UNKNOWN, VOLUME, type ComponentBlock, type SeamCache } from "./block";

type Limits = { maxComponents?: number; maxFragmentCells?: number; maxBlocksBuilt?: number };
type Status = "Ready" | "NoChange" | "UnknownBoundary" | "OverBudget" | "FragmentOverBudget";
const countersForCut = () => ({
  blocksBuilt: 0, dirtyBlocksBuilt: 0, sourceCellsScanned: 0, seamPairsBuilt: 0,
  componentsVisited: 0, edgesVisited: 0, outputCells: 0,
  blockTypedArrayBytesAllocated: 0, localComponentsBuilt: 0,
});
type Counters = ReturnType<typeof countersForCut>;
type Fragments = (readonly HvpStructuralCell[])[];
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
  let current = initial;
  const cache = new Map<number, ComponentBlock>();
  const nx = Math.ceil(current.sizeX / SIDE), ny = Math.ceil(current.sizeY / SIDE), nz = Math.ceil(current.sizeZ / SIDE);
  const key = (x: number,y: number,z: number) => x + nx * (y + ny * z);
  const inGrid = (x: number,y: number,z: number) => x >= 0 && x < nx && y >= 0 && y < ny && z >= 0 && z < nz;

  function getBlock(x: number, y: number, z: number, source: HvpTerrainSnapshot, stats: Counters,
    maxBuilt: number, overlay?: Map<number,ComponentBlock>): ComponentBlock {
    const id = key(x,y,z);
    // A prepared cut can be abandoned. Speculative leaf versions never enter the committed cache.
    const dirty = source !== current && source.leafRevision(x,y,z) !== current.leafRevision(x,y,z);
    const storage = dirty ? overlay! : cache;
    const cached = storage.get(id);
    if (cached) return cached;
    if (stats.blocksBuilt >= maxBuilt) throw BLOCK_LIMIT;
    const block = buildBlock(dirty ? source : current, id, [x*SIDE,y*SIDE,z*SIDE]);
    stats.blocksBuilt++;
    stats.blockTypedArrayBytesAllocated += block.labels.byteLength + block.members.byteLength;
    stats.localComponentsBuilt += block.components.length;
    if (dirty) stats.dirtyBlocksBuilt++;
    stats.sourceCellsScanned += Math.min(SIDE, source.sizeX - x*SIDE) * Math.min(SIDE, source.sizeY - y*SIDE)
      * Math.min(SIDE, source.sizeZ - z*SIDE);
    if (storage === cache && cache.size >= capacity) cache.delete(cache.keys().next().value!);
    storage.set(id,block);
    return block;
  }

  function assertBase(cut: HvpPreparedCut): void {
    if (cut.before !== current || cut.after.epoch !== current.epoch || cut.after.sessionId !== current.sessionId
      || cut.after.baseDigest !== current.baseDigest || cut.after.revision !== current.revision + Number(cut.changed.length > 0)) {
      throw new Error("Stale component index or cut");
    }
  }

  function prepare(cut: HvpPreparedCut, limits: Limits = {}): IndexedSupport {
    assertBase(cut);
    if (cut.changed.length > 512) throw new RangeError("Indexed support expects the tool cut before ownership transfer");
    const maxComponents = bounded(limits.maxComponents ?? 262144, 262144);
    const maxFragment = bounded(limits.maxFragmentCells ?? 32768, 32768);
    const maxBuilt = bounded(limits.maxBlocksBuilt ?? 64, 4096);
    const counters = countersForCut(), fragments: Fragments = [];
    const finish = (status: Status): IndexedSupport => ({status,counters,fragments:status === "Ready" ? fragments : []});
    if (!cut.changed.length) return finish("NoChange");
    const source = cut.after;
    const overlay = new Map<number,ComponentBlock>();
    const privateSeams = new WeakMap<ComponentBlock,SeamCache>();
    const read = (x: number,y: number,z: number) => getBlock(x,y,z,source,counters,maxBuilt,overlay);
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
      for (const cell of [...seedCells].sort((a,b)=>a-b)) {
        const x = cell % source.sizeX, y = Math.floor(cell/source.sizeX) % source.sizeY, z = Math.floor(cell/(source.sizeX*source.sizeY));
        const block = read(x>>4,y>>4,z>>4);
        const label = block.labels[localOffset(x,y,z)];
        if (label === UNKNOWN) return finish("UnknownBoundary");
        if (label !== 0) seeds.set(vertexId({block,label}), {block,label});
      }

      const anchored = new Set<number>(), detached = new Set<number>();
      for (const [id,seed] of seeds) {
        if (anchored.has(id) || detached.has(id)) continue;
        const visited = new Set<number>([id]), queue = [seed];
        let supported = false, unknown = false, members = 0;
        for (let cursor = 0; cursor < queue.length && !supported; cursor++) {
          if (++counters.componentsVisited > maxComponents) return finish("OverBudget");
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
              cache = privateSeams.get(block) ?? new WeakMap();
              privateSeams.set(block,cache);
            }
            if (!cache.has(other)) counters.seamPairsBuilt++;
            const links = readSeam(block,other,d,cache).get(label);
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
        if (supported) { for (const v of visited) anchored.add(v); continue; }
        if (unknown) return finish("UnknownBoundary");
        // The current terrain transfer accepts at most 32,768 cells across the entire cut.
        if (members > maxFragment || members + counters.outputCells > 32768 || fragments.length >= 32) {
          return finish("FragmentOverBudget");
        }
        for (const v of visited) detached.add(v);
        const cells: HvpStructuralCell[] = [];
        for (const {block,label} of queue) {
          const {start,length} = block.components[label-1];
          for (let i=start; i<start+length; i++) {
            const pos = block.members[i], x = block.origin[0]+(pos&15), y = block.origin[1]+((pos>>4)&15), z = block.origin[2]+(pos>>8);
            cells.push({x,y,z,materialId:source.readSlot(x,y,z)!});
          }
        }
        cells.sort((a,b)=>a.z-b.z || a.y-b.y || a.x-b.x);
        counters.outputCells += cells.length;
        fragments.push(cells);
      }
      return finish("Ready");
    } catch (error) {
      if (error === BLOCK_LIMIT) return finish("OverBudget");
      throw error;
    }
  }

  return {
    prepare,
    warm(blocks: readonly HvpCell[]): Readonly<Counters> {
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
        cache.delete(key(x,y,z));
      }
      current = published;
    },
  };
}
