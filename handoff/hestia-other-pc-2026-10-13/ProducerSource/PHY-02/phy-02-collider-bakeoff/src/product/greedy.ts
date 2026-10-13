import {deepFreeze} from "../geometry.js";
type StructuralOwnedReserve=(bytes:number,retained?:boolean)=>void;
type QuantumBox=Readonly<{min:Readonly<{x:number;y:number;z:number}>;max:Readonly<{x:number;y:number;z:number}>}>;
const quantumKey=(x:number,y:number,z:number)=>x+":"+y+":"+z;
class StructuralValidationError extends Error {
  constructor(readonly code:string,readonly path:string,message:string){super(message);this.name="StructuralValidationError";}
}
const structuralFail=(code:string,path:string,message:string):never=>{throw new StructuralValidationError(code,path,message);};
// shortcut: no owned-budget execution in primitive slice, consume original owner API with PHY-01.
export function* structuralFreezeArraySteps<T>(values:T[],reserve?:StructuralOwnedReserve):Generator<void,readonly T[],void>{
  if(reserve!==undefined)throw new Error("Owned reserve path is not supported in this primitive snapshot");
  return deepFreeze(values);
}
export const drainStructuralSteps = <T>(steps: Generator<void, T, void>): T => {
  for (;;) {
    const step = steps.next();
    if (step.done) { return step.value; }
  }
};

export function* structuralSortSteps<T>(values: T[], compare: (left: T, right: T) => number, reserve?: StructuralOwnedReserve): Generator<void, T[], void> {
  if (reserve === undefined) { return values.sort(compare); }
  reserve(64 + values.length * 8);
  let from = values, to = new Array<T>(values.length);
  yield;
  for (let width = 1; width < values.length; width *= 2) {
    for (let start = 0; start < values.length; start += width * 2) {
      const middle = Math.min(start + width, values.length), end = Math.min(start + width * 2, values.length);
      let left = start, right = middle;
      for (let target = start; target < end; target += 1) {
        to[target] = left < middle && (right >= end || compare(from[left], from[right]) <= 0) ? from[left++] : from[right++];
        yield;
      }
    }
    const old = from; from = to; to = old;
  }
  if (from !== values) {
    for (let index = 0; index < values.length; index += 1) { values[index] = from[index]; yield; }
  }
  return values;
}

export const mergeGreedyQuantumBoxes = (
  cells: readonly (Readonly<{ x: number; y: number; z: number }>)[],
  path: string
): readonly QuantumBox[] => drainStructuralSteps(greedyQuantumBoxesSteps(cells, path));

/** INACTIVE direct-module form. The producer retains a first-party plain/index-only immutable
 * cell array for the complete generator lifetime and charges it to ONE parent ledger. No
 * structural/recipe/World authority is issued; the parent alone releases the borrowed reserve. */
export function* mergeGreedyQuantumBoxesOwnedSteps(
  cells: readonly (Readonly<{ x: number; y: number; z: number }>)[], path: string, reserve: StructuralOwnedReserve
) {
  return yield* greedyQuantumBoxesSteps(cells, path, reserve);
}

function* greedyQuantumBoxesSteps(
  cells: readonly (Readonly<{ x: number; y: number; z: number }>)[], path: string, reserve?: StructuralOwnedReserve
): Generator<void, readonly QuantumBox[], void> {
  reserve?.(512);
  const remaining = new Map<string, Readonly<{ x: number; y: number; z: number }>>();
  for (const cell of cells) {
    if (!Number.isSafeInteger(cell.x) || !Number.isSafeInteger(cell.y) || !Number.isSafeInteger(cell.z)) {
      return structuralFail("InvalidContract", path, "Greedy merge requires safe-integer quantum cells.");
    }
    reserve?.(256);
    const key = quantumKey(cell.x, cell.y, cell.z);
    if (remaining.has(key)) {
      return structuralFail("InvalidContract", path, "Greedy merge requires unique quantum cells.");
    }
    remaining.set(key, cell);
    if (reserve !== undefined) { yield; }
  }
  reserve?.(64);
  const boxes: QuantumBox[] = [];
  while (remaining.size > 0) {
    let seeds: Readonly<{ x: number; y: number; z: number }>[];
    if (reserve === undefined) { seeds = [...remaining.values()]; }
    else {
      reserve(64 + remaining.size * 128);
      seeds = [];
      for (const cell of remaining.values()) { seeds.push(cell); yield; }
    }
    const seed = (yield* structuralSortSteps(seeds, (a, b) => a.x - b.x || a.y - b.y || a.z - b.z, reserve))[0];
    let maxX = seed.x;
    for (;;) {
      reserve?.(128);
      const present = remaining.has(quantumKey(maxX + 1, seed.y, seed.z));
      if (reserve !== undefined) { yield; }
      if (!present) { break; }
      maxX += 1;
    }
    let maxY = seed.y;
    let rowComplete = true;
    while (rowComplete) {
      for (let x = seed.x; x <= maxX; x += 1) {
        reserve?.(128);
        const present = remaining.has(quantumKey(x, maxY + 1, seed.z));
        if (reserve !== undefined) { yield; }
        if (!present) {
          rowComplete = false;
          break;
        }
      }
      if (rowComplete) { maxY += 1; }
    }
    let maxZ = seed.z;
    let slabComplete = true;
    while (slabComplete) {
      for (let y = seed.y; y <= maxY; y += 1) {
        for (let x = seed.x; x <= maxX; x += 1) {
          reserve?.(128);
          const present = remaining.has(quantumKey(x, y, maxZ + 1));
          if (reserve !== undefined) { yield; }
          if (!present) {
            slabComplete = false;
            break;
          }
        }
        if (!slabComplete) { break; }
      }
      if (slabComplete) { maxZ += 1; }
    }
    for (let z = seed.z; z <= maxZ; z += 1) {
      for (let y = seed.y; y <= maxY; y += 1) {
        for (let x = seed.x; x <= maxX; x += 1) {
          reserve?.(128);
          remaining.delete(quantumKey(x, y, z));
          if (reserve !== undefined) { yield; }
        }
      }
    }
    reserve?.(1_024, true);
    boxes.push(deepFreeze({
      min: deepFreeze({ x: seed.x, y: seed.y, z: seed.z }),
      max: deepFreeze({ x: maxX + 1, y: maxY + 1, z: maxZ + 1 })
    }));
    if (reserve !== undefined) { yield; }
  }
  let covered = 0;
  for (const box of boxes) {
    covered += (box.max.x - box.min.x) * (box.max.y - box.min.y) * (box.max.z - box.min.z);
    if (reserve !== undefined) { yield; }
  }
  if (covered !== cells.length) {
    return structuralFail("InvalidContract", path, "Greedy merge coverage must equal the fragment cell count.");
  }
  yield* structuralSortSteps(boxes, (a, b) => a.min.z - b.min.z || a.min.y - b.min.y || a.min.x - b.min.x, reserve);
  return yield* structuralFreezeArraySteps(boxes, reserve);
}

