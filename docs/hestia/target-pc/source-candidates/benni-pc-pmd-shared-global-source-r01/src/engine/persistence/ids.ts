export type PersistenceBrand<T, Name extends string> = T & {
  readonly __persistenceBrand: Name;
};

export type SaveId = PersistenceBrand<string, "SaveId">;
export type PlayerId = PersistenceBrand<string, "PlayerId">;
export type ShipId = PersistenceBrand<string, "ShipId">;
export type DroneId = PersistenceBrand<string, "DroneId">;
export type StationId = PersistenceBrand<string, "StationId">;
export type BaseId = PersistenceBrand<string, "BaseId">;
export type MissionId = PersistenceBrand<string, "MissionId">;
export type EncounterId = PersistenceBrand<string, "EncounterId">;
export type EventId = PersistenceBrand<string, "EventId">;
export type ContainerId = PersistenceBrand<string, "ContainerId">;
export type SiteId = PersistenceBrand<string, "SiteId">;
export type ResourceNodeId = PersistenceBrand<string, "ResourceNodeId">;
export type ShipVariantId = PersistenceBrand<string, "ShipVariantId">;
export type ExternalReferenceId = PersistenceBrand<string, "ExternalReferenceId">;

export type StableIdKind =
  | "save"
  | "player"
  | "ship"
  | "drone"
  | "station"
  | "base"
  | "mission"
  | "encounter"
  | "event"
  | "container"
  | "site"
  | "resource-node"
  | "ship-variant";

export type StableIdClassification = "Instance" | "Definition";

export interface StableIdByKind {
  readonly save: SaveId;
  readonly player: PlayerId;
  readonly ship: ShipId;
  readonly drone: DroneId;
  readonly station: StationId;
  readonly base: BaseId;
  readonly mission: MissionId;
  readonly encounter: EncounterId;
  readonly event: EventId;
  readonly container: ContainerId;
  readonly site: SiteId;
  readonly "resource-node": ResourceNodeId;
  readonly "ship-variant": ShipVariantId;
}

export type StableInstanceId =
  | SaveId
  | PlayerId
  | ShipId
  | DroneId
  | StationId
  | BaseId
  | MissionId
  | EncounterId
  | EventId
  | ContainerId
  | SiteId
  | ResourceNodeId;

export type StableDefinitionId = ShipVariantId;
export type AnyStableId = StableInstanceId | StableDefinitionId;

export const MAX_STABLE_ID_LENGTH = 128;

export const STABLE_ID_PREFIXES = Object.freeze({
  save: "save:",
  player: "player:",
  ship: "ship:",
  drone: "drone:",
  station: "station:",
  base: "base:",
  mission: "mission:",
  encounter: "encounter:",
  event: "event:",
  container: "container:",
  site: "site:",
  "resource-node": "resource-node:",
  "ship-variant": "ship-variant:"
} satisfies Readonly<Record<StableIdKind, string>>);

export const STABLE_ID_CLASSIFICATIONS = Object.freeze({
  save: "Instance",
  player: "Instance",
  ship: "Instance",
  drone: "Instance",
  station: "Instance",
  base: "Instance",
  mission: "Instance",
  encounter: "Instance",
  event: "Instance",
  container: "Instance",
  site: "Instance",
  "resource-node": "Instance",
  "ship-variant": "Definition"
} satisfies Readonly<Record<StableIdKind, StableIdClassification>>);

const stableIdKinds = Object.freeze(Object.keys(STABLE_ID_PREFIXES) as StableIdKind[]);
const suffixPattern = /^[a-z0-9._-]+$/;
const externalReferencePattern = /^[a-z][a-z0-9-]*:[a-z0-9._-]+$/;

export type StableIdErrorCode = "INVALID_ID_KIND" | "INVALID_STABLE_ID" | "INVALID_FIXTURE_SEED" | "INVALID_SEQUENCE";

export class StableIdError extends Error {
  public readonly code: StableIdErrorCode;
  public readonly path: string;

  public constructor(code: StableIdErrorCode, path: string, message: string) {
    super(message);
    this.name = "StableIdError";
    this.code = code;
    this.path = path;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const isAscii = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 0x7f) {
      return false;
    }
  }
  return true;
};

export const isStableIdKind = (value: unknown): value is StableIdKind =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(STABLE_ID_PREFIXES, value);

export const getStableIdClassification = (kind: StableIdKind): StableIdClassification => STABLE_ID_CLASSIFICATIONS[kind];

export const isStableId = <TKind extends StableIdKind>(kind: TKind, value: unknown): value is StableIdByKind[TKind] => {
  if (typeof value !== "string" || value.length > MAX_STABLE_ID_LENGTH || !isAscii(value)) {
    return false;
  }

  const prefix = STABLE_ID_PREFIXES[kind];
  return value.startsWith(prefix) && suffixPattern.test(value.slice(prefix.length));
};

export const parseStableId = <TKind extends StableIdKind>(
  kind: TKind,
  value: unknown,
  path = ""
): StableIdByKind[TKind] => {
  if (!isStableId(kind, value)) {
    throw new StableIdError(
      "INVALID_STABLE_ID",
      path,
      `Expected a ${STABLE_ID_PREFIXES[kind]} identifier with a nonempty lowercase ASCII suffix.`
    );
  }
  return value;
};

export const detectStableIdKind = (value: unknown): StableIdKind | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  return stableIdKinds.find((kind) => isStableId(kind, value));
};

export const parseStableInstanceId = (value: unknown, path = ""): StableInstanceId => {
  const kind = detectStableIdKind(value);
  if (kind === undefined || getStableIdClassification(kind) !== "Instance") {
    throw new StableIdError("INVALID_STABLE_ID", path, "Expected a supported stable instance identifier.");
  }
  return value as StableInstanceId;
};

export const parseExternalReferenceId = (value: unknown, path = ""): ExternalReferenceId => {
  if (
    typeof value !== "string" ||
    value.length > MAX_STABLE_ID_LENGTH ||
    !isAscii(value) ||
    !externalReferencePattern.test(value)
  ) {
    throw new StableIdError("INVALID_STABLE_ID", path, "Expected a stable lowercase ASCII reference identifier.");
  }
  return value as ExternalReferenceId;
};

export const createStableFixtureId = <TKind extends StableIdKind>(
  kind: TKind,
  seed: string,
  sequence: number
): StableIdByKind[TKind] => {
  if (!isStableIdKind(kind)) {
    throw new StableIdError("INVALID_ID_KIND", "/kind", "Fixture ID kind is not supported.");
  }
  if (!suffixPattern.test(seed) || !isAscii(seed)) {
    throw new StableIdError("INVALID_FIXTURE_SEED", "/seed", "Fixture seed must already be normalized lowercase ASCII.");
  }
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new StableIdError("INVALID_SEQUENCE", "/sequence", "Fixture sequence must be a nonnegative safe integer.");
  }
  return parseStableId(kind, `${STABLE_ID_PREFIXES[kind]}${seed}.${sequence}`, "");
};

export interface StableFixtureIdFactory<TKind extends StableIdKind> {
  readonly kind: TKind;
  readonly seed: string;
  readonly startingSequence: number;
  readonly at: (offset: number) => StableIdByKind[TKind];
  readonly next: () => StableIdByKind[TKind];
}

export const createStableFixtureIdFactory = <TKind extends StableIdKind>(
  kind: TKind,
  seed: string,
  startingSequence = 0
): StableFixtureIdFactory<TKind> => {
  createStableFixtureId(kind, seed, startingSequence);
  let nextSequence = startingSequence;
  let exhausted = false;
  return Object.freeze({
    kind,
    seed,
    startingSequence,
    at: (offset: number): StableIdByKind[TKind] => {
      if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(startingSequence + offset)) {
        throw new StableIdError("INVALID_SEQUENCE", "/offset", "Fixture offset must produce a nonnegative safe integer.");
      }
      return createStableFixtureId(kind, seed, startingSequence + offset);
    },
    next: (): StableIdByKind[TKind] => {
      if (exhausted) {
        throw new StableIdError("INVALID_SEQUENCE", "/sequence", "Fixture sequence cannot advance beyond MAX_SAFE_INTEGER.");
      }
      const result = createStableFixtureId(kind, seed, nextSequence);
      if (nextSequence === Number.MAX_SAFE_INTEGER) {
        exhausted = true;
      } else {
        nextSequence += 1;
      }
      return result;
    }
  });
};

export const parseSaveId = (value: unknown, path = ""): SaveId => parseStableId("save", value, path);
export const parsePlayerId = (value: unknown, path = ""): PlayerId => parseStableId("player", value, path);
export const parseShipId = (value: unknown, path = ""): ShipId => parseStableId("ship", value, path);
export const parseDroneId = (value: unknown, path = ""): DroneId => parseStableId("drone", value, path);
export const parseStationId = (value: unknown, path = ""): StationId => parseStableId("station", value, path);
export const parseBaseId = (value: unknown, path = ""): BaseId => parseStableId("base", value, path);
export const parseMissionId = (value: unknown, path = ""): MissionId => parseStableId("mission", value, path);
export const parseEncounterId = (value: unknown, path = ""): EncounterId => parseStableId("encounter", value, path);
export const parseEventId = (value: unknown, path = ""): EventId => parseStableId("event", value, path);
export const parseContainerId = (value: unknown, path = ""): ContainerId => parseStableId("container", value, path);
export const parseSiteId = (value: unknown, path = ""): SiteId => parseStableId("site", value, path);
export const parseResourceNodeId = (value: unknown, path = ""): ResourceNodeId => parseStableId("resource-node", value, path);
export const parseShipVariantId = (value: unknown, path = ""): ShipVariantId => parseStableId("ship-variant", value, path);
