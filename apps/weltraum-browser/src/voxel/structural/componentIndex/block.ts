import type { HvpCell } from "../../../hestia-prototype/terrain/picking";

import type { HvpTerrainSnapshot } from "../../../hestia-prototype/terrain/cutPlan";
import { preparePart, type PartFacts } from "./partFacts";

export const SIDE = 16;
export const VOLUME = SIDE ** 3;
export const UNKNOWN = -1;
const SOLID = -2;
export const DIRECTIONS: readonly HvpCell[] = [
  [0, -1, 0], [0, 1, 0], [-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1],
];
const STRIDES = [-16, 16, -1, 1, -256, 256];

export interface LocalComponent {
  readonly length: number;
  readonly atFloor: boolean;
  readonly touchesUnknown: boolean;
  readonly faceMask: number;
}

export type SeamCache = Map<number, {other: WeakRef<ComponentBlock>; targets: Map<number, Set<number>>; bytes:number}>;

export interface ComponentBlock {
  readonly key: number;
  readonly origin: HvpCell;
  readonly labels: Int16Array;
  readonly parts: readonly PartFacts[];
  readonly typedBytesAllocated: number;
  readonly retainedBytes: number;
  readonly components: LocalComponent[];
  readonly seams: SeamCache;
}

export const localOffset = (x: number, y: number, z: number) => (x & 15) + ((y & 15) << 4) + ((z & 15) << 8);

export function buildBlock(source: HvpTerrainSnapshot, key: number, origin: HvpCell): ComponentBlock {
  const [ox, oy, oz] = origin;
  const labels = new Int16Array(VOLUME);
  labels.fill(UNKNOWN);
  const slots = new Uint8Array(VOLUME);
  let occupied = 0;
  for (let z = 0; z < SIDE && z + oz < source.sizeZ; z++) {
    for (let y = 0; y < SIDE && y + oy < source.sizeY; y++) {
      for (let x = 0; x < SIDE && x + ox < source.sizeX; x++) {
        const value = source.readSlot(ox + x, oy + y, oz + z);
        if (value === undefined) continue;
        if (!Number.isInteger(value) || value < 0 || value > 4) throw new Error("Invalid support material");
        slots[localOffset(x,y,z)] = value;
        labels[localOffset(x,y,z)] = value === 0 ? 0 : SOLID;
        if (value !== 0) occupied++;
      }
    }
  }

  // Reuse the bounded flood queue for all local components.
  const members = new Uint16Array(occupied);
  const components: LocalComponent[] = [];
  let tail = 0;
  for (let seed = 0; seed < VOLUME; seed++) {
    if (labels[seed] !== SOLID) continue;
    const start = tail;
    const label = components.length + 1;
    members[tail++] = seed;
    labels[seed] = label;
    let atFloor = false, touchesUnknown = false, faceMask = 0;
    for (let head = start; head < tail; head++) {
      const pos = members[head];
      const x = pos & 15, y = (pos >> 4) & 15, z = pos >> 8;
      const boundary = Number(y === 0) | (Number(y === 15) << 1) | (Number(x === 0) << 2)
        | (Number(x === 15) << 3) | (Number(z === 0) << 4) | (Number(z === 15) << 5);
      faceMask |= boundary;
      atFloor ||= oy + y === 0;
      for (let d = 0; d < STRIDES.length; d++) {
        if ((boundary & (1 << d)) !== 0) continue;
        const next = pos + STRIDES[d];
        if (labels[next] === UNKNOWN) touchesUnknown = true;
        if (labels[next] !== SOLID) continue;
        labels[next] = label;
        members[tail++] = next;
      }
    }
    components.push({length: tail - start, atFloor, touchesUnknown, faceMask});
  }
  // Encode exact membership during classification. No fragment ever borrows a mutable slot page.
  const groups = components.map(():number[]=>[]);
  for (let pos = 0; pos < VOLUME;) {
    const slot = slots[pos];
    if (!slot) { pos++; continue; }
    const start = pos, rowEnd = (start | 15) + 1;
    do { pos++; } while (pos < rowEnd && slots[pos] === slot);
    groups[labels[start]-1].push(start | ((pos-start-1)<<12) | (slot<<16));
  }
  const leafRevision = source.leafRevision(ox>>4,oy>>4,oz>>4);
  Object.freeze(origin);
  const parts = groups.map((runs,i)=>preparePart(origin,leafRevision,i+1,runs));
  const retainedBytes = 2048 + labels.byteLength + parts.reduce((n,p)=>
    n+1536+p.part.runs.length*32+(p.shapes?.length??0)*384,0);
  return {key, origin, labels, components, parts, seams: new Map(), retainedBytes,
    typedBytesAllocated:slots.byteLength+labels.byteLength+members.byteLength};
}

// A seam is valid only for these two exact block versions. Connecting the same pair
// in the opposite direction computes its own reverse lookup at most once.
export function readSeam(block: ComponentBlock, other: ComponentBlock, face: number, cache: SeamCache): Map<number, Set<number>> {
  const cached = cache.get(face);
  if (cached?.other.deref() === other) return cached.targets;
  const targets = new Map<number, Set<number>>();
  const stride = Math.abs(STRIDES[face]);
  for (let v = 0; v < SIDE; v++) {
    for (let u = 0; u < SIDE; u++) {
      const plane = stride === 1 ? (u << 4) + (v << 8) : stride === 16 ? u + (v << 8) : u + (v << 4);
      const high = (face & 1) !== 0;
      const from = block.labels[plane + (high ? 15 * stride : 0)];
      const to = other.labels[plane + (high ? 0 : 15 * stride)];
      if (from <= 0 || to === 0) continue;
      let list = targets.get(from);
      if (!list) { list = new Set(); targets.set(from,list); }
      list.add(to);
    }
  }
  const bytes=256+[...targets.values()].reduce((sum,links)=>sum+256+links.size*96,0);
  cache.set(face,{other:new WeakRef(other),targets,bytes});
  return targets;
}
