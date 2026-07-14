import {
  compareAscii,
  type BackendRevision,
  BufferOwnershipOutcome,
  RenderBackendDiagnostics,
  RenderBackendState,
  RenderCommandResult,
  RepresentationKey
} from "../../../presentation";

export interface ThreeDiagnosticState {
  acceptedArtifacts: number;
  rejectedArtifacts: number;
  geometryAllocations: number;
  geometryDisposals: number;
  materialAllocations: number;
  materialDisposals: number;
  replacementCount: number;
  removeCount: number;
  staleRejectCount: number;
  resetCount: number;
  evictionCount: number;
  evictionRejectCount: number;
  rehydrationCount: number;
  renderTargetAllocations: number;
  renderTargetDisposals: number;
  backendRevision: BackendRevision;
  backendState: RenderBackendState;
  lastCommandStatus?: RenderCommandResult["status"];
  lastOwnershipOutcome?: BufferOwnershipOutcome;
}

export interface ThreeDiagnosticResources {
  readonly residentKeys: readonly RepresentationKey[];
  readonly visibleKeys: readonly RepresentationKey[];
  readonly pinnedFallbackKeys: readonly RepresentationKey[];
  readonly estimatedGpuBytes: number;
  readonly ownedCpuBytes: number;
}

export const createDiagnosticState = (backendRevision: BackendRevision): ThreeDiagnosticState => ({
  acceptedArtifacts: 0,
  rejectedArtifacts: 0,
  geometryAllocations: 0,
  geometryDisposals: 0,
  materialAllocations: 0,
  materialDisposals: 0,
  replacementCount: 0,
  removeCount: 0,
  staleRejectCount: 0,
  resetCount: 0,
  evictionCount: 0,
  evictionRejectCount: 0,
  rehydrationCount: 0,
  renderTargetAllocations: 0,
  renderTargetDisposals: 0,
  backendRevision,
  backendState: "Uninitialized"
});

export const recordCommandResult = (state: ThreeDiagnosticState, result: RenderCommandResult): RenderCommandResult => {
  state.lastCommandStatus = result.status;
  state.lastOwnershipOutcome = result.ownership;
  return result;
};

const sorted = (keys: readonly RepresentationKey[]): readonly RepresentationKey[] =>
  Object.freeze([...keys].sort(compareAscii));

export const diagnosticSnapshot = (
  state: ThreeDiagnosticState,
  resources: ThreeDiagnosticResources
): RenderBackendDiagnostics => Object.freeze({
  acceptedArtifacts: state.acceptedArtifacts,
  rejectedArtifacts: state.rejectedArtifacts,
  activeRepresentations: resources.residentKeys.length,
  activeFallbacks: resources.pinnedFallbackKeys.length,
  geometryAllocations: state.geometryAllocations,
  geometryDisposals: state.geometryDisposals,
  materialAllocations: state.materialAllocations,
  materialDisposals: state.materialDisposals,
  estimatedGpuBytes: resources.estimatedGpuBytes,
  ownedCpuBytes: resources.ownedCpuBytes,
  replacementCount: state.replacementCount,
  removeCount: state.removeCount,
  staleRejectCount: state.staleRejectCount,
  resetCount: state.resetCount,
  evictionCount: state.evictionCount,
  evictionRejectCount: state.evictionRejectCount,
  rehydrationCount: state.rehydrationCount,
  renderTargetAllocations: state.renderTargetAllocations,
  renderTargetDisposals: state.renderTargetDisposals,
  activeRenderTargets: state.renderTargetAllocations - state.renderTargetDisposals,
  backendRevision: state.backendRevision,
  backendState: state.backendState,
  residentRepresentationKeys: sorted(resources.residentKeys),
  visibleRepresentationKeys: sorted(resources.visibleKeys),
  pinnedFallbackRepresentationKeys: sorted(resources.pinnedFallbackKeys),
  lastCommandStatus: state.lastCommandStatus,
  lastOwnershipOutcome: state.lastOwnershipOutcome
});
