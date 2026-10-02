import { deepFreeze, serializeAdaptiveKey as adaptiveSerializeKey } from "../adaptive";
import { globalQuantumForStructuralCell, localCellIndexFromOffset } from "./coordinates";
import { structuralAddressForBrickCell } from "./model";
import type { StructuralCellAddress, StructuralObject, StructuralVoxelState } from "./types";
import { normalizeAdaptiveAuthorityFunction, structuralFail, structuralPositiveBudget } from "./validation";

// Pure core, deliberately NOT re-exported by the structural barrel: the cursor is an internal building block.
const serializeAdaptiveKey = normalizeAdaptiveAuthorityFunction(adaptiveSerializeKey);

export class StructuralConnectivityError extends Error {
  readonly code = "BudgetExceeded" as const;
  readonly path: string;

  constructor(path: string, message: string) {
    super(message);
    this.name = "StructuralConnectivityError";
    this.path = path;
  }
}

export interface OccupiedEntry {
  readonly address: StructuralCellAddress;
  readonly globalKey: string;
  readonly state: StructuralVoxelState;
  /** compareStructuralCellAddresses tuple, derived once from this entry's own validated address. */
  readonly brickOrderKey: string;
  readonly localOrderIndex: number;
}

export const globalKey = (x: number, y: number, z: number): string => `${x}:${y}:${z}`;

/**
 * Same order as compareStructuralCellAddresses. Every address here was just built and validated by
 * structuralAddressForBrickCell as a fresh deep-frozen primitive record, so the comparator's
 * per-call revalidation can neither throw nor differ; its tuple is computed once per entry instead.
 */
export const compareOccupiedEntries = (left: OccupiedEntry, right: OccupiedEntry): number => {
  if (left.brickOrderKey !== right.brickOrderKey) {
    return left.brickOrderKey < right.brickOrderKey ? -1 : 1;
  }
  return left.localOrderIndex - right.localOrderIndex;
};

/**
 * The single occupied-entry extraction algorithm. Native for...of keeps the exact read order,
 * getter/proxy behaviour, iterator closing and engine errors of the previous nested loops.
 * One resumption = one brick fetch, or reading that brick's cells (iterator acquired on its first
 * cell resumption) plus one cell's existing work.
 */
function* occupiedEntrySteps(object: StructuralObject, maxVisitedCells: number) {
  const entries: OccupiedEntry[] = [];
  for (const brick of object.bricks) {
    yield;
    for (const cell of brick.cells) {
      if (entries.length >= maxVisitedCells) {
        throw new StructuralConnectivityError("connectivityBudgets/maxVisitedCells", "Occupied-cell traversal exceeded the explicit connectivity budget.");
      }
      const address = structuralAddressForBrickCell(brick, cell.localIndex);
      const global = globalQuantumForStructuralCell(address);
      const brickOrderKey = serializeAdaptiveKey(address.brickKey);
      entries.push(deepFreeze({
        address,
        globalKey: globalKey(global.x, global.y, global.z),
        state: cell.state,
        brickOrderKey,
        localOrderIndex: localCellIndexFromOffset(address.local)
      }));
      yield;
    }
  }
  return entries;
}

export type StructuralCursorStep<T> = { readonly done: false } | { readonly done: true; readonly value: T };

/**
 * Bounded unit-wise extraction of unsorted occupied entries. The caller owns input immutability
 * across advances (intended: an owner-bound frozen source); the input stays borrowed. No full-source
 * copy and no freeze beyond the existing per-cell behaviour: each entry's deepFreeze also freezes
 * the borrowed `cell.state`, exactly as the synchronous path always did.
 */
export const createStructuralOccupiedEntriesCursor = (object: StructuralObject, maxVisitedCellsValue: number) => {
  const maxVisitedCells = structuralPositiveBudget(maxVisitedCellsValue, "connectivityBudgets/maxVisitedCells");
  let steps: ReturnType<typeof occupiedEntrySteps> | undefined = occupiedEntrySteps(object, maxVisitedCells);
  let state: "open" | "done" | "failed" | "disposed" = "open";
  let failure: unknown;
  return {
    advance(maxUnitsValue: number): StructuralCursorStep<OccupiedEntry[]> {
      if (state === "failed") {
        throw failure;
      }
      if (state !== "open" || steps === undefined) {
        return structuralFail("InvalidContract", "cursor", "Occupied-entry cursor is finished or disposed.");
      }
      const maxUnits = structuralPositiveBudget(maxUnitsValue, "cursor/maxUnits");
      for (let unit = 0; unit < maxUnits; unit += 1) {
        let step: IteratorResult<undefined, OccupiedEntry[]>;
        try {
          step = steps.next();
        } catch (error) {
          // The generator already closed its native iterators; the original error stays sticky.
          state = "failed";
          failure = error;
          steps = undefined;
          throw error;
        }
        if (step.done) {
          // Issued exactly once; the returned array belongs to the caller from here on.
          state = "done";
          steps = undefined;
          return { done: true, value: step.value };
        }
      }
      return { done: false };
    },
    dispose(): void {
      const open = state === "open" ? steps : undefined;
      steps = undefined;
      if (state === "open") {
        state = "disposed";
      }
      if (open !== undefined) {
        try {
          // Like leaving a for...of early: closes the borrowed iterators, never touches their data.
          open.return([]);
        } catch {
          // dispose never throws; an iterator's own return() failure cannot replace any result.
        }
      }
    }
  };
};

/** At most this many cursor units (brick fetches or cells) run between two classification yields. */
export const STRUCTURAL_OCCUPIED_UNITS_PER_YIELD = 64;
/** Internal phase label of a yield that ends a bounded occupied-cell batch. */
export const STRUCTURAL_OCCUPIED_CELLS_PHASE = "classificationCells";

/**
 * Extraction in bounded batches, then the unchanged residuals: whole-array sort and the final
 * collection freeze (not units). `finally` releases the cursor on completion, failure or an
 * early generator return (cancel/dispose of an owner plan).
 */
export function* sortedStructuralOccupiedEntrySteps(object: StructuralObject, maxVisitedCells: number) {
  const cursor = createStructuralOccupiedEntriesCursor(object, maxVisitedCells);
  try {
    for (;;) {
      const step = cursor.advance(STRUCTURAL_OCCUPIED_UNITS_PER_YIELD);
      if (step.done) {
        const entries = step.value;
        entries.sort(compareOccupiedEntries);
        return deepFreeze(entries);
      }
      yield STRUCTURAL_OCCUPIED_CELLS_PHASE;
    }
  } finally {
    cursor.dispose();
  }
}
