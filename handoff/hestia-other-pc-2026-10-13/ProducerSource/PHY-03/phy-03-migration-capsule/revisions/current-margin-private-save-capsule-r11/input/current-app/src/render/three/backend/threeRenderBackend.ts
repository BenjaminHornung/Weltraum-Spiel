import * as THREE from "three";
import {isFactoryOwnedFrameProjectionSnapshot} from "../../../presentation/visibilityPlan";
import { validateRenderCommandOwnedSteps, renderCommandSignatureOwnedSteps } from "../../../presentation/renderCommands";
import {createMeshArtifactIntakeSteps,copyMeshArtifactSceneSteps,meshArtifactIntakeBytes,captureMeshArtifactIntakeInput,type MeshArtifactInput,type MeshArtifact} from "../../../presentation/meshArtifact";
import {canonicalSignaturePrivateSteps} from "../../../presentation/canonical";
import {validateMaterialProfile} from "../../../presentation/materialProfile";
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
  readonly onTiming?: (phase:string,start:number,duration:number,key:RepresentationKey)=>void;
}

const capabilities: RenderBackendCapabilities = Object.freeze({
  supportedIndexWidths: Object.freeze([16, 32] as const),
  supportedMaterialKinds: Object.freeze(["Unlit", "BasicLit", "DebugWireframe"] as const),
  supportsPerspectiveProjection: true,
  supportsEviction: true
});

const defaultRendererFactory = (canvas: HTMLCanvasElement, parameters: THREE.WebGLRendererParameters): ThreeRendererPort =>
  new THREE.WebGLRenderer({ ...parameters, canvas });

export interface ThreePrivateMeshBinding {readonly worldId:string;readonly sessionId:string;readonly sourceEpoch:number;readonly sourceRevision:number;readonly sourceDigest:string;readonly renderEpoch:number;readonly backendRevision:BackendRevision}
declare const privateMeshBrand:unique symbol;
export interface ThreePrivateMeshHandle {readonly [privateMeshBrand]:true;readonly receipt:Readonly<{representationKey:RepresentationKey;sourceRevision:MeshArtifact["sourceRevision"];artifactRevision:MeshArtifact["artifactRevision"];frameId:MeshArtifact["frameId"];algorithmVersion:string;contentHash:ContentHash;vertexCount:number;indexCount:number;estimatedBytes:number}>}
type PrivateMeshEntry={artifact:MeshArtifact;binding:ThreePrivateMeshBinding;profiles:readonly MaterialProfile[];profilesSignature:ContentHash;signature:ContentHash;state:"Prepared"|"Installed"|"Evicted"|"Released"|"Uncertain";sceneRecord?:ThreeResourceRecord;sceneArtifact?:MeshArtifact};
const freezePrivate=Object.freeze,PrivateWeakMap=WeakMap,weakGet=WeakMap.prototype.get,weakSet=WeakMap.prototype.set,weakDelete=WeakMap.prototype.delete;
const privateSignature=(value:unknown)=>{const steps=canonicalSignaturePrivateSteps(value);for(;;){const step=steps.next();if(step.done){return step.value;}}};
const samePrivateBinding=(a:ThreePrivateMeshBinding,b:ThreePrivateMeshBinding)=>a.worldId===b.worldId&&a.sessionId===b.sessionId&&a.sourceEpoch===b.sourceEpoch&&a.sourceRevision===b.sourceRevision&&a.sourceDigest===b.sourceDigest&&a.renderEpoch===b.renderEpoch&&a.backendRevision===b.backendRevision;
const privateProfilesSignature=(profiles:readonly MaterialProfile[])=>{
  if(!Array.isArray(profiles)||profiles.length===0||profiles.length>256||profiles.some(p=>!validateMaterialProfile(p).valid)){throw new Error("Invalid private material profiles");}
  return privateSignature([...profiles].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0));
};

export class ThreeRenderBackend implements RenderBackend {
  #privateMeshes=new PrivateWeakMap<ThreePrivateMeshHandle,PrivateMeshEntry>();
  #privateHandles=new Set<ThreePrivateMeshHandle>();
  #privateInstalled=new Map<RepresentationKey,ThreePrivateMeshHandle>();
  #privateAdmissionSerial=0;
  #privatePendingBytes=0;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
  readonly representationRoot = new THREE.Group();

  private readonly registry = new ThreeResourceRegistry();
  private readonly materialFactory = new ThreeMaterialFactory();
  private readonly diagnostics: ThreeDiagnosticState;
  private readonly rendererFactory: NonNullable<ThreeRenderBackendOptions["rendererFactory"]>;
  private renderer: ThreeRendererPort | undefined;
  private viewportWidth:number;
  private viewportHeight:number;
  private rendererTeardownUncertain=false;
  private visibilityPlan: VisibilityPlan | undefined;
  private visibilitySignature: ContentHash | undefined;
  private projection: FrameProjectionSnapshot | undefined;
  private projectionSignature: ContentHash | undefined;
  private lastAppliedReset: { readonly from: BackendRevision; readonly to: BackendRevision } | undefined;
  private readonly projectedTransforms = new Map<RepresentationKey, FrameProjectionSnapshot["representationTransforms"][number]>();

  constructor(private readonly options: ThreeRenderBackendOptions) {
    this.rendererFactory = options.rendererFactory ?? defaultRendererFactory;
    this.viewportWidth=options.width??640;
    this.viewportHeight=options.height??360;
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

  *admitPrivateMeshSteps(input:MeshArtifactInput,profiles:readonly MaterialProfile[],binding:ThreePrivateMeshBinding):Generator<string,ThreePrivateMeshHandle,unknown>{
    const snapshot=captureMeshArtifactIntakeInput(input);
    const context=freezePrivate({worldId:binding.worldId,sessionId:binding.sessionId,sourceEpoch:binding.sourceEpoch,sourceRevision:binding.sourceRevision,sourceDigest:binding.sourceDigest,renderEpoch:binding.renderEpoch,backendRevision:binding.backendRevision});
    if(!/^[A-Za-z0-9:._-]{1,128}$/.test(context.worldId)||!/^[A-Za-z0-9:._-]{1,128}$/.test(context.sessionId)
      ||typeof context.sourceDigest!=="string"||context.sourceDigest.length===0||context.sourceDigest.length>128
      ||![context.sourceEpoch,context.sourceRevision,context.renderEpoch,context.backendRevision].every(n=>Number.isSafeInteger(n)&&n>=0)){throw new Error("Invalid private mesh context");}
    const current=()=>{if(this.diagnostics.backendState!=="Available"||context.backendRevision!==this.diagnostics.backendRevision||!samePrivateBinding(context,binding)){throw new Error("Stale private mesh intake");}
      const rejected=this.ephemeralAdmission(snapshot.representationKey);if(rejected){throw new Error(rejected.reasonCode??"Expired private mesh");}};
    current();const profilesSignature=privateProfilesSignature(profiles);
    const copiedProfiles:MaterialProfile[]=[];
    for(let i=0;i<profiles.length;i++){const p=profiles[i]!;copiedProfiles[i]=freezePrivate({id:p.id,kind:p.kind,baseColor:freezePrivate({r:p.baseColor.r,g:p.baseColor.g,b:p.baseColor.b}),opacity:p.opacity,doubleSided:p.doubleSided,wireframe:p.wireframe,depthWrite:p.depthWrite});}
    const materialSnapshot=freezePrivate(copiedProfiles);
    if(privateProfilesSignature(materialSnapshot)!==profilesSignature){throw new Error("Private material snapshot mismatch");}
    const bytes=meshArtifactIntakeBytes(snapshot),steps=createMeshArtifactIntakeSteps(snapshot);let artifact:MeshArtifact;
    this.#privatePendingBytes+=bytes;
    try{for(;;){current();const next=steps.next();if(next.done){artifact=next.value;break;}yield next.value;}}finally{steps.return(undefined as never);this.#privatePendingBytes-=bytes;}
    current();if(privateProfilesSignature(profiles)!==profilesSignature){throw new Error("Private material context changed");}
    const ids=new Set(materialSnapshot.map(p=>p.id)),usedIds=new Set(artifact!.materialRanges.map(r=>r.materialProfileId));
    if(artifact!.materialRanges.some(r=>!ids.has(r.materialProfileId))||ids.size!==profiles.length||usedIds.size!==ids.size){throw new Error("Incomplete private material coverage");}
    const receipt=freezePrivate({representationKey:artifact!.representationKey,sourceRevision:artifact!.sourceRevision,artifactRevision:artifact!.artifactRevision,
      frameId:artifact!.frameId,algorithmVersion:artifact!.algorithmVersion,contentHash:artifact!.contentHash,vertexCount:artifact!.positions.length/3,indexCount:artifact!.indices.length,
      estimatedBytes:artifact!.positions.byteLength+artifact!.normals.byteLength+artifact!.indices.byteLength+(artifact!.attributes?.uv?.byteLength??0)+(artifact!.attributes?.color?.byteLength??0)});
    const handle=freezePrivate({receipt}) as ThreePrivateMeshHandle;
    if(this.#privateAdmissionSerial>=Number.MAX_SAFE_INTEGER){throw new Error("Private mesh admission serial exhausted");}
    const signature=privateSignature({version:2,kind:"PrivateMesh",admissionSerial:++this.#privateAdmissionSerial,binding:context,receipt,profilesSignature});
    weakSet.call(this.#privateMeshes,handle,{artifact:artifact!,binding:context,profiles:materialSnapshot,profilesSignature,signature,state:"Prepared"});this.#privateHandles.add(handle);return handle;
  }

  *upsertPrivateMeshSteps(handle:ThreePrivateMeshHandle,profiles:readonly MaterialProfile[],binding:ThreePrivateMeshBinding):Generator<string,RenderCommandResult,unknown>{
    const entry=weakGet.call(this.#privateMeshes,handle) as PrivateMeshEntry|undefined;
    if(entry===undefined){return this.finish(renderCommandResult("RejectedInvalidArtifact","RetainedByCaller","ForeignPrivateMesh"));}
    const current=()=>{try{return entry.state!=="Released"&&entry.state!=="Uncertain"&&this.diagnostics.backendState==="Available"&&binding.backendRevision===this.diagnostics.backendRevision&&samePrivateBinding(entry.binding,binding)&&this.ephemeralAdmission(entry.artifact.representationKey)===undefined&&privateProfilesSignature(profiles)===entry.profilesSignature;}catch{return false;}};
    if(!current()){return this.finish(renderCommandResult("RejectedStaleRevision","RetainedByCaller","PrivateMeshBindingMismatch"));}
    try{if(privateProfilesSignature(profiles)!==entry.profilesSignature){return this.finish(renderCommandResult("RejectedContentConflict","RetainedByCaller","PrivateMaterialMismatch"));}}
    catch{return this.finish(renderCommandResult("RejectedInvalidArtifact","RetainedByCaller","InvalidPrivateMaterial"));}
    const key=entry.artifact.representationKey;let installed=this.#privateInstalled.get(key);const resident=this.registry.get(key);
    if(entry.state==="Installed"){
      return installed===handle&&resident?.commandSignature===entry.signature?this.finish(renderCommandResult("AlreadyApplied","AlreadyOwnedByBackend"))
        :this.finish(renderCommandResult("RejectedStaleRevision","RetainedByCaller","PrivateMeshNoLongerResident"));
    }
    const ledger=this.registry.getLedger(key);
    if(installed!==undefined&&installed!==handle&&ledger!==undefined&&compareArtifactVersions(entry.artifact,ledger)===0){return this.finish(renderCommandResult("RejectedContentConflict","RetainedByCaller","PrivateMeshAlreadyAdopted"));}
    const steps=copyMeshArtifactSceneSteps(entry.artifact);let artifact:MeshArtifact;
    this.#privatePendingBytes+=handle.receipt.estimatedBytes;
    try{for(;;){if(!current()){return this.finish(renderCommandResult("RejectedStaleRevision","RetainedByCaller","PrivateMeshBindingMismatch"));}
      const next=steps.next();if(next.done){artifact=next.value;break;}yield next.value;}}finally{steps.return(undefined as never);this.#privatePendingBytes-=handle.receipt.estimatedBytes;}
    if(!current()){return this.finish(renderCommandResult("RejectedStaleRevision","RetainedByCaller","PrivateMeshBindingMismatch"));}
    installed=this.#privateInstalled.get(key);
    if((weakGet.call(this.#privateMeshes,handle) as PrivateMeshEntry|undefined)?.state==="Installed"){return installed===handle&&this.registry.get(key)?.commandSignature===entry.signature
      ?this.finish(renderCommandResult("AlreadyApplied","AlreadyOwnedByBackend")):this.rejectStaleArtifact("PrivateMeshNoLongerResident");}
    let result:RenderCommandResult;
    entry.sceneArtifact=artifact!;
    try{result=this.measureCpu("privateUploadCommitCpuMs",key,()=>{
      // Intake already validated and hashed; this internal installation has no suspension.
      const step=this.upsertSteps({kind:"UpsertMeshArtifact",backendRevision:binding.backendRevision,artifact:artifact!,materialProfiles:entry.profiles},false,entry.signature,entry).next();
      if(!step.done){throw new Error("Private mesh installation unexpectedly suspended");}return step.value;
    });}
    catch(error){entry.state="Uncertain";throw error;}
    if(result.status==="Accepted"){
      if(installed!==undefined&&installed!==handle){this.forgetPrivateMesh(installed);}
      entry.state="Installed";this.#privateInstalled.set(key,handle);
    }else if(result.ownership==="AlreadyOwnedByBackend"||this.registry.getEphemeralRegistration(key)?.releaseUncertain===true){entry.state="Uncertain";}
    else{entry.sceneArtifact=undefined;}
    return result;
  }

  releasePrivateMesh(handle:ThreePrivateMeshHandle,binding:ThreePrivateMeshBinding):RenderCommandResult{
    const entry=weakGet.call(this.#privateMeshes,handle) as PrivateMeshEntry|undefined;
    if(entry===undefined||!samePrivateBinding(entry.binding,binding)){return this.finish(renderCommandResult("RejectedInvalidArtifact","RetainedByCaller","ForeignPrivateMesh"));}
    if(entry.state==="Uncertain"){return this.finish(renderCommandResult("BackendUnavailable","AlreadyOwnedByBackend","PrivateMeshReleaseUncertain"));}
    if(this.diagnostics.backendState!=="Available"||binding.backendRevision!==this.diagnostics.backendRevision){return this.finish(renderCommandResult("RejectedStaleRevision","RetainedByCaller","PrivateMeshBindingMismatch"));}
    const custodyOnly=entry.state==="Prepared";
    if(entry.state==="Installed"||entry.state==="Evicted"){
      let result:RenderCommandResult;
      try{result=this.remove({kind:"RemoveRepresentation",backendRevision:binding.backendRevision,representationKey:entry.artifact.representationKey,
        expectedSourceRevision:entry.artifact.sourceRevision,expectedArtifactRevision:entry.artifact.artifactRevision,expectedContentHash:entry.artifact.contentHash});}
      catch{entry.state="Uncertain";return this.finish(renderCommandResult("BackendUnavailable","AlreadyOwnedByBackend","PrivateMeshReleaseUncertain"));}
      if(result.status!=="Accepted"&&result.status!=="AlreadyApplied"){if(result.ownership==="AlreadyOwnedByBackend"){entry.state="Uncertain";}return result;}
      this.#privateInstalled.delete(entry.artifact.representationKey);
    }
    this.forgetPrivateMesh(handle);return this.finish(renderCommandResult("Accepted","ReleasedByBackend",custodyOnly?"PrivateMeshCustodyOnlyReleased":undefined));
  }

  private forgetPrivateMesh(handle:ThreePrivateMeshHandle):void{
    const entry=weakGet.call(this.#privateMeshes,handle) as PrivateMeshEntry|undefined;
    if(entry!==undefined){entry.state="Released";if(this.#privateInstalled.get(entry.artifact.representationKey)===handle){this.#privateInstalled.delete(entry.artifact.representationKey);}}
    this.#privateHandles.delete(handle);weakDelete.call(this.#privateMeshes,handle);
  }

  private privateReleaseUncertain():boolean{
    for(const handle of this.#privateHandles){if((weakGet.call(this.#privateMeshes,handle) as PrivateMeshEntry|undefined)?.state==="Uncertain"){return true;}}return false;
  }

  private releasePreparedPrivateMeshes():void{
    for(const handle of this.#privateHandles){const state=(weakGet.call(this.#privateMeshes,handle) as PrivateMeshEntry|undefined)?.state;if(state==="Prepared"||state==="Evicted"){this.forgetPrivateMesh(handle);}}
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
        if(this.privateReleaseUncertain()){return this.finish(renderCommandResult("BackendUnavailable","AlreadyOwnedByBackend","PrivateMeshReleaseUncertain"));}
        if (this.registry.hasEphemeralReleaseUncertainty()) {
          return this.finish(renderCommandResult("BackendUnavailable", "AlreadyOwnedByBackend", "EphemeralReleaseUncertain"));
        }
        if(this.rendererTeardownUncertain){return this.finish(renderCommandResult("BackendUnavailable","AlreadyOwnedByBackend","RendererTeardownUncertain"));}
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

  resizeViewport(width:number,height:number):RenderCommandResult {
    if(!Number.isSafeInteger(width)||width<=0||!Number.isSafeInteger(height)||height<=0){
      return this.finish(renderCommandResult("RejectedInvalidArtifact","NotApplicable","InvalidViewport"));
    }
    if(this.diagnostics.backendState!=="Available"||this.renderer===undefined){
      return this.finish(renderCommandResult("BackendUnavailable","NotApplicable","BackendNotAvailable"));
    }
    if(width===this.viewportWidth&&height===this.viewportHeight){return this.finish(renderCommandResult("Accepted"));}
    this.renderer.setSize(width,height,false);
    this.viewportWidth=width;this.viewportHeight=height;
    return this.finish(renderCommandResult("Accepted"));
  }

  getCapabilities(): RenderBackendCapabilities {
    return capabilities;
  }

  readDiagnostics(): RenderBackendDiagnostics {
    const records = this.registry.residentRecords();
    const ownedRecords = [...this.registry.ownedRecords()];
    let privateBytes=this.#privatePendingBytes;
    for(const handle of this.#privateHandles){const entry=weakGet.call(this.#privateMeshes,handle) as PrivateMeshEntry|undefined;
      if(entry!==undefined){privateBytes+=handle.receipt.estimatedBytes;
        if(entry.sceneRecord!==undefined&&!ownedRecords.includes(entry.sceneRecord)){ownedRecords.push(entry.sceneRecord);}
        else if(entry.sceneRecord===undefined&&entry.sceneArtifact!==undefined){privateBytes+=handle.receipt.estimatedBytes;}}}
    return diagnosticSnapshot(this.diagnostics, {
      residentKeys: records.map((record) => record.representationKey),
      visibleKeys: records.filter((record) => record.sceneNode.visible).map((record) => record.representationKey),
      pinnedFallbackKeys: this.visibilityPlan?.fallbackRepresentationKeys ?? [],
      estimatedGpuBytes: ownedRecords.reduce((total, record) => total + record.estimatedBytes, 0),
      ownedCpuBytes: privateBytes+ownedRecords.reduce((total, record) => total + record.estimatedBytes, 0)
    });
  }

  readPrivateMeshBytes():Readonly<{custody:number;pending:number}>{
    let custody=0;for(const handle of this.#privateHandles){const entry=weakGet.call(this.#privateMeshes,handle) as PrivateMeshEntry|undefined;
      custody+=handle.receipt.estimatedBytes;if(entry?.sceneRecord===undefined&&entry?.sceneArtifact!==undefined){custody+=handle.receipt.estimatedBytes;}}return freezePrivate({custody,pending:this.#privatePendingBytes});
  }

  private initialize(command: InitializeBackendCommand): RenderCommandResult {
    if (this.diagnostics.backendState === "Disposed") {
      return this.finish(renderCommandResult("BackendUnavailable", "NotApplicable", "BackendDisposed"));
    }
    if(this.rendererTeardownUncertain){return this.finish(renderCommandResult("BackendUnavailable","AlreadyOwnedByBackend","RendererTeardownUncertain"));}
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

  private *upsertSteps(command: UpsertMeshArtifactCommand, owned: boolean,privateSignature?:ContentHash,privateEntry?:PrivateMeshEntry): Generator<string, RenderCommandResult, unknown> {
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
    const signature = privateSignature??(owned ? yield* renderCommandSignatureOwnedSteps(command) : renderCommandSignature(command));
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
      prepared = this.measureCpu("prepareThreeMeshCpuMs",command.artifact.representationKey,()=>prepareThreeMesh(command.artifact, orderedProfiles, this.materialFactory));
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
    this.measureCpu("representationAddCpuMs",record.representationKey,()=>this.representationRoot.add(record.sceneNode));
    const previous = this.measureCpu("registryCommitCpuMs",record.representationKey,()=>this.registry.commit(record));
    if(privateEntry!==undefined){privateEntry.sceneRecord=record;}
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
        try{previous.prepared.dispose();}catch(error){this.markPrivateRecordRelease(previous,false);throw error;}
      }
      this.markPrivateRecordRelease(previous,true);
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
        this.releaseRecord(resident,true);
      } catch {
        resident.sceneNode.visible = false;
        this.registry.preserveUncertainEphemeralRecord(command.representationKey, resident);
        this.syncMaterialDiagnostics();
        return this.finish(renderCommandResult("BackendUnavailable", "AlreadyOwnedByBackend", "EphemeralReleaseUncertain"));
      }
    }
    const evicted = this.registry.markEvicted(command.representationKey);
    if (!isEphemeral && evicted !== undefined) this.releaseRecord(evicted,true);
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
    const timingKey=this.options.onTiming===undefined?undefined:command.snapshot.representationTransforms[0]?.representationKey;
    const signatureStart=timingKey===undefined?0:performance.now();
    const signature = isFactoryOwnedFrameProjectionSnapshot(command.snapshot)?undefined:frameProjectionSignature(command.snapshot);
    const signatureEnd=timingKey===undefined?0:performance.now();
    if (this.projection !== undefined) {
      if (command.snapshot.frameRevision < this.projection.frameRevision) return this.rejectStale("FrameRevisionStale");
      if (command.snapshot.frameRevision === this.projection.frameRevision) {
        const incoming=signature??privateSignature({version:1,...command.snapshot});
        const previous=this.projectionSignature??privateSignature({version:1,...this.projection});
        this.projectionSignature=previous;
        return this.finish(previous === incoming
          ? renderCommandResult("AlreadyApplied")
          : renderCommandResult("RejectedContentConflict", "NotApplicable", "FrameRevisionConflict"));
      }
    }
    const cameraMapStart=timingKey===undefined?0:performance.now();
    const transforms = applyCameraProjection(this.camera, command.snapshot);
    this.projectedTransforms.clear();
    transforms.forEach((transform, key) => this.projectedTransforms.set(key, transform));
    this.projection = command.snapshot;
    this.projectionSignature = signature;
    const cameraMapEnd=timingKey===undefined?0:performance.now();
    const sceneStart=timingKey===undefined?0:performance.now();
    this.recomputeVisibility();
    const sceneEnd=timingKey===undefined?0:performance.now();
    if(timingKey!==undefined){
      try{this.options.onTiming?.("projectionSignatureCpuMs",signatureStart,signatureEnd-signatureStart,timingKey);}catch{/* Timing cannot alter projection. */}
      try{this.options.onTiming?.("projectionCameraMapCpuMs",cameraMapStart,cameraMapEnd-cameraMapStart,timingKey);}catch{/* Timing cannot alter projection. */}
      try{this.options.onTiming?.("projectionSceneApplyCpuMs",sceneStart,sceneEnd-sceneStart,timingKey);}catch{/* Timing cannot alter projection. */}
    }
    return this.finish(renderCommandResult("Accepted"));
  }

  private reset(command: ResetBackendCommand): RenderCommandResult {
    if(this.privateReleaseUncertain()){return this.finish(renderCommandResult("BackendUnavailable","AlreadyOwnedByBackend","PrivateMeshReleaseUncertain"));}
    const releasedEphemeral = this.releaseEphemeralResidentsBeforeClear();
    if (typeof releasedEphemeral !== "number") {
      return releasedEphemeral;
    }
    const records = this.registry.clear();
    records.forEach((record) => this.releaseRecord(record));
    this.releasePreparedPrivateMeshes();
    this.materialFactory.disposeAll();
    this.visibilityPlan = undefined;
    this.visibilitySignature = undefined;
    this.projection = undefined;
    this.projectionSignature = undefined;
    this.projectedTransforms.clear();
    try{this.renderer?.dispose();}catch{
      this.rendererTeardownUncertain=true;this.diagnostics.backendState="Uninitialized";
      return this.finish(renderCommandResult("BackendUnavailable","AlreadyOwnedByBackend","RendererTeardownUncertain"));
    }
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
    this.releasePreparedPrivateMeshes();
    const privateUncertain=this.privateReleaseUncertain();
    const releasedEphemeral = this.registry.hasEphemeralReleaseUncertainty()||privateUncertain ? 0 : this.releaseEphemeralResidentsBeforeClear();
    if (this.registry.hasEphemeralReleaseUncertainty()||this.privateReleaseUncertain()) {
      let additionalReleaseFailure = false;
      for (const record of this.registry.residentRecords()) {
        if(this.isPrivateRecordUncertain(record)){continue;}
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
        this.rendererTeardownUncertain=true;
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
      return this.finish(renderCommandResult("BackendUnavailable", "AlreadyOwnedByBackend",this.privateReleaseUncertain()?"PrivateMeshReleaseUncertain":"EphemeralReleaseUncertain", message));
    }
    if (typeof releasedEphemeral !== "number") {
      return releasedEphemeral;
    }
    const records = this.registry.clear();
    records.forEach((record) => this.releaseRecord(record));
    this.materialFactory.disposeAll();
    try{this.renderer?.dispose();}catch{
      this.rendererTeardownUncertain=true;this.diagnostics.backendState="Disposed";this.syncMaterialDiagnostics();
      return this.finish(renderCommandResult("BackendUnavailable","AlreadyOwnedByBackend","RendererTeardownUncertain"));
    }
    this.renderer = undefined;
    this.visibilityPlan = undefined;
    this.projection = undefined;
    this.projectionSignature = undefined;
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
      for(const handle of this.#privateHandles){const entry=weakGet.call(this.#privateMeshes,handle) as PrivateMeshEntry|undefined;
        if(entry?.state==="Prepared"&&entry.artifact.representationKey===command.representationKey){this.forgetPrivateMesh(handle);}}
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
      const isEphemeral=parseEphemeralRepresentationKey(key)!==undefined;
      const privateOwned=[...this.#privateHandles].some(handle=>(weakGet.call(this.#privateMeshes,handle) as PrivateMeshEntry|undefined)?.sceneRecord===record);
      if (!isEphemeral&&!privateOwned) {
        continue;
      }
      try {
        this.releaseRecord(record);
      } catch {
        record.sceneNode.visible = false;
        if(isEphemeral){this.registry.preserveUncertainEphemeralRecord(key, record);}
        this.syncMaterialDiagnostics();
        return this.finish(renderCommandResult("BackendUnavailable", "AlreadyOwnedByBackend",isEphemeral?"EphemeralReleaseUncertain":"PrivateMeshReleaseUncertain"));
      }
      this.registry.markRemoved(key);
      if (isEphemeral&&!this.registry.expireEphemeral(key)) {
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

  private releaseRecord(record: ThreeResourceRecord,retainPrivateCustody=false): void {
    this.representationRoot.remove(record.sceneNode);
    try{record.prepared.dispose();}catch(error){this.markPrivateRecordRelease(record,false);
      if(this.isPrivateRecordUncertain(record)&&parseEphemeralRepresentationKey(record.representationKey)===undefined){this.registry.markRemoved(record.representationKey);}throw error;}
    if(retainPrivateCustody){
      for(const handle of this.#privateHandles){const entry=weakGet.call(this.#privateMeshes,handle) as PrivateMeshEntry|undefined;if(entry?.sceneRecord===record){entry.state="Evicted";entry.sceneRecord=undefined;entry.sceneArtifact=undefined;}}
    }else{this.markPrivateRecordRelease(record,true);}
    this.diagnostics.geometryDisposals += 1;
    this.syncMaterialDiagnostics();
  }

  private isPrivateRecordUncertain(record:ThreeResourceRecord):boolean{
    for(const handle of this.#privateHandles){const entry=weakGet.call(this.#privateMeshes,handle) as PrivateMeshEntry|undefined;if(entry?.sceneRecord===record&&entry.state==="Uncertain"){return true;}}return false;
  }

  private markPrivateRecordRelease(record:ThreeResourceRecord,released:boolean):void{
    for(const handle of this.#privateHandles){const entry=weakGet.call(this.#privateMeshes,handle) as PrivateMeshEntry|undefined;
      if(entry?.sceneRecord===record){if(released){this.forgetPrivateMesh(handle);}else{entry.state="Uncertain";record.sceneNode.visible=false;}}}
  }

  private measureCpu<T>(phase:string,key:RepresentationKey,action:()=>T):T{
    if(this.options.onTiming===undefined){return action();}const start=performance.now();
    try{return action();}finally{try{this.options.onTiming(phase,start,performance.now()-start,key);}catch{/* Timing cannot change ownership or installation. */}}
  }

  private createRenderer(): ThreeRendererPort {
    const renderer = this.rendererFactory(this.options.canvas, {
      antialias: this.options.antialias ?? true,
      alpha: false,
      preserveDrawingBuffer: this.options.preserveDrawingBuffer ?? false
    });
    try {
      renderer.setPixelRatio(this.options.pixelRatio ?? 1);
      renderer.setSize(this.viewportWidth,this.viewportHeight,false);
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
