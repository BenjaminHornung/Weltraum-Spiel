import type { FactoryPlacementView, FactoryPlacementPlan, FactoryPlacementRequest } from "../construction/placement";
import type { FactoryFacilityRequest } from "../../hestia-prototype/physics/factoryFacilitySession";
import type { HvpSourceColumn } from "../../hvp/hvpCoastSource";
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
export interface FactorySourceProfile { readonly version:"hvp-factory-startsite-v1"; readColumn(x:number,z:number):HvpSourceColumn }
/** Read-only capability of the existing HVP host, never another World owner. */
export interface FactoryHostView {
  readonly sessionId: string;
  readonly epoch: number;
  readonly nativeTick: number;
  readonly physicsStatus: "Running" | "Paused" | "SimulationHold" | "CoverageHold" | "RecoveryHold" | "Disposed";
  readonly confirmed: boolean;
  readonly terrain: Readonly<{
    epoch: number; revision: number; sourceDigest: string; baseDigest: string;
    cellMeters: number; originMeters: Readonly<{ x: number; y: number; z: number }>;
    sizeX: number; sizeY: number; sizeZ: number;
  }>;
}
export interface FactoryHostPort {
  readonly construction?:FactoryNativeConstructionPort;
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
  /** Optional safe teardown barrier; default requires isQuiescent, never skips cleanup. */
  canEndSession?(): boolean;
}
export type FactoryHostExtension = (host: FactoryHostPort) => Promise<FactoryHostExtensionHandle>;
