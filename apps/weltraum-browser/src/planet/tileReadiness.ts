import { comparePlanetTileKeys } from "./canonical";
import { parsePlanetTileId } from "./ids";
import type { PlanetTileId } from "./types";

export const PLANET_TILE_READINESS_STATES = Object.freeze([
  "not-requested",
  "queued",
  "loading",
  "render-ready",
  "failed",
  "evicted"
] as const);

export type PlanetTileReadinessState = (typeof PLANET_TILE_READINESS_STATES)[number];

export type PlanetTileReadinessErrorCode =
  | "INVALID_READINESS_REVISION"
  | "INVALID_READINESS_SNAPSHOT"
  | "INVALID_READINESS_ENTRY"
  | "INVALID_READINESS_STATE"
  | "DUPLICATE_READINESS_ENTRY";

export class PlanetTileReadinessError extends Error {
  public constructor(
    public readonly code: PlanetTileReadinessErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PlanetTileReadinessError";
  }
}

export interface PlanetTileReadinessEntry {
  readonly tileId: PlanetTileId;
  readonly state: PlanetTileReadinessState;
}

export interface PlanetTileReadinessSnapshot {
  readonly revision: number;
  readonly entries: readonly PlanetTileReadinessEntry[];
}

export const assertPlanetTileReadinessRevision = (revision: number): void => {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new PlanetTileReadinessError(
      "INVALID_READINESS_REVISION",
      "Planet tile readiness revision must be a non-negative safe integer."
    );
  }
};

const compareEntries = (left: PlanetTileReadinessEntry, right: PlanetTileReadinessEntry): number =>
  comparePlanetTileKeys(parsePlanetTileId(left.tileId), parsePlanetTileId(right.tileId));

const isPlanetTileReadinessState = (value: unknown): value is PlanetTileReadinessState => {
  switch (value) {
    case "not-requested":
    case "queued":
    case "loading":
    case "render-ready":
    case "failed":
    case "evicted":
      return true;
    default:
      return false;
  }
};

export const createPlanetTileReadinessSnapshot = (
  input: PlanetTileReadinessSnapshot
): PlanetTileReadinessSnapshot => {
  if (input === null || typeof input !== "object" || !Array.isArray(input.entries)) {
    throw new PlanetTileReadinessError(
      "INVALID_READINESS_SNAPSHOT",
      "Planet tile readiness snapshot and entries are required."
    );
  }
  assertPlanetTileReadinessRevision(input.revision);

  const entries: PlanetTileReadinessEntry[] = [];
  for (let index = 0; index < input.entries.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(input.entries, index)) {
      throw new PlanetTileReadinessError(
        "INVALID_READINESS_ENTRY",
        `Planet tile readiness entry ${index} is missing; readiness entries must be dense.`
      );
    }
    const entry = input.entries[index];
    if (entry === null || typeof entry !== "object" || typeof entry.tileId !== "string") {
      throw new PlanetTileReadinessError(
        "INVALID_READINESS_ENTRY",
        `Planet tile readiness entry ${index} must contain a stable tile ID.`
      );
    }
    try {
      parsePlanetTileId(entry.tileId);
    } catch {
      throw new PlanetTileReadinessError(
        "INVALID_READINESS_ENTRY",
        `Planet tile readiness entry ${index} contains an invalid tile ID.`
      );
    }
    if (!isPlanetTileReadinessState(entry.state)) {
      throw new PlanetTileReadinessError(
        "INVALID_READINESS_STATE",
        `Planet tile readiness entry ${index} contains an invalid state.`
      );
    }
    entries.push(Object.freeze({ tileId: entry.tileId, state: entry.state }));
  }
  entries.sort(compareEntries);

  for (let index = 1; index < entries.length; index += 1) {
    if (entries[index - 1].tileId === entries[index].tileId) {
      throw new PlanetTileReadinessError(
        "DUPLICATE_READINESS_ENTRY",
        `Planet tile readiness contains duplicate tile ID ${entries[index].tileId}.`
      );
    }
  }

  return Object.freeze({
    revision: input.revision,
    entries: Object.freeze(entries)
  });
};
