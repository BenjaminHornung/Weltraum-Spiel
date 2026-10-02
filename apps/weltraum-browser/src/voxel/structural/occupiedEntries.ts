import { deepFreeze, serializeAdaptiveKey as adaptiveSerializeKey } from "../adaptive";
import { serializeStructuralCellAddress } from "./canonical";
import { globalQuantumForStructuralCell, localCellIndexFromOffset } from "./coordinates";
import { isIssuedStructuralObject, structuralAddressForBrickCell } from "./model";
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

/** Internal classification input projected only from an exact locally issued Structural source. */
export interface IssuedOccupiedEntry extends OccupiedEntry {
  readonly globalX: number;
  readonly globalY: number;
  readonly globalZ: number;
  readonly cellKey: string;
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
type OccupiedEntryFactory<T extends OccupiedEntry> = (
  brick: StructuralObject["bricks"][number],
  cell: StructuralObject["bricks"][number]["cells"][number],
  address: StructuralCellAddress
) => T;

function* occupiedEntrySteps<T extends OccupiedEntry>(
  object: StructuralObject,
  maxVisitedCells: number,
  createEntry: OccupiedEntryFactory<T>
): Generator<undefined, T[], void> {
  const entries: T[] = [];
  for (const brick of object.bricks) {
    yield;
    for (const cell of brick.cells) {
      if (entries.length >= maxVisitedCells) {
        throw new StructuralConnectivityError("connectivityBudgets/maxVisitedCells", "Occupied-cell traversal exceeded the explicit connectivity budget.");
      }
      const address = structuralAddressForBrickCell(brick, cell.localIndex);
      entries.push(createEntry(brick, cell, address));
      yield;
    }
  }
  return entries;
}

const genericOccupiedEntry: OccupiedEntryFactory<OccupiedEntry> = (_brick, cell, address) => {
  const global = globalQuantumForStructuralCell(address);
  const brickOrderKey = serializeAdaptiveKey(address.brickKey);
  return deepFreeze({
    address,
    globalKey: globalKey(global.x, global.y, global.z),
    state: cell.state,
    brickOrderKey,
    localOrderIndex: localCellIndexFromOffset(address.local)
  });
};

const issuedOccupiedEntry: OccupiedEntryFactory<IssuedOccupiedEntry> = (_brick, cell, address) => {
  // The issuer validated this brick key/address; its level-4 cell quantum is exactly origin + local.
  const globalX = address.brickKey.originQuantum.x + address.local.x;
  const globalY = address.brickKey.originQuantum.y + address.local.y;
  const globalZ = address.brickKey.originQuantum.z + address.local.z;
  return Object.freeze({
    address,
    globalKey: globalKey(globalX, globalY, globalZ),
    state: cell.state,
    brickOrderKey: serializeAdaptiveKey(address.brickKey),
    localOrderIndex: cell.localIndex,
    globalX,
    globalY,
    globalZ,
    cellKey: serializeStructuralCellAddress(address)
  });
};

export type StructuralCursorStep<T> = { readonly done: false } | { readonly done: true; readonly value: T };

/**
 * Bounded unit-wise extraction of unsorted occupied entries. The caller owns input immutability
 * across advances (intended: an owner-bound frozen source); the input stays borrowed. No full-source
 * copy and no freeze beyond the existing per-cell behaviour: each entry's deepFreeze also freezes
 * the borrowed `cell.state`, exactly as the synchronous path always did.
 */
const createOccupiedEntriesCursor = <T extends OccupiedEntry>(
  object: StructuralObject,
  maxVisitedCellsValue: number,
  createEntry: OccupiedEntryFactory<T>
) => {
  const maxVisitedCells = structuralPositiveBudget(maxVisitedCellsValue, "connectivityBudgets/maxVisitedCells");
  let steps: Generator<undefined, T[], void> | undefined = occupiedEntrySteps(object, maxVisitedCells, createEntry);
  let state: "open" | "done" | "failed" | "disposed" = "open";
  let failure: unknown;
  return {
    advance(maxUnitsValue: number): StructuralCursorStep<T[]> {
      if (state === "failed") {
        throw failure;
      }
      if (state !== "open" || steps === undefined) {
        return structuralFail("InvalidContract", "cursor", "Occupied-entry cursor is finished or disposed.");
      }
      const maxUnits = structuralPositiveBudget(maxUnitsValue, "cursor/maxUnits");
      for (let unit = 0; unit < maxUnits; unit += 1) {
        let step: IteratorResult<undefined, T[]>;
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

export const createStructuralOccupiedEntriesCursor = (object: StructuralObject, maxVisitedCellsValue: number) =>
  createOccupiedEntriesCursor(object, maxVisitedCellsValue, genericOccupiedEntry);

/** Private owner-only cursor; caller cannot replace its exact issued source identity. */
export const createIssuedStructuralOccupiedEntriesCursor = (object: StructuralObject, maxVisitedCellsValue: number) => {
  const sourceIdentity = object;
  if (!isIssuedStructuralObject(sourceIdentity)) {
    return structuralFail("InvalidContract", "connectivity/source", "Owned occupied-entry extraction requires an issued structural source.");
  }
  return createOccupiedEntriesCursor(sourceIdentity, maxVisitedCellsValue, issuedOccupiedEntry);
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

/** Issued sources are already brick-key/local-index canonical, so owner extraction needs no full sort. */
export function* sortedIssuedStructuralOccupiedEntrySteps(object: StructuralObject, maxVisitedCells: number) {
  const cursor = createIssuedStructuralOccupiedEntriesCursor(object, maxVisitedCells);
  try {
    for (;;) {
      const step = cursor.advance(STRUCTURAL_OCCUPIED_UNITS_PER_YIELD);
      if (step.done) {
        return Object.freeze(step.value);
      }
      yield STRUCTURAL_OCCUPIED_CELLS_PHASE;
    }
  } finally {
    cursor.dispose();
  }
}
