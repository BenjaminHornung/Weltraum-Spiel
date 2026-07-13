import type {
  BaseId,
  ContainerId,
  DroneId,
  EncounterId,
  EventId,
  ExternalReferenceId,
  MissionId,
  PlayerId,
  SaveId,
  ShipId,
  ShipVariantId,
  SiteId,
  StableInstanceId,
  StationId
} from "./ids";
import type { SimulationTick, UniverseTime } from "./time";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;
export interface JsonArray extends ReadonlyArray<JsonValue> {}
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type DefinitionDomain = string;
export type DefinitionsVersion = string;

export interface DefinitionsVersionReference {
  readonly domain: DefinitionDomain;
  readonly version: DefinitionsVersion;
}

export interface DefinitionReference<TDefinitionId extends ShipVariantId = ShipVariantId> {
  readonly domain: DefinitionDomain;
  readonly definitionId: TDefinitionId;
  readonly definitionsVersionRef: DefinitionsVersionReference;
}

/** Caller-owned catalog boundary used only while validating; never serialized into a save. */
export interface DefinitionResolutionSnapshot<TDefinitionId extends ShipVariantId = ShipVariantId> {
  readonly domain: DefinitionDomain;
  readonly version: DefinitionsVersion;
  readonly definitionIds: readonly TDefinitionId[];
}

export type DefinitionSnapshotResolver = readonly DefinitionResolutionSnapshot[];

export interface MutableInstanceState<
  TId extends StableInstanceId,
  TDefinitionId extends ShipVariantId = ShipVariantId,
  TData extends JsonObject = JsonObject
> {
  readonly instanceId: TId;
  readonly definitionRef: DefinitionReference<TDefinitionId>;
  readonly data: TData;
}

export interface FiniteVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface FiniteQuaternion {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export const SIMULATION_MODES = Object.freeze([
  "Active",
  "Background",
  "Dormant",
  "NeedsReplan",
  "NeedsPlayerAttention",
  "Destroyed"
] as const);

export type SimulationMode = (typeof SIMULATION_MODES)[number];

export interface MobileObjectPersistentState<TObjectId extends ShipId | DroneId = ShipId | DroneId> {
  readonly objectId: TObjectId;
  readonly ownerId: StableInstanceId;
  readonly definitionId: ShipVariantId;
  readonly frameId: ExternalReferenceId;
  readonly positionMeters: FiniteVector3;
  readonly velocityMetersPerSecond: FiniteVector3;
  readonly angularVelocity: FiniteVector3;
  readonly orientation: FiniteQuaternion;
  readonly epochSeconds: number;
  readonly currentMassKg: number;
  readonly dryMassKg: number;
  readonly fuelMassKg: number;
  readonly cargoContainerIds: readonly ContainerId[];
  readonly damageStateRef: ExternalReferenceId | null;
  readonly powerStateRef: ExternalReferenceId | null;
  readonly activePlanRef: ExternalReferenceId | null;
  readonly activeMissionRef: MissionId | null;
  readonly simulationMode: SimulationMode;
}

export interface PlayerPersistentState {
  readonly playerId: PlayerId;
  readonly activeShipId: ShipId | null;
  readonly activeMissionRef: MissionId | null;
  readonly data: JsonObject;
}

export interface NeutralPersistentRecord<TId extends StableInstanceId> {
  readonly schemaVersion: 1;
  readonly instanceId: TId;
  readonly definitionRef: DefinitionReference | null;
  readonly data: JsonObject;
}

export type StationPersistentState = NeutralPersistentRecord<StationId>;
export type BasePersistentState = NeutralPersistentRecord<BaseId>;
export type MissionPersistentState = NeutralPersistentRecord<MissionId>;
export type EncounterPersistentState = NeutralPersistentRecord<EncounterId>;

export interface DiscoveryPersistentState {
  readonly schemaVersion: 1;
  readonly siteId: SiteId;
  readonly discoveredAtTick: SimulationTick;
  readonly data: JsonObject;
}

export type EventType =
  | "MissionComplete"
  | "FuelReserveLow"
  | "WarpExited"
  | "CargoFull"
  | "ContactLost"
  | "NeedsReplan"
  | "NeedsPlayerAttention"
  | "DefinitionMissing"
  | "MigrationApplied";
export type EventSeverity = "Info" | "Warning" | "Critical";
export type EventStatus = "Pending" | "Acknowledged";

export interface DomainEvent {
  readonly eventId: EventId;
  readonly type: EventType;
  readonly universeTime: UniverseTime;
  readonly sourceId: StableInstanceId | null;
  readonly targetId: StableInstanceId | null;
  readonly severity: EventSeverity;
  readonly actionRequired: boolean;
  readonly payload: JsonValue;
  readonly status: EventStatus;
  readonly acknowledgedAt: UniverseTime | null;
}

export interface EventQueueSnapshot {
  readonly events: readonly DomainEvent[];
}

export interface SaveGameMetadata {
  readonly createdAtTick: SimulationTick;
  readonly updatedAtTick: SimulationTick;
  readonly provenance: JsonObject | null;
}

export interface SaveGameEnvelopeV1 {
  readonly schemaVersion: 1;
  readonly gameVersion: string;
  readonly saveId: SaveId;
  readonly universeTime: UniverseTime;
  readonly definitionsVersionRefs: readonly DefinitionsVersionReference[];
  readonly player: PlayerPersistentState;
  readonly ships: readonly MobileObjectPersistentState<ShipId>[];
  readonly drones: readonly MobileObjectPersistentState<DroneId>[];
  readonly stations: readonly StationPersistentState[];
  readonly bases: readonly BasePersistentState[];
  readonly missions: readonly MissionPersistentState[];
  readonly encounters: readonly EncounterPersistentState[];
  readonly discoveries: readonly DiscoveryPersistentState[];
  readonly worldEvents: EventQueueSnapshot;
  readonly metadata: SaveGameMetadata;
}
