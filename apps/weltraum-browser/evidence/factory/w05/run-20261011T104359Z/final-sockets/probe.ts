import * as THREE from "three";
import { createFp02CatalogInput, loadFactoryCatalog } from "/src/factory/catalog/fp02Catalog.ts";
import { createFactoryAssetProjection, getFactoryAssetSource } from "/src/factory/presentation/factoryAssets.ts";
import { sampleMachinePose } from "/src/factory/presentation/machinePose.ts";
import { ThreeRenderBackend } from "/src/render/three/backend/threeRenderBackend.ts";
import { backendRevision, createFrameProjectionSnapshot, createVisibilityPlan, frameId, frameRevision, visibilityPlanRevision } from "/src/presentation/index.ts";

const catalog = loadFactoryCatalog(createFp02CatalogInput());
const canvas = document.querySelector("canvas")!;
const registrations = [];
const add = canvas.addEventListener.bind(canvas), remove = canvas.removeEventListener.bind(canvas);
canvas.addEventListener = (type, listener, options) => {
  const capture = typeof options === "boolean" ? options : options?.capture === true;
  add(type, listener, options);
  if (!registrations.some(entry => entry.type === type && entry.listener === listener && entry.capture === capture)) registrations.push({type,listener,capture});
};
canvas.removeEventListener = (type, listener, options) => {
  const capture = typeof options === "boolean" ? options : options?.capture === true;
  remove(type, listener, options);
  const index = registrations.findIndex(entry => entry.type === type && entry.listener === listener && entry.capture === capture);
  if (index >= 0) registrations.splice(index,1);
};
let backend, renderer, asset, present, status = "IDLE", work = 0, damage = 0, revision = 0, cameraView = "full";
const command = command => { const result = backend.dispatch({ ...command, backendRevision: backendRevision(0) }); if (result.status !== "Accepted" && result.status !== "AlreadyApplied") throw new Error(JSON.stringify(result)); return result; };
const close = () => { if (backend) { command({kind:"DisposeBackend"}); const stats=backend.readDiagnostics(); if(stats.geometryAllocations!==stats.geometryDisposals || stats.materialAllocations!==stats.materialDisposals || registrations.length) throw new Error("Owned probe cleanup failed"); } };
const render = () => {
  const pose=sampleMachinePose({projection:asset,status,confirmedWorkMs:work,presentPartIds:present,damageRevision:damage},revision);
  const camera=new THREE.PerspectiveCamera();
  const height=asset.bounds.max.y;
  const distance=Math.max(4,Math.max(asset.bounds.max.x-asset.bounds.min.x,height)*1.7);
  if(cameraView==="top") {camera.position.set(0,height+distance,0.001);camera.up.set(0,0,-1);} else if(cameraView==="side") camera.position.set(-distance,height/2,distance/3); else if(cameraView==="player") camera.position.set(distance*0.65,1.7,distance*0.65); else camera.position.set(distance,height*0.75+1,distance);
  if(cameraView==="socket") {
    const port=asset.ports.find(value=>value.role==="PowerProducer"), center=port.centerM;
    camera.position.set(center[0]+0.75,center[1]+0.5,center[2]+1.25);camera.lookAt(...center);
  } else camera.lookAt(0,height/2,0);
  camera.updateMatrixWorld();
  const transforms=pose.partPoses.map(part=>({representationKey:asset.parts.find(value=>value.partId===part.partId).artifact.representationKey,positionRelative:{x:part.translationM[0],y:part.translationM[1],z:part.translationM[2]},orientation:{x:0,y:0,z:0,w:1},scale:{x:1,y:1,z:1}}));
  command({kind:"ApplyFrameProjection",snapshot:createFrameProjectionSnapshot({frameId:frameId(asset.frameId),frameRevision:frameRevision(++revision),cameraPositionRelative:{x:camera.position.x,y:camera.position.y,z:camera.position.z},cameraOrientation:{x:camera.quaternion.x,y:camera.quaternion.y,z:camera.quaternion.z,w:camera.quaternion.w},projectionParameters:{kind:"Perspective",verticalFovDegrees:42,aspect:canvas.clientWidth/canvas.clientHeight,near:0.1,far:100},representationTransforms:transforms})});
  command({kind:"ApplyVisibilityPlan",plan:createVisibilityPlan({planRevision:visibilityPlanRevision(revision),visibleRepresentationKeys:transforms.map(value=>value.representationKey),fallbackRepresentationKeys:[],hiddenRepresentationKeys:[]})});
  backend.renderFrame();
  document.querySelector("#status").textContent=asset.source.assetId+" · "+status+" · "+pose.phase;
  return {...pose,assetId:asset.source.assetId,definitionId:asset.definitionRef.sourceId,confirmedWorkMs:work,sourceDigest:asset.sourceDigest,bounds:asset.bounds,diagnostics:backend.readDiagnostics(),canvasListeners:registrations.length,gpu:{...renderer.info.memory},sourceKind:asset.kind,instanceId:asset.definitionRef.instanceId};
};
const show = (definitionId="B06",view="full",nextStatus="IDLE",confirmedWorkMs=0,lighting="day") => {
  close(); revision=0;damage=0;work=confirmedWorkMs;status=nextStatus;cameraView=view;
  const definition=[...catalog.devices,...catalog.items].find(value=>value.sourceId===definitionId);
  asset=createFactoryAssetProjection({...definition,instanceId:"synthetic_probe_"+getFactoryAssetSource(definitionId).assetId},getFactoryAssetSource(definitionId));
  present=asset.parts.map(part=>part.partId);
  backend=new ThreeRenderBackend({canvas,width:canvas.clientWidth,height:canvas.clientHeight,pixelRatio:1,preserveDrawingBuffer:true,backgroundColor:lighting==="night"?0x081018:0x202e38,rendererFactory:(element,parameters)=>{renderer=new THREE.WebGLRenderer({...parameters,canvas:element});return renderer;}});
  command({kind:"InitializeBackend"});
  if(lighting==="night") backend.scene.children.filter(child=>child.isLight).forEach(light=>light.intensity*=0.25);
  asset.parts.forEach(part=>command({kind:"UpsertMeshArtifact",artifact:part.artifact,materialProfiles:part.materialProfiles}));
  return render();
};
window.__factoryS0Probe={show,sample:(nextStatus,confirmedWorkMs)=>{status=nextStatus;work=confirmedWorkMs;return render();},damageTool:()=>{const removed=asset.parts.filter(part=>part.role==="tool");removed.forEach(part=>command({kind:"RemoveRepresentation",representationKey:part.artifact.representationKey,expectedSourceRevision:part.artifact.sourceRevision,expectedArtifactRevision:part.artifact.artifactRevision,expectedContentHash:part.artifact.contentHash}));present=present.filter(id=>!removed.some(part=>part.partId===id));damage++;status="FAULT";return render();},close:()=>{close();return {diagnostics:backend.readDiagnostics(),canvasListeners:registrations.length,gpu:{...renderer.info.memory}};},churn:()=>{const results=[];for(let i=0;i<100;i++){show("B06","full","RUNNING",15000);results.push(window.__factoryS0Probe.close());backend=undefined;}return results;},catalogDigest:catalog.catalogDigest,synthetic:true};
show();
window.__factoryS0ProbeReady=true;
