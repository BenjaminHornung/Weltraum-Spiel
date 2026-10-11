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
