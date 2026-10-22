import type { FactoryPlacementView, FactoryPlacementPlan, FactoryPlacementRequest } from "../construction/placement";
import type { FactoryVector } from "../construction/installationProfile";
import type { BeltInstalledPort } from "../conveyor/beltPorts";
import type { BeltPacket } from "../conveyor/beltReference";
import type { FactoryFacilityRead,FactoryCarrierRequest, FactoryFacilityRequest } from "../../hestia-prototype/physics/factoryFacilitySession";
import type { HvpFactorySourceVersion, HvpSourceColumn } from "../../hvp/hvpCoastSource";
import type { FactoryCheckpointPreflight, FactoryDecodedCheckpoint, FactorySessionCheckpointV1, FactorySessionCheckpointV2 } from "../persistence/factoryCheckpoint";
import type { FactoryCheckpointCaptureUnion } from "../persistence/restoreFactorySession";
export type FactoryCheckpointRawAdmission = (rawFactory: FactorySessionCheckpointV1 | FactorySessionCheckpointV2, cacheBytes: number, treeMetrics: FactoryCheckpointPreflight) => void;
export type FactoryCheckpointRawAdmissionV1 = (rawFactory: FactorySessionCheckpointV1, cacheBytes: number, treeMetrics: FactoryCheckpointPreflight) => void;
export type FactoryCheckpointCacheBreakdown = Readonly<{
  cachedDomainCanonicalDescendantsBytes: number;
  dryFactoryStateBytes: number;
  dryFactoryStateBytesMatchesLastStepNextState: boolean;
  currentExactMaterialBindingsBytes: number;
  currentProductionMaterialBytes: number;
  beltMaterialFragmentBytes: number;
  catalogTreeBytes: number;
  goalProjectionMemoBytes: number;
  initialMaterial: Readonly<{
    included: boolean;
    checkpointDtoBytes: number;
    exactMaterialBindingsBytes: number;
    productionMaterialBytes: number;
  }>;
}>;
export type FactoryCheckpointMemoryRead = Readonly<{ factory: FactorySessionCheckpointV1 | FactorySessionCheckpointV2; cacheBytes: number; treeMetrics: FactoryCheckpointPreflight;
  cacheBreakdown?: FactoryCheckpointCacheBreakdown }>;
export type FactoryCheckpointMemoryReadV1 = Omit<FactoryCheckpointMemoryRead,"factory"> & Readonly<{factory:FactorySessionCheckpointV1}>;
export interface FactoryNativeConstructionPort {
  openCargo():Promise<void>;
  readFacts(): Omit<FactoryPlacementView,"material"|"installations">;
  prepareNative(request:FactoryFacilityRequest):Promise<unknown>;
  commitNative(id:string):Promise<unknown>;
  publishNative(id:string):void;
  rollbackNative(id:string):Promise<unknown>;
  finalizeNative(id:string):Promise<unknown>;
  stageProjection(plan:FactoryPlacementPlan):Promise<void>;
  publishProjection(plan:FactoryPlacementPlan):void;
  rollbackProjection(id:string):void;
  finalizeProjection(id:string):void;
  projectGhost(request:FactoryPlacementRequest|null):void;
  dispose():void;
}
/** Existing Native World capabilities. All source/reach facts are native projections. */
export interface FactoryNativeHandlingPort {
  read(): FactoryFacilityRead;
  prepare(request:FactoryCarrierRequest,operation:"pickup"|"deposit"|"release"):Promise<FactoryFacilityRead>;
  commit(id:string):Promise<void>;
  publish(id:string):void;
  rollback(id:string):Promise<void>;
  finalize(id:string):Promise<void>;
}
export interface FactorySourceProfile { readonly version:HvpFactorySourceVersion; readColumn(x:number,z:number):HvpSourceColumn }
export type FactoryHostSurface = "cargo"|"machine"|"power"|"technology"|"build"|"map"|"help"|"pause"|"start"|"settings";
/** Read-only capability of the existing HVP host, never another World owner. */
export interface FactoryHostView {
  readonly sessionId: string;
  readonly epoch: number;
  readonly nativeTick: number;
  readonly persistence?: Readonly<{ state: "Idle" | "Saving" | "Saved" | "Rejected" | "RecoveryHold"; message: string;
    revision: number | null; saveAvailable: boolean; continueAvailable: boolean }>;
  readonly physicsStatus: "Running" | "Paused" | "SimulationHold" | "CoverageHold" | "RecoveryHold" | "Disposed";
  readonly confirmed: boolean;
  readonly simulationRecoveryAvailable?:boolean;
  readonly input?:Readonly<{active:boolean;activationPending:boolean;pointerLocked:boolean;pausePending:boolean;
    focusedPanel:FactoryUiPanel|null;surface:FactoryHostSurface|null;error:string|null}>;
  readonly terrain: Readonly<{
    epoch: number; revision: number; sourceDigest: string; baseDigest: string; profileVersion?:FactorySourceProfile["version"];
    cellMeters: number; originMeters: Readonly<{ x: number; y: number; z: number }>;
    sizeX: number; sizeY: number; sizeZ: number;
  }>;
}
export interface FactoryHostPort {
  readonly construction?:FactoryNativeConstructionPort;
  readonly handling?:FactoryNativeHandlingPort;
  setPanelFocus?(panel:FactoryUiPanel|null):void;
  /** Closing clears only its own modal binding; it never resumes input. */
  setSurface?(surface:FactoryHostSurface|null,binding:Readonly<{sessionId:string;epoch:number}>):void;
  /** Called directly under the actual gesture; resolves only after native Play ACK and current pointer lock. */
  play?():Promise<FactoryHostView>;
  /** Separate explicit acknowledgement, returns paused; ordinary Play/Resume remain guarded. */
  recoverSimulationHold?():Promise<FactoryHostView>;
  endSession?():Promise<void>;
  save?():Promise<void>;
  continueSession?():void;
  current(): boolean;
  read(): FactoryHostView;
  readTerrainSlot(x: number, y: number, z: number): number | undefined;
  /** Includes informational unconfirmed holds; only view.confirmed may grant ticks. */
  subscribeConfirmed(listener: (view: FactoryHostView) => void): () => void;
  pause(): Promise<FactoryHostView>;
  /** Explicit only; refuses hidden, unconfirmed, busy or stale hosts. */
  resume(): Promise<FactoryHostView>;
}
export interface FactoryHostExtensionHandle {
  dispose(): Promise<void>;
  isQuiescent(): boolean;
  canBeginFactoryCheckpoint?(): boolean;
  beginFactoryCheckpoint?(admit?: FactoryCheckpointRawAdmission): FactoryCheckpointCaptureUnion;
  readFactoryCheckpointMemory?(): FactoryCheckpointMemoryRead;
  /** Private Host-only clock recovery. Callback must use the existing Native owner. */
  canRecoverSimulationHold?():boolean;
  recoverSimulationHold?(resetNative:()=>Promise<void>):Promise<void>;
  /** Optional safe teardown barrier; default requires isQuiescent, never skips cleanup. */
  canEndSession?(): boolean;
  /** Internal immutable committed-domain projection, independent of panel visibility. */
  readFactoryPresentation?(host:FactoryHostView):FactoryPresentationRead;
}
export interface FactoryPresentationMachine {
 readonly instanceId:string;readonly definitionRef:FactoryUiRecipeRef;readonly sourceDigest:string;readonly profileDigest:string;
 readonly installationRevision:number;readonly confirmed:boolean;readonly status:string;readonly confirmedWorkMs:number;
 readonly jobId:string|null;readonly recipeRef:FactoryUiRecipeRef|null;
 readonly custody:Readonly<{inputContainerId:string;wipContainerId:string;outputContainerId:string;offcutContainerId:string;installedContainerId:string}>;
}
export interface FactoryPresentationRead {
 readonly sessionId:string;readonly epoch:number;readonly publicationRevision:number;readonly nativeTick:number;
 readonly catalogDigest:string;readonly terrainRevision:number;readonly facilityRevision:number;readonly confirmed:boolean;
 readonly phase:FactoryHostView["physicsStatus"];
 readonly machines:readonly FactoryPresentationMachine[];
  readonly powerLinks:readonly FactoryPresentationPowerLink[];
  readonly belts:readonly FactoryPresentationBelt[];
 readonly material:import("../material/reservations").MaterialView;
 readonly installations:readonly import("../construction/placement").FactoryInstallation[];
}
export interface FactoryPresentationPowerLink {
 readonly linkId:string;readonly fromPortId:string;readonly toPortId:string;
 readonly sourceProfileDigest:string;readonly targetProfileDigest:string;readonly containerId:string;
 readonly lengthMm:number;readonly routeMm:readonly [FactoryVector,FactoryVector,FactoryVector,FactoryVector];readonly active:boolean;
}
export type FactoryPresentationBeltEndpoint=BeltInstalledPort&Readonly<{confirmed:boolean}>;
export type FactoryPresentationBeltPacket=Pick<BeltPacket,"packetId"|"stackId"|"itemId"|"itemVersion"|"itemDigest"|"positionMm">;
export interface FactoryPresentationBelt {
 readonly lineId:string;readonly driveInstanceId:string;readonly source:FactoryPresentationBeltEndpoint;readonly target:FactoryPresentationBeltEndpoint;
 readonly lengthMm:number;readonly bandContainerId:string;readonly packet:FactoryPresentationBeltPacket|null;
}
export type FactoryHostExtension = (host: FactoryHostPort, restore?: FactoryDecodedCheckpoint,
  owner?:FactorySessionCheckpointV2) => Promise<FactoryHostExtensionHandle>;

/** Frozen W09 player protocol. Implementations resolve all facts through this Host; panels own no domain state. */
export type FactoryUiPanel = "cargo" | "machine" | "power" | "technology";
export interface FactoryUiBinding {
  readonly catalogDigest: string; readonly terrainSourceDigest: string; readonly powerSourceProfileDigest: string;
  readonly terrainRevision: number; readonly facilityRevision: number; readonly materialRevision: number;
  readonly netRevision: number; readonly handlingRevision: number;
}
export interface FactoryUiLotRef { readonly containerId: string; readonly containerRevision: number; readonly stackId: string; readonly quantityUnits: number }
export interface FactoryUiEntityRef { readonly id: string; readonly revision: number }
export interface FactoryUiRecipeRef { readonly sourceId: string; readonly version: number; readonly digest: string }
interface FactoryUiCommandBase {
  readonly version: "fp06-ui-command-v1"; readonly commandId: string; readonly sessionId: string; readonly epoch: number;
  readonly expected: FactoryUiBinding;
}
/** No actor/source poses, arbitrary physics bodies, material amounts outside a bound lot, or caller-supplied grants. */
export type FactoryUiCommand = FactoryUiCommandBase & (
  | Readonly<{ kind: "open-cargo" }>
  | Readonly<{ kind: "pickup"; profileId: string; sourceLots: readonly FactoryUiLotRef[] }>
  | Readonly<{ kind: "deposit"; handling: FactoryUiEntityRef; target: Readonly<{ kind: "ground" }> | Readonly<{ kind: "container"; container: FactoryUiEntityRef }> }>
  | Readonly<{ kind: "return"; handling: FactoryUiEntityRef; target: FactoryUiEntityRef }>
  | Readonly<{ kind: "build"; preview: FactoryUiEntityRef }>
  | Readonly<{ kind: "select-recipe"; machine: FactoryUiEntityRef; recipe: FactoryUiRecipeRef }>
  | Readonly<{ kind: "start"; machine: FactoryUiEntityRef; sourceLots: readonly FactoryUiLotRef[] }>
  | Readonly<{ kind: "manual-work" | "manual-finish"; machine: FactoryUiEntityRef; jobId: string }>
  | Readonly<{ kind: "transfer"; source: FactoryUiLotRef; target: FactoryUiEntityRef }>
  | Readonly<{ kind: "connect-power"; sourcePortId: string; targetPortId: string; cableLot: FactoryUiLotRef }>
  | Readonly<{ kind: "connect-belt"; sourcePortId: string; targetPortId: string; sourceLots: readonly FactoryUiLotRef[] }>
  | Readonly<{ kind: "set-enabled"; machine: FactoryUiEntityRef; enabled: boolean }>
);
export interface FactoryUiCapability { readonly enabled: boolean; readonly reason: string | null }
export interface FactoryUiInventory {
  readonly id: string; readonly revision: number; readonly ownerId: string | null;
  readonly role: "cargo" | "carrier" | "depot" | "installed" | "input" | "output" | "offcut" | "wip" | "belt";
  readonly accessible: boolean; readonly massMg: number; readonly capacityMassMg: number; readonly capacityVolumeMm3: number;
  readonly contents: readonly Readonly<{ stackId: string; itemId: string; name: string; quantityUnits: number; quantityBasis: "mg" | "mm" | "piece"; massMg: number; freshProduction: boolean }>[];
  readonly pickupProfiles: readonly Readonly<{ profileId: string; name: string; sourceLots: readonly FactoryUiLotRef[]; capability: FactoryUiCapability }>[];
}
export interface FactoryUiMachine {
  readonly id: string; readonly revision: number; readonly definitionId: string; readonly name: string; readonly installed: boolean;
  readonly status: string; readonly reason: string | null; readonly selectedRecipe: FactoryUiRecipeRef | null;
  readonly recipes: readonly Readonly<{ ref: FactoryUiRecipeRef; name: string; durationMs: number | null; powerWatts: number }>[];
  readonly jobId: string | null; readonly confirmedWorkMs: number; readonly requiredWorkMs: number | null;
  readonly allocatedWatts: number; readonly inputContainerId: string; readonly outputContainerId: string;
  readonly offcutContainerId: string; readonly wipContainerId: string; readonly installedContainerId: string;
  readonly ports: readonly Readonly<{ id: string; role: string; connected: boolean }>[];
  readonly actions: Readonly<{ start: FactoryUiCapability; manualWork: FactoryUiCapability; manualFinish: FactoryUiCapability; toggle: FactoryUiCapability }>;
}
export interface FactoryUiReceipt {
  readonly commandId: string; readonly requestCanonicalJson: string;
  readonly status: "Committed" | "Rejected" | "RecoveryHold";
  readonly reason: string | null; readonly publicationRevision: number; readonly binding: FactoryUiBinding;
}
export interface FactoryUiReadModel {
  readonly version: "fp06-ui-read-v1"; readonly sessionId: string; readonly epoch: number; readonly publicationRevision: number;
  readonly binding: FactoryUiBinding; readonly host: FactoryHostView; readonly factorySteps: number; readonly elapsedMs: number;
  readonly state: "Ready" | "Waiting" | "RecoveryHold" | "Disposed"; readonly reason: string | null; readonly focusedPanel: FactoryUiPanel | null;
  readonly inventory: readonly FactoryUiInventory[]; readonly machines: readonly FactoryUiMachine[];
  readonly power: Readonly<{ status: string; generationWatts: number; allocatedWatts: number; batteryEnergyJ: number | null; batteryCapacityJ: number | null;
    reserveEnergyJ: number | null; sourceQuality: string; allocationConfirmed?:boolean; devices?:readonly Readonly<{id:string;revision:number;name:string;enabled:boolean;capability:FactoryUiCapability}>[]; consumers: readonly Readonly<{ id: string; name: string; requestedWatts: number; allocatedWatts: number; reason: string | null }>[] }>;
  readonly technologies: readonly Readonly<{ id: string; name: string; status: "AVAILABLE" | "MISSING_REQUIREMENTS" | "PLANNED";
    requirements: readonly string[]; reason: string | null }>[];
  readonly interaction: Readonly<{ cargoOpened: boolean; cargoAccessible: boolean; handling: Readonly<{ id: string; revision: number; profileId: string;
    phase: "Carrying" | "Deposited"; massMg: number }> | null; openCargo: FactoryUiCapability; deposit: FactoryUiCapability; returnCargo: FactoryUiCapability;
    localDeposits?:readonly Readonly<{target:FactoryUiEntityRef;capability:FactoryUiCapability}>[] }>;
  readonly lastReceipt: FactoryUiReceipt | null;
  /** Pure current Native/finite-lot choices. Submit always repeats admission. */
  readonly connections?:Readonly<{
    power:readonly Readonly<{id:string;sourcePortId:string;targetPortId:string;lengthMm:number;cableLot:FactoryUiLotRef|null;capability:FactoryUiCapability}>[];
    belts:readonly Readonly<{id:string;sourcePortId:string;targetPortId:string;sourceLots:readonly FactoryUiLotRef[];capability:FactoryUiCapability}>[];
  }>;
}
export interface FactoryUiResult { readonly status: "Committed" | "NoOp" | "Rejected" | "RecoveryHold"; readonly receipt: FactoryUiReceipt }
export interface FactoryUiPort {
  read(): FactoryUiReadModel;
  subscribe(listener: (view: FactoryUiReadModel) => void): () => void;
  submit(command: FactoryUiCommand): Promise<FactoryUiResult>;
  readReceipt(commandId: string): FactoryUiReceipt | undefined;
  /** Closing a panel never restores a previous held movement or build key. */
  setPanelFocus(panel: FactoryUiPanel | null): void;
}
