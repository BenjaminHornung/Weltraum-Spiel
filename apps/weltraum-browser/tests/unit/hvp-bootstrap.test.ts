import * as THREE from "three";
import { afterAll,afterEach,beforeAll,beforeEach,describe, expect, it, vi } from "vitest";
import {readFile} from "node:fs/promises";
import playManifest from "../../public/factory/play-2026-10-12/manifest.json";
import playSurfaceManifest from "../../public/factory/play-2026-10-12/manifest-surface-v2.json";

const actualFetch=globalThis.fetch;
let hullFetches=0;
// Unit transport serves the actual reviewed files. The production loader's
// byte/hash/format admission stays enabled; this creates no World or fake pose.
beforeEach(()=>{hullFetches=0;vi.spyOn(globalThis,"fetch").mockImplementation(async(input,init)=>{
 const url=typeof input==="string"?input:input instanceof URL?input.href:input.url;
 if(url.startsWith("/factory/play-2026-10-12/")&&/^[-a-z0-9]+\.glb$/.test(url.split("/").at(-1)!)){
  const payload=await readFile(new URL(`../../public${url}`,import.meta.url));
  return new Response(new Uint8Array(payload),{status:200});
 }
 if(url==="/factory/crashsite-walkable-v1-2026-10-19/crashsite-walkable-v1.glb"){
  hullFetches++;const payload=await readFile(new URL("../../public/factory/crashsite-walkable-v1-2026-10-19/crashsite-walkable-v1.glb",import.meta.url));
  return new Response(new Uint8Array(payload),{status:200});
 }
 return actualFetch(input,init);
});});
afterEach(()=>vi.restoreAllMocks());
import {HVP_BRANCH_CELLS,HVP_BRANCH_KEY} from "../../src/hestia-prototype/physics/profile";
import { backendRevision, materialProfileId, renderCommandResult, type RenderCommand } from "../../src/presentation";
import {
  HVP_COAST_BLOCK_SIZE_METERS,
  HVP_TERRAIN_MATERIAL_ID,
  HVP_WATER_REPRESENTATION_KEY,
  type HvpBlockMesh,
  hvpBuildCoastBlockCells,
  hvpMeshBlocks
} from "../../src/hvp/hvpTerrain";
import {
  HVP_SLOT_LIMESTONE_DRY,
  HVP_SLOT_LIMESTONE_WET,
  HVP_SLOT_MOSS,
  HVP_SLOT_SOIL,
  materializeHvpCoastSource,
  type HvpCoastSourceSnapshot
} from "../../src/hvp/hvpCoastSource";
import { meshHvpTestCells } from "../../src/hvp/hvpCoastMesher";
import {
  admitHvpResources,
  buildHvpResourceLedger,
  estimateHvpStageCpuBytes,
  createHvpCompactLookTerrain,
  createHvpLookTerrain,
  HVP_RESOURCE_CAPS_DEFAULT,
  startHvp,
  startHvpRoute,
  type HvpBootstrapHandle
} from "../../src/hvp/hvpBootstrap";
import { createHvpLookProfile } from "../../src/hestia-prototype/presentation/look";
import { createFp02Fixture } from "../../src/factory/catalog/fp02Catalog";
import { materializeFactoryStartSiteV5, readFactorySourceColumnWorldV5 } from "../../src/factory/fixtures/startSite";
import { materializeFactoryStartSiteV6, readFactorySourceColumnWorldV6 } from "../../src/factory/fixtures/startSiteV6";
import { createFactoryCargoSite } from "../../src/factory/fixtures/cargoSite";
import { createHvpTerrainRoot } from "../../src/hestia-prototype/terrain/cutPlan";
import { collisionSectors, type HvpCollisionSector, type HvpCollisionSource } from "../../src/hestia-prototype/physics/terrainColliders";
import { createHvpPhysicsSession, resolveHvpGravity } from "../../src/hestia-prototype/physics/session";
import { createFactoryMaterialView } from "../../src/factory/material/reservations";
import { bindFactoryDomainSession, readDryFactoryCheckpointCacheBytes } from "../../src/factory/session/dryFactorySlice";
import { FACTORY_POWER_POLICY } from "../../src/factory/power/factoryPower";
import { readProductionFactoryCheckpointCacheBytes } from "../../src/factory/production/recipeAdmission";
import { createResourceContainerDefinition, createResourceContainerSnapshot, createResourceContainerState } from "../../src/resources/containers";
import { planHvpVegetation, buildHvpPlant, meshHvpVegetation, estimateHvpVegetationSourceBytes, isHvpPlantHabitat } from "../../src/hestia-prototype/presentation/vegetation";
import { countFactoryDecorFaces, createFactoryDecorFootprints, createFactoryDecorProjection, factoryDecorHullFootprintFromNativeSectors } from "../../src/factory/presentation/factoryDecorProjection";
import { encodeHvpPlant } from "../../src/hestia-prototype/persistence/plantCheckpoint";
import { decodeStoredFactoryCheckpoint, encodeFactoryCheckpointV2, readFactoryDecodedOwner, FACTORY_COMBINED_SAVE_PROFILES,
  type FactoryDecodedCheckpoint, type FactorySessionCheckpointV2 } from "../../src/factory/persistence/factoryCheckpoint";
import { canonicalJson } from "../../src/resources/serialization";
import { createFactoryInstallationProfile, FACTORY_RUNTIME_INSTALLATION_PROFILE_CACHE_RESERVE_BYTES } from "../../src/factory/construction/installationProfile";
import { loadFactoryS1Assets } from "../../src/factory/presentation/factoryS1Assets";
import { loadPlayAssetProjection, readLoadedHullMetadataBytes, type PlayAssetProjection, type PlayDefinitionRef, type PlayExpectedBinding } from "../../src/factory/presentation/playAssetLoader";
import { mountFactorySession, type FactorySessionHandle } from "../../src/factory/session/factorySession";
import { inspectFactoryCheckpointMemoryTree, type FactorySessionCheckpointV1 } from "../../src/factory/persistence/factoryCheckpoint";
import type { FactoryCheckpointCapture } from "../../src/factory/persistence/restoreFactorySession";
import type { FactoryCheckpointRawAdmission, FactoryHostExtensionHandle, FactoryHostPort, FactoryHostView } from "../../src/factory/session/hostPort";
import { ThreeRenderBackend } from "../../src/render/three/backend";
import { applyCameraProjection } from "../../src/render/three/backend/threeCameraProjection";
import type { FactoryFacilityRequest } from "../../src/hestia-prototype/physics/factoryFacilitySession";
import {canonicalSignature} from "../../src/resources/serialization";

class FakeElement extends EventTarget {
  id = "";
  open = false;
  textContent = "";
  readonly dataset: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  get hidden():boolean { return this.attributes.has("hidden"); }
  set hidden(value:boolean) { if(value)this.attributes.set("hidden","");else this.attributes.delete("hidden"); }
  readonly style:Record<string,string>={};
  parent: FakeElement | undefined;

  constructor(readonly tagName: string) { super(); }

  append(...children: FakeElement[]): void {
    children.forEach((child) => { child.parent = this; });
    this.children.push(...children);
  }

  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  hasAttribute(name: string): boolean { return this.attributes.has(name); }
  removeAttribute(name: string): void { this.attributes.delete(name); }
  remove(): void {
    if (this.parent === undefined) return;
    const index = this.parent.children.indexOf(this);
    if (index >= 0) this.parent.children.splice(index, 1);
    this.parent = undefined;
  }

  focus(): void {}
  setPointerCapture(): void {}
  releasePointerCapture(): void {}
  showModal():void { this.open = true; }
  close():void { this.open = false; }
}

class FakeWindow extends EventTarget {
  innerWidth = 1920;
  innerHeight = 1080;
  devicePixelRatio = 1;
  readonly animationFrames = new Map<number, FrameRequestCallback>();
  readonly listenerTotals = new Map<string, number>();
  #nextAnimationFrame = 1;

  public override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void {
    super.addEventListener(type, listener, options);
    this.listenerTotals.set(type, (this.listenerTotals.get(type) ?? 0) + 1);
  }

  public override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void {
    super.removeEventListener(type, listener, options);
    this.listenerTotals.set(type, Math.max(0, (this.listenerTotals.get(type) ?? 0) - 1));
  }

  public requestAnimationFrame(callback: FrameRequestCallback): number {
    const id = this.#nextAnimationFrame++;
    this.animationFrames.set(id, callback);
    return id;
  }

  public cancelAnimationFrame(id: number): void { this.animationFrames.delete(id); }
}

const descendants = (element: FakeElement): FakeElement[] =>
  element.children.flatMap((child) => [child, ...descendants(child)]);

type HvpReviewedPlayEntry=Readonly<{assetId:string;definitionRef:PlayDefinitionRef|null;visualOnlyAnchor:Readonly<Record<string,unknown>>|null}>;
const hvpReviewedPlayEntries=[...playManifest.assets,...playSurfaceManifest.assets] as unknown as readonly HvpReviewedPlayEntry[];
const loadHvpVertexColorPlay=async(assetId:string,instanceId:string):Promise<PlayAssetProjection>=>{
  const entry=hvpReviewedPlayEntries.find(value=>value.assetId===assetId);if(!entry)throw Error(`Missing reviewed Play asset ${assetId}`);
  const expectedBinding:PlayExpectedBinding=entry.definitionRef?{definitionRef:entry.definitionRef}:{visualOnlyAnchor:entry.visualOnlyAnchor!};
  return loadPlayAssetProjection({assetId,instanceId,expectedBinding,renderMode:"vertex-colors"});
};

const testFactoryOwnerMemory=(()=>{
  const factory=({version:"fp06-factory-session-owner-v1",installations:[],
    material:{version:"fp06-material-owner-v1",catalogDigest:"factory-owner-test",revision:0,containers:[],reservations:[],receipts:[]},
    domain:{},lastPower:null,links:[],recipeSelections:[],waitingStarts:[],commandReceipts:[],lastReceipt:null,publicationRevision:0} as unknown as FactorySessionCheckpointV1);
  return Object.freeze({factory,cacheBytes:0,treeMetrics:inspectFactoryCheckpointMemoryTree(factory)});
})();
const withTestFactoryOwnerMemory=<T extends object>(extension:T)=>({...extension,readFactoryCheckpointMemory:()=>testFactoryOwnerMemory});

const harness = () => {
  const body = new FakeElement("body");
  const host = new FakeElement("main");
  host.id = "app";
  const canvas = new FakeElement("canvas");
  canvas.id = "debug-scene";
  const reticle = new FakeElement("div");
  reticle.setAttribute("class", "hud-center-safe-area");
  host.append(reticle);
  body.append(host, canvas);
  const documentPort = {
    addEventListener: () => {}, removeEventListener: () => {},
    body,
    querySelector: (selector: string) => {
      if (selector === "#app") return host;
      if (selector === "#debug-scene") return canvas;
      if (selector === ".hud-center-safe-area") return reticle;
      if (selector === "#hvp-hud") return descendants(body).find((element) => element.id === "hvp-hud") ?? null;
      if (selector === "#flight-hud") return null;
      return null;
    },
    createElement: (tagName: string) => new FakeElement(tagName)
  };
  const windowPort = new FakeWindow();
  let backendConstructions = 0;
  let backendDisposals = 0;
  let renders = 0;
  const dispatchedCommands: RenderCommand[] = [];
  const scene = new THREE.Scene();
  const representationRoot = new THREE.Group();
  scene.add(representationRoot);
  const backend = {
    camera: new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1_000),
    scene,
    representationRoot,
    dispatch: (command: RenderCommand) => {
      dispatchedCommands.push(command);
      if (command.kind === "DisposeBackend") backendDisposals += 1;
      return renderCommandResult("Accepted");
    },
    renderFrame: () => { renders += 1; return renderCommandResult("Accepted"); },
    getCapabilities: () => ({
      supportedIndexWidths: [16, 32],
      supportedMaterialKinds: ["Unlit", "BasicLit", "DebugWireframe"],
      supportsPerspectiveProjection: true,
      supportsEviction: true
    }),
    readDiagnostics: () => ({
      acceptedArtifacts: 0,
      rejectedArtifacts: 0,
      activeRepresentations: 0,
      activeFallbacks: 0,
      geometryAllocations: 0,
      geometryDisposals: 0,
      materialAllocations: 0,
      materialDisposals: 0,
      estimatedGpuBytes: 0,
      ownedCpuBytes: 0,
      replacementCount: 0,
      removeCount: 0,
      staleRejectCount: 0,
      resetCount: 0,
      evictionCount: 0,
      evictionRejectCount: 0,
      rehydrationCount: 0,
      renderTargetAllocations: 0,
      renderTargetDisposals: 0,
      activeRenderTargets: 0,
      backendRevision: backendRevision(0),
      backendState: "Available",
      residentRepresentationKeys: [],
      visibleRepresentationKeys: [],
      pinnedFallbackRepresentationKeys: []
    })
  };
  const createBackend = vi.fn(() => {
    backendConstructions += 1;
    return backend;
  });
  const overrides = (extra: Record<string, unknown> = {}) => ({
    documentPort: documentPort as unknown as Document,
    windowPort: windowPort as unknown as Window,
    // Bootstrap lifecycle tests isolate transport; real Rapier/worker kernels
    // are verified separately, without allocating a second World per UI test.
    createPhysics: async (_sources: unknown, spawn: { x: number; y: number; z: number }) => ({
      collisionBytes: 0, workerCount: 1, update: () => {}, command: async () => {}, dispose: async () => {},
      setPlayerInput: () => {}, setCutAim:()=>{},impulse:async()=>{},
      preparation: { jobs: 95, peakParallelJobs: 1, mainPrepareMaxMs: 0 },
      read: () => ({ status: "Paused", ticks: 0, backlogSeconds: 0, discardedSeconds: 0,
        gravity: 11.79, gravityProfile: "test-fixture", solver: "test-fixture", stepCpuMs: 0,
        bodyCount: 3, colliderCount: 5, nativeBytes: "unsupported", player: null,
        // Transport-only fixture: the real mass/solver contract has its own tests.
        inertia: {ownerId:"hvp:physics:inertia",sourceDigest:"test-fixture",centerOfMass:{x:71/240,y:71/240,z:.125}},lastImpulse:null,
        structural:{generation:0,sourceDigest:"test-fixture",state:"Idle",last:null,preview:null,aimPoint:spawn,
          attachment:{id:"hvp:branch:foliage",ownerId:HVP_BRANCH_KEY,supportCell:{x:10,y:11,z:2}},
          parts:[{ownerId:HVP_BRANCH_KEY,anchored:true,cells:HVP_BRANCH_CELLS,center:{x:.75,y:1,z:.25},position:spawn,orientation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:0},massKg:450,sleeping:true}]},
        bodies: [{ ownerId: "hvp:physics:drop", position: spawn, orientation: { x: 0, y: 0, z: 0, w: 1 },
          velocity: { x: 0, y: 0, z: 0 }, sleeping: true, massKg: 300 },
          {ownerId:"hvp:physics:inertia",position:spawn,orientation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:0},sleeping:true,massKg:35.15625},
          {ownerId:HVP_BRANCH_KEY,position:spawn,orientation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:0},sleeping:true,massKg:450}] })
    }),
    createBackend: createBackend as unknown as (
      options: ConstructorParameters<typeof import("../../src/render/three/backend").ThreeRenderBackend>[0]
    ) => import("../../src/render/three/backend").ThreeRenderBackend,
    ...extra
  } as unknown as Parameters<typeof startHvp>[0]);
  return {
    body,
    host,
    canvas,
    documentPort,
    windowPort,
    createBackend,
    overrides,
    counts: () => ({ backendConstructions, backendDisposals, renders }),
    commands: dispatchedCommands,
    camera: backend.camera,
    scene,
    backend
  };
};

/** Emulates the browser firing a pending frame: the fired callback leaves the queue. */
const stepFrame = (windowPort: FakeWindow, timestamp: number): void => {
  expect(windowPort.animationFrames.size).toBe(1);
  const [id, callback] = [...windowPort.animationFrames.entries()][0]!;
  windowPort.animationFrames.delete(id);
  callback(timestamp);
};

/** Actual receiver/Host fault fixture; Native replies isolate transport, not physical admission. */
const factoryCarrierHostFixture=async()=>{
  const source=harness(),original=source.overrides()!,site=await import("../../src/factory/fixtures/startSite");
  const {readCargoHandlingProfile}=await import("../../src/factory/construction/cargoHandlingProfile");
  const profile=readCargoHandlingProfile(createFp02Fixture("cargo").catalog,"B07-BOM")!;
  let port!:FactoryHostPort,carrier:import("../../src/hestia-prototype/physics/factoryFacilitySession").FactoryNativeCarrierRead|undefined;
  let preparedPartObservation:import("../../src/hestia-prototype/physics/factoryFacilitySession").FactoryNativePartObservation|undefined;
  let preparedRequest:FactoryFacilityRequest|undefined;
  let privatePreparedRead:ReturnType<NonNullable<FactoryHostPort["handling"]>["read"]>|undefined;
  let nativeTickDelta=0;
  let collisionBytes=0,carrierUploads=0,carrierRemoves=0,retireAfter=0,failStage=false,failRetire=false,failProjection=false,uncertainPrepare=false;
  let lastCarrierVeto:import("../../src/hestia-prototype/physics/factoryFacilitySession").FactoryCarrierVeto|undefined;
  const prepare=vi.fn(),rollback=vi.fn();
  const backend=new ThreeRenderBackend({canvas:source.canvas as unknown as HTMLCanvasElement,rendererFactory:()=>({setPixelRatio(){},setSize(){},render(){},dispose(){}})});
  const dispatch=backend.dispatch.bind(backend);
  vi.spyOn(backend,"dispatch").mockImplementation(command=>{
    if(command.kind==="UpsertMeshArtifact"&&command.artifact.representationKey.startsWith("factory-play:carrier:slot:")){
      carrierUploads++;if(failStage&&carrierUploads===2)return renderCommandResult("RejectedContentConflict","NotApplicable","FaultStage");
    }
    if(command.kind==="RemoveRepresentation"&&command.representationKey.startsWith("factory-play:carrier:slot:")){carrierRemoves++;if(failRetire&&carrierRemoves>retireAfter)return renderCommandResult("RejectedContentConflict","NotApplicable","FaultRetire");}
    if(failProjection&&command.kind==="ApplyFrameProjection"){failProjection=false;return renderCommandResult("RejectedContentConflict","NotApplicable","FaultProjection");}
    return dispatch(command);
  });
  const request={transactionId:"render_carrier_pickup",ownerId:"factory_carrier",profileId:profile.profileId,profileDigest:profile.digest,expectedRevision:0,expectedTerrainRevision:0,sourceContainerId:"fp02_wreck_cargo",custodyContainerId:"custody_render_carrier_pickup",materialBinding:"finite-transport-reply-fixture"};
  const handle=await startHvp(source.overrides({createBackend:()=>backend,createSourceSnapshot:site.materializeFactoryStartSite,
    factorySourceProfile:{version:"hvp-factory-startsite-v1",readColumn:site.readFactorySourceColumnWorld},
    createPhysics:async(...args:Parameters<NonNullable<typeof original.createPhysics>>)=>{
      const native=await original.createPhysics!(...args),read=native.read,cargo=args[10]!;
      const facilities=(held=false)=>({revision:0,state:held?"PreparedHeld" as const:"Idle" as const,transactionId:held?preparedRequest!.transactionId:null,owners:[],prepared:held?{...preparedRequest!,sourceDigest:preparedPartObservation!.sourceDigest,profileDigest:preparedPartObservation!.profileDigest,centerMm:[preparedRequest!.centerMm[0]!,preparedRequest!.centerMm[1]!,preparedRequest!.centerMm[2]!] as const,massMg:341000000,bodyHandle:20,colliderHandles:preparedPartObservation!.parts.flatMap(p=>p.colliderHandles),installationRevision:0}:null,...(held&&preparedPartObservation?{preparedPartObservation}:{}),...(carrier?{carrier}:{}),...(lastCarrierVeto?{lastCarrierVeto}:{}),cargo:{site:cargo,ownerId:cargo.ownerId,containerId:cargo.containerId,sourceDigest:cargo.sourceDigest,profileDigest:cargo.profileDigest,opened:true,positionMm:cargo.centerMm,accessBoundsMm:cargo.accessBoundsMm,bodyHandle:4,colliderHandles:[5],accessible:true,openReceipt:null}});
      return {...native,command:async()=>{},prepareFactoryCarrier:async()=>{prepare();carrier={ownerId:request.ownerId,transactionId:request.transactionId,profileId:profile.profileId,profileDigest:profile.digest,phase:"Carrying",bodyHandle:6,colliderHandles:[7,8,9,10,11],massMg:profile.massMg,materialBinding:request.materialBinding,positionMm:[-6250,1500,-2500],containerId:request.custodyContainerId,accessible:true,nativeMassKg:341,localCom:{x:0,y:.5,z:0},principalInertia:{x:1,y:1,z:1}};return facilities();},commitFactoryCarrier:async()=>{},publishFactoryCarrier:()=>{},finalizeFactoryCarrier:async()=>{},rollbackFactoryCarrier:async()=>{rollback();carrier=undefined;},
        // Transparent transport proof fixture; actual Rapier admission is
        // covered separately by facilitySession.test.ts.
        prepareFactoryFacility:async(request:FactoryFacilityRequest)=>{const {createFactoryInstallationProfile}=await import("../../src/factory/construction/installationProfile");const profile=createFactoryInstallationProfile(request.definitionRef.sourceId);
          const core={instanceId:request.instanceId,definitionRef:profile.definitionRef,sourceDigest:profile.sourceDigest,profileDigest:profile.profileDigest,installationRevision:0,terrainRevision:0,facilityRevision:0,published:false,confirmed:true,complete:true,parts:profile.source.parts.map(part=>({partId:part.partId,status:"Present" as const,colliderHandles:profile.colliders.flatMap((box,index)=>box.partId===part.partId?[100+index]:[])}))};
          preparedRequest=request;preparedPartObservation={...core,observationDigest:canonicalSignature(core)};privatePreparedRead=facilities(true);if(uncertainPrepare)throw Error("Worker rollback response lost");return privatePreparedRead;},commitFactoryFacility:async()=>{},publishFactoryFacility:()=>{},rollbackFactoryFacility:async()=>{preparedPartObservation=undefined;},finalizeFactoryFacility:async()=>{},
        read:()=>({...read(),ticks:read().ticks+nativeTickDelta,collisionBytes,player:{...read().player!,position:{x:-6.25,y:2.4,z:-1.5}},factoryFacilities:facilities()})};
    },factoryExtension:async(host:FactoryHostPort)=>{port=host;return withTestFactoryOwnerMemory({isQuiescent:()=>true,dispose:async()=>host.construction!.dispose()});}}));
  if(source.body.dataset.hestiaPrototypeState!=="Ready"){
    const detail=descendants(source.body).find(element=>element.textContent.startsWith("Technical initialization failure:"))?.textContent??"No technical failure detail";
    await handle.dispose();throw Error(`Factory carrier fixture did not reach Ready: ${detail}`);
  }
  return {port,request,backend,handle,prepare,rollback,source,
    setCarrierPhase:(phase:"Carrying"|"Deposited")=>{if(carrier)carrier={...carrier,phase};},
    clearCarrier:()=>{carrier=undefined;},
    setCarrierVeto:(reason:string|undefined)=>{lastCarrierVeto=reason?{reason,targetMm:[-6250,1500,-2500]}:undefined;},
    failStage:()=>{failStage=true;failRetire=true;},failReleaseRetire:()=>{failRetire=true;retireAfter=carrierRemoves+1;},failProjection:()=>{failProjection=true;},
    readPrepared:()=>privatePreparedRead!,setNativeTickDelta:(delta:number)=>{nativeTickDelta=delta;},setUncertainPrepare:()=>{uncertainPrepare=true;},
    setCollisionBytes:(bytes:number)=>{collisionBytes=bytes;},disableFaults:()=>{failStage=false;failRetire=false;failProjection=false;}};
};

describe("HVP T08 bootstrap lifecycle", () => {
  // Full starts materialize and mesh the region; allow generous time per test
  // instead of the 5 s default so slow environments report real failures.
  vi.setConfig({ testTimeout: 120_000 });

  it("R01 actual GLBs keep the normal nine-owner preview under real draw admission",async()=>{
    const owners:PlayAssetProjection[]=[];
    const specs=[
      ["play_battery_v1","r01_battery",undefined],
      ["play_distribution_v1","r01_distribution",undefined],
      ["play_former_v2","r01_former","B07"],
      ["play_storage_v1","r01_raw_storage",undefined],
      ["play_workbench_v1","r01_workbench",undefined],
      ["play_cutter_v2","r01_cutter","B06"],
      ["play_belt_v1","r01_mid_belt",undefined],
      ["play_belt_v1","r01_raw_belt",undefined],
      ["play_storage_v1","r01_product_storage",undefined]
    ] as const;
    for(const [assetId,instanceId,sourceId] of specs){
      if(sourceId){const profile=createFactoryInstallationProfile(sourceId);owners.push((await loadFactoryS1Assets({...profile.definitionRef,instanceId},{renderMode:"vertex-colors"})).render);}
      else owners.push(await loadHvpVertexColorPlay(assetId,instanceId));
    }
    const brace=await loadHvpVertexColorPlay("play_brace_v1","r01_brace"),cargoClosed=await loadHvpVertexColorPlay("play_wreck_cargo_v1","r01_cargo_closed"),
      cargoOpen=await loadHvpVertexColorPlay("play_wreck_cargo_open_v1","r01_cargo_open"),carrier=await loadHvpVertexColorPlay("play_carrier_medium_v1","carrier:slot:r01");
    const draws=(value:PlayAssetProjection)=>value.parts.reduce((n,part)=>n+part.artifact.materialRanges.length,0);
    const ownerDraws=owners.reduce((n,value)=>n+draws(value),0),braceDraws=draws(brace),cargoDraws=draws(cargoClosed)+draws(cargoOpen),carrierDraws=draws(carrier);
    const ghostDraws=createFactoryInstallationProfile("B07").colliders.length,conservativeNextImportDraws=24;
    const colorBytes=[...owners,brace,cargoClosed,cargoOpen,carrier].flatMap(value=>value.parts)
      .reduce((n,part)=>n+(part.artifact.attributes?.color?.byteLength??0),0);
    expect(owners).toHaveLength(9);expect(ownerDraws).toBe(66);expect(braceDraws).toBe(3);expect(cargoDraws).toBe(2);
    expect(carrierDraws).toBe(5);expect(ghostDraws).toBe(34);expect(colorBytes).toBeGreaterThan(0);
    // R13 saved-scene evidence: HVP-only base is 312 minus Factory 119, old ghost 5 and conservative import 24.
    const observedHvpBaseDraws=164;
    const composedDraws=observedHvpBaseDraws+ownerDraws+braceDraws+cargoDraws+carrierDraws+ghostDraws+conservativeNextImportDraws;
    expect(composedDraws).toBe(298);expect(HVP_RESOURCE_CAPS_DEFAULT.maxDrawCalls).toBe(300);
    // Exercise the production admission function with real parser outputs; this case isolates the draw-call axis.
    expect(()=>admitHvpResources({totalCpuBytes:0,retainedMeshBytes:0,triangles:0,drawCalls:composedDraws})).not.toThrow();
  });

  it("PLAY03 Host modal owns neutral pause and releases before real Play ACK without a second stop",async()=>{
    const source=harness(),original=source.overrides()!,events=new EventTarget();
    const doc=Object.assign(source.documentPort,{hidden:false,pointerLockElement:null as FakeElement|null,
      addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),
      exitPointerLock:()=>{doc.pointerLockElement=null;events.dispatchEvent(new Event("pointerlockchange"));}});
    let gesture=false,status:FactoryHostView["physicsStatus"]="Paused",nativeTick=0,port!:FactoryHostPort;
    const acks:(()=>void)[]=[],commands:string[]=[],intents:unknown[]=[];
    Object.defineProperty(source.canvas,"requestPointerLock",{value:()=>{expect(gesture).toBe(true);doc.pointerLockElement=source.canvas;events.dispatchEvent(new Event("pointerlockchange"));return Promise.resolve();}});
    const handle=await startHvp(source.overrides({createPhysics:async(...args:Parameters<NonNullable<typeof original.createPhysics>>)=>{
      const native=await original.createPhysics!(...args),read=native.read;
      return {...native,setPlayerInput:(value:unknown)=>intents.push(value),command:(kind:string)=>{commands.push(kind);if(kind==="Pause"&&status==="Running")nativeTick++;status=kind==="Play"?"Running":"Paused";return kind==="Play"?new Promise<void>(resolve=>acks.push(resolve)):Promise.resolve();},read:()=>({...read(),status,ticks:nativeTick})};
    },factoryExtension:async(host:FactoryHostPort)=>{port=host;return withTestFactoryOwnerMemory({isQuiescent:()=>true,dispose:async()=>{}});}}));
    try{
      const host=port as FactoryHostPort&{setSurface?:(surface:string|null,binding:{sessionId:string;epoch:number})=>void;play?:()=>Promise<FactoryHostView>};
      expect(host.setSurface,"Host must own the single modal focus lifetime").toBeTypeOf("function");expect(host.play,"Host Play must await the actual input/native ACK").toBeTypeOf("function");
      const binding=host.read();host.setSurface!("cargo",binding);await Promise.resolve();const pauses=commands.filter(value=>value==="Pause").length;
      host.setPanelFocus!("power");host.setPanelFocus!(null);host.setSurface!("cargo",binding);
      expect(commands.filter(value=>value==="Pause")).toHaveLength(pauses);
      expect((host.read() as unknown as {input:{surface:string|null}}).input.surface).toBe("cargo");
      let settled=false;gesture=true;const playing=host.play!().then(view=>{settled=true;return view;});gesture=false;
      await Promise.resolve();expect(settled).toBe(false);expect(doc.pointerLockElement).toBe(source.canvas);expect(acks).toHaveLength(1);
      acks[0]!();await playing;const beforeRelease=commands.length;
      host.setPanelFocus!(null);host.setSurface!(null,binding);host.setSurface!(null,binding);
      expect(commands).toHaveLength(beforeRelease);expect(host.read().physicsStatus).toBe("Running");
      source.windowPort.dispatchEvent(Object.assign(new Event("keydown",{cancelable:true}),{code:"KeyD",repeat:false}));
      // This declared Host transport uses Legacy deferred input, not the dedicated Factory Native event fixture.
      stepFrame(source.windowPort,16);expect(JSON.parse(source.body.dataset.hestiaPrototypeInput!).pressedKeys).toEqual(["KeyD"]);
      expect(descendants(source.body).find(element=>element.id==="hvp-hud")?.hidden,"Factory Shell must retain HUD ownership after the real legacy frame update").toBe(true);
      host.setSurface!("map",binding);await Promise.resolve();expect(intents.at(-1)).toMatchObject({x:0,z:0,sprint:false,jump:false});expect(doc.pointerLockElement).toBe(null);expect(host.read().physicsStatus).toBe("Paused");
      stepFrame(source.windowPort,32);
      const pausedVisibility=source.commands.filter((command):command is Extract<RenderCommand,{kind:"ApplyVisibilityPlan"}>=>command.kind==="ApplyVisibilityPlan").at(-1)!;
      expect(pausedVisibility.plan.visibleRepresentationKeys,"a paused Factory first-person camera must not render its own visor").not.toContain("hvp:player:avatar");
      host.setSurface!(null,binding);expect(host.read().physicsStatus).toBe("Paused");expect(acks).toHaveLength(1);
      host.setSurface!("cargo",{...binding,epoch:binding.epoch+1});expect((host.read() as unknown as {input:{surface:string|null}}).input.surface).toBe(null);
      status="CoverageHold";await expect(host.play!()).rejects.toThrow(/unconfirmed|busy|hold/i);expect(acks).toHaveLength(1);
      expect(descendants(source.body).find(element=>element.id==="hvp-player-pause")?.open).toBe(false);
    }finally{await handle.dispose();}
    const old=commands.length;(port as unknown as {setSurface:(surface:string|null,binding:unknown)=>void}).setSurface("cargo",{sessionId:"stale",epoch:0});expect(commands).toHaveLength(old);
  });

  it("PLAY01 V2 bootstrap admits only its explicitly matching Factory profile",async()=>{
    const fixture=await import("../../src/factory/fixtures/startSite");
    const extension=async()=>withTestFactoryOwnerMemory({isQuiescent:()=>true,dispose:async()=>{}});
    const invalidPhysicalProfile={version:"hvp-factory-startsite-v2",readColumn:(x:number,z:number)=>x===8.0625&&z===7.0625?{topMeters:0,slot:0}:fixture.readFactorySourceColumnWorldV2(x,z)};
    for(const [name,profile,factoryExtension,ready] of [
      ["matching",{version:"hvp-factory-startsite-v2",readColumn:fixture.readFactorySourceColumnWorldV2},extension,true],
      ["V1 mismatch",{version:"hvp-factory-startsite-v1",readColumn:fixture.readFactorySourceColumnWorld},extension,false],
      ["missing",undefined,extension,false],
      ["without Factory",{version:"hvp-factory-startsite-v2",readColumn:fixture.readFactorySourceColumnWorldV2},undefined,false],
      ["unknown version",{version:"hvp-factory-startsite-v3",readColumn:fixture.readFactorySourceColumnWorldV2},extension,false],
      ["additional invalid physical plant",invalidPhysicalProfile,extension,false]
    ] as const){
      const source=harness(),original=source.overrides()!;
      const handle=await startHvp(source.overrides({createSourceSnapshot:fixture.materializeFactoryStartSiteV2,factorySourceProfile:profile,factoryExtension,
        // Actual source binding with declared Native reply fixture; physical admission is tested in the normal browser.
        createPhysics:async(...args:Parameters<NonNullable<typeof original.createPhysics>>)=>{
          const native=await original.createPhysics!(...args),read=native.read,site=args[10]!;
          return {...native,read:()=>({...read(),factoryFacilities:{revision:0,state:"Idle" as const,transactionId:null,owners:[],prepared:null,
            cargo:{site,ownerId:site.ownerId,containerId:site.containerId,sourceDigest:site.sourceDigest,profileDigest:site.profileDigest,opened:false,positionMm:site.centerMm,accessBoundsMm:site.accessBoundsMm,bodyHandle:4,colliderHandles:[5],accessible:true,openReceipt:null}}})};
        }}));
      try{
        const alert=descendants(source.body).find(e=>e.textContent.startsWith("Technical initialization failure:"));
        expect(source.body.dataset.hestiaPrototypeState,`${name}: ${alert?.textContent??""}`).toBe(ready?"Ready":"Error");
        if(ready){expect(source.body.dataset.hestiaPrototypeSourceDigest).toBe("ec8ba9b1");expect(source.body.dataset.hestiaPrototypeVegetationCount).toBe("96");}
        else{expect(source.counts().renders,name).toBe(0);expect(source.windowPort.animationFrames.size,name).toBe(0);}
      }finally{await handle.dispose();}
    }
  });

  it("PLAY01 V3 bootstrap binds its named generation and preserves the hard habitat/unknown-profile guards", async () => {
    const fixture = await import("../../src/factory/fixtures/startSite");
    const expectedDigest = fixture.materializeFactoryStartSiteV3().sourceDigest;
    const extension = async () => withTestFactoryOwnerMemory({ isQuiescent: () => true, dispose: async () => {} });
    const invalidPhysicalProfile = { version: "hvp-factory-startsite-v3", readColumn: (x: number, z: number) =>
      x === 8.0625 && z === 7.0625 ? { topMeters: 0, slot: 0 } : fixture.readFactorySourceColumnWorldV3(x, z) };
    for (const [name, profile, factoryExtension, ready] of [
      ["matching", { version: "hvp-factory-startsite-v3", readColumn: fixture.readFactorySourceColumnWorldV3 }, extension, true],
      ["V2 mismatch", { version: "hvp-factory-startsite-v2", readColumn: fixture.readFactorySourceColumnWorldV2 }, extension, false],
      ["missing", undefined, extension, false],
      ["without Factory", { version: "hvp-factory-startsite-v3", readColumn: fixture.readFactorySourceColumnWorldV3 }, undefined, false],
      ["unknown V4", { version: "hvp-factory-startsite-v4", readColumn: fixture.readFactorySourceColumnWorldV3 }, extension, false],
      ["additional invalid physical plant", invalidPhysicalProfile, extension, false]
    ] as const) {
      const source = harness(), original = source.overrides()!;
      const handle = await startHvp(source.overrides({ createSourceSnapshot: fixture.materializeFactoryStartSiteV3,
        factorySourceProfile: profile, factoryExtension,
        // Declared current transport response only; normal-game admission remains a separate proof.
        createPhysics: async (...args: Parameters<NonNullable<typeof original.createPhysics>>) => {
          const native = await original.createPhysics!(...args), read = native.read, site = args[10]!;
          return { ...native, read: () => ({ ...read(), factoryFacilities: { revision: 0, state: "Idle" as const,
            transactionId: null, owners: [], prepared: null, cargo: { site, ownerId: site.ownerId, containerId: site.containerId,
              sourceDigest: site.sourceDigest, profileDigest: site.profileDigest, opened: false, positionMm: site.centerMm,
              accessBoundsMm: site.accessBoundsMm, bodyHandle: 4, colliderHandles: [5], accessible: true, openReceipt: null } } }) };
        } }));
      try {
        const alert = descendants(source.body).find(e => e.textContent.startsWith("Technical initialization failure:"));
        expect(source.body.dataset.hestiaPrototypeState, `${name}: ${alert?.textContent ?? ""}`).toBe(ready ? "Ready" : "Error");
        if (ready) {
          expect(source.body.dataset.hestiaPrototypeSourceDigest).toBe(expectedDigest);
          expect(source.body.dataset.hestiaPrototypeVegetationCount).toBe("96");
        } else {
          expect(source.counts().renders, name).toBe(0);
          expect(source.windowPort.animationFrames.size, name).toBe(0);
        }
      } finally { await handle.dispose(); }
    }
  });

  it("PLAY01 V4 bootstrap binds its named generation and preserves the hard habitat/unknown-profile guards", async () => {
    const fixture = await import("../../src/factory/fixtures/startSite");
    const expectedDigest = fixture.materializeFactoryStartSiteV4().sourceDigest;
    const extension = async () => withTestFactoryOwnerMemory({ isQuiescent: () => true, dispose: async () => {} });
    const invalidPhysicalProfile = { version: "hvp-factory-startsite-v4", readColumn: (x: number, z: number) =>
      x === 8.0625 && z === 7.0625 ? { topMeters: 0, slot: 0 } : fixture.readFactorySourceColumnWorldV4(x, z) };
    for (const [name, profile, factoryExtension, ready] of [
      ["matching", { version: "hvp-factory-startsite-v4", readColumn: fixture.readFactorySourceColumnWorldV4 }, extension, true],
      ["V2 mismatch", { version: "hvp-factory-startsite-v2", readColumn: fixture.readFactorySourceColumnWorldV2 }, extension, false],
      ["missing", undefined, extension, false],
      ["without Factory", { version: "hvp-factory-startsite-v4", readColumn: fixture.readFactorySourceColumnWorldV4 }, undefined, false],
      ["known V5 mismatch", { version: "hvp-factory-startsite-v5", readColumn: fixture.readFactorySourceColumnWorldV4 }, extension, false],
      ["additional invalid physical plant", invalidPhysicalProfile, extension, false]
    ] as const) {
      const source = harness(), original = source.overrides()!;
      const handle = await startHvp(source.overrides({ createSourceSnapshot: fixture.materializeFactoryStartSiteV4,
        factorySourceProfile: profile, factoryExtension,
        // Declared current transport response only; normal-game admission remains a separate proof.
        createPhysics: async (...args: Parameters<NonNullable<typeof original.createPhysics>>) => {
          const native = await original.createPhysics!(...args), read = native.read, site = args[10]!;
          return { ...native, read: () => ({ ...read(), factoryFacilities: { revision: 0, state: "Idle" as const,
            transactionId: null, owners: [], prepared: null, cargo: { site, ownerId: site.ownerId, containerId: site.containerId,
              sourceDigest: site.sourceDigest, profileDigest: site.profileDigest, opened: false, positionMm: site.centerMm,
              accessBoundsMm: site.accessBoundsMm, bodyHandle: 4, colliderHandles: [5], accessible: true, openReceipt: null } } }) };
        } }));
      try {
        const alert = descendants(source.body).find(e => e.textContent.startsWith("Technical initialization failure:"));
        expect(source.body.dataset.hestiaPrototypeState, `${name}: ${alert?.textContent ?? ""}`).toBe(ready ? "Ready" : "Error");
        if (ready) {
          expect(source.body.dataset.hestiaPrototypeSourceDigest).toBe(expectedDigest);
          expect(source.body.dataset.hestiaPrototypeVegetationCount).toBe("96");
        } else {
          expect(source.counts().renders, name).toBe(0);
          expect(source.windowPort.animationFrames.size, name).toBe(0);
        }
      } finally { await handle.dispose(); }
    }
  });
  it("PLAY01 V5 bootstrap binds its named generation and preserves the hard habitat/unknown-profile guards", async () => {
    const fixture = await import("../../src/factory/fixtures/startSite");
    const expectedDigest = fixture.materializeFactoryStartSiteV5().sourceDigest;
    const extension = async () => withTestFactoryOwnerMemory({ isQuiescent: () => true, dispose: async () => {} });
    const invalidPhysicalProfile = { version: "hvp-factory-startsite-v5", readColumn: (x: number, z: number) =>
      x === 8.0625 && z === 7.0625 ? { topMeters: 0, slot: 0 } : fixture.readFactorySourceColumnWorldV5(x, z) };
    for (const [name, profile, factoryExtension, ready] of [
      ["matching", { version: "hvp-factory-startsite-v5", readColumn: fixture.readFactorySourceColumnWorldV5 }, extension, true],
      ["unknown V6", { version: "hvp-factory-startsite-v6", readColumn: fixture.readFactorySourceColumnWorldV5 }, extension, false],
      ["additional invalid physical plant", invalidPhysicalProfile, extension, false]
    ] as const) {
      const source = harness(), original = source.overrides()!;
      const handle = await startHvp(source.overrides({ createSourceSnapshot: fixture.materializeFactoryStartSiteV5,
        factorySourceProfile: profile, factoryExtension,
        // Declared current transport response only; normal-game admission remains a separate proof.
        createPhysics: async (...args: Parameters<NonNullable<typeof original.createPhysics>>) => {
          const native = await original.createPhysics!(...args), read = native.read, site = args[10]!;
          return { ...native, read: () => ({ ...read(), factoryFacilities: { revision: 0, state: "Idle" as const,
            transactionId: null, owners: [], prepared: null, cargo: { site, ownerId: site.ownerId, containerId: site.containerId,
              sourceDigest: site.sourceDigest, profileDigest: site.profileDigest, opened: false, positionMm: site.centerMm,
              accessBoundsMm: site.accessBoundsMm, bodyHandle: 4, colliderHandles: [5], accessible: true, openReceipt: null } } }) };
        } }));
      try {
        const alert = descendants(source.body).find(e => e.textContent.startsWith("Technical initialization failure:"));
        expect(source.body.dataset.hestiaPrototypeState, `${name}: ${alert?.textContent ?? ""}`).toBe(ready ? "Ready" : "Error");
        if (ready) {
          expect(source.body.dataset.hestiaPrototypeSourceDigest).toBe(expectedDigest);
          expect(source.body.dataset.hestiaPrototypeVegetationCount).toBe("96");
          expect(hullFetches,"V5 startup must not fetch the V6 Hull payload").toBe(0);
        } else {
          expect(source.counts().renders, name).toBe(0);
          expect(source.windowPort.animationFrames.size, name).toBe(0);
        }
      } finally { await handle.dispose(); }
    }
  });

  it("PLAY01 V6 stages its pinned Hull sectors and rejects a Hull draw over-cap before fetch or Native",async()=>{
    const extension=async()=>withTestFactoryOwnerMemory({isQuiescent:()=>true,dispose:async()=>{}});
    const source=harness(),original=source.overrides()!;let nativeCalls=0;
    let passedHullSectors:readonly HvpCollisionSector[]|undefined,initialCollisionSources:readonly HvpCollisionSource[]|undefined;
    const handle=await startHvp(source.overrides({createSourceSnapshot:materializeFactoryStartSiteV6,
      factorySourceProfile:{version:"hvp-factory-startsite-v6",readColumn:readFactorySourceColumnWorldV6},factoryExtension:extension,
      createPhysics:async(...args:Parameters<NonNullable<typeof original.createPhysics>>)=>{
        nativeCalls++;initialCollisionSources=[...args[0]];passedHullSectors=args[12];
        const native=await original.createPhysics!(...args),read=native.read,site=args[10]!;
        return {...native,read:()=>({...read(),factoryFacilities:{revision:0,state:"Idle" as const,transactionId:null,owners:[],prepared:null,
          cargo:{site,ownerId:site.ownerId,containerId:site.containerId,sourceDigest:site.sourceDigest,profileDigest:site.profileDigest,opened:false,
            positionMm:site.centerMm,accessBoundsMm:site.accessBoundsMm,bodyHandle:4,colliderHandles:[5],accessible:true,openReceipt:null}}})};
      }}));
    let overCapHandle:HvpBootstrapHandle|undefined;
    try{
      expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
      expect(source.body.dataset.hestiaPrototypeSourceDigest).toBe("360b00fa");
      expect(source.body.dataset.hestiaPrototypeVegetationCount).toBe("95");
      expect(hullFetches).toBe(1);
      expect(passedHullSectors).toHaveLength(8);
      expect(passedHullSectors!.reduce((sum,sector)=>sum+sector.vertices.byteLength+sector.indices.byteLength,0)).toBe(703_296);
      const admitted=JSON.parse(source.body.dataset.hestiaPrototypeResources!) as {ledger:{drawCalls:number;vegetationSourceBytes:number}};
      expect(admitted.ledger.vegetationSourceBytes).toBe(3_016_128);
      const withoutHullDraws=admitted.ledger.drawCalls-8;
      expect(withoutHullDraws).toBeGreaterThan(0);
      const floraUploads=source.commands.filter((command):command is Extract<RenderCommand,{kind:"UpsertMeshArtifact"}> =>
        command.kind==="UpsertMeshArtifact"&&command.artifact.representationKey.startsWith("hvp:flora:"));
      expect(floraUploads.length).toBeGreaterThan(0);
      expect(floraUploads.some(command=>command.artifact.representationKey.startsWith("hvp:flora:hero:"))).toBe(false);
      expect(initialCollisionSources).toBeDefined();
      const vegetationProfile={version:"hvp-factory-vegetation-v1" as const,readColumn:readFactorySourceColumnWorldV6};
      const hero=planHvpVegetation(undefined,vegetationProfile).find(plant=>plant.id==="hvp:flora:hero");
      expect(hero).toMatchObject({kind:"tree",variant:0,position:{x:8,z:7}});
      const heroWood=buildHvpPlant(hero!,vegetationProfile).wood!;
      const heroOrigin={x:hero!.position.x+heroWood.originMeters.x,y:hero!.position.y+heroWood.originMeters.y,z:hero!.position.z+heroWood.originMeters.z};
      const hullFootprint=factoryDecorHullFootprintFromNativeSectors(passedHullSectors!);
      const hullMask=createFactoryDecorFootprints([],hullFootprint);
      const profilePlants=planHvpVegetation(undefined,vegetationProfile),invalidPlants=profilePlants.filter(plant=>
        !isHvpPlantHabitat(plant.kind,plant.position.x,plant.position.z,vegetationProfile));
      const invalidPlant=invalidPlants[0],maskCandidates=profilePlants.filter(plant=>plant!==invalidPlant&&plant.id!==hero!.id
        &&plant.position.x-11<hullFootprint.maxX&&plant.position.x+11>hullFootprint.minX
        &&plant.position.z-11<hullFootprint.maxZ&&plant.position.z+11>hullFootprint.minZ);
      let hullMaskedArtifact=false;
      for(const plant of maskCandidates){
        const source=buildHvpPlant(plant,vegetationProfile),sourceDigest=source.digest,rawFaces=countFactoryDecorFaces(source.decoration);
        const projected=createFactoryDecorProjection(source,vegetationProfile,hullMask),maskedFaces=countFactoryDecorFaces(projected.occupancy);
        if(maskedFaces.occupiedCells>=rawFaces.occupiedCells)continue;
        const baseline=meshHvpVegetation(source).find(product=>String(product.artifact.representationKey)===`${plant.id}:${plant.kind}`);
        const expected=meshHvpVegetation(source,undefined,{decoration:projected.occupancy,
          ...(maskedFaces.occupiedCells===0?{omitEmptyDecoration:true}:{})}).find(product=>String(product.artifact.representationKey)===`${plant.id}:${plant.kind}`);
        const actual=floraUploads.find(command=>command.artifact.representationKey===`${plant.id}:${plant.kind}`);
        if(expected){expect(actual?.artifact.contentHash).toBe(expected.artifact.contentHash);expect(actual?.artifact.contentHash).not.toBe(baseline?.artifact.contentHash);}
        else expect(actual).toBeUndefined();
        expect(source.digest).toBe(sourceDigest);
        hullMaskedArtifact=true;break;
      }
      expect(hullMaskedArtifact,"the admitted Native Hull footprint must change at least one rendered plant decoration").toBe(true);
      const nativeVegetationSources=initialCollisionSources!.filter(collision=>collision.sizeX!==256||collision.sizeY!==128||collision.sizeZ!==256);
      expect(nativeVegetationSources).toHaveLength(1);
      expect(nativeVegetationSources.some(collision=>collision.sizeX===heroWood.sizeX&&collision.sizeY===heroWood.sizeY&&collision.sizeZ===heroWood.sizeZ
        &&collision.cellMeters===heroWood.cellMeters&&collision.originMeters.x===heroOrigin.x&&collision.originMeters.y===heroOrigin.y&&collision.originMeters.z===heroOrigin.z)).toBe(false);
      await handle.dispose();

      const over=harness(),overOriginal=over.overrides()!,nativeCallsBefore= nativeCalls,fetchesBefore=hullFetches;
      overCapHandle=await startHvp(over.overrides({createSourceSnapshot:materializeFactoryStartSiteV6,
        factorySourceProfile:{version:"hvp-factory-startsite-v6",readColumn:readFactorySourceColumnWorldV6},factoryExtension:extension,
        resourceCaps:{maxDrawCalls:withoutHullDraws},
        createPhysics:async(...args:Parameters<NonNullable<typeof overOriginal.createPhysics>>)=>{nativeCalls++;return overOriginal.createPhysics!(...args);}}));
      expect(over.body.dataset.hestiaPrototypeState).toBe("Error");
      expect(nativeCalls).toBe(nativeCallsBefore);
      expect(hullFetches).toBe(fetchesBefore);
      expect(over.commands.some(command=>command.kind==="UpsertMeshArtifact"&&command.artifact.representationKey.startsWith("factory-play:factory_hull:crashsite:"))).toBe(false);
    }finally{await handle.dispose();if(overCapHandle)await overCapHandle.dispose();}
  },180_000);

  it("cancels the V6 Hull response on pagehide before publishing the Hull or creating Native",async()=>{
    const source=harness(),original=source.overrides()!,payload=new Uint8Array(await readFile(new URL("../../public/factory/crashsite-walkable-v1-2026-10-19/crashsite-walkable-v1.glb",import.meta.url)));
    let startHullRead!:()=>void,cancelled=false,physicsCalls=0;
    const hullRead=new Promise<void>(resolve=>{startHullRead=resolve;});
    vi.mocked(globalThis.fetch).mockImplementation(async(input,init)=>{
      const url=typeof input==="string"?input:input instanceof URL?input.href:input.url;
      if(url==="/factory/crashsite-walkable-v1-2026-10-19/crashsite-walkable-v1.glb"){
        hullFetches++;
        return new Response(new ReadableStream<Uint8Array>({start(controller){controller.enqueue(payload.slice(0,64));startHullRead();},cancel(){cancelled=true;}}),{status:200});
      }
      return actualFetch(input,init);
    });
    const pending=startHvp(source.overrides({createSourceSnapshot:materializeFactoryStartSiteV6,
      factorySourceProfile:{version:"hvp-factory-startsite-v6",readColumn:readFactorySourceColumnWorldV6},
      factoryExtension:async()=>withTestFactoryOwnerMemory({isQuiescent:()=>true,dispose:async()=>{}}),
      createPhysics:async(...args:Parameters<NonNullable<typeof original.createPhysics>>)=>{physicsCalls++;return original.createPhysics!(...args);}}));
    await hullRead;
    source.windowPort.dispatchEvent(new Event("pagehide"));
    const handle=await pending;
    try{
      expect(hullFetches).toBe(1);expect(cancelled).toBe(true);expect(physicsCalls).toBe(0);
      expect(source.commands.some(command=>command.kind==="UpsertMeshArtifact"&&command.artifact.representationKey.startsWith("factory-play:factory_hull:crashsite:"))).toBe(false);
      expect(source.windowPort.animationFrames.size).toBe(0);
    }finally{await handle.dispose();}
  },180_000);

  it("W09 projects actual carrier mass, movement veto and deposit guidance into the normal HUD",async()=>{
    // Actual Bootstrap/HUD path with declared Native transport reply fixture; no physical admission claim.
    const f=await factoryCarrierHostFixture();const text=(id:string)=>descendants(f.source.body).find(e=>e.id===id)!.textContent;
    try{
      const cargoKeys=f.backend.readDiagnostics().residentRepresentationKeys.filter(key=>key.startsWith("factory-play:fp02_wreck_owner:"));
      expect(cargoKeys.length).toBeGreaterThan(0);
      for(const key of cargoKeys){const node=f.backend.representationRoot.getObjectByName(`representation:${key}`) as THREE.Mesh;
        expect(node.geometry.getAttribute("color").count).toBe(node.geometry.getAttribute("position").count);}
      stepFrame(f.source.windowPort,performance.now());
      const baseCost=JSON.parse(f.source.body.dataset.hestiaFactoryPresentation!) as {cost:{cpu:number;mesh:number;draws:number}};
      expect(text("hvp-interaction-target")).toContain("No hit within 4 m");
      await f.port.handling!.prepare(f.request,"pickup");await f.port.handling!.commit(f.request.transactionId);f.port.handling!.publish(f.request.transactionId);await f.port.handling!.finalize(f.request.transactionId);
      const carrierKeys=f.backend.readDiagnostics().residentRepresentationKeys.filter(key=>key.startsWith("factory-play:carrier:slot:"));
      const carrierNodes=carrierKeys.map(key=>f.backend.representationRoot.getObjectByName(`representation:${key}`) as THREE.Mesh);
      expect(carrierNodes.length).toBeGreaterThan(0);
      for(const node of carrierNodes)expect(node.geometry.getAttribute("color").count).toBe(node.geometry.getAttribute("position").count);
      const carrierBytes=carrierNodes.reduce((total,node)=>total+node.geometry.getAttribute("position").array.byteLength+node.geometry.getAttribute("normal").array.byteLength
        +node.geometry.getIndex()!.array.byteLength+node.geometry.getAttribute("color").array.byteLength,0);
      const finalCost=JSON.parse(f.source.body.dataset.hestiaFactoryPresentation!) as {cost:{cpu:number;mesh:number;draws:number}};
      expect(finalCost.cost.mesh-baseCost.cost.mesh).toBe(carrierBytes*2);
      expect(finalCost.cost.cpu-baseCost.cost.cpu).toBe(carrierBytes*3+108824*8+(83735+9721+10782+5520+14007)*4);
      expect(finalCost.cost.draws-baseCost.cost.draws).toBe(carrierNodes.length);
      const carrierMaterials=()=>carrierNodes.flatMap(node=>Array.isArray(node.material)?node.material:[node.material]);
      expect(carrierMaterials().every(material=>(material as THREE.MeshBasicMaterial).vertexColors)).toBe(true);
      const aoToggle=descendants(f.source.body).find(e=>e.id==="hvp-ao-toggle");expect(aoToggle).toBeDefined();
      aoToggle!.dispatchEvent(new Event("click"));expect(carrierMaterials().every(material=>(material as THREE.MeshBasicMaterial).vertexColors)).toBe(true);
      aoToggle!.dispatchEvent(new Event("click"));expect(carrierMaterials().every(material=>(material as THREE.MeshBasicMaterial).vertexColors)).toBe(true);
      const before=JSON.stringify(f.port.read());stepFrame(f.source.windowPort,performance.now());
      expect(text("hvp-interaction-target")).toContain("Transport: 341.0 kg");
      expect(text("hvp-interaction-feedback")).toContain("WASD");
      expect(text("hvp-cut-feedback")).toContain("set down here");
      expect(descendants(f.source.body).find(e=>e.id==="hvp-interaction")!.children[3]!.textContent).not.toContain("cut");
      expect(JSON.stringify(f.port.read())).toBe(before);
      f.setCarrierVeto("CarrierOverlap");stepFrame(f.source.windowPort,performance.now()+17);
      expect(text("hvp-interaction-feedback")).toContain("Obstacle");
      f.setCarrierPhase("Deposited");stepFrame(f.source.windowPort,performance.now()+34);
      expect(text("hvp-interaction-target")).toContain("Depot: 341.0 kg");
      expect(text("hvp-cut-feedback")).toContain("deliver locally");
      f.clearCarrier();stepFrame(f.source.windowPort,performance.now()+51);
      expect(text("hvp-interaction-target")).toContain("No hit within 4 m");
      expect(text("hvp-interaction-feedback")).toContain("F pushes");
      expect(descendants(f.source.body).find(e=>e.id==="hvp-interaction")!.children[3]!.textContent).toContain("cut");
    }finally{await f.handle.dispose();}
  });

  it("W09 enters RecoveryHold when a partially staged carrier cannot retire its actual receiver artifact",async()=>{
    const f=await factoryCarrierHostFixture();try{
      f.failStage();await expect(f.port.handling!.prepare(f.request,"pickup")).rejects.toThrow(/RecoveryHold/);
      expect(f.rollback).toHaveBeenCalledTimes(1);
      expect(f.backend.readDiagnostics().residentRepresentationKeys.some(key=>key.startsWith("factory-play:carrier:slot:"))).toBe(true);
      f.disableFaults();expect(()=>f.port.construction!.dispose()).not.toThrow();
      expect(f.backend.readDiagnostics().residentRepresentationKeys.some(key=>key.startsWith("factory-play:carrier:slot:"))).toBe(false);
    }finally{f.disableFaults();await f.handle.dispose();}
  });

  it("W09 restores the consumed paid depot projection after actual held publication rejects",async()=>{
    const f=await factoryCarrierHostFixture();try{
      await f.port.handling!.prepare(f.request,"pickup");await f.port.handling!.commit(f.request.transactionId);f.port.handling!.publish(f.request.transactionId);await f.port.handling!.finalize(f.request.transactionId);
      const before=f.backend.readDiagnostics().visibleRepresentationKeys.filter(key=>key.startsWith("factory-play:carrier:slot:"));expect(before).toHaveLength(5);
      const {createFactoryInstallationProfile}=await import("../../src/factory/construction/installationProfile");const profile=createFactoryInstallationProfile("B07");
      const request={transactionId:"render_consume_depot",instanceId:"render_former",definitionSourceId:"B07",centerMm:[-6250,1500,-2500],quarterTurns:1};
      await f.port.construction!.prepareNative({...request,ownerId:request.instanceId,definitionRef:profile.definitionRef,profileDigest:profile.profileDigest,expectedRevision:0,expectedTerrainRevision:0,materialBinding:"finite-install-reply-fixture",consumedCustody:{containerId:f.request.custodyContainerId,emptyCanonicalJson:"empty-fixture"}});
      const plan={request,installation:{instanceId:request.instanceId},profile} as unknown as Parameters<NonNullable<FactoryHostPort["construction"]>["stageProjection"]>[0];
      await expect(f.port.construction!.stageProjection(plan),"actual prepared RPC receipt is separate from published physics.read()").resolves.toBeUndefined();await f.port.construction!.commitNative(request.transactionId);
      f.failProjection();expect(()=>f.port.construction!.publishNative(request.transactionId)).toThrow(/FaultProjection/);
      await f.port.construction!.rollbackNative(request.transactionId);f.port.construction!.rollbackProjection(request.transactionId);
      expect(f.backend.readDiagnostics().visibleRepresentationKeys.filter(key=>key.startsWith("factory-play:carrier:slot:"))).toEqual(before);
    }finally{f.disableFaults();await f.handle.dispose();}
  });

  it("PLAY02 private prepared geometry rejects stale headers, request/profile mismatches and contradictory parts before upload",async()=>{
    const f=await factoryCarrierHostFixture();try{
      const {createFactoryInstallationProfile}=await import("../../src/factory/construction/installationProfile"),profile=createFactoryInstallationProfile("B07");
      const request={transactionId:"guard_prepared",instanceId:"guard_former",definitionSourceId:"B07",centerMm:[-6250,1500,-2500],quarterTurns:1};
      await f.port.construction!.prepareNative({...request,ownerId:request.instanceId,definitionRef:profile.definitionRef,profileDigest:profile.profileDigest,expectedRevision:0,expectedTerrainRevision:0,materialBinding:"finite-receiver-fixture"});
      const plan={request,installation:{instanceId:request.instanceId},profile} as unknown as Parameters<NonNullable<FactoryHostPort["construction"]>["stageProjection"]>[0];
      const held=f.readPrepared(),copy=JSON.stringify(held),resident=[...f.backend.readDiagnostics().residentRepresentationKeys];
      const restore=()=>Object.assign(held,JSON.parse(copy));
      for(const mutate of [
        ()=>Object.assign(held,{transactionId:"foreign"}),
        ()=>Object.assign(held,{state:"CommittedHeld"}),
        ()=>Object.assign(held.prepared!,{profileDigest:"foreign"}),
        ()=>Object.assign(held.prepared!,{ownerId:"foreign"}),
        ()=>Object.assign(held.prepared!,{transactionId:"foreign"}),
        ()=>Object.assign(held.prepared!,{materialBinding:"substituted"}),
        ()=>Object.assign(held.preparedPartObservation!,{terrainRevision:99}),
        ()=>{const row=held.preparedPartObservation!;Object.assign(row,{parts:row.parts.map((p,i)=>i===0?{...p,status:"Unknown"}:p)});const {observationDigest:_digest,...core}=row;Object.assign(row,{observationDigest:canonicalSignature(core)});},
        ()=>{const row=held.preparedPartObservation!;Object.assign(row,{parts:row.parts.map((p,i)=>i===0?{...p,colliderHandles:[999]}:p)});const {observationDigest:_digest,...core}=row;Object.assign(row,{observationDigest:canonicalSignature(core)});}
      ]){restore();mutate();await expect(f.port.construction!.stageProjection(plan)).rejects.toThrow(/binding|geometry|observation/);expect(f.backend.readDiagnostics().residentRepresentationKeys).toEqual(resident);}
      restore();f.setNativeTickDelta(1);await expect(f.port.construction!.stageProjection(plan)).rejects.toThrow(/binding/);f.setNativeTickDelta(0);
      await expect(f.port.construction!.stageProjection({...plan,request:{...request,centerMm:[-6500,1500,-2500]}} as typeof plan)).rejects.toThrow(/binding/);
      f.port.construction!.rollbackProjection(request.transactionId);
    }finally{await f.handle.dispose();}
  });

  it("W09 release enters RecoveryHold after one actual carrier artifact retires and the next rejects",async()=>{
    const f=await factoryCarrierHostFixture();try{
      await f.port.handling!.prepare(f.request,"pickup");await f.port.handling!.commit(f.request.transactionId);f.port.handling!.publish(f.request.transactionId);await f.port.handling!.finalize(f.request.transactionId);
      const release={...f.request,transactionId:"render_carrier_release"};await f.port.handling!.prepare(release,"release");await f.port.handling!.commit(release.transactionId);f.failReleaseRetire();
      expect(()=>f.port.handling!.publish(release.transactionId)).toThrow(/RecoveryHold/);
      expect(f.backend.readDiagnostics().residentRepresentationKeys.filter(key=>key.startsWith("factory-play:carrier:slot:"))).toHaveLength(4);expect(f.rollback).not.toHaveBeenCalled();
      f.disableFaults();expect(()=>f.port.construction!.dispose()).not.toThrow();
      expect(f.backend.readDiagnostics().residentRepresentationKeys.some(key=>key.startsWith("factory-play:carrier:slot:"))).toBe(false);
    }finally{f.disableFaults();await f.handle.dispose();}
  });

  it.each(["pickup","deposit","release"] as const)("W09 admits complete Native member capture cost before carrier %s allocation",async(operation)=>{
    const f=await factoryCarrierHostFixture();try{
      f.setCollisionBytes(HVP_RESOURCE_CAPS_DEFAULT.maxCpuBytes);
      await expect(f.port.handling!.prepare(f.request,operation)).rejects.toThrow(/CPU|budget|cap/i);expect(f.prepare).not.toHaveBeenCalled();
    }finally{await f.handle.dispose();}
  });
  it("records measured cold Ready only after the first submitted scene frame",async()=>{
    const source=harness();Object.defineProperty(source.windowPort,"location",{value:{search:"?hvpMeasure=1"}});
    const measure=vi.spyOn(performance,"measure");let handle:Awaited<ReturnType<typeof startHvp>>|undefined;
    try{
      handle=await startHvp(source.overrides());
      const startupProjection=source.commands.filter(c=>c.kind==="ApplyFrameProjection");
      expect(startupProjection).toHaveLength(1);
      expect(startupProjection[0]!.snapshot.representationTransforms).toHaveLength(source.commands.filter(c=>c.kind==="UpsertMeshArtifact").length);
      const visibilityBeforeFirstFrame=source.commands.filter(c=>c.kind==="ApplyVisibilityPlan").length;
      const projectionTimingBeforeFirstFrame=measure.mock.calls.filter(c=>c[0]==="hvp.startupProjectionMs").length;
      expect(measure.mock.calls.filter(c=>c[0]==="hvp.coldReadyMs")).toHaveLength(0);
      expect(measure.mock.calls.filter(c=>c[0]==="hvp.startupBackendUpsertMs")).toHaveLength(source.commands.filter(c=>c.kind==="UpsertMeshArtifact").length);
      expect(measure.mock.calls.filter(c=>c[0]==="hvp.startupProjectionMs").length).toBeGreaterThanOrEqual(startupProjection.length);
      stepFrame(source.windowPort,performance.now());expect(source.counts().renders).toBe(1);
      expect(source.commands.filter(c=>c.kind==="ApplyVisibilityPlan").length).toBeGreaterThan(visibilityBeforeFirstFrame);
      expect(measure.mock.calls.filter(c=>c[0]==="hvp.startupProjectionMs").length).toBe(projectionTimingBeforeFirstFrame);
      expect(source.commands.filter(c=>c.kind==="ApplyFrameProjection").length).toBeGreaterThanOrEqual(startupProjection.length);
      expect(measure.mock.calls.filter(c=>c[0]==="hvp.coldReadyMs")).toHaveLength(1);
      stepFrame(source.windowPort,performance.now()+17);
      expect(measure.mock.calls.filter(c=>c[0]==="hvp.coldReadyMs")).toHaveLength(1);
    }finally{await handle?.dispose();measure.mockRestore();}
  });
  it("binds the rendered daylight look scene instead of only publishing dataset claims", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides());

    try {
      const presentation = source.scene.getObjectByName("hvp-readable-coast-presentation");
      expect(presentation).toBeDefined();
      expect(source.scene.background).toBeInstanceOf(THREE.Color);
      expect((source.scene.background as THREE.Color).getHex()).toBe(0x87b5d9);
      expect(source.scene.fog).toBeInstanceOf(THREE.Fog);
      expect((source.scene.fog as THREE.Fog).near).toBe(48);
      expect((source.scene.fog as THREE.Fog).far).toBe(170);
      expect(source.scene.getObjectByName("hvp-ambient-fill")).toBeInstanceOf(THREE.HemisphereLight);
      expect(source.scene.getObjectByName("hvp-sun-key")).toBeInstanceOf(THREE.DirectionalLight);
      expect(source.scene.getObjectByName("hvp-cool-fill")).toBeInstanceOf(THREE.DirectionalLight);

      expect(presentation?.userData.hvpRenderOnly).toBe(true);
    } finally {
      await handle.dispose();
    }
  });

  it("fails closed when the backend cannot provide a rendered scene", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides({
      createBackend: () => ({ ...source.backend, scene: undefined })
    }));

    expect(source.body.dataset.hestiaPrototypeState).toBe("Error");
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(0);
    expect(descendants(source.body).filter((element) => element.getAttribute("role") === "alert")).toHaveLength(1);
    expect(descendants(source.body).find((element) => element.id === "hvp-error-detail")?.textContent)
      .toContain("HVP-02 requires a rendered Three.js scene");
    expect(source.body.dataset.hestiaPrototypeLook).toBeUndefined();
    await handle.dispose();
  });

  it("proves the far field arrives bound through the pipeline as render-only data", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides());

    try {
      const proxyGroup = source.scene.getObjectByName("hvp-distant-coast-proxy-noneditable");
      expect(proxyGroup).toBeUndefined();
      const farCommand = source.commands.find((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
        command.kind === "UpsertMeshArtifact"
        && command.artifact.representationKey === "hvp:far"
      );
      expect(farCommand).toBeDefined();
      if (farCommand === undefined) return;
      expect(farCommand.artifact.algorithmVersion).toBe("hvp-farfield-macro-v3");
      expect(farCommand.artifact.indices.length).toBeGreaterThan(0);
      expect(farCommand.artifact.indices.length / 3).toBeLessThanOrEqual(500_000);
      const roleIds = farCommand.artifact.materialRanges.map((range) => range.materialProfileId);
      expect(roleIds.length).toBeGreaterThan(0);
      for (const id of roleIds) {
        expect([
          "hvp:look:limestone-dry",
          "hvp:look:limestone-wet",
          "hvp:look:soil",
          "hvp:look:moss"
        ]).toContain(id);
      }
      expect(farCommand.artifact.materialRanges.reduce((total, range) => total + range.indexCount, 0))
        .toBe(farCommand.artifact.indices.length);
      expect((handle as unknown as { readonly edit?: unknown }).edit).toBeUndefined();
    } finally {
      await handle.dispose();
    }
  });

  it("keeps source-derived terrain geometry intact while grouping readable material ranges", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides());
    try {
      const terrainCommands = source.commands.filter((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
        command.kind === "UpsertMeshArtifact"
        && command.artifact.representationKey.startsWith("hvp:terrain:s")
      );
      expect(terrainCommands).toHaveLength(16);
      expect(terrainCommands.map(c=>c.artifact.representationKey)).toEqual(Array.from({length:16},(_,i)=>`hvp:terrain:s${i}:r0`));
      const allIndices=terrainCommands.reduce((n,c)=>n+c.artifact.indices.length,0);
      expect(allIndices).toBeGreaterThan(6000);expect(allIndices/3).toBeLessThanOrEqual(500_000);
      expect(new Set(terrainCommands.flatMap(c=>c.artifact.materialRanges.map(r=>r.materialProfileId))))
        .toEqual(new Set(["hvp:look:limestone-dry","hvp:look:limestone-wet","hvp:look:soil","hvp:look:moss"]));
      for(const terrainCommand of terrainCommands) {
      expect(terrainCommand.artifact.algorithmVersion).toBe("hvp-terrain-sector-v1");
      expect(terrainCommand.artifact.indices.length % 6).toBe(0);
      expect(terrainCommand.artifact.materialRanges.reduce((total, range) => total + range.indexCount, 0))
        .toBe(terrainCommand.artifact.indices.length);
      terrainCommand.artifact.materialRanges.forEach((range) => {
        expect(range.indexCount).toBeGreaterThan(0);
      });
      expect(terrainCommand.artifact.sourceRevision).toBe(0);
      terrainCommand.artifact.materialRanges.forEach((range, index, ranges) => {
        expect(range.startIndex).toBe(index === 0 ? 0 : ranges[index - 1]!.startIndex + ranges[index - 1]!.indexCount);
      });
      }
      expect(source.body.dataset.hestiaPrototypeSeed).toBe("hestia-hvp-lagoon-001");
      expect(source.body.dataset.hestiaPrototypeSourceRevision).toBe("hvp-authored-coast-v5");
      expect(source.body.dataset.hestiaPrototypeSourceDigest).toMatch(/^[0-9a-f]{8}$/);
      const resources = JSON.parse(source.body.dataset.hestiaPrototypeResources!);
      const artifactTriangles = source.commands.reduce((count, command) =>
        count + (command.kind === "UpsertMeshArtifact" ? command.artifact.indices.length / 3 : 0), 0);
      // The presentation-only sky contributes 24 * 11 * 2 triangles, not a world artifact.
      expect(resources.ledger.triangles).toBe(artifactTriangles + 528);
      expect(resources.ledger.gpuBytes).toBe("unsupported");
      expect(resources.ledger.totalCpuBytes).toBeLessThanOrEqual(resources.caps.maxCpuBytes);
      expect(resources.ledger.retainedMeshBytes).toBeLessThanOrEqual(resources.caps.maxMeshBytes);

      const waterCommand = source.commands.find((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
        command.kind === "UpsertMeshArtifact"
        && command.artifact.representationKey === HVP_WATER_REPRESENTATION_KEY
      );
      expect(waterCommand).toBeDefined();
      if (waterCommand === undefined) return;
      expect(waterCommand.artifact.algorithmVersion).toBe("hvp-water-mask-v2");
      expect(new Set([...waterCommand.artifact.positions].filter((_value, index) => index % 3 === 1))).toEqual(new Set([0]));
      expect(waterCommand.materialProfiles).toHaveLength(1);
      expect([...waterCommand.artifact.normals].every((value, index) => value === (index % 3 === 1 ? 1 : 0))).toBe(true);
      expect(waterCommand.materialProfiles[0]).toMatchObject({
        id: "hvp:look:water",
        depthWrite: false
      });
      let waterArea = 0;
      const positions = waterCommand.artifact.positions;
      const indices = waterCommand.artifact.indices;
      for (let triangle = 0; triangle < indices.length; triangle += 3) {
        const ax = positions[indices[triangle]! * 3]!;
        const az = positions[indices[triangle]! * 3 + 2]!;
        const bx = positions[indices[triangle + 1]! * 3]!;
        const bz = positions[indices[triangle + 1]! * 3 + 2]!;
        const cx = positions[indices[triangle + 2]! * 3]!;
        const cz = positions[indices[triangle + 2]! * 3 + 2]!;
        waterArea += Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2;
      }
      expect(waterArea).toBeGreaterThan(40);
      expect(waterArea).toBeLessThan(480 * 480);

      const joinCommand = source.commands.find((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
        command.kind === "UpsertMeshArtifact"
        && command.artifact.representationKey === "hvp:join"
      );
      expect(joinCommand).toBeDefined();
      if (joinCommand === undefined) return;
      expect(joinCommand.artifact.algorithmVersion).toBe("hvp-coast-greedy-v3");
      expect(joinCommand.artifact.indices.length).toBeGreaterThan(600);
      expect(joinCommand.artifact.materialRanges).toHaveLength(4);
      expect(joinCommand.artifact.materialRanges.map((range) => range.materialProfileId)).toEqual([
        "hvp:look:limestone-dry",
        "hvp:look:limestone-wet",
        "hvp:look:soil",
        "hvp:look:moss"
      ]);

      const waterButton = source.body.children
        .flatMap((child) => [child, ...descendants(child)])
        .find((element) => element.id === "hvp-water-toggle");
      expect(waterButton).toBeDefined();
      waterButton?.dispatchEvent(new Event("click"));
      const visibilityPlans = source.commands.filter((command): command is Extract<RenderCommand, { kind: "ApplyVisibilityPlan" }> =>
        command.kind === "ApplyVisibilityPlan"
      );
      const hiddenWaterPlan = visibilityPlans.at(-1)?.plan;
      const publishedKeys = source.commands.flatMap((command) => command.kind === "UpsertMeshArtifact" ? [command.artifact.representationKey] : []).sort();
      expect(publishedKeys.filter((key) => key.startsWith("hvp:flora:") && key.endsWith(":wood"))).toHaveLength(4);
      expect(source.body.dataset.hestiaPrototypeVegetation).toBe("hvp-root-umbrella-v3");
      // Key sets are canonical ASCII-sorted by the visibility contract.
      expect(hiddenWaterPlan?.visibleRepresentationKeys).toEqual(publishedKeys.filter((key) => key !== HVP_WATER_REPRESENTATION_KEY));
      expect(hiddenWaterPlan?.hiddenRepresentationKeys).toEqual(["hvp:water"]);
      waterButton?.dispatchEvent(new Event("click"));
      const restoredPlan = source.commands.filter((command): command is Extract<RenderCommand, { kind: "ApplyVisibilityPlan" }> =>
        command.kind === "ApplyVisibilityPlan"
      ).at(-1)?.plan;
      expect(restoredPlan?.visibleRepresentationKeys).toEqual(publishedKeys);
      expect(restoredPlan?.hiddenRepresentationKeys).toEqual([]);
    } finally {
      await handle.dispose();
    }
  });

  it("fails closed when a look role is empty or its profile diverges from the role", () => {
    const look = createHvpLookProfile("readable");
    const sparseMesh: HvpBlockMesh = {
      faceCount: 1,
      outerFaceCount: 1,
      cavityFaceCount: 0,
      positions: new Float32Array([0, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1]),
      normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
      indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
      boundsMeters: { min: { x: 0, y: 1, z: 0 }, max: { x: 1, y: 1, z: 1 } },
      materialProfileId: HVP_TERRAIN_MATERIAL_ID
    };
    expect(() => createHvpLookTerrain(sparseMesh, look)).toThrow(/empty|four/i);

    const divergent = {
      ...look,
      materials: look.materials.map((material) => material.role === "moss"
        ? {
            ...material,
            materialProfile: Object.freeze({
              ...material.materialProfile,
              id: materialProfileId("hvp:look:soil")
            })
          }
        : material)
    };
    expect(() => createHvpLookTerrain(hvpMeshBlocks(
      hvpBuildCoastBlockCells(HVP_COAST_BLOCK_SIZE_METERS),
      HVP_COAST_BLOCK_SIZE_METERS,
      HVP_TERRAIN_MATERIAL_ID
    ), divergent)).toThrow(/diverg|profile/i);
  });

  it.each(["?hvpLoad=primary", "?factoryLoad=archive"])("rejects unsupported Factory restore query %s before mounting its owner", async search => {
    const source=harness();Object.defineProperty(source.windowPort,"location",{value:{search}});
    let extensionCalls=0;
    const handle=await startHvp(source.overrides({factoryExtension:async()=>{
      extensionCalls++;return withTestFactoryOwnerMemory({isQuiescent:()=>true,dispose:async()=>{}});
    }}));
    try {
      const alert=descendants(source.body).find(e=>e.textContent.startsWith("Technical initialization failure:"));
      expect(source.body.dataset.hestiaPrototypeState).toBe("Error");
      expect(alert?.textContent).toMatch(/combined checkpoint|Factory restore slot/i);
      expect(extensionCalls).toBe(0);
      expect(source.counts()).toMatchObject({backendConstructions:1,backendDisposals:1,renders:0});
      expect(source.windowPort.animationFrames.size).toBe(0);
    } finally { await handle.dispose(); }
    expect(descendants(source.body).some(e=>e.textContent.startsWith("Technical initialization failure:"))).toBe(false);
  });

  it("W06 mounts one optional native-host extension, refuses legacy persistence, and closes it before the backend", async () => {
    const source = harness();
    let hostPort: import("../../src/factory/session/hostPort").FactoryHostPort | undefined;
    let closed = 0;
    const handle = await startHvp(source.overrides({ factoryExtension: async (host: import("../../src/factory/session/hostPort").FactoryHostPort) => {
      hostPort = host;
      return withTestFactoryOwnerMemory({ isQuiescent: () => true, dispose: async () => {
        expect(host.current()).toBe(false); expect(source.counts().backendDisposals).toBe(0); closed++;
      } });
    } }));
    try {
      expect(hostPort).toBeDefined();
      expect(hostPort!.read()).toMatchObject({ nativeTick: 0, confirmed: true, terrain: { cellMeters: 0.125 } });
      expect(hostPort!.readTerrainSlot(-1, 0, 0)).toBeUndefined();
      const save = descendants(source.body).find(e => e.id === "hvp-save")!;
      save.dispatchEvent(new Event("click")); await Promise.resolve();
      expect(source.body.dataset.hestiaPrototypeSave).toContain("Factory");
      expect(source.body.dataset.hestiaPrototypeSave).toContain("Rejected");
    } finally { await handle.dispose(); }
    expect(closed).toBe(1);
  });

  it("Factory Save enters confirmed capture admission before raising the Root busy fence", async () => {
    const source=harness(),original=source.overrides()!;
    Object.defineProperty(source.windowPort,"location",{value:{search:"?hvpMeasure=1"}});
    const performanceMeasure=vi.spyOn(performance,"measure");
    let host!:FactoryHostPort,admissionEntered=false,confirmedBeforeAdmission=false,confirmedAfterAdmission:boolean|undefined;
    const release=vi.fn();
    const checkpointFactory=vi.fn(async()=>{throw Error("Native checkpoint should not run before capture witness");});
    const store={initialize:async()=>{},list:async()=>({slots:[]}),load:async()=>{throw Error("unexpected cold load");},
      save:async()=>{throw Error("save should stop after admission");},close:async()=>{}};
    vi.doMock("../../src/factory/persistence/factorySaveStore",()=>({createFactorySaveStore:()=>store}));
    let handle:HvpBootstrapHandle|undefined;
    try{
      handle=await startHvp(source.overrides({
      createPhysics:async(...args:Parameters<NonNullable<typeof original.createPhysics>>)=>{
        const native=await original.createPhysics!(...args),read=native.read;
        return {...native,checkpointFactory,
          read:()=>({...read(),status:"Paused",terrainTransaction:"Idle",neighborTransaction:"Idle",bodyResidencyTransaction:"Idle",
            moving:{state:"Idle"},factoryFacilities:{revision:0,state:"Idle" as const,transactionId:null,owners:[],prepared:null}} as unknown as ReturnType<typeof read>),
          lifecycle:()=>({workers:1,pendingJobs:0,timers:null,listeners:0,native:null,
            factoryInput:{enabled:true,lastSentId:null,lastAckId:null,pendingIds:[],desiredLevel:{x:0,z:0,sprint:false,jump:false},commandDepth:0,closing:false,canDispatch:true}})
        };
      },
      factoryExtension:async(port:FactoryHostPort):Promise<FactoryHostExtensionHandle>=>{
        host=port;
        return withTestFactoryOwnerMemory({isQuiescent:()=>true,dispose:async()=>{},canBeginFactoryCheckpoint:()=>true,
          beginFactoryCheckpoint:(admit?:FactoryCheckpointRawAdmission):FactoryCheckpointCapture=>{
            const before=host.read();
            if(!before.confirmed)throw Error("Root host was not confirmed before Factory admission");
            confirmedBeforeAdmission=true;admissionEntered=true;
            admit?.(testFactoryOwnerMemory.factory,testFactoryOwnerMemory.cacheBytes,testFactoryOwnerMemory.treeMetrics);
            confirmedAfterAdmission=host.read().confirmed;
            return {host:{sessionId:before.sessionId,epoch:before.epoch,nativeTick:before.nativeTick,remainderTicks:0,steps:0},
              factory:testFactoryOwnerMemory.factory,assertCurrent:()=>{throw Error("Stop after admission regression");},release};
          }});
      }
      }));
      const startupError=descendants(source.body).find(element=>element.textContent.startsWith("Technical initialization failure:"))?.textContent;
      expect(source.body.dataset.hestiaPrototypeState, startupError??"Factory Save fixture did not reach Ready").toBe("Ready");
      expect(host.read().persistence?.saveAvailable).toBe(true);
      const factoryCost=JSON.parse(source.body.dataset.hestiaFactoryPresentation!).cost as {cpu:number};
      const closedDefinitionCpu=2*13*32768+(19222+19487+5596+5889)*8;
      const frameProjectionReferenceReserveBytes=512*1024;
      const logicalCameraReserveBytes=16*1024;
      const hullMetadataBytes=readLoadedHullMetadataBytes();
      expect([0,42_578]).toContain(hullMetadataBytes);
      expect(factoryCost.cpu).toBe(FACTORY_RUNTIME_INSTALLATION_PROFILE_CACHE_RESERVE_BYTES+frameProjectionReferenceReserveBytes+logicalCameraReserveBytes+closedDefinitionCpu+hullMetadataBytes);
      const stageAdmission=performanceMeasure.mock.calls.find(([name])=>name==="hvp.factoryStageAdmission");
      expect((stageAdmission?.[1] as {detail?:{data?:Record<string,unknown>}}|undefined)?.detail?.data)
        .toMatchObject({profileCacheReserveBytes:FACTORY_RUNTIME_INSTALLATION_PROFILE_CACHE_RESERVE_BYTES,frameProjectionReferenceReserveBytes,logicalCameraReserveBytes});
      await expect(host.save!()).rejects.toThrow("Stop after admission regression");
      const earlySaveAdmission=performanceMeasure.mock.calls.filter(([name])=>name==="hvp.factorySaveAdmission")
        .map(([,entry])=>(entry as {detail?:{data?:Record<string,unknown>}}).detail?.data)
        .find(data=>data?.phase==="early");
      expect(earlySaveAdmission).toMatchObject({profileCacheReserveBytes:FACTORY_RUNTIME_INSTALLATION_PROFILE_CACHE_RESERVE_BYTES,
        frameProjectionReferenceReserveBytes,logicalCameraReserveBytes});
      expect(admissionEntered).toBe(true);
      expect(confirmedBeforeAdmission).toBe(true);
      expect(confirmedAfterAdmission).toBe(false);
      expect(checkpointFactory).not.toHaveBeenCalled();
      expect(release).toHaveBeenCalledTimes(1);
      expect(host.read().confirmed).toBe(false);
      expect(host.read().persistence).toMatchObject({state:"RecoveryHold",message:expect.stringContaining("Stop after admission regression")});
    }finally{if(handle)await handle.dispose();vi.doUnmock("../../src/factory/persistence/factorySaveStore");}
  });

  it("W06 holds the single host lease through late async extension cleanup and rejects stale pause", async () => {
    const source = harness();
    let entered!: () => void;
    const mounting = new Promise<void>(resolve => { entered = resolve; });
    let resolveExtension!: (value: import("../../src/factory/session/hostPort").FactoryHostExtensionHandle) => void;
    const deferred = new Promise<import("../../src/factory/session/hostPort").FactoryHostExtensionHandle>(resolve => { resolveExtension = resolve; });
    let oldHost!: import("../../src/factory/session/hostPort").FactoryHostPort;
    let closed = 0;
    const pending = startHvp(source.overrides({ factoryExtension: (host: typeof oldHost) => {
      oldHost = host; entered(); return deferred;
    } }));
    await mounting;
    source.windowPort.dispatchEvent(new Event("pagehide"));
    await expect(startHvp(source.overrides())).rejects.toThrow(/already mounted/i);
    resolveExtension(withTestFactoryOwnerMemory({ isQuiescent: () => true, dispose: async () => { closed++; } }));
    const oldHandle = await pending; await oldHandle.dispose();
    expect(closed).toBe(1); expect(source.windowPort.animationFrames.size).toBe(0);
    const next = await startHvp(source.overrides());
    try {
      await expect(oldHost.pause()).rejects.toThrow(/disposed|superseded/i);
      expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
      expect(source.counts().backendConstructions).toBe(2);
    } finally { await next.dispose(); }
  });

  it("W06 safe pause observes confirmed native counters and refuses busy resume", async () => {
    const source = harness(); const original = source.overrides()!;
    const confirm = vi.fn(() => true); Object.defineProperty(source.windowPort, "confirm", { value: confirm });
    let tick = 17; let busy = false;
    let port!: import("../../src/factory/session/hostPort").FactoryHostPort;
    const views: number[] = [];
    const handle = await startHvp(source.overrides({
      createPhysics: async (...args: Parameters<NonNullable<typeof original.createPhysics>>) => {
        const native = await original.createPhysics!(...args); const read = native.read;
        return { ...native, read: () => ({ ...read(), ticks: tick }), command: async () => { tick++; } };
      },
      factoryExtension: async (host: typeof port) => {
        port = host; const unsubscribe = host.subscribeConfirmed(view => { views.push(view.nativeTick); });
        return withTestFactoryOwnerMemory({ isQuiescent: () => !busy, dispose: async () => { unsubscribe(); } });
      }
    }));
    try {
      stepFrame(source.windowPort, 16); stepFrame(source.windowPort, 32);
      expect(views.every(value => value === 17)).toBe(true);
      tick = 23; stepFrame(source.windowPort, 48); expect(views.at(-1)).toBe(23);
      await port.pause(); expect(views.at(-1)).toBe(24);
      busy = true; await expect(port.resume()).rejects.toThrow(/busy|unconfirmed/i);
      expect(port.read().confirmed).toBe(false); expect(tick).toBe(24);
      descendants(source.body).find(e => e.id === "hvp-end-session")!.dispatchEvent(new Event("click"));
      await Promise.resolve(); expect(confirm).not.toHaveBeenCalled();
      expect(source.counts().backendDisposals).toBe(0);
    } finally { await handle.dispose(); }
  });

  it("W07 actual Host Ghost move/rotate/cancel keeps one HVP frame, Cargo Open and disposal intact", async () => {
    const source=harness(),original=source.overrides()!;
    const fixture=await import("../../src/factory/fixtures/startSite");
    let port!:FactoryHostPort,opened=false,revision=0;
    const open=vi.fn(async()=>{opened=true;revision++;});
    let rendererDisposals=0;const nativeCommands=vi.fn(async()=>{});
    // Actual command receiver and ledger; only the WebGL driver is stubbed.
    const backend=new ThreeRenderBackend({canvas:source.canvas as unknown as HTMLCanvasElement,rendererFactory:()=>({setPixelRatio(){},setSize(){},render(){},dispose(){rendererDisposals++;}})});
    const dispatch=vi.spyOn(backend,"dispatch");
    const handle=await startHvp(source.overrides({
      createBackend:()=>backend,
      createSourceSnapshot:fixture.materializeFactoryStartSite,
      factorySourceProfile:{version:"hvp-factory-startsite-v1",readColumn:fixture.readFactorySourceColumnWorld},
      createPhysics:async(...args:Parameters<NonNullable<typeof original.createPhysics>>)=>{
        const native=await original.createPhysics!(...args),read=native.read,site=args[10]!;
        // Transport fixture only: actual World/LOS/player/Cargo admission is independently exercised in Native and Browser tests.
        return {...native,command:nativeCommands,openFactoryCargo:open,read:()=>({...read(),factoryFacilities:{revision,state:"Idle",transactionId:null,owners:[],prepared:null,
          cargo:{site,ownerId:site.ownerId,containerId:site.containerId,sourceDigest:site.sourceDigest,profileDigest:site.profileDigest,opened,positionMm:site.centerMm,accessBoundsMm:site.accessBoundsMm,bodyHandle:4,colliderHandles:[5],accessible:true,openReceipt:null}}})};
      },factoryExtension:async(host:FactoryHostPort)=>{
        port=host;return withTestFactoryOwnerMemory({isQuiescent:()=>true,dispose:async()=>{host.construction!.dispose();}});
      }
    }));
    try{
      const request={transactionId:"frame_cycle_1",instanceId:"frame_cut_1",definitionSourceId:"B06",centerMm:[-6250,1500,5000],quarterTurns:1};
      const initialDiagnostics=backend.readDiagnostics();
      expect(()=>port.construction!.projectGhost(request)).not.toThrow();
      const firstCommands=dispatch.mock.calls.map(([command])=>command);
      const firstGhostUploads=firstCommands.filter((command):command is Extract<RenderCommand,{kind:"UpsertMeshArtifact"}>=>command.kind==="UpsertMeshArtifact"&&command.artifact.representationKey.startsWith("factory:ghost:slot_"));
      const firstDiagnostics=backend.readDiagnostics(),poseStart=dispatch.mock.calls.length;
      expect(()=>port.construction!.projectGhost({...request,centerMm:[-6000,1500,5000],quarterTurns:2})).not.toThrow();
      const poseCommands=dispatch.mock.calls.slice(poseStart).map(([command])=>command);
      expect(poseCommands.some(command=>command.kind==="UpsertMeshArtifact"||command.kind==="RemoveRepresentation")).toBe(false);
      const movedProjection=poseCommands.filter((command):command is Extract<RenderCommand,{kind:"ApplyFrameProjection"}>=>command.kind==="ApplyFrameProjection").at(-1)!;
      const movedTransforms=movedProjection.snapshot.representationTransforms.filter(value=>value.representationKey.startsWith("factory:ghost:slot_"));
      expect(movedTransforms).toHaveLength(firstGhostUploads.length);
      for(const transform of movedTransforms){expect(transform.positionRelative).toEqual({x:-6,y:1.5,z:5});expect(transform.orientation.y).toBe(1);expect(transform.orientation.w).toBeCloseTo(0);}
      expect(backend.readDiagnostics()).toMatchObject({geometryAllocations:firstDiagnostics.geometryAllocations,geometryDisposals:firstDiagnostics.geometryDisposals,materialAllocations:firstDiagnostics.materialAllocations,materialDisposals:firstDiagnostics.materialDisposals});
      expect(()=>port.construction!.projectGhost(null)).not.toThrow();
      expect(()=>port.construction!.projectGhost(request)).not.toThrow();
      expect(()=>port.construction!.projectGhost({...request,quarterTurns:3})).not.toThrow();
      expect(()=>port.construction!.projectGhost(null)).not.toThrow();
      for(let index=0;index<3;index++){
        expect(()=>port.construction!.projectGhost({...request,instanceId:`new_paid_identity_${index}`})).not.toThrow();
        expect(()=>port.construction!.projectGhost(null)).not.toThrow();
      }
      const commands=dispatch.mock.calls.map(([command])=>command);
      const uploads=commands.filter((command):command is Extract<RenderCommand,{kind:"UpsertMeshArtifact"}>=>command.kind==="UpsertMeshArtifact"),frame=uploads[0]!.artifact.frameId;
      const factoryUploads=uploads.filter(command=>command.artifact.representationKey.startsWith("factory:"));
      expect(factoryUploads.length).toBeGreaterThan(1);expect(factoryUploads.every(command=>command.artifact.frameId===frame)).toBe(true);
      const ghostUploads=factoryUploads.filter(command=>command.artifact.representationKey.startsWith("factory:ghost:slot_"));
      expect(new Set(ghostUploads.map(command=>command.artifact.representationKey)).size).toBe(firstGhostUploads.length);
      for(const first of firstGhostUploads){const lifecycle=ghostUploads.filter(command=>command.artifact.representationKey===first.artifact.representationKey);
        expect(lifecycle.map(command=>command.artifact.artifactRevision)).toEqual([1,2,3,4,5]);
        expect(lifecycle.every(command=>command.artifact.sourceRevision===first.artifact.sourceRevision&&command.artifact.contentHash===first.artifact.contentHash)).toBe(true);
      }
      expect(nativeCommands).not.toHaveBeenCalled();expect(open).not.toHaveBeenCalled();
      expect(backend.readDiagnostics().visibleRepresentationKeys.some(key=>key.startsWith("factory:ghost:slot_"))).toBe(false);
      expect(backend.readDiagnostics()).toMatchObject({activeRepresentations:initialDiagnostics.activeRepresentations,rejectedArtifacts:0,staleRejectCount:0});
      await expect(port.construction!.openCargo()).resolves.toBeUndefined();expect(open).toHaveBeenCalledTimes(1);expect(port.read().confirmed).toBe(true);
      stepFrame(source.windowPort,16);expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
    }finally{await handle.dispose();}
    expect(rendererDisposals).toBe(1);expect(backend.readDiagnostics().backendState).toBe("Disposed");expect(source.windowPort.animationFrames.size).toBe(0);
  });

  it("W09 actual UI Cargo Open passes its own command barrier while foreign native holds still refuse admission",async()=>{
    const source=harness(),original=source.overrides()!,fixture=await import("../../src/factory/fixtures/startSite");
    let session!:FactorySessionHandle,opened=false,revision=0,status:FactoryHostView["physicsStatus"]="Paused";
    const open=vi.fn(async()=>{opened=true;revision++;});
    const handle=await startHvp(source.overrides({createSourceSnapshot:fixture.materializeFactoryStartSite,
      factorySourceProfile:{version:"hvp-factory-startsite-v1",readColumn:fixture.readFactorySourceColumnWorld},
      createPhysics:async(...args:Parameters<NonNullable<typeof original.createPhysics>>)=>{
        const native=await original.createPhysics!(...args),read=native.read,site=args[10]!;
        return {...native,openFactoryCargo:open,read:()=>({...read(),status,factoryFacilities:{revision,state:"Idle",transactionId:null,owners:[],prepared:null,
          cargo:{site,ownerId:site.ownerId,containerId:site.containerId,sourceDigest:site.sourceDigest,profileDigest:site.profileDigest,opened,positionMm:site.centerMm,accessBoundsMm:site.accessBoundsMm,bodyHandle:4,colliderHandles:[5],accessible:true,openReceipt:null}}})};
      },factoryExtension:async(host:FactoryHostPort)=>{session=await mountFactorySession(host,createFp02Fixture("cargo").catalog);return session;}}));
    const command=(id:string)=>({version:"fp06-ui-command-v1" as const,commandId:id,sessionId:session.ui.read().sessionId,epoch:session.ui.read().epoch,expected:session.ui.read().binding,kind:"open-cargo" as const});
    try{
      const result=await session.ui.submit(command("normal_ui_open"));
      expect(result.status).toBe("Committed");expect(open).toHaveBeenCalledTimes(1);expect(session.ui.read().interaction.cargoOpened).toBe(true);
      status="CoverageHold";stepFrame(source.windowPort,16);
      const held=await session.ui.submit(command("held_ui_open"));expect(held.status).toBe("Rejected");expect(open).toHaveBeenCalledTimes(1);
    }finally{await handle.dispose();}
  });

  it("W07 actual receiver keeps Ghost separate from legal paid owner ghost_slot_0", async () => {
    const source=harness(),original=source.overrides()!,fixture=await import("../../src/factory/fixtures/startSite");
    const {isSaveSafeResourceId}=await import("../../src/resources/ids");
    let port!:FactoryHostPort,session!:FactorySessionHandle,opened=false;
    const backend=new ThreeRenderBackend({canvas:source.canvas as unknown as HTMLCanvasElement,rendererFactory:()=>({setPixelRatio(){},setSize(){},render(){},dispose(){}})});
    const reportedCollisionBytes=2*1024*1024;let captureWorldBytes=0;
    const publishedCosts:number[]=[],dispatch=vi.spyOn(backend,"dispatch"),prepare=vi.fn();
    let publishedGhostAtFinalize=false;
    const handle=await startHvp(source.overrides({
      createBackend:()=>backend,createSourceSnapshot:fixture.materializeFactoryStartSite,
      factorySourceProfile:{version:"hvp-factory-startsite-v1",readColumn:fixture.readFactorySourceColumnWorld},
      createPhysics:async(...args:Parameters<NonNullable<typeof original.createPhysics>>)=>{
        const native=await original.createPhysics!(...args),read=native.read,site=args[10]!;
        type Facilities=import("../../src/hestia-prototype/physics/factoryFacilitySession").FactoryFacilityRead;
        let published:Facilities={revision:0,state:"Idle",transactionId:null,owners:[],prepared:null,
          cargo:{site,ownerId:site.ownerId,containerId:site.containerId,sourceDigest:site.sourceDigest,profileDigest:site.profileDigest,opened,positionMm:site.centerMm,accessBoundsMm:site.accessBoundsMm,bodyHandle:4,colliderHandles:[5],accessible:true,openReceipt:null}};
        let prepared:Facilities|undefined;
        let beforePrepare=published;
        const facilities=()=>({...published,cargo:{...published.cargo!,opened}});
        // This transport fixture tests Host/Resources/actual receiver admission, not a second Native install proof.
        return {...native,command:async()=>{},openFactoryCargo:async()=>{opened=true;return facilities();},
          prepareFactoryFacility:async(request:FactoryFacilityRequest)=>{
            captureWorldBytes=reportedCollisionBytes*2+(read().colliderCount+read().bodyCount)*2048;prepare(request);
            beforePrepare=published;
            const {createFactoryInstallationProfile}=await import("../../src/factory/construction/installationProfile");
            const profile=createFactoryInstallationProfile(request.definitionRef.sourceId);
            const owner={...request,sourceDigest:profile.sourceDigest,profileDigest:profile.profileDigest,
              centerMm:[request.centerMm[0]!,request.centerMm[1]!,request.centerMm[2]!] as const,
              massMg:profile.massMg,bodyHandle:20,colliderHandles:profile.colliders.map((_,index)=>100+index),installationRevision:request.expectedRevision+1};
            const proof={instanceId:owner.instanceId,definitionRef:owner.definitionRef,sourceDigest:owner.sourceDigest,profileDigest:owner.profileDigest,
              installationRevision:owner.installationRevision,terrainRevision:request.expectedTerrainRevision,facilityRevision:request.expectedRevision,
              published:false,confirmed:true,complete:true,parts:profile.source.parts.map(part=>({partId:part.partId,status:"Present" as const,
                colliderHandles:profile.colliders.flatMap((box,index)=>box.partId===part.partId?[owner.colliderHandles[index]!]:[])}))};
            prepared={...facilities(),revision:request.expectedRevision,state:"PreparedHeld",transactionId:request.transactionId,
              prepared:owner,preparedPartObservation:{...proof,observationDigest:canonicalSignature(proof)}};
            return prepared;
          },
          commitFactoryFacility:async(id:string)=>{
            if(prepared?.transactionId!==id||prepared.state!=="PreparedHeld")throw Error("Invalid fixture commit");
            const {observationDigest:_,...proof}=prepared!.preparedPartObservation!;
            const publishedProof={...proof,published:true,facilityRevision:prepared!.revision+1};
            prepared={...facilities(),revision:prepared!.revision+1,state:"PublishedHeld",transactionId:prepared!.transactionId,
              owners:[prepared!.prepared!],prepared:null,partObservations:[{...publishedProof,observationDigest:canonicalSignature(publishedProof)}]};
          },
          publishFactoryFacility:(id:string)=>{
            if(prepared?.transactionId!==id||prepared.state!=="PublishedHeld"||published===prepared)throw Error("Invalid fixture publish");
            published=prepared;
          },
          rollbackFactoryFacility:async(id:string)=>{
            if(prepared?.transactionId!==id)throw Error("Invalid fixture rollback");
            published=beforePrepare;prepared=undefined;
          },
          finalizeFactoryFacility:async(id:string)=>{
            if(id!=="legal_slot_paid_1"||published.transactionId!==id||published.state!=="PublishedHeld")throw Error("Invalid fixture finalize");
            const view=JSON.parse(source.body.dataset.hestiaFactoryPresentation??"null") as {cost?:{cpu:number};scenes?:readonly {instanceId:string;published:boolean}[]}|null;
            publishedGhostAtFinalize=Boolean(view?.scenes?.some(scene=>scene.instanceId==="ghost_slot_0"&&scene.published));
            if(publishedGhostAtFinalize&&view?.cost)publishedCosts.push(view.cost.cpu);
            published={...published,state:"Idle",transactionId:null};prepared=undefined;
          },
          read:()=>({...read(),collisionBytes:reportedCollisionBytes,player:{...read().player!,position:{x:-6.35,y:2.4,z:9.075}},factoryFacilities:facilities()})};
      },factoryExtension:async(host:FactoryHostPort)=>{port=host;session=await mountFactorySession(host,createFp02Fixture("cargo").catalog);return session;}
    }));
    try{
      await port.construction!.openCargo();
      const request={transactionId:"legal_slot_paid_1",instanceId:"ghost_slot_0",definitionSourceId:"B06",centerMm:[-6250,1500,5000],quarterTurns:1};
      expect(isSaveSafeResourceId(request.instanceId)).toBe(true);
      const before=session.construction!.read().material;
      const plan=session.construction!.preview(request);expect(plan.status).toBe("Prepared");if(plan.status!=="Prepared")throw new Error(plan.reason);
      port.construction!.projectGhost(request);
      expect(session.construction!.read().material).toBe(before);expect(prepare).not.toHaveBeenCalled();
      await expect(session.construction!.commit(plan)).resolves.toMatchObject({status:"Committed",reason:"INSTALLED"});
      expect(prepare).toHaveBeenCalledTimes(1);expect(session.construction!.read().installations[0]!.instanceId).toBe(request.instanceId);
      const artifacts=dispatch.mock.calls.flatMap(([command])=>command.kind==="UpsertMeshArtifact"?[command.artifact]:[]);
      const paid=artifacts.filter(value=>value.representationKey.startsWith("factory-play:ghost_slot_0:"));
      const ghosts=artifacts.filter(value=>value.representationKey.startsWith("factory:ghost:slot_"));
      expect(paid.length).toBeGreaterThan(0);expect(ghosts.length).toBe(paid.length);
      expect(paid.every(value=>value.attributes?.color!==undefined&&value.algorithmVersion==="factory-play-glb-vertex-colors-v1"
        &&value.materialRanges.length===1&&value.materialRanges[0]!.materialProfileId==="fp06_vertex_color")).toBe(true);
      expect(paid.every(value=>!ghosts.some(ghost=>ghost.representationKey===value.representationKey))).toBe(true);
      port.construction!.projectGhost(null);
      expect(backend.readDiagnostics().residentRepresentationKeys.filter(key=>key.startsWith("factory-play:ghost_slot_0:"))).toHaveLength(paid.length);
      expect(backend.readDiagnostics()).toMatchObject({rejectedArtifacts:0,staleRejectCount:0});
      const finalPresentation=JSON.parse(source.body.dataset.hestiaFactoryPresentation!) as {cost:{cpu:number}};
      expect(publishedGhostAtFinalize).toBe(true);
      expect(publishedCosts.length).toBeGreaterThan(0);
      const captureBytes=captureWorldBytes;
      expect(publishedCosts[0]!-finalPresentation.cost.cpu).toBeGreaterThanOrEqual(captureBytes);
    }finally{await handle.dispose();}
  });

  it("W06 R1 publishes actual unconfirmed native holds without work and permits transient recovery", async () => {
    const source = harness(), original = source.overrides()!;
    let status: FactoryHostView["physicsStatus"] = "Paused", tick = 17;
    let session!: FactorySessionHandle;
    const observations: FactoryHostView[] = [];
    const handle = await startHvp(source.overrides({
      createPhysics: async (...args: Parameters<NonNullable<typeof original.createPhysics>>) => {
        const native = await original.createPhysics!(...args), read = native.read;
        // Declared transport fixture for the current Host read contract, not Native facility admission.
        return { ...native, read: () => ({ ...read(), ticks: tick, status,
          factoryFacilities:{revision:0,state:"Idle" as const,transactionId:null,owners:[],prepared:null} }) };
      }, factoryExtension: async (host: FactoryHostPort) => {
        session = await mountFactorySession(host, createFp02Fixture("cargo").catalog);
        host.subscribeConfirmed(view => { observations.push(view); }); return session;
      }
    }));
    try {
      expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
      status = "CoverageHold"; tick = 23; stepFrame(source.windowPort, 16);
      expect(observations.at(-1)).toMatchObject({ physicsStatus: "CoverageHold", confirmed: false });
      expect(session.read()).toMatchObject({ state: "WaitingForHost", nativeTick: 17, steps: 0 });
      expect(session.isQuiescent()).toBe(true); // Neighbor repair must remain admissible.
      status = "SimulationHold"; stepFrame(source.windowPort, 32);
      expect(session.read()).toMatchObject({ state: "WaitingForHost", nativeTick: 17, steps: 0 });
      status = "Paused"; stepFrame(source.windowPort, 48);
      expect(session.read()).toMatchObject({ state: "Ready", nativeTick: 23, steps: 1 });
      status = "RecoveryHold"; tick = 29; stepFrame(source.windowPort, 64);
      expect(session.read()).toMatchObject({ state: "RecoveryHold", nativeTick: 23, steps: 1 });
      expect(session.isQuiescent()).toBe(false);
      status = "Running"; tick = 35; stepFrame(source.windowPort, 80);
      expect(session.read()).toMatchObject({ state: "RecoveryHold", nativeTick: 23, steps: 1 });
    } finally { await handle.dispose(); }
  });

  it("W06 R1 refuses all actual Factory Resume and Play paths during native holds", async () => {
    const source = harness(), original = source.overrides()!;
    const requestPointerLock = vi.fn(); Object.defineProperty(source.canvas, "requestPointerLock", { value: requestPointerLock });
    let status: FactoryHostView["physicsStatus"] = "Paused";
    let port!: FactoryHostPort;
    const commands: string[] = [];
    const handle = await startHvp(source.overrides({
      createPhysics: async (...args: Parameters<NonNullable<typeof original.createPhysics>>) => {
        const native = await original.createPhysics!(...args), read = native.read;
        return { ...native, read: () => ({ ...read(), status }), command: async (kind: string) => { commands.push(kind); } };
      }, factoryExtension: async (host: FactoryHostPort) => {
        port = host; return withTestFactoryOwnerMemory({ isQuiescent: () => true, dispose: async () => {} });
      }
    }));
    try {
      const baseline = commands.length;
      for (const hold of ["CoverageHold", "SimulationHold", "RecoveryHold"] as const) {
        status = hold;
        expect(port.read().confirmed).toBe(false);
        await expect.soft(port.resume()).rejects.toThrow(/unconfirmed|hold/i);
        expect.soft(commands).toHaveLength(baseline); commands.length = baseline;
        descendants(source.body).find(e => e.id === "hvp-physics-pause")!.dispatchEvent(new Event("click"));
        await Promise.resolve(); await Promise.resolve();
        expect.soft(commands).toHaveLength(baseline); commands.length = baseline;
        descendants(source.body).find(e => e.id === "hvp-play")!.dispatchEvent(new Event("click"));
        await Promise.resolve(); await Promise.resolve();
        expect.soft(commands).toHaveLength(baseline); commands.length = baseline;
        expect.soft(requestPointerLock).not.toHaveBeenCalled(); requestPointerLock.mockClear();
        descendants(source.body).find(e => e.textContent === "Resume game")!.dispatchEvent(new Event("click"));
        expect.soft(requestPointerLock).not.toHaveBeenCalled(); requestPointerLock.mockClear();
      }
      status = "Paused"; await port.resume(); expect(commands.at(-1)).toBe("Resume");
    } finally { await handle.dispose(); }
  });

  it("W06 R1 keeps the actual post-disposal restart in the Factory profile", async () => {
    const source = harness(), assign = vi.fn();
    Object.defineProperty(source.windowPort, "location", { value: { search: "", assign } });
    Object.defineProperty(source.windowPort, "confirm", { value: () => true });
    const handle = await startHvp(source.overrides({ factoryExtension: async () => withTestFactoryOwnerMemory({ isQuiescent: () => true, dispose: async () => {} }) }));
    try {
      descendants(source.body).find(e => e.id === "hvp-end-session")!.dispatchEvent(new Event("click"));
      await vi.waitFor(() => { expect(descendants(source.body).find(e => e.id === "hvp-ended")).toBeDefined(); });
      descendants(source.body).find(e => e.textContent === "Restart")!.dispatchEvent(new Event("click"));
      expect(assign).toHaveBeenCalledWith("/factory.html");
    } finally { await handle.dispose(); }
  });

  it("W06 R1 permits awaited session disposal from terminal RecoveryHold without resuming", async () => {
    const source = harness(), original = source.overrides()!;
    Object.defineProperty(source.windowPort, "confirm", { value: () => true });
    let tick = 0; const commands: string[] = [];
    let session!: FactorySessionHandle;
    const handle = await startHvp(source.overrides({
      createPhysics: async (...args: Parameters<NonNullable<typeof original.createPhysics>>) => {
        const native = await original.createPhysics!(...args), read = native.read;
        // Same declared empty facility fixture; real World/custody tests remain separate.
        return { ...native, read: () => ({ ...read(), ticks: tick,
          factoryFacilities:{revision:0,state:"Idle" as const,transactionId:null,owners:[],prepared:null} }), command: async (kind: string) => { commands.push(kind); } };
      }, factoryExtension: async (host: FactoryHostPort) => { session = await mountFactorySession(host, createFp02Fixture("cargo").catalog); return session; }
    }));
    try {
      expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
      tick = -1; stepFrame(source.windowPort, 16); expect(session.read().state).toBe("RecoveryHold");
      descendants(source.body).find(e => e.id === "hvp-end-session")!.dispatchEvent(new Event("click"));
      await vi.waitFor(() => { expect(descendants(source.body).find(e => e.id === "hvp-ended")).toBeDefined(); });
      expect(session.read().state).toBe("Disposed"); expect(source.counts().backendDisposals).toBe(1);
      expect(commands).not.toContain("Resume");
    } finally { await handle.dispose(); }
  });

  it("W06 R2 Drop grants no native command during holds and preserves confirmed and legacy dispatch", async () => {
    for (const factory of [true, false]) {
      const source = harness(), original = source.overrides()!;
      let status: FactoryHostView["physicsStatus"] = "Paused";
      const commands: string[] = [];
      const handle = await startHvp(source.overrides({
        createPhysics: async (...args: Parameters<NonNullable<typeof original.createPhysics>>) => {
          const native = await original.createPhysics!(...args), read = native.read;
          return { ...native, read: () => ({ ...read(), status }), command: async (kind: string) => { commands.push(kind); } };
        }, ...(factory ? { factoryExtension: async () => withTestFactoryOwnerMemory({ isQuiescent: () => true, dispose: async () => {} }) } : {})
      }));
      try {
        const drop = descendants(source.body).find(e => e.id === "hvp-physics-drop")!;
        for (const hold of ["CoverageHold", "SimulationHold", "RecoveryHold"] as const) {
          status = hold; commands.length = 0; drop.dispatchEvent(new Event("click"));
          await Promise.resolve(); await Promise.resolve();
          if (factory) expect.soft(commands, hold).toEqual([]);
          else expect(commands, `unchanged legacy ${hold}`).toEqual(["Drop"]);
        }
        status = "Paused"; commands.length = 0; drop.dispatchEvent(new Event("click"));
        await Promise.resolve(); await Promise.resolve(); expect(commands).toEqual(["Drop"]);
      } finally { await handle.dispose(); }
    }
  });

  it("reaches Ready with exactly one tick loop and disposes start/dispose exactly once", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides());

    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(1);
    expect(source.windowPort.animationFrames.size).toBe(1);

    stepFrame(source.windowPort, 16);
    expect(source.counts().renders).toBe(1);
    expect(source.windowPort.animationFrames.size).toBe(1);
    stepFrame(source.windowPort, 32);
    expect(source.counts().renders).toBe(2);
    expect(source.windowPort.animationFrames.size).toBe(1);

    await handle.dispose();
    await handle.dispose();
    expect(source.windowPort.animationFrames.size).toBe(0);
    expect(source.counts()).toEqual({ backendConstructions: 1, backendDisposals: 1, renders: 2 });
    expect(source.windowPort.listenerTotals.get("pagehide")).toBe(0);
  });

  it("fails a double mount closed with no duplicate HUD and no second backend", async () => {
    const source = harness();
    const first = await startHvp(source.overrides());

    await expect(startHvp(source.overrides())).rejects.toThrow(/already mounted/i);
    expect(source.createBackend).toHaveBeenCalledTimes(1);
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(1);

    await first.dispose();
    const second = await startHvp(source.overrides());
    expect(source.createBackend).toHaveBeenCalledTimes(2);
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(1);
    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
    await second.dispose();
  });

  it("fails a restart closed while dispose is pending and recovers after settle", async () => {
    const source = harness();
    const first = await startHvp(source.overrides());

    const pending = first.dispose();
    await expect(startHvp(source.overrides())).rejects.toThrow(/already mounted/i);
    expect(source.createBackend).toHaveBeenCalledTimes(1);

    await pending;
    const second = await startHvp(source.overrides());
    expect(source.createBackend).toHaveBeenCalledTimes(2);
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(1);
    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
    await second.dispose();
  });

  it("keeps the live session clean when the route entry fires twice", async () => {
    const source = harness();
    let handle: HvpBootstrapHandle | undefined;
    const documentPort = source.documentPort as unknown as Parameters<typeof startHvpRoute>[0];
    const loadHvp = async (): Promise<{ startHvp(): Promise<HvpBootstrapHandle> }> => ({
      startHvp: async () => (handle = await startHvp(source.overrides()))
    });

    await startHvpRoute(documentPort, loadHvp);
    await startHvpRoute(documentPort, loadHvp);

    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(1);
    expect(descendants(source.body).filter((element) => element.getAttribute("role") === "alert")).toHaveLength(0);
    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");

    await handle!.dispose();
  });

  it("never installs failure UI into a torn-down or newer mount", async () => {
    const source = harness();
    let rejectSource!: (error: Error) => void;
    const gate = new Promise<HvpCoastSourceSnapshot>((_resolve, reject) => {
      rejectSource = reject;
    });
    const pending = startHvp(source.overrides({
      createSourceSnapshot: () => gate
    }));

    source.windowPort.dispatchEvent(new Event("pagehide"));
    rejectSource(new Error("late source failure"));
    const handle = await pending;
    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });

    expect(source.body.dataset.hestiaPrototypeState).toBeUndefined();
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(0);
    expect(descendants(source.body).filter((element) => element.getAttribute("role") === "alert")).toHaveLength(0);
    expect(source.counts().renders).toBe(0);
    expect(source.windowPort.animationFrames.size).toBe(0);
    await handle.dispose();

    const retry = await startHvp(source.overrides());
    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
    await retry.dispose();
  }, 120_000);

  it("cancels a deferred source on pagehide without publishing products", async () => {
    const source = harness();
    const snapshot = materializeHvpCoastSource();
    let resolveSource!: (value: HvpCoastSourceSnapshot) => void;
    const gate = new Promise<HvpCoastSourceSnapshot>((resolve) => {
      resolveSource = resolve;
    });
    const pending = startHvp(source.overrides({
      createSourceSnapshot: () => gate
    }));

    expect(source.body.dataset.hestiaPrototypeState).toBe("Loading");
    source.windowPort.dispatchEvent(new Event("pagehide"));
    resolveSource(snapshot);
    const handle = await pending;
    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });

    expect(source.body.dataset.hestiaPrototypeState).toBeUndefined();
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(0);
    expect(descendants(source.body).filter((element) => element.getAttribute("role") === "alert")).toHaveLength(0);
    expect(source.commands.filter((command) => command.kind === "UpsertMeshArtifact")).toHaveLength(0);
    expect(source.counts().renders).toBe(0);
    expect(source.windowPort.animationFrames.size).toBe(0);
    await handle.dispose();

    const retry = await startHvp(source.overrides());
    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
    await retry.dispose();
  }, 120_000);

  it("does not let a late failure teardown wipe a newer mount", async () => {
    const source = harness();
    let rejectFirst!: (error: Error) => void;
    const gate = new Promise<HvpCoastSourceSnapshot>((_resolve, reject) => {
      rejectFirst = reject;
    });
    const firstPending = startHvp(source.overrides({
      createSourceSnapshot: () => gate
    }));
    source.windowPort.dispatchEvent(new Event("pagehide"));
    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });

    const second = await startHvp(source.overrides());
    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");

    rejectFirst(new Error("late source failure"));
    const firstHandle = await firstPending;
    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });

    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(1);
    expect(descendants(source.body).filter((element) => element.getAttribute("role") === "alert")).toHaveLength(0);
    await firstHandle.dispose();
    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
    await second.dispose();
  }, 180_000);

  it("rejects over-cap scenes before attaching products or reaching Ready", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides({
      resourceCaps: { maxTriangles: 100 }
    }));

    expect(source.body.dataset.hestiaPrototypeState).toBe("Error");
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(0);
    expect(source.commands.filter((command) => command.kind === "UpsertMeshArtifact")).toHaveLength(0);
    expect(source.counts().renders).toBe(0);
    expect(source.windowPort.animationFrames.size).toBe(0);
    await handle.dispose();

    const retry = await startHvp(source.overrides());
    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
    await retry.dispose();
  }, 180_000);

  it("rejects malformed look ranges instead of falling back to vertex zero", () => {
    const look = createHvpLookProfile("readable");    const mesh = meshHvpTestCells(
      [
        { x: 0, y: 0, z: 0, slot: HVP_SLOT_LIMESTONE_DRY },
        { x: 1, y: 0, z: 0, slot: HVP_SLOT_LIMESTONE_WET },
        { x: 0, y: 0, z: 1, slot: HVP_SLOT_SOIL },
        { x: 1, y: 0, z: 1, slot: HVP_SLOT_MOSS }
      ],
      1
    );
    const grouped = createHvpCompactLookTerrain(mesh, look);
    expect(grouped.materialRanges).toHaveLength(4);
    const corrupt = {
      ...mesh,
      materialRanges: [{ slot: 1, startIndex: 999_999_999, indexCount: 6 }]
    };
    expect(() => createHvpCompactLookTerrain(corrupt, look)).toThrow();
  });

  it("groups partial proxy roles in order while strict mode still rejects them", () => {
    const look = createHvpLookProfile("readable");
    const partial = meshHvpTestCells(
      [
        { x: 0, y: 0, z: 0, slot: HVP_SLOT_LIMESTONE_DRY },
        { x: 1, y: 0, z: 0, slot: HVP_SLOT_LIMESTONE_WET }
      ],
      1
    );
    expect(() => createHvpCompactLookTerrain(partial, look)).toThrow(/empty/i);
    const grouped = createHvpCompactLookTerrain(partial, look, { allowPartialRoles: true });
    expect(grouped.materialRanges.map((range) => range.materialProfileId)).toEqual([
      "hvp:look:limestone-dry",
      "hvp:look:limestone-wet"
    ]);
    expect(grouped.materialRanges.reduce((total, range) => total + range.indexCount, 0))
      .toBe(grouped.indices.length);
    expect(grouped.materialProfiles.map((profile) => profile.id)).toEqual([
      "hvp:look:limestone-dry",
      "hvp:look:limestone-wet"
    ]);
  });

  it("exposes a real Inspect-only AO toggle defaulting to on", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides());
    try {
      expect(source.body.dataset.hestiaPrototypeAo).toBe("on");
      const elements = source.body.children.flatMap((child) => [child, ...descendants(child)]);
      const aoButton = elements.find((element) => element.id === "hvp-ao-toggle");
      expect(aoButton?.textContent).toBe("AO: on");
      expect(aoButton?.getAttribute("aria-pressed")).toBe("true");
      const commandsBefore = source.commands.length;
      const terrainBefore = source.commands.filter((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
        command.kind === "UpsertMeshArtifact" && command.artifact.representationKey.startsWith("hvp:terrain:s")
      );
      expect(terrainBefore).toHaveLength(16);
      const positionsBefore = terrainBefore.map(c=>[...c.artifact.positions]);
      aoButton?.dispatchEvent(new Event("click"));
      expect(aoButton?.textContent).toBe("AO: off");
      expect(aoButton?.getAttribute("aria-pressed")).toBe("false");
      expect(source.body.dataset.hestiaPrototypeAo).toBe("off");
      aoButton?.dispatchEvent(new Event("click"));
      expect(aoButton?.textContent).toBe("AO: on");
      expect(source.body.dataset.hestiaPrototypeAo).toBe("on");
      // Render-only toggle: no new scene products, geometry bytes untouched.
      expect(source.commands.length).toBe(commandsBefore);
      const terrainAfter = source.commands.filter((command): command is Extract<RenderCommand, { kind: "UpsertMeshArtifact" }> =>
        command.kind === "UpsertMeshArtifact" && command.artifact.representationKey.startsWith("hvp:terrain:s")
      );
      expect(terrainAfter.map(c=>[...c.artifact.positions])).toEqual(positionsBefore);
    } finally {
      await handle.dispose();
    }
  });

  it("swaps whole material arrays on toggle without mutating cached instances", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides());
    try {
      const root = source.backend.representationRoot;
      const terrainNode = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
      const terrain = source.commands.find((c):c is Extract<RenderCommand,{kind:"UpsertMeshArtifact"}>=>c.kind==="UpsertMeshArtifact"&&c.artifact.representationKey.startsWith("hvp:terrain:s"))!;
      expect(terrain).toBeDefined();
      terrainNode.name = `representation:${terrain.artifact.representationKey}`;
      const originals = [...(Array.isArray(terrainNode.material) ? terrainNode.material : [terrainNode.material])];
      root.add(terrainNode);
      const woodNodes = source.commands.flatMap((command) => {
        if (command.kind !== "UpsertMeshArtifact" || !command.artifact.representationKey.endsWith(":wood")) { return []; }
        const material = new THREE.MeshBasicMaterial({vertexColors:true});
        const node = new THREE.Mesh(new THREE.BufferGeometry(), material);
        node.name = `representation:${command.artifact.representationKey}`;
        root.add(node);
        return [{node,material}];
      });
      expect(woodNodes).toHaveLength(4);
      const elements = source.body.children.flatMap((child) => [child, ...descendants(child)]);
      const aoButton = elements.find((element) => element.id === "hvp-ao-toggle");
      aoButton?.dispatchEvent(new Event("click"));
      const offMaterials = Array.isArray(terrainNode.material) ? terrainNode.material : [terrainNode.material];
      expect(offMaterials).toHaveLength(terrain.materialProfiles.length);
      expect(offMaterials).not.toEqual(originals);
      for (const material of offMaterials) {
        expect((material as { vertexColors?: boolean }).vertexColors).toBe(false);
      }
      for (const {node,material} of woodNodes) {
        const uncolored = node.material as unknown as THREE.MeshBasicMaterial[];
        expect(uncolored).toHaveLength(1);
        expect(uncolored[0]!.vertexColors).toBe(false);
        expect(uncolored[0]).not.toBe(material);
      }
      aoButton?.dispatchEvent(new Event("click"));
      expect([...(Array.isArray(terrainNode.material) ? terrainNode.material : [terrainNode.material])]).toEqual(originals);
      for (const {node,material} of woodNodes) {
        expect(node.material).toEqual([material]);
        root.remove(node);
        node.geometry.dispose();
        material.dispose();
      }
      root.remove(terrainNode);
      terrainNode.geometry.dispose();
      originals.forEach((material) => material.dispose());
    } finally {
      await handle.dispose();
    }
  });

  it("separates retired initial-build scratch from live replacement working memory without raising caps",()=>{
    const mib=1024*1024,before={totalCpuBytes:250*mib,tempEstimateBytes:150*mib},after={totalCpuBytes:251*mib,tempEstimateBytes:149*mib};
    const totalCpuBytes=estimateHvpStageCpuBytes(before,after,2*mib,96*mib);
    expect(totalCpuBytes).toBe(204*mib); // 102 retained + 6 old/new/index coexistence + 96 preparation.
    expect(()=>admitHvpResources({totalCpuBytes,retainedMeshBytes:30*mib,triangles:400_000,drawCalls:200})).not.toThrow();
    expect(()=>admitHvpResources({totalCpuBytes:estimateHvpStageCpuBytes(before,after,20*mib,96*mib),
      retainedMeshBytes:30*mib,triangles:400_000,drawCalls:200})).toThrow(/BudgetExceeded/);
    expect(HVP_RESOURCE_CAPS_DEFAULT.maxCpuBytes).toBe(256*mib);
  });
  it("MEMORY-R01 replaces expired startup mesher scratch with Native prepare reserve during Factory admission and still rejects genuine CPU excess",async()=>{
    const observedWithoutFactory=268_626_378,mesherScratch=149_622_408,prepareReserve=96*1024*1024;
    const observedLedger={totalCpuBytes:observedWithoutFactory,tempEstimateBytes:mesherScratch,factoryCpuBytes:1_839_280};
    const fifthFacilityTotal=estimateHvpStageCpuBytes(observedLedger,observedLedger,0,prepareReserve)-observedLedger.factoryCpuBytes+1_839_280;
    expect(fifthFacilityTotal).toBe(219_667_266);
    expect(HVP_RESOURCE_CAPS_DEFAULT.maxCpuBytes).toBe(268_435_456);
    expect(()=>admitHvpResources({totalCpuBytes:fifthFacilityTotal,retainedMeshBytes:30*1024*1024,triangles:400_000,drawCalls:200})).not.toThrow();

    const f=await factoryCarrierHostFixture();
    try{
      const {ledger}=JSON.parse(f.source.body.dataset.hestiaPrototypeResources!) as {ledger:{tempEstimateBytes:number;physicsPrepareBytes:number}};
      expect(ledger.tempEstimateBytes).toBeGreaterThan(ledger.physicsPrepareBytes);
      const {createFactoryInstallationProfile}=await import("../../src/factory/construction/installationProfile");
      const profile=createFactoryInstallationProfile("B06");
      const req={transactionId:"mem_r01_cut",instanceId:"mem_r01_cut",definitionSourceId:"B06",centerMm:[-6250,1500,5000],quarterTurns:1,ownerId:"mem_r01_cut",definitionRef:profile.definitionRef,profileDigest:profile.profileDigest,expectedRevision:0,expectedTerrainRevision:0,materialBinding:"finite-memory-r01-fixture"};
      const ghost={transactionId:"mem_r01_ghost",instanceId:"ghost_slot_0",definitionSourceId:"B06",centerMm:[-6250,1500,5000],quarterTurns:1};
      const presentationCpu=()=> (JSON.parse(f.source.body.dataset.hestiaFactoryPresentation!) as {cost:{cpu:number}}).cost.cpu;
      f.port.construction!.projectGhost(ghost);const baselineCpu=presentationCpu();
      f.setCollisionBytes(64*1024*1024);
      await expect(f.port.construction!.prepareNative(req)).rejects.toThrow(/BudgetExceeded/);
      f.setCollisionBytes(24*1024*1024);
      await expect(f.port.construction!.prepareNative(req)).resolves.toMatchObject({state:"PreparedHeld",transactionId:"mem_r01_cut"});
      f.port.construction!.projectGhost(ghost);const captureHeldCpu=presentationCpu();
      await f.port.construction!.rollbackNative(req.transactionId);
      f.port.construction!.projectGhost(ghost);expect(presentationCpu()).toBe(captureHeldCpu);
      f.port.construction!.rollbackProjection(req.transactionId);
      f.port.construction!.projectGhost(ghost);expect(presentationCpu()).toBe(baselineCpu);
    }finally{await f.handle.dispose();}
  });

  it("MEMORY-R03 retains an installation capture after a raw Native rollback error",async()=>{
    const f=await factoryCarrierHostFixture();
    try{
      const {createFactoryInstallationProfile}=await import("../../src/factory/construction/installationProfile");
      const profile=createFactoryInstallationProfile("B06"),ghost={transactionId:"mem_r03_ghost",instanceId:"ghost_slot_0",definitionSourceId:"B06",centerMm:[-6250,1500,5000],quarterTurns:1};
      const request={transactionId:"mem_r03_uncertain",instanceId:"mem_r03_uncertain",definitionSourceId:"B06",centerMm:[-6250,1500,5000],quarterTurns:1,
        ownerId:"mem_r03_uncertain",definitionRef:profile.definitionRef,profileDigest:profile.profileDigest,expectedRevision:0,expectedTerrainRevision:0,materialBinding:"finite-memory-r03-fixture"};
      const presentationCpu=()=> (JSON.parse(f.source.body.dataset.hestiaFactoryPresentation!) as {cost:{cpu:number}}).cost.cpu;
      f.port.construction!.projectGhost(ghost);const baselineCpu=presentationCpu();
      f.setCollisionBytes(4*1024*1024);f.setUncertainPrepare();
      await expect(f.port.construction!.prepareNative(request)).rejects.toThrow(/rollback response lost/i);
      f.port.construction!.projectGhost(ghost);
      expect(presentationCpu()-baselineCpu).toBeGreaterThan(8*1024*1024);
    }finally{await f.handle.dispose();}
  });

  it("accounts exact ledger bytes from known inputs and rejects just below total", () => {
    const ledger = buildHvpResourceLedger({
      terrainMesh: {
          faceCount: 2,
          unitFaceCount: 2,
          outerFaceCount: 2,
          cavityFaceCount: 0,
          positions: new Float32Array(24),
          normals: new Float32Array(24),
          indices: new Uint16Array(12),
          colors: null,
          materialRanges: [{ slot: 1, startIndex: 0, indexCount: 12 }],
          boundsMeters: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
          sourceDigest: "00000000",
          algorithmVersion: "test-ledger-v1",
          tempEstimateBytes: 100
        },
        waterMesh: {
          faceCount: 1,
          unitFaceCount: 1,
          outerFaceCount: 1,
          cavityFaceCount: 0,
          positions: new Float32Array(12),
          normals: new Float32Array(12),
          indices: new Uint16Array(6),
          colors: null,
          materialRanges: [{ slot: 1, startIndex: 0, indexCount: 6 }],
          boundsMeters: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 0, z: 1 } },
          sourceDigest: "00000000",
          algorithmVersion: "test-ledger-v1",
          tempEstimateBytes: 50
        },
        joinMesh: {
          faceCount: 0,
          unitFaceCount: 0,
          outerFaceCount: 0,
          cavityFaceCount: 0,
          positions: new Float32Array(0),
          normals: new Float32Array(0),
          indices: new Uint16Array(0),
          colors: null,
          materialRanges: [],
          boundsMeters: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
          sourceDigest: "00000000",
          algorithmVersion: "test-ledger-v1",
          tempEstimateBytes: 0
        },
        farMesh: {
          faceCount: 1,
          unitFaceCount: 1,
          outerFaceCount: 1,
          cavityFaceCount: 0,
          positions: new Float32Array(12),
          normals: new Float32Array(12),
          indices: new Uint16Array(6),
          colors: null,
          materialRanges: [{ slot: 1, startIndex: 0, indexCount: 6 }],
          boundsMeters: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 0, z: 1 } },
          sourceDigest: "00000000",
          algorithmVersion: "test-ledger-v1",
          tempEstimateBytes: 0
        },
        groupedIndexBytes: 48,
        drawCalls: 2
      });
      expect(ledger.meshBytes).toBe(
        (96 + 96 + 24) + 2 * (48 + 48 + 12)
      );
      // Far is dispatched through UpsertMeshArtifact too, not wrapped directly.
      expect(ledger.artifactCopyBytes).toBe((96 + 96 + 24) + 2 * (48 + 48 + 12));
      expect(ledger.maskBytes).toBe(256 * 256 + 320 * 320 + 960 * 960);
      expect(ledger.retainedMeshBytes).toBe(ledger.artifactCopyBytes);
      expect(ledger.triangles).toBe(4 + 2 + 2);
      expect(ledger.drawCalls).toBe(2);
      expect(ledger.gpuBytes).toBe("unsupported");
      expect(ledger.totalCpuBytes).toBe(
        ledger.slotBytes + ledger.preparedCopyBytes + ledger.maskBytes + ledger.meshBytes
        + ledger.groupedIndexBytes + ledger.artifactCopyBytes + ledger.tempEstimateBytes
      );
      expect(() => admitHvpResources(ledger, HVP_RESOURCE_CAPS_DEFAULT)).not.toThrow();
      expect(() => admitHvpResources(ledger, {
        ...HVP_RESOURCE_CAPS_DEFAULT,
        maxCpuBytes: ledger.totalCpuBytes - 1
      })).toThrow(/BudgetExceeded/);
      expect(() => admitHvpResources(ledger, {
        ...HVP_RESOURCE_CAPS_DEFAULT,
        maxTriangles: ledger.triangles - 1
      })).toThrow(/BudgetExceeded/);
      expect(() => admitHvpResources(ledger, {
        ...HVP_RESOURCE_CAPS_DEFAULT,
        maxMeshBytes: ledger.retainedMeshBytes - 1
      })).toThrow(/BudgetExceeded/);
  });

  it("rejects a World missing the planned inertia specimen before publishing meshes",async()=>{
    const source=harness();const options=source.overrides()!;
    const handle=await startHvp({...options,createPhysics:async(...args)=>{
      const client=await options.createPhysics!(...args);
      return {...client,read:()=>({...client.read(),inertia:null})};
    }});
    expect(source.body.dataset.hestiaPrototypeState).toBe("Error");
    expect(source.commands.some(c=>c.kind==="UpsertMeshArtifact")).toBe(false);
    await handle.dispose();
  });

  it("never reaches Ready on an invalid source and stays fail-closed", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides({
      createSourceSnapshot: async () => ({
        version: "hvp-authored-coast-v999",
        seedName: "invalid-seed",
        registryDigest: "deadbeef",
        sourceDigest: "deadbeef",
        sizeX: 0,
        sizeY: 0,
        sizeZ: 0,
        cellMeters: 0.125,
        originMeters: { x: -16, y: -8, z: -16 },
        readSlot: () => 0,
        copySlots: () => new Uint8Array(0)
      })
    }));

    expect(source.body.dataset.hestiaPrototypeState).toBe("Error");
    expect(descendants(source.body).filter((element) => element.id === "hvp-hud")).toHaveLength(0);
    const alert = descendants(source.body).find((element) => element.getAttribute("role") === "alert");
    expect(alert?.id).toBe("hvp-failure");
    expect(alert?.getAttribute("aria-live")).toBe("assertive");
    expect(source.counts().renders).toBe(0);
    expect(source.windowPort.animationFrames.size).toBe(0);

    await handle.dispose();
    const retry = await startHvp(source.overrides());
    expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
    await retry.dispose();
  });

  it("hides the leftover flight reticle on entry and restores it on dispose", async () => {
    const source = harness();
    const reticle = source.documentPort.querySelector(".hud-center-safe-area") as unknown as FakeElement;
    expect(reticle.getAttribute("style")).toBeNull();
    const handle = await startHvp(source.overrides());
    try {
      expect(source.body.dataset.hestiaPrototypeState).toBe("Ready");
      expect(reticle.getAttribute("style")).toContain("display:none");
    } finally {
      await handle.dispose();
    }
    expect(reticle.getAttribute("style")).toBeNull();
  });

  it("restores the flight reticle when the HVP start fails closed", async () => {
    const source = harness();
    const reticle = source.documentPort.querySelector(".hud-center-safe-area") as unknown as FakeElement;
    const handle = await startHvp(source.overrides({
      createBackend: () => ({ ...source.backend, scene: undefined })
    }));
    expect(source.body.dataset.hestiaPrototypeState).toBe("Error");
    expect(reticle.getAttribute("style")).toBeNull();
    await handle.dispose();
  });

  it("exposes an accessible HUD hide control and a labeled camera inspection mode", async () => {
    const source = harness();
    const handle = await startHvp(source.overrides());
    try {
      const elements = source.body.children.flatMap((child) => [child, ...descendants(child)]);
      const hideButton = elements.find((element) => element.id === "hvp-hide-ui");
      const inspectButton = elements.find((element) => element.id === "hvp-camera-inspect");
      expect(hideButton?.textContent).toBe("Hide UI");
      expect(hideButton?.getAttribute("aria-pressed")).toBe("false");
      expect(inspectButton?.textContent).toBe("Inspect: off");
      expect(inspectButton?.getAttribute("aria-pressed")).toBe("false");
      const originalInspectStyle = inspectButton?.getAttribute("style");
      expect(originalInspectStyle).toBe("margin:6px 6px 0 0;pointer-events:auto");

      hideButton?.dispatchEvent(new Event("click"));
      expect(hideButton?.textContent).toBe("Show UI");
      expect(hideButton?.getAttribute("aria-pressed")).toBe("true");
      const statePanel = elements.find((element) => element.id === "hvp-state");
      expect(statePanel?.hasAttribute("hidden")).toBe(true);
      expect(inspectButton?.hasAttribute("hidden")).toBe(true);
      expect(inspectButton?.getAttribute("style")).toBe(originalInspectStyle);
      expect(hideButton?.hasAttribute("hidden")).toBe(false);
      hideButton?.dispatchEvent(new Event("click"));
      expect(hideButton?.textContent).toBe("Hide UI");
      expect(statePanel?.getAttribute("style")).toBeNull();
      expect(statePanel?.hasAttribute("hidden")).toBe(false);
      expect(inspectButton?.hasAttribute("hidden")).toBe(false);
      expect(inspectButton?.getAttribute("style")).toBe(originalInspectStyle);

      inspectButton?.dispatchEvent(new Event("click"));
      expect(inspectButton?.textContent).toBe("Inspect: on");
      expect(source.body.children.flatMap((child) => [child, ...descendants(child)])
        .find((element) => element.id === "hvp-mode")?.textContent).toContain("(Fly)");
      inspectButton?.dispatchEvent(new Event("click"));
      expect(inspectButton?.textContent).toBe("Inspect: off");
      expect(source.body.children.flatMap((child) => [child, ...descendants(child)])
        .find((element) => element.id === "hvp-mode")?.textContent).toContain("(Orbit)");
    } finally {
      await handle.dispose();
    }
  });
  it("publishes save busy and rejection immediately without waiting for a render frame",async()=>{
    const source=harness(),handle=await startHvp(source.overrides());
    try{
      const save=source.body.children.flatMap(child=>[child,...descendants(child)]).find(e=>e.id==="hvp-save")!;
      expect(save).toBeDefined();save.dispatchEvent(new Event("click"));
      expect(JSON.parse(source.body.dataset.hestiaPrototypeSave!).state).toBe("Saving");
      // Transport fixture deliberately has no checkpoint method: exercise the
      // error boundary, not a fake successful persistence operation.
      await vi.waitFor(()=>expect(JSON.parse(source.body.dataset.hestiaPrototypeSave!).state).toBe("Rejected"));
      expect(source.counts().renders).toBe(0);
    }finally{await handle.dispose();}
  });

it("PLAY04 Host exposes a separate exact SimulationHold acknowledgement while ordinary Play and Resume stay blocked",async()=>{
 const source=harness(),original=source.overrides()!;let status:FactoryHostView["physicsStatus"]="Paused",port!:FactoryHostPort,resetCalls=0;
 const requestPointerLock=vi.fn();Object.defineProperty(source.canvas,"requestPointerLock",{value:requestPointerLock});
 const handle=await startHvp(source.overrides({
  createPhysics:async(...args:Parameters<NonNullable<typeof original.createPhysics>>)=>{
   const native=await original.createPhysics!(...args),read=native.read;
   return {...native,read:()=>({...read(),status,terrainTransaction:"Idle",neighborTransaction:"Idle",bodyResidencyTransaction:"Idle",moving:{state:"Idle"},factoryFacilities:{revision:0,state:"Idle" as const,transactionId:null,owners:[],prepared:null}}),
    lifecycle:()=>({factoryInput:{enabled:true,pendingIds:[],desiredLevel:{x:0,z:0,sprint:false,jump:false},commandDepth:0,closing:false}}),
    recoverFactorySimulationHold:async(expectedTick:number)=>{expect(expectedTick).toBe(read().ticks);resetCalls++;status="Paused";}} as any;
  },factoryExtension:async(host:FactoryHostPort)=>{port=host;return mountFactorySession(host,createFp02Fixture("cargo").catalog);}
 }));
 try{
  status="SimulationHold";stepFrame(source.windowPort,16);const recovery=port as FactoryHostPort&{recoverSimulationHold:()=>Promise<FactoryHostView>};
  expect((port.read() as FactoryHostView&{simulationRecoveryAvailable?:boolean}).simulationRecoveryAvailable).toBe(true);expect(port.read().confirmed).toBe(false);
  await expect(port.resume()).rejects.toThrow(/unconfirmed|hold/);await expect(port.play!()).rejects.toThrow(/unconfirmed|hold/);
  await expect(Promise.resolve().then(()=>recovery.recoverSimulationHold())).resolves.toMatchObject({physicsStatus:"Paused",confirmed:true});
  expect(resetCalls).toBe(1);expect(requestPointerLock).not.toHaveBeenCalled();
  for(const hold of ["CoverageHold","RecoveryHold"] as const){status=hold;await expect(recovery.recoverSimulationHold()).rejects.toThrow(/unavailable|unconfirmed|hold/);expect(resetCalls).toBe(1);}
  status="SimulationHold";Object.defineProperty(source.documentPort,"hidden",{value:true,configurable:true});await expect(recovery.recoverSimulationHold()).rejects.toThrow(/unavailable|unconfirmed|hold/);expect(resetCalls).toBe(1);
 }finally{await handle.dispose();}
});
it("PLAY04 recovery cannot clear a newer focus Pause awaiting its own native ACK",async()=>{
 const source=harness(),original=source.overrides()!;let status:FactoryHostView["physicsStatus"]="Paused",port!:FactoryHostPort,recovering=false,releasePause!:()=>void;
 const focusAck=new Promise<void>(resolve=>{releasePause=resolve;});
 const handle=await startHvp(source.overrides({
  createPhysics:async(...args:Parameters<NonNullable<typeof original.createPhysics>>)=>{
   const native=await original.createPhysics!(...args),read=native.read;
   return {...native,read:()=>({...read(),status,terrainTransaction:"Idle",neighborTransaction:"Idle",bodyResidencyTransaction:"Idle",moving:{state:"Idle"},factoryFacilities:{revision:0,state:"Idle",transactionId:null,owners:[],prepared:null}}),
    command:async(kind:string)=>{if(kind==="Pause"&&recovering)await focusAck;},
    lifecycle:()=>({factoryInput:{enabled:true,pendingIds:[],desiredLevel:{x:0,z:0,sprint:false,jump:false},commandDepth:0,closing:false}}),
    recoverFactorySimulationHold:async()=>{status="Paused";}} as any;
  },factoryExtension:async(host:FactoryHostPort)=>{
   port=host;const session=await mountFactorySession(host,createFp02Fixture("cargo").catalog);
   session.subscribe(view=>{if(recovering&&view.state==="Ready")host.setSurface!("pause",{sessionId:view.sessionId,epoch:view.epoch});});
   return session;
  }
 }));
 try{
  status="SimulationHold";stepFrame(source.windowPort,16);recovering=true;
  await port.recoverSimulationHold!();
  expect(port.read()).toMatchObject({physicsStatus:"Paused",confirmed:false,input:{pausePending:true}});
  await expect(port.resume()).rejects.toThrow(/unconfirmed|hold/);await expect(port.play!()).rejects.toThrow(/unconfirmed|hold/);
  releasePause();await focusAck;await Promise.resolve();
  expect(port.read()).toMatchObject({physicsStatus:"Paused",confirmed:true,input:{pausePending:false}});
 }finally{releasePause();await handle.dispose();}
});

it("charges warm Hull metadata before a cold Factory store read",async()=>{
 const hullLoader=await import("../../src/factory/presentation/playAssetLoader");
 await hullLoader.readFactoryHullMetadata();
 expect(hullLoader.readLoadedHullMetadataBytes()).toBe(42_578);
 const source=harness(),original=source.overrides()!;
 Object.defineProperty(source.windowPort,"location",{value:{search:"?factoryLoad=primary"}});
 const store={initialize:vi.fn(async()=>{}),list:vi.fn(async()=>({slots:[]})),
  load:vi.fn(async()=>{throw Error("cold Factory load must not run before full admission");}),
  save:vi.fn(async()=>{throw Error("unexpected Factory write");}),close:vi.fn(async()=>{})};
 const createStore=vi.fn(()=>store);
 vi.doMock("../../src/factory/persistence/factorySaveStore",()=>({createFactorySaveStore:createStore}));
 let nativeCalls=0,handle:HvpBootstrapHandle|undefined;
 try{
  handle=await startHvp(source.overrides({resourceCaps:{maxCpuBytes:256*1024*1024-1},
   factoryExtension:async()=>withTestFactoryOwnerMemory({isQuiescent:()=>true,dispose:async()=>{}}),
   createPhysics:async(...args:Parameters<NonNullable<typeof original.createPhysics>>)=>{
    nativeCalls++;return original.createPhysics!(...args);
   }}));
  const alert=descendants(source.body).find(element=>element.textContent.startsWith("Technical initialization failure:"))?.textContent;
  expect(source.body.dataset.hestiaPrototypeState).toBe("Error");
  expect(alert).toMatch(/HVP scene BudgetExceeded: .* CPU bytes exceed/);
  expect(createStore).not.toHaveBeenCalled();
  expect(store.initialize).not.toHaveBeenCalled();
  expect(store.load).not.toHaveBeenCalled();
  expect(nativeCalls).toBe(0);
  expect(hullFetches).toBe(0);
  expect(source.commands.some(command=>command.kind==="UpsertMeshArtifact"
   &&command.artifact.representationKey.startsWith("factory-play:factory_hull:crashsite:"))).toBe(false);
 }finally{
  if(handle)await handle.dispose();
  vi.doUnmock("../../src/factory/persistence/factorySaveStore");
 }
});

describe("COLD_PLANT_SOURCE_R01",()=>{
  type ColdPlantFixture=Readonly<{
    source:ReturnType<typeof materializeFactoryStartSiteV5>;
    decoded:ReturnType<typeof decodeStoredFactoryCheckpoint>;
    owner:ReturnType<typeof readFactoryDecodedOwner>;
    payloadBytes:number;
    plantBytes:number;
  }>;
  let coldPlantFixture:ColdPlantFixture;
  let coldPlantPhysics:Awaited<ReturnType<typeof createHvpPhysicsSession>>|undefined;

  beforeAll(async()=>{
    const source=materializeFactoryStartSiteV5();
    const root=createHvpTerrainRoot(source,"hvp-cold-plant-r01",2);
    const vegetationProfile={version:"hvp-factory-vegetation-v1" as const,readColumn:readFactorySourceColumnWorldV5};
    const planned=planHvpVegetation(undefined,vegetationProfile);
    const invalid=planned.filter(plant=>!isHvpPlantHabitat(plant.kind,plant.position.x,plant.position.z,vegetationProfile));
    const removed=invalid[0];
    if(planned.length!==97||invalid.length!==1||removed?.id!=="hvp:flora:bed-52-220"
      ||removed.kind!=="broadleaf"||removed.variant!==1||removed.position.x!==-9.5||removed.position.y!==2.5||removed.position.z!==11.5){
      throw Error("Factory V5 plant fixture differs from its checked habitat delta");
    }
    const plantSources=planned.filter(plant=>plant!==removed).map(plant=>buildHvpPlant(plant,vegetationProfile));
    const plantBytes=plantSources.reduce((bytes,plant)=>bytes+(plant.wood?.byteLength??0)+plant.decoration.byteLength,0);
    if(plantSources.length!==96||plantBytes!==5_227_968)throw Error("Factory V5 cold plant fixture size changed");
    coldPlantPhysics=await createHvpPhysicsSession([...collisionSectors(root.read())],{x:-9,y:8,z:-9},resolveHvpGravity(),
      {spawn:{x:-9,y:2.42,z:-11},coverage:[{minX:-16,maxX:16,minZ:-16,maxZ:16}]},
      {x:-9,y:readFactorySourceColumnWorldV5(-9,-13).topMeters+1.25,z:-13},
      {x:-12,y:readFactorySourceColumnWorldV5(-12,-13.5).topMeters,z:-13.5},"worker-hvp-cold-plant-r01");
    coldPlantPhysics.pause();

    const catalogFixture=createFp02Fixture("cargo");
    const buffer=createResourceContainerSnapshot(createResourceContainerDefinition({containerId:"cold_plant_buffer",kind:"OutpostStorage",maxMassKg:10,maxVolumeM3:1,maxStackCount:20}),
      createResourceContainerState({containerId:"cold_plant_buffer",ownerId:catalogFixture.resourceState.ownerId,contents:[]},catalogFixture.catalog.resources),catalogFixture.catalog.resources);
    const cargo=createResourceContainerSnapshot(createResourceContainerDefinition({containerId:catalogFixture.resourceState.containerId,kind:"ShipCargo",maxMassKg:4000,maxVolumeM3:30,maxStackCount:200}),
      catalogFixture.resourceState,catalogFixture.catalog.resources);
    const materialView=createFactoryMaterialView(catalogFixture.catalog,[cargo,buffer]);
    const sessionId=root.read().sessionId,epoch=root.read().epoch;
    const binding={sessionId:bindFactoryDomainSession(sessionId).domainSessionId,epoch,netRevision:0,
      catalogDigest:catalogFixture.catalog.catalogDigest,sourceProfileDigest:FACTORY_POWER_POLICY.sourceObservationVersion};
    const material={version:"fp06-material-owner-v1" as const,catalogDigest:materialView.catalog.catalogDigest,revision:materialView.revision,
      containers:materialView.containers.map(container=>({definition:container.definition,state:container.state})),
      reservations:materialView.reservations,receipts:materialView.receipts};
    const site=createFactoryCargoSite(source);
    const checkpoint=encodeFactoryCheckpointV2({
      host:{sessionId,epoch,nativeTick:coldPlantPhysics.read().ticks,remainderTicks:0,steps:0},
      native:{version:"fp06-native-core-checkpoint-v1",profiles:FACTORY_COMBINED_SAVE_PROFILES.native,terrain:root.checkpoint(),
        plants:plantSources.map(encodeHvpPlant),world:coldPlantPhysics.checkpoint(),
        receipts:{terrain:{version:"hvp-command-receipts-v1",kind:"terrain",entries:[],last:null},
          structural:{version:"hvp-command-receipts-v1",kind:"structural",entries:[],last:null},
          moving:{version:"hvp-command-receipts-v1",kind:"moving",entries:[],last:null}},
        view:{camera:{mode:"Fly",preset:"C04-WIDE",fov:55,position:{x:-24.123456789,y:18.234567891,z:-28.345678912},target:{x:-24.123456789,y:18.234567891,z:-18.345678912},quaternion:{x:1,y:0,z:0,w:Math.cos(Math.PI/2)}},
          playerYaw:Math.PI,playerPitch:0,thirdPerson:false,waterEnabled:true,aoEnabled:true,tool:{mode:2,sequence:0,structureSequence:0,movingSequence:0,edges:0}},
        progress:null,neighbor:null},
      nativeFactory:{version:"fp06-native-factory-parts-v1",revision:0,state:"Idle",transactionId:null,prepared:null,
        cargo:{ownerId:site.ownerId,containerId:site.containerId,opened:false,sourceDigest:site.sourceDigest,profileDigest:site.profileDigest,site,openReceipt:null},
        carrier:null,owners:[],completedTransactionIds:[]},
      factory:{version:"fp06-factory-session-owner-v2",installations:[],material,
        domain:{binding,revision:0,tickEndUs:"0",power:{version:"fp06-factory-power-v1",binding,revision:0,tickEndUs:"0",battery:null,consumers:[]},machines:[],belts:[],lastStep:null},
        lastPower:null,links:[],recipeSelections:[],waitingStarts:[],commandReceipts:[],lastReceipt:null,publicationRevision:0} as FactorySessionCheckpointV2
    });
    const decoded=decodeStoredFactoryCheckpoint(JSON.parse(JSON.stringify(checkpoint)));
    coldPlantFixture={source,decoded,owner:readFactoryDecodedOwner(decoded),payloadBytes:new TextEncoder().encode(canonicalJson(checkpoint)).byteLength,plantBytes};
  });

  afterAll(async()=>{await coldPlantPhysics?.dispose();});

  it("charges the exact adopted Factory plant generation once through scene and residual admission",async()=>{
    const fixture=coldPlantFixture,source=harness(),original=source.overrides()!;
    Object.defineProperty(source.windowPort,"location",{value:{search:"?factoryLoad=primary&hvpMeasure=1"}});
    const dispatch=source.backend.dispatch;
    vi.spyOn(source.backend,"dispatch").mockImplementation(command=>{
      if(command.kind==="ApplyFrameProjection")applyCameraProjection(source.camera,command.snapshot);
      return dispatch(command);
    });
    const resourceSnapshots:string[]=[];
    Object.defineProperty(source.body.dataset,"hestiaPrototypeResources",{configurable:true,get:()=>resourceSnapshots.at(-1),set:(value:string)=>resourceSnapshots.push(value)});
    const plantBytes=fixture.decoded.native.plants.reduce((bytes,plant)=>bytes+(plant.wood?.byteLength??0)+plant.decoration.byteLength,0);
    const store={initialize:async()=>{},list:async()=>({slots:[{slotId:"factory-primary",recordRevision:1}]}),
      load:async()=>({decoded:fixture.decoded,owner:fixture.owner,metadata:{recordRevision:1,payloadBytes:fixture.payloadBytes}}),
      save:async()=>{throw Error("unexpected Factory write");},close:async()=>{}};
    const performanceMeasure=vi.spyOn(performance,"measure");
    vi.doMock("../../src/factory/persistence/factorySaveStore",()=>({createFactorySaveStore:()=>store}));
    let coldHost:FactoryHostPort|undefined;
    let handle:HvpBootstrapHandle|undefined;
    try{
      handle=await startHvp(source.overrides({factorySourceProfile:{version:"hvp-factory-startsite-v5",readColumn:readFactorySourceColumnWorldV5},
        createPhysics:async(...args:Parameters<NonNullable<typeof original.createPhysics>>)=>{
          const native=await original.createPhysics!(...args),read=native.read,site=args[10]!;
          const factoryFacilities={revision:0,state:"Idle" as const,transactionId:null,prepared:null,cargo:{site,ownerId:site.ownerId,containerId:site.containerId,
            sourceDigest:site.sourceDigest,profileDigest:site.profileDigest,opened:false,positionMm:site.centerMm,accessBoundsMm:site.accessBoundsMm,
            bodyHandle:4,colliderHandles:[5],accessible:true,openReceipt:null},carrier:null,owners:[],completedTransactionIds:[]};
          return {...native,read:()=>({...read(),status:"Paused" as const,ticks:fixture.decoded.checkpoint.host.nativeTick,
            terrainTransaction:"Idle" as const,neighborTransaction:"Idle" as const,bodyResidencyTransaction:"Idle" as const,moving:{state:"Idle" as const},
            factoryFacilities} as unknown as ReturnType<typeof read>)};
        },
        factoryExtension:async(host:FactoryHostPort,decoded:FactoryDecodedCheckpoint|undefined,owner:FactorySessionCheckpointV2|undefined)=>{
          coldHost=host;
          if(decoded!==fixture.decoded||owner!==fixture.owner)throw Error("Factory restore fixture lost its issued checkpoint binding");
          const cacheBytes=readDryFactoryCheckpointCacheBytes(owner.domain,decoded.material)+readProductionFactoryCheckpointCacheBytes(decoded.material);
          const treeMetrics=inspectFactoryCheckpointMemoryTree(owner);
          return {isQuiescent:()=>true,dispose:async()=>{},canBeginFactoryCheckpoint:()=>true,
            readFactoryCheckpointMemory:()=>({factory:owner,cacheBytes,treeMetrics}),
            readFactoryPresentation:(view:FactoryHostView)=>({sessionId:view.sessionId,epoch:view.epoch,publicationRevision:owner.publicationRevision,nativeTick:view.nativeTick,
              catalogDigest:decoded.material.catalog.catalogDigest,terrainRevision:view.terrain.revision,facilityRevision:0,confirmed:view.confirmed,
              phase:view.physicsStatus,machines:[],material:decoded.material,installations:[]})};
        }
      }));
      const startupError=descendants(source.body).find(element=>element.textContent.startsWith("Technical initialization failure:"))?.textContent;
      expect(source.body.dataset.hestiaPrototypeState,startupError??"Cold Factory fixture did not reach Ready").toBe("Ready");
      expect(coldHost?.read().persistence).toMatchObject({state:"Saved",message:"Combined Factory checkpoint loaded and paused; Save checks memory before writing"});
      const coldAdmission=performanceMeasure.mock.calls.find(([name])=>name==="hvp.factoryColdAdmission");
      const coldData=(coldAdmission?.[1] as {detail?:{data?:Record<string,unknown>}}|undefined)?.detail?.data??{};
      expect(coldData.profileCacheReserveBytes).toBe(FACTORY_RUNTIME_INSTALLATION_PROFILE_CACHE_RESERVE_BYTES);
      expect(coldData.frameProjectionReferenceReserveBytes).toBe(512*1024);
      expect(coldData.logicalCameraReserveBytes).toBe(16*1024);
      const hullMetadataBytes=readLoadedHullMetadataBytes();
      expect([0,42_578]).toContain(hullMetadataBytes);
      expect(Number(coldData.totalBytes)).toBe(Number(coldData.T)+Number(coldData.U)+Number(coldData.K)+Number(coldData.ownerImportBytes)
        +Number(coldData.decodedSourceBytes)+Number(coldData.baseBytes)+Number(coldData.preparedBaseBytes)
        +Number(coldData.nativeReserveBytes)+FACTORY_RUNTIME_INSTALLATION_PROFILE_CACHE_RESERVE_BYTES+512*1024+16*1024+hullMetadataBytes);
      const events=performanceMeasure.mock.calls.filter(([name])=>name==="hvp.factoryColdPlantAdoption")
        .map(([,options])=>(options as {detail?:{data?:Record<string,unknown>}}).detail?.data??{});
      const scene=events.find(event=>event.phase==="scene"),residual=events.find(event=>event.phase==="residual");
      expect(scene).toMatchObject({plantGenerationMatchesNative:true,plantSourceBytes:plantBytes,nativeReserveBytes:96*1024*1024});
      expect(Number(scene?.checkpointSourceBytesBefore)-Number(scene?.checkpointSourceBytesAfter)).toBe(plantBytes);
      expect(Number(scene?.sceneTotalBefore)-Number(scene?.sceneTotalAfter)).toBe(plantBytes);
      const admittedLedger=JSON.parse(resourceSnapshots[0]??"null")?.ledger as {checkpointSourceBytes:number;vegetationSourceBytes:number}|undefined;
      expect(admittedLedger?.checkpointSourceBytes).toBe(Number(scene?.checkpointSourceBytesAfter));
      expect(admittedLedger?.vegetationSourceBytes).toBe(plantBytes);
      expect(scene?.mesherScratchBytes).toBeGreaterThan(0);
      expect(residual).toMatchObject({plantAdoptedBytes:plantBytes,neighborAdoptedBytes:0});
      expect(residual?.retainedDecodedBytes).toBe(Number(residual?.decodedSourceBytes)-plantBytes);
      expect(fixture.decoded.checkpoint.native.view.camera.mode).toBe("Fly");
      expect(fixture.decoded.checkpoint.native.view.thirdPerson).toBe(false);
      const expectedW=Math.cos(Math.PI/2),projections=()=>source.commands.filter((command):command is Extract<RenderCommand,{kind:"ApplyFrameProjection"}> =>
        command.kind==="ApplyFrameProjection"),visibilityCount=()=>source.commands.filter(command=>command.kind==="ApplyVisibilityPlan").length;
      const restoredProjection=projections().at(-1)!;
      expect(restoredProjection.snapshot.cameraOrientation.w).toBe(expectedW);
      expect(source.camera.quaternion.w).toBe(Math.fround(expectedW));
      const restoredVisibility=source.commands.filter((command):command is Extract<RenderCommand,{kind:"ApplyVisibilityPlan"}>=>command.kind==="ApplyVisibilityPlan").at(-1)!;
      expect(restoredVisibility.plan.visibleRepresentationKeys).not.toContain("hvp:player:avatar");
      expect(restoredVisibility.plan.hiddenRepresentationKeys).toContain("hvp:player:avatar");
      const initialProjectionCount=projections().length;
      stepFrame(source.windowPort,16);
      expect(projections()).toHaveLength(initialProjectionCount);
      const stableProjectionCount=projections().length,stableVisibilityCount=visibilityCount(),stableCommandCount=source.commands.length;
      stepFrame(source.windowPort,32);
      expect(projections()).toHaveLength(stableProjectionCount);
      expect(visibilityCount()).toBe(stableVisibilityCount);
      expect(source.commands).toHaveLength(stableCommandCount);

      const wheel=new Event("wheel",{cancelable:true});Object.defineProperty(wheel,"deltaY",{value:-1});
      source.canvas.dispatchEvent(wheel);
      stepFrame(source.windowPort,48);
      const afterWheel=projections().at(-1)!;
      expect(afterWheel.snapshot.cameraPositionRelative.z).not.toBe(restoredProjection.snapshot.cameraPositionRelative.z);
      expect(Object.is(afterWheel.snapshot.cameraPositionRelative.z,Math.fround(afterWheel.snapshot.cameraPositionRelative.z))).toBe(false);
      expect(source.camera.quaternion.w).toBe(Math.fround(afterWheel.snapshot.cameraOrientation.w));
      expect(source.camera.position.z).toBe(Math.fround(afterWheel.snapshot.cameraPositionRelative.z));
      const beforeResize=projections().length;
      source.windowPort.innerWidth=1365;source.windowPort.innerHeight=768;
      source.windowPort.dispatchEvent(new Event("resize"));
      stepFrame(source.windowPort,64);
      const afterResize=projections().at(-1)!;
      expect(projections()).toHaveLength(beforeResize+1);
      expect(afterResize.snapshot.projectionParameters.aspect).toBe(1365/768);
      expect(source.camera.aspect).toBe(Math.fround(1365/768));
    }finally{if(handle)await handle.dispose();vi.doUnmock("../../src/factory/persistence/factorySaveStore");}
  });

  it("does not credit a fresh equal-content plant generation to a Factory checkpoint",async()=>{
    const fixture=coldPlantFixture,source=harness(),original=source.overrides()!;
    Object.defineProperty(source.windowPort,"location",{value:{search:"?hvpMeasure=1"}});
    const freshInstances=planHvpVegetation(undefined,{version:"hvp-factory-vegetation-v1",readColumn:readFactorySourceColumnWorldV5})
      .filter(plant=>isHvpPlantHabitat(plant.kind,plant.position.x,plant.position.z,{version:"hvp-factory-vegetation-v1",readColumn:readFactorySourceColumnWorldV5}));
    expect(freshInstances).toEqual(fixture.decoded.native.plants.map(plant=>plant.instance));
    expect(estimateHvpVegetationSourceBytes(freshInstances)).toBe(fixture.plantBytes);
    const store={initialize:async()=>{},list:async()=>({slots:[{slotId:"factory-primary",recordRevision:15}]}),
      load:vi.fn(async()=>{throw Error("unexpected cold Factory load");}),save:async()=>{throw Error("unexpected Factory write");},close:async()=>{}};
    vi.doMock("../../src/factory/persistence/factorySaveStore",()=>({createFactorySaveStore:()=>store}));
    const performanceMeasure=vi.spyOn(performance,"measure");
    let host:FactoryHostPort|undefined;
    let handle:HvpBootstrapHandle|undefined;
    try{
      handle=await startHvp(source.overrides({createSourceSnapshot:()=>fixture.source,
        factorySourceProfile:{version:"hvp-factory-startsite-v5",readColumn:readFactorySourceColumnWorldV5},
        createPhysics:async(...args:Parameters<NonNullable<typeof original.createPhysics>>)=>{
          const native=await original.createPhysics!(...args),read=native.read,site=args[10]!;
          return {...native,read:()=>({...read(),status:"Paused" as const,terrainTransaction:"Idle" as const,neighborTransaction:"Idle" as const,
            bodyResidencyTransaction:"Idle" as const,moving:{state:"Idle" as const},factoryFacilities:{revision:0,state:"Idle" as const,
              transactionId:null,prepared:null,cargo:{site,ownerId:site.ownerId,containerId:site.containerId,sourceDigest:site.sourceDigest,
                profileDigest:site.profileDigest,opened:false,positionMm:site.centerMm,accessBoundsMm:site.accessBoundsMm,bodyHandle:4,
                colliderHandles:[5],accessible:true,openReceipt:null},carrier:null,owners:[],completedTransactionIds:[]}} as unknown as ReturnType<typeof read>)};
        },factoryExtension:async(factoryHost:FactoryHostPort)=>{host=factoryHost;return withTestFactoryOwnerMemory({isQuiescent:()=>true,dispose:async()=>{}});}}));
      const startupError=descendants(source.body).find(element=>element.textContent.startsWith("Technical initialization failure:"))?.textContent;
      expect(source.body.dataset.hestiaPrototypeState,startupError??"Fresh Factory-profile fixture did not reach Ready").toBe("Ready");
      expect(host?.read().persistence).toMatchObject({state:"Saved",revision:15,message:"Combined Factory checkpoint available; Save checks memory before writing"});
      expect(store.load).not.toHaveBeenCalled();
      const ledger=JSON.parse(source.body.dataset.hestiaPrototypeResources!) as {ledger:{checkpointSourceBytes:number;vegetationSourceBytes:number}};
      expect(ledger.ledger.checkpointSourceBytes).toBe(0);
      expect(ledger.ledger.vegetationSourceBytes).toBe(fixture.plantBytes);
      expect(performanceMeasure.mock.calls.some(([name])=>name==="hvp.factoryColdPlantAdoption")).toBe(false);
    }finally{if(handle)await handle.dispose();vi.doUnmock("../../src/factory/persistence/factorySaveStore");}
  });
});
});
