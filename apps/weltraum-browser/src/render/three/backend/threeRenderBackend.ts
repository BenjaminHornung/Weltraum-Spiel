import * as THREE from "three";
import { validateRenderCommandOwnedSteps, renderCommandSignatureOwnedSteps } from "../../../presentation/renderCommands";
import {
  backendRevision,
  compareArtifactVersions,
  estimateMeshArtifactBytes,
  frameProjectionSignature,
  meshArtifactOwnedBuffers,
  parseEphemeralRepresentationKey,
  renderCommandResult,
  renderCommandSignature,
  resolveVisibility,
  validateRenderCommand,
  visibilityPlanSignature,
  type ApplyFrameProjectionCommand,
  type ApplyVisibilityPlanCommand,
  type AdvanceEphemeralEpochCommand,
  type BackendRevision,
  type CancelEphemeralRepresentationCommand,
  type ContentHash,
  type DisposeBackendCommand,
  type EvictRepresentationCommand,
  type FrameProjectionSnapshot,
  type InitializeBackendCommand,
  type MaterialProfile,
  type RemoveRepresentationCommand,
  type RenderBackend,
  type RenderBackendCapabilities,
  type RenderBackendDiagnostics,
  type RenderCommand,
  type RenderCommandResult,
  type RegisterEphemeralRepresentationCommand,
  type RepresentationKey,
  type ResetBackendCommand,
  type UpsertMeshArtifactCommand,
  type VisibilityPlan
} from "../../../presentation";
import { applyCameraProjection, applyRepresentationTransform } from "./threeCameraProjection";
import {
  createDiagnosticState,
  diagnosticSnapshot,
  recordCommandResult,
  type ThreeDiagnosticState
} from "./threeDiagnostics";
import { MaterialProfileConflictError, ThreeMaterialFactory } from "./threeMaterialFactory";
import { prepareThreeMesh } from "./threeMeshFactory";
import { ThreeResourceRegistry, type ThreeResourceRecord } from "./threeResourceRegistry";

export interface ThreeRendererPort {
  setPixelRatio(value: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
}

export interface ThreeRenderBackendOptions {
  readonly canvas: HTMLCanvasElement;
  readonly width?: number;
  readonly height?: number;
  readonly pixelRatio?: number;
  readonly antialias?: boolean;
  readonly backgroundColor?: number;
  readonly lightingMode?: "Basic" | "None";
  readonly preserveDrawingBuffer?: boolean;
  readonly rendererFactory?: (canvas: HTMLCanvasElement, parameters: THREE.WebGLRendererParameters) => ThreeRendererPort;
}

const capabilities: RenderBackendCapabilities = Object.freeze({
  supportedIndexWidths: Object.freeze([16, 32] as const),
  supportedMaterialKinds: Object.freeze(["Unlit", "BasicLit", "DebugWireframe"] as const),
  supportsPerspectiveProjection: true,
  supportsEviction: true
});

const defaultRendererFactory = (canvas: HTMLCanvasElement, parameters: THREE.WebGLRendererParameters): ThreeRendererPort =>
  new THREE.WebGLRenderer({ ...parameters, canvas });

export class ThreeRenderBackend implements RenderBackend {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
  readonly representationRoot = new THREE.Group();

  private readonly registry = new ThreeResourceRegistry();
  private readonly materialFactory = new ThreeMaterialFactory();
  private readonly diagnostics: ThreeDiagnosticState;
  private readonly rendererFactory: NonNullable<ThreeRenderBackendOptions["rendererFactory"]>;
  private renderer: ThreeRendererPort | undefined;
  private visibilityPlan: VisibilityPlan | undefined;
  private visibilitySignature: ContentHash | undefined;
  private projection: FrameProjectionSnapshot | undefined;
  private projectionSignature: ContentHash | undefined;
  private lastAppliedReset: { readonly from: BackendRevision; readonly to: BackendRevision } | undefined;
  private readonly projectedTransforms = new Map<RepresentationKey, FrameProjectionSnapshot["representationTransforms"][number]>();

  constructor(private readonly options: ThreeRenderBackendOptions) {
    this.rendererFactory = options.rendererFactory ?? defaultRendererFactory;
    this.diagnostics = createDiagnosticState(backendRevision(0));
    this.scene.background = new THREE.Color(options.backgroundColor ?? 0x101820);
    this.scene.add(this.representationRoot);
    if (options.lightingMode !== "None") {
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x202030, 1.5));
      const directional = new THREE.DirectionalLight(0xffffff, 2);
      directional.position.set(3, 5, 4);
      this.scene.add(directional);
    }
  }

  dispatch(command: RenderCommand): RenderCommandResult {
    return this.dispatchSteps(command, false).next().value as RenderCommandResult;
  }

  *dispatchOwnedSteps(command: RenderCommand): Generator<string, RenderCommandResult, unknown> {
    return yield* this.dispatchSteps(command, true);
  }

  private *dispatchSteps(command: RenderCommand, owned: boolean): Generator<string, RenderCommandResult, unknown> {
    const validation = owned ? yield* validateRenderCommandOwnedSteps(command) : validateRenderCommand(command);
    if (!validation.valid) {
      if ((command as { readonly kind?: unknown }).kind === "UpsertMeshArtifact") {
        this.diagnostics.rejectedArtifacts += 1;
      }
      return this.finish(renderCommandResult(
        "RejectedInvalidArtifact",
        (command as { readonly kind?: unknown }).kind === "UpsertMeshArtifact" ? "RetainedByCaller" : "NotApplicable",
        validation.issues[0]?.code
      ));
    }
    if (command.kind === "InitializeBackend") return this.initialize(command);
    if (this.diagnostics.backendState === "Disposed") {
      if (command.kind === "DisposeBackend" && command.backendRevision === this.diagnostics.backendRevision) {
        if (this.registry.hasEphemeralReleaseUncertainty()) {
          return this.finish(renderCommandResult("BackendUnavailable", "AlreadyOwnedByBackend", "EphemeralReleaseUncertain"));
        }
        return this.finish(renderCommandResult("AlreadyApplied", "NotApplicable", "BackendAlreadyDisposed"));
      }
      return this.finish(renderCommandResult("BackendUnavailable", "RetainedByCaller", "BackendDisposed"));
    }
    if (command.kind === "ResetBackend"
      && this.lastAppliedReset?.from === command.backendRevision
      && this.lastAppliedReset.to === command.nextBackendRevision
      && this.diagnostics.backendRevision === command.nextBackendRevision) {
      return this.finish(renderCommandResult("AlreadyApplied", "NotApplicable", "ResetAlreadyApplied"));
    }
    if (this.diagnostics.backendState !== "Available") {
      return this.finish(renderCommandResult("BackendUnavailable", "RetainedByCaller", "BackendNotInitialized"));
    }
    if (command.backendRevision !== this.diagnostics.backendRevision) {
      this.diagnostics.staleRejectCount += 1;
      return this.finish(renderCommandResult("RejectedStaleRevision", "RetainedByCaller", "BackendRevisionMismatch"));
    }
    switch (command.kind) {
      case "UpsertMeshArtifact": return yield* this.upsertSteps(command, owned);
      case "RemoveRepresentation": return this.remove(command);
      case "EvictRepresentation": return this.evict(command);
      case "RegisterEphemeralRepresentation": {
        return this.registerEphemeral(command);
      }
      case "CancelEphemeralRepresentation": {
        return this.cancelEphemeral(command);
      }
      case "AdvanceEphemeralEpoch": {
        return this.advanceEphemeralEpoch(command);
      }
      case "ApplyVisibilityPlan": return this.applyVisibilityPlan(command);
      case "ApplyFrameProjection": return this.applyProjection(command);
      case "ResetBackend": return this.reset(command);
      case "DisposeBackend": return this.dispose(command);
      default: return this.finish(renderCommandResult("RejectedInvalidArtifact", "NotApplicable", "UnsupportedCommandKind"));
    }
  }

  renderFrame(): RenderCommandResult {
    if (this.diagnostics.backendState !== "Available" || this.renderer === undefined) {
      return this.finish(renderCommandResult("BackendUnavailable", "NotApplicable", "BackendNotAvailable"));
    }
    this.renderer.render(this.scene, this.camera);
    return this.finish(renderCommandResult("Accepted"));
  }

  getCapabilities(): RenderBackendCapabilities {
    return capabilities;
  }

  readDiagnostics(): RenderBackendDiagnostics {
    const records = this.registry.residentRecords();
    const ownedRecords = this.registry.ownedRecords();
    return diagnosticSnapshot(this.diagnostics, {
      residentKeys: records.map((record) => record.representationKey),
      visibleKeys: records.filter((record) => record.sceneNode.visible).map((record) => record.representationKey),
      pinnedFallbackKeys: this.visibilityPlan?.fallbackRepresentationKeys ?? [],
      estimatedGpuBytes: ownedRecords.reduce((total, record) => total + record.estimatedBytes, 0),
      ownedCpuBytes: ownedRecords.reduce((total, record) => total + record.estimatedBytes, 0)
    });
  }

  private initialize(command: InitializeBackendCommand): RenderCommandResult {
    if (this.diagnostics.backendState === "Disposed") {
      return this.finish(renderCommandResult("BackendUnavailable", "NotApplicable", "BackendDisposed"));
    }
    if (this.diagnostics.backendState === "Available") {
      return this.finish(command.backendRevision === this.diagnostics.backendRevision
        ? renderCommandResult("AlreadyApplied")
        : renderCommandResult("RejectedStaleRevision", "NotApplicable", "BackendRevisionMismatch"));
    }
    if (command.backendRevision !== this.diagnostics.backendRevision) {
      this.diagnostics.staleRejectCount += 1;
      return this.finish(renderCommandResult("RejectedStaleRevision", "NotApplicable", "InitialBackendRevisionMustBeZero"));
    }
    try {
      this.renderer = this.createRenderer();
      this.diagnostics.backendState = "Available";
      return this.finish(renderCommandResult("Accepted"));
    } catch {
      return this.finish(renderCommandResult("BackendUnavailable", "NotApplicable", "RendererInitializationFailed"));
    }
  }

  private *upsertSteps(command: UpsertMeshArtifactCommand, owned: boolean): Generator<string, RenderCommandResult, unknown> {
    const admission = this.ephemeralAdmission(command.artifact.representationKey);
    if (admission !== undefined) {
      return admission;
    }
    const isEphemeral = parseEphemeralRepresentationKey(command.artifact.representationKey) !== undefined;
    const indexWidth = command.artifact.indices instanceof Uint16Array ? 16 : 32;
    if (!capabilities.supportedIndexWidths.includes(indexWidth)) {
      this.diagnostics.rejectedArtifacts += 1;
      return this.finish(renderCommandResult("RejectedUnsupportedCapability", "RetainedByCaller", "UnsupportedIndexWidth"));
    }
    const signature = owned ? yield* renderCommandSignatureOwnedSteps(command) : renderCommandSignature(command);
    if (owned) {
      if (this.diagnostics.backendState !== "Available") return this.finish(renderCommandResult("BackendUnavailable", "RetainedByCaller", "BackendNotAvailable"));
      if (command.backendRevision !== this.diagnostics.backendRevision) return this.rejectStale("BackendRevisionMismatch", "RetainedByCaller");
      const currentAdmission = this.ephemeralAdmission(command.artifact.representationKey);
      if (currentAdmission !== undefined) return currentAdmission;
    }
    const ledger = this.registry.getLedger(command.artifact.representationKey);
    if (ledger !== undefined) {
      const ordering = compareArtifactVersions(command.artifact, ledger);
      if (ordering < 0) return this.rejectStaleArtifact("ArtifactRevisionStale");
      if (ordering === 0) {
        if (ledger.contentHash !== command.artifact.contentHash || ledger.commandSignature !== signature) {
          this.diagnostics.rejectedArtifacts += 1;
          return this.finish(renderCommandResult("RejectedContentConflict", "RetainedByCaller", "RevisionContentConflict"));
        }
        if (ledger.state === "Resident") {
          const resident = this.registry.get(command.artifact.representationKey);
          const residentBuffers = resident === undefined ? [] : meshArtifactOwnedBuffers(resident.artifact);
          const proposedBuffers = meshArtifactOwnedBuffers(command.artifact);
          const alreadyOwned = residentBuffers.length === proposedBuffers.length
            && residentBuffers.every((buffer, index) => buffer === proposedBuffers[index]);
          return this.finish(renderCommandResult("AlreadyApplied", alreadyOwned ? "AlreadyOwnedByBackend" : "RetainedByCaller"));
        }
        if (ledger.state === "Removed") return this.rejectStaleArtifact("RepresentationRemovedAtRevision");
      }
    }

    const orderedProfiles = this.orderProfiles(command);
    let prepared: ReturnType<typeof prepareThreeMesh>;
    try {
      prepared = prepareThreeMesh(command.artifact, orderedProfiles, this.materialFactory);
    } catch (error) {
      this.syncMaterialDiagnostics();
      this.diagnostics.rejectedArtifacts += 1;
      const conflict = error instanceof MaterialProfileConflictError;
      if (isEphemeral && !conflict) {
        this.registry.markEphemeralReleaseUncertain(command.artifact.representationKey);
      }
      return this.finish(renderCommandResult(
        conflict ? "RejectedContentConflict" : "BackendUnavailable",
        "RetainedByCaller",
        conflict ? "MaterialProfileConflict" : "ResourcePreparationFailed"
      ));
    }

    const record: ThreeResourceRecord = {
      representationKey: command.artifact.representationKey,
      sourceRevision: command.artifact.sourceRevision,
      artifactRevision: command.artifact.artifactRevision,
      contentHash: command.artifact.contentHash,
      commandSignature: signature,
      estimatedBytes: estimateMeshArtifactBytes(command.artifact),
      artifact: command.artifact,
      geometry: prepared.geometry,
      materials: prepared.materialLease.materials,
      sceneNode: prepared.sceneNode,
      prepared,
      pinnedAsFallback: this.visibilityPlan?.fallbackRepresentationKeys.includes(command.artifact.representationKey) ?? false
    };
    this.representationRoot.add(record.sceneNode);
    const previous = this.registry.commit(record);
    this.diagnostics.geometryAllocations += 1;
    this.diagnostics.acceptedArtifacts += 1;
    if (ledger?.state === "Evicted") this.diagnostics.rehydrationCount += 1;
    this.recomputeVisibility();
    if (previous !== undefined) {
      this.representationRoot.remove(previous.sceneNode);
      if (isEphemeral) {
        try {
          previous.prepared.dispose();
        } catch {
          previous.sceneNode.visible = false;
          this.registry.preserveUncertainEphemeralRecord(command.artifact.representationKey, previous);
          this.syncMaterialDiagnostics();
          return this.finish(renderCommandResult("BackendUnavailable", "AlreadyOwnedByBackend", "EphemeralReleaseUncertain"));
        }
      } else {
        previous.prepared.dispose();
      }
      this.diagnostics.geometryDisposals += 1;
      this.diagnostics.replacementCount += 1;
    }
    this.syncMaterialDiagnostics();
    return this.finish(renderCommandResult("Accepted", "MovedToBackend"));
  }

  private remove(command: RemoveRepresentationCommand): RenderCommandResult {
    const admission = this.ephemeralAdmission(command.representationKey);
    if (admission !== undefined) {
      return admission;
    }
    const isEphemeral = parseEphemeralRepresentationKey(command.representationKey) !== undefined;
    const match = this.matchExpected(command);
    if (match !== undefined) return match;
    const ledger = this.registry.getLedger(command.representationKey);
    if (ledger?.state === "Removed") return this.finish(renderCommandResult("AlreadyApplied", "NotApplicable"));
    if (this.isPinnedFallback(command.representationKey)) {
      return this.finish(renderCommandResult("RejectedContentConflict", "NotApplicable", "PinnedFallback"));
    }
    const resident = this.registry.get(command.representationKey);
    if (isEphemeral && resident !== undefined) {
      try {
        this.releaseRecord(resident);
      } catch {
        resident.sceneNode.visible = false;
        this.registry.preserveUncertainEphemeralRecord(command.representationKey, resident);
        this.syncMaterialDiagnostics();
        return this.finish(renderCommandResult("BackendUnavailable", "AlreadyOwnedByBackend", "EphemeralReleaseUncertain"));
      }
    }
    const removed = this.registry.markRemoved(command.representationKey);
    if (!isEphemeral && removed !== undefined) this.releaseRecord(removed);
    if (isEphemeral && !this.registry.expireEphemeral(command.representationKey)) {
      return this.finish(renderCommandResult("BackendUnavailable", "AlreadyOwnedByBackend", "EphemeralReleaseUncertain"));
    }
    this.diagnostics.removeCount += 1;
    this.recomputeVisibility();
    return this.finish(renderCommandResult("Accepted", removed === undefined ? "NotApplicable" : "ReleasedByBackend"));
  }

  private evict(command: EvictRepresentationCommand): RenderCommandResult {
    const admission = this.ephemeralAdmission(command.representationKey);
    if (admission !== undefined) {
      return admission;
    }
    const isEphemeral = parseEphemeralRepresentationKey(command.representationKey) !== undefined;
    const match = this.matchExpected(command);
    if (match !== undefined) return match;
    const ledger = this.registry.getLedger(command.representationKey);
    if (ledger?.state === "Evicted") return this.finish(renderCommandResult("AlreadyApplied", "NotApplicable"));
    if (this.isPinnedFallback(command.representationKey)) {
      this.diagnostics.evictionRejectCount += 1;
      return this.finish(renderCommandResult("RejectedContentConflict", "NotApplicable", "PinnedFallback"));
    }
    const resident = this.registry.get(command.representationKey);
    if (isEphemeral && resident !== undefined) {
      try {
        this.releaseRecord(resident);
      } catch {
        resident.sceneNode.visible = false;
        this.registry.preserveUncertainEphemeralRecord(command.representationKey, resident);
        this.syncMaterialDiagnostics();
        return this.finish(renderCommandResult("BackendUnavailable", "AlreadyOwnedByBackend", "EphemeralReleaseUncertain"));
      }
    }
    const evicted = this.registry.markEvicted(command.representationKey);
    if (!isEphemeral && evicted !== undefined) this.releaseRecord(evicted);
    this.diagnostics.evictionCount += 1;
    this.recomputeVisibility();
    return this.finish(renderCommandResult("Accepted", evicted === undefined ? "NotApplicable" : "ReleasedByBackend"));
  }

  private applyVisibilityPlan(command: ApplyVisibilityPlanCommand): RenderCommandResult {
    const signature = visibilityPlanSignature(command.plan);
    if (this.visibilityPlan !== undefined) {
      if (command.plan.planRevision < this.visibilityPlan.planRevision) return this.rejectStale("VisibilityPlanRevisionStale");
      if (command.plan.planRevision === this.visibilityPlan.planRevision) {
        return this.finish(this.visibilitySignature === signature
          ? renderCommandResult("AlreadyApplied")
          : renderCommandResult("RejectedContentConflict", "NotApplicable", "VisibilityPlanRevisionConflict"));
      }
    }
    this.visibilityPlan = command.plan;
    this.visibilitySignature = signature;
    this.recomputeVisibility();
    return this.finish(renderCommandResult("Accepted"));
  }

  private applyProjection(command: ApplyFrameProjectionCommand): RenderCommandResult {
    const signature = frameProjectionSignature(command.snapshot);
    if (this.projection !== undefined) {
      if (command.snapshot.frameRevision < this.projection.frameRevision) return this.rejectStale("FrameRevisionStale");
      if (command.snapshot.frameRevision === this.projection.frameRevision) {
        return this.finish(this.projectionSignature === signature
          ? renderCommandResult("AlreadyApplied")
          : renderCommandResult("RejectedContentConflict", "NotApplicable", "FrameRevisionConflict"));
      }
    }
    const transforms = applyCameraProjection(this.camera, command.snapshot);
    this.projectedTransforms.clear();
    transforms.forEach((transform, key) => this.projectedTransforms.set(key, transform));
    this.projection = command.snapshot;
    this.projectionSignature = signature;
    this.recomputeVisibility();
    return this.finish(renderCommandResult("Accepted"));
  }

  private reset(command: ResetBackendCommand): RenderCommandResult {
    const releasedEphemeral = this.releaseEphemeralResidentsBeforeClear();
    if (typeof releasedEphemeral !== "number") {
      return releasedEphemeral;
    }
    const records = this.registry.clear();
    records.forEach((record) => this.releaseRecord(record));
    this.materialFactory.disposeAll();
    this.visibilityPlan = undefined;
    this.visibilitySignature = undefined;
    this.projection = undefined;
    this.projectionSignature = undefined;
    this.projectedTransforms.clear();
    this.renderer?.dispose();
    try {
      this.renderer = this.createRenderer();
    } catch {
      this.renderer = undefined;
      this.diagnostics.backendState = "Uninitialized";
    }
    this.diagnostics.backendRevision = command.nextBackendRevision;
    this.lastAppliedReset = { from: command.backendRevision, to: command.nextBackendRevision };
    this.diagnostics.resetCount += 1;
    this.syncMaterialDiagnostics();
    return this.finish(this.renderer === undefined
      ? renderCommandResult("BackendUnavailable", "ReleasedByBackend", "RendererRebuildFailed")
      : renderCommandResult("Accepted", "ReleasedByBackend"));
  }

  private dispose(_command: DisposeBackendCommand): RenderCommandResult {
    const releasedEphemeral = this.registry.hasEphemeralReleaseUncertainty() ? 0 : this.releaseEphemeralResidentsBeforeClear();
    if (this.registry.hasEphemeralReleaseUncertainty()) {
      let additionalReleaseFailure = false;
      for (const record of this.registry.residentRecords()) {
        try {
          this.releaseRecord(record);
          this.registry.forgetReleasedRecord(record);
        } catch {
          additionalReleaseFailure = true;
          record.sceneNode.visible = false;
          if (parseEphemeralRepresentationKey(record.representationKey) !== undefined) {
            this.registry.preserveUncertainEphemeralRecord(record.representationKey, record);
          }
        }
      }
      let rendererTeardownSucceeded = true;
      try {
        this.renderer?.dispose();
        this.renderer = undefined;
      } catch {
        rendererTeardownSucceeded = false;
      }
      this.visibilityPlan = undefined;
      this.visibilitySignature = undefined;
      this.projection = undefined;
      this.projectionSignature = undefined;
      this.projectedTransforms.clear();
      this.registry.pruneTerminalCleanState();
      this.diagnostics.backendState = "Disposed";
      this.syncMaterialDiagnostics();
      const message = additionalReleaseFailure || !rendererTeardownSucceeded
        ? "Additional terminal cleanup remains unproven"
        : undefined;
      return this.finish(renderCommandResult("BackendUnavailable", "AlreadyOwnedByBackend", "EphemeralReleaseUncertain", message));
    }
    if (typeof releasedEphemeral !== "number") {
      return releasedEphemeral;
    }
    const records = this.registry.clear();
    records.forEach((record) => this.releaseRecord(record));
    this.materialFactory.disposeAll();
    this.renderer?.dispose();
    this.renderer = undefined;
    this.visibilityPlan = undefined;
    this.projection = undefined;
    this.projectedTransforms.clear();
    this.diagnostics.backendState = "Disposed";
    this.syncMaterialDiagnostics();
    return this.finish(renderCommandResult("Accepted", records.length + releasedEphemeral === 0 ? "NotApplicable" : "ReleasedByBackend"));
  }

  private orderProfiles(command: UpsertMeshArtifactCommand): readonly MaterialProfile[] {
    const byId = new Map(command.materialProfiles.map((profile) => [profile.id, profile]));
    return command.artifact.materialRanges.map((range) => byId.get(range.materialProfileId) as MaterialProfile);
  }

  private registerEphemeral(command: RegisterEphemeralRepresentationCommand): RenderCommandResult {
    const result = this.registry.registerEphemeral(command.representationKey, command.serial, command.epoch);
    if (result === "Accepted") {
      return this.finish(renderCommandResult("Accepted"));
    }
    return this.rejectStale(result === "EpochMismatch" ? "EphemeralEpochMismatch" : "EphemeralSerialMismatch");
  }

  private cancelEphemeral(command: CancelEphemeralRepresentationCommand): RenderCommandResult {
    const result = this.registry.cancelEphemeral(command.representationKey, command.serial);
    if (result === "Accepted") {
      return this.finish(renderCommandResult("Accepted"));
    }
    if (result === "ReleaseUncertain") {
      return this.finish(renderCommandResult("BackendUnavailable", "AlreadyOwnedByBackend", "EphemeralReleaseUncertain"));
    }
    return this.rejectStale(result === "AlreadyUploaded" ? "EphemeralRepresentationAlreadyUploaded" : "ExpiredEpoch");
  }

  private advanceEphemeralEpoch(command: AdvanceEphemeralEpochCommand): RenderCommandResult {
    return this.registry.advanceEphemeralEpoch(command.nextEpoch)
      ? this.finish(renderCommandResult("Accepted"))
      : this.rejectStale("EphemeralEpochMismatch");
  }

  private ephemeralAdmission(key: RepresentationKey): RenderCommandResult | undefined {
    if (parseEphemeralRepresentationKey(key) === undefined) {
      return undefined;
    }
    const registration = this.registry.getEphemeralRegistration(key);
    if (registration === undefined) {
      return this.rejectStale("ExpiredEpoch", "RetainedByCaller");
    }
    if (registration.releaseUncertain) {
      return this.finish(renderCommandResult("BackendUnavailable", "AlreadyOwnedByBackend", "EphemeralReleaseUncertain"));
    }
    return undefined;
  }

  private releaseEphemeralResidentsBeforeClear(): number | RenderCommandResult {
    if (this.registry.hasEphemeralReleaseUncertainty()) {
      return this.finish(renderCommandResult("BackendUnavailable", "AlreadyOwnedByBackend", "EphemeralReleaseUncertain"));
    }
    let released = 0;
    for (const record of this.registry.residentRecords()) {
      const key = record.representationKey;
      if (parseEphemeralRepresentationKey(key) === undefined) {
        continue;
      }
      try {
        this.releaseRecord(record);
      } catch {
        record.sceneNode.visible = false;
        this.registry.preserveUncertainEphemeralRecord(key, record);
        this.syncMaterialDiagnostics();
        return this.finish(renderCommandResult("BackendUnavailable", "AlreadyOwnedByBackend", "EphemeralReleaseUncertain"));
      }
      this.registry.markRemoved(key);
      if (!this.registry.expireEphemeral(key)) {
        return this.finish(renderCommandResult("BackendUnavailable", "AlreadyOwnedByBackend", "EphemeralReleaseUncertain"));
      }
      released += 1;
    }
    return released;
  }

  private matchExpected(command: RemoveRepresentationCommand | EvictRepresentationCommand): RenderCommandResult | undefined {
    const ledger = this.registry.getLedger(command.representationKey);
    if (ledger === undefined) return this.finish(renderCommandResult("NotFound", "NotApplicable"));
    const ordering = compareArtifactVersions(
      { sourceRevision: command.expectedSourceRevision, artifactRevision: command.expectedArtifactRevision },
      ledger
    );
    if (ordering < 0) return this.rejectStale("ExpectedRevisionStale");
    if (ordering > 0) return this.finish(renderCommandResult("RejectedContentConflict", "NotApplicable", "ExpectedRevisionNotResident"));
    if (command.expectedContentHash !== ledger.contentHash) {
      return this.finish(renderCommandResult("RejectedContentConflict", "NotApplicable", "ExpectedContentHashMismatch"));
    }
    return undefined;
  }

  private recomputeVisibility(): void {
    const records = this.registry.residentRecords();
    const resident = new Set(records.map((record) => record.representationKey));
    const projected = new Set<RepresentationKey>();
    for (const record of records) {
      const transform = this.projectedTransforms.get(record.representationKey);
      if (transform !== undefined && this.projection?.frameId === record.artifact.frameId) {
        applyRepresentationTransform(record.sceneNode, transform);
        projected.add(record.representationKey);
      }
    }
    const resolution = this.visibilityPlan === undefined
      ? { visibleRepresentationKeys: [] as readonly RepresentationKey[], pinnedFallbackRepresentationKeys: [] as readonly RepresentationKey[] }
      : resolveVisibility(this.visibilityPlan, resident, projected);
    const visible = new Set(resolution.visibleRepresentationKeys);
    const pinned = new Set(resolution.pinnedFallbackRepresentationKeys);
    records.forEach((record) => {
      record.sceneNode.visible = visible.has(record.representationKey);
      record.pinnedAsFallback = pinned.has(record.representationKey);
    });
  }

  private isPinnedFallback(key: RepresentationKey): boolean {
    return this.visibilityPlan?.fallbackRepresentationKeys.includes(key) ?? false;
  }

  private releaseRecord(record: ThreeResourceRecord): void {
    this.representationRoot.remove(record.sceneNode);
    record.prepared.dispose();
    this.diagnostics.geometryDisposals += 1;
    this.syncMaterialDiagnostics();
  }

  private createRenderer(): ThreeRendererPort {
    const renderer = this.rendererFactory(this.options.canvas, {
      antialias: this.options.antialias ?? true,
      alpha: false,
      preserveDrawingBuffer: this.options.preserveDrawingBuffer ?? false
    });
    try {
      renderer.setPixelRatio(this.options.pixelRatio ?? 1);
      renderer.setSize(this.options.width ?? 640, this.options.height ?? 360, false);
      return renderer;
    } catch (error) {
      renderer.dispose();
      throw error;
    }
  }

  private rejectStaleArtifact(reasonCode: string): RenderCommandResult {
    this.diagnostics.rejectedArtifacts += 1;
    return this.rejectStale(reasonCode, "RetainedByCaller");
  }

  private rejectStale(reasonCode: string, ownership: RenderCommandResult["ownership"] = "NotApplicable"): RenderCommandResult {
    this.diagnostics.staleRejectCount += 1;
    return this.finish(renderCommandResult("RejectedStaleRevision", ownership, reasonCode));
  }

  private syncMaterialDiagnostics(): void {
    this.diagnostics.materialAllocations = this.materialFactory.allocations;
    this.diagnostics.materialDisposals = this.materialFactory.disposals;
  }

  private finish(result: RenderCommandResult): RenderCommandResult {
    return recordCommandResult(this.diagnostics, result);
  }
}
