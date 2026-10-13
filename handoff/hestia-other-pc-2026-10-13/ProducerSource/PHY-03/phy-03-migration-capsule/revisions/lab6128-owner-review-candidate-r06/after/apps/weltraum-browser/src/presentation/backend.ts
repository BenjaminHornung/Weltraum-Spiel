import type { BackendRevision, RepresentationKey } from "./ids";
import type { MaterialProfileKind } from "./materialProfile";
import type { BufferOwnershipOutcome, RenderCommand, RenderCommandResult, RenderCommandStatus } from "./renderCommands";

export interface RenderBackendCapabilities {
  readonly supportedIndexWidths: readonly (16 | 32)[];
  readonly supportedMaterialKinds: readonly MaterialProfileKind[];
  readonly supportsPerspectiveProjection: true;
  readonly supportsEviction: true;
}

export type RenderBackendState = "Uninitialized" | "Available" | "Disposed";

export interface RenderBackendDiagnostics {
  readonly acceptedArtifacts: number;
  readonly rejectedArtifacts: number;
  readonly activeRepresentations: number;
  readonly activeFallbacks: number;
  readonly geometryAllocations: number;
  readonly geometryDisposals: number;
  readonly materialAllocations: number;
  readonly materialDisposals: number;
  readonly estimatedGpuBytes: number;
  readonly ownedCpuBytes: number;
  readonly replacementCount: number;
  readonly removeCount: number;
  readonly staleRejectCount: number;
  readonly resetCount: number;
  readonly evictionCount: number;
  readonly evictionRejectCount: number;
  readonly rehydrationCount: number;
  readonly renderTargetAllocations: number;
  readonly renderTargetDisposals: number;
  readonly activeRenderTargets: number;
  readonly backendRevision: BackendRevision;
  readonly backendState: RenderBackendState;
  readonly residentRepresentationKeys: readonly RepresentationKey[];
  readonly visibleRepresentationKeys: readonly RepresentationKey[];
  readonly pinnedFallbackRepresentationKeys: readonly RepresentationKey[];
  readonly lastCommandStatus?: RenderCommandStatus;
  readonly lastOwnershipOutcome?: BufferOwnershipOutcome;
}

export interface RenderBackend {
  dispatch(command: RenderCommand): RenderCommandResult;
  renderFrame(): RenderCommandResult;
  getCapabilities(): RenderBackendCapabilities;
  readDiagnostics(): RenderBackendDiagnostics;
}
