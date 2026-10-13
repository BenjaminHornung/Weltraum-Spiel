import assert from 'node:assert/strict';
import {validateBorrowedPort} from './snapshot/borrowed-port-fixed.ts';

// Every image/evidence/transform here is synthetic metadata, never pixels, a resource or upstream proof.
type Metadata = Record<string, any>;
const sha = (digit: string) => 'sha256:' + digit.repeat(64);
const ref = (id: string) => ({sourceId:'SYNTHETIC_NOT_FILE_VERIFIED:' + id,
  absolutePath:'C:/IFI_SourceCode/SYNTHETIC_METADATA_ONLY/does-not-exist.json',bytes:1,sha256:'a'.repeat(64)});
const matrix = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
function packet(port: string): Metadata {
  const current = {viewSessionId:'synthetic.view',frameId:'synthetic.frame.2',resourceGeneration:2,cameraEpoch:2,projectionEpoch:3,
    sourcePresentationRevision:'synthetic.presentation.1',weatherSnapshotId:sha('a'),opticsDigest:sha('b'),atlasDigest:sha('c'),atlasEpoch:1,originMeters:[0,0,0]};
  const owners = {hdrColor:'synthetic.hdr',depth:'synthetic.depth',waterDepth:'synthetic.water',velocity:'synthetic.motion',reactive:'synthetic.reactive'};
  const image = (role: keyof typeof owners) => ({ownerId:owners[role],resourceKey:'SYNTHETIC_METADATA_ONLY:' + role,
    frame:structuredClone(current),backend:'WebGL',width:16,height:8,sampleCount:1,format:'SYNTHETIC_FORMAT_METADATA_ONLY',
    validUntil:'FRAME_END_OR_OWNER_GENERATION_CHANGE',disposalOwner:'PRODUCER_ONLY'});
  const exact = (id: string) => ({id:'synthetic.' + id,version:1,digest:sha('d')});
  const frame = {status:'Known',simulationTick:7200000,weatherSnapshotId:sha('a'),bodyId:'synthetic.body',bodyRadiusMeters:1000,
    bodyNormal:[0,1,0],originMeters:[0,0,0],sourceRevision:1,atlasEpoch:1,weatherExtinctionPerM:0.01,windMps:[1,0,2],
    stormIds:['synthetic.storm'],authoredCloudCoverage:0.4,rain01:0.3,opticsDigest:sha('b'),
    binding:{worldId:'synthetic.world',sessionId:'synthetic.session',sourceEpoch:'synthetic.source.1',sourceOwner:'synthetic.author',sourceRevision:'1',
      sourceDigest:sha('d'),atmosphereEpoch:'synthetic.atmosphere.1',authorityRevision:'1',eventCursor:'0',eventDigest:sha('e'),simulationTick:7200000,
      profile:exact('profile'),model:exact('model'),climateNormals:exact('climate'),macroGeography:null}};
  const light = {bindingRef:ref('light'),revision:'synthetic.light.1',eventId:null,phase:'STEADY',sourceStrength:1,
    sunDirectionBody:[0,1,0],shadowAtlasLightingDigest:sha('f')};
  return {port,sourceFrame:frame,weather:{status:'Known',frozenResult:ref('weather'),authoredMask:ref('mask')},
    current,currentEvidence:ref('frame'),producerOwners:owners,lighting:light,historyEvidence:ref('history'),
    history:{generation:1,valid:true,inputResolution:[16,8],displayResolution:[32,16],cameraEpoch:2,projectionEpoch:3,
      sourceFrameId:'synthetic.frame.1',bufferOwner:'SELECTED_TEMPORAL_PACKAGE_ONLY'},
    contribution:{hdrColor:image('hdrColor'),colorSpace:'LINEAR_HDR',toneMapped:false,
      depth:{image:image('depth'),projectionKind:'Perspective',clipDepthRange:'MinusOneToOne',nearMeters:0.1,farMeters:1000,
        reversedZ:false,logarithmicDepth:false,encoding:'NATIVE_SINGLE_SAMPLE_DEPTH_ATTACHMENT',writers:'OPAQUE_ONLY',
        backgroundValidity:'EXPLICIT_SKY_DISPOSITION',currentProjectionUnjittered:matrix(),currentView:matrix()},
      waterDepth:image('waterDepth'),waterStrategy:'NEAREST_PLANAR_FRONT_BACK_ALPHA_PRESERVED',
      velocity:{availability:'AVAILABLE',image:image('velocity'),convention:'UNJITTERED_NDC_CURRENT_MINUS_PREVIOUS',
        previousFrameId:'synthetic.frame.1',previousProjectionUnjittered:matrix(),previousView:matrix(),geometryDeformationOracle:ref('motion'),
        disocclusionPolicy:'NO_PREVIOUS_COLOR_FOR_NEW_SURFACE'},
      reactive:{availability:'AVAILABLE',image:image('reactive'),channel:'RED_0_TO_1',includes:['Water','Volume','Rain','Lightning','NewSurface'],
        coverageOracle:ref('reactive'),lighting:structuredClone(light)}}};
}
type ExactCase = {id:string;port:string;change:(p:Metadata)=>void;status:'Pending'|'Unsupported'|'ValidatedSourceOnly';reason?:string};
const cases: ExactCase[] = [
  {id:'NUM-01',port:'DEPTH',change:p=>{p.contribution.depth.nearMeters=NaN;},status:'Unsupported',reason:'DEPTH_CONVENTION_INVALID'},
  {id:'NUM-02',port:'DEPTH',change:p=>{delete p.contribution.depth.farMeters;},status:'Pending',reason:'DEPTH_METADATA_MISSING:farMeters'},
  {id:'NUM-03',port:'DEPTH',change:p=>{p.contribution.depth.farMeters=Infinity;},status:'Unsupported',reason:'DEPTH_CONVENTION_INVALID'},
  {id:'NUM-04',port:'DEPTH',change:p=>{p.contribution.depth.farMeters=p.contribution.depth.nearMeters;},status:'Unsupported',reason:'DEPTH_CONVENTION_INVALID'},
  {id:'NUM-05',port:'DEPTH',change:p=>{p.contribution.depth.image.width=16.5;},status:'Unsupported',reason:'IMAGE_METADATA_INVALID:depth'},
  {id:'NUM-06',port:'GL_VOLUME',change:p=>{p.contribution.hdrColor.height=9;},status:'Unsupported',reason:'COLOR_DEPTH_MISMATCH'},
  {id:'NUM-07',port:'DEPTH',change:p=>{p.contribution.depth.currentProjectionUnjittered=matrix().slice(0,15);},status:'Unsupported',reason:'DEPTH_CONVENTION_INVALID'},
  {id:'NUM-08',port:'DEPTH',change:p=>{p.contribution.depth.currentProjectionUnjittered[5]=NaN;},status:'Unsupported',reason:'DEPTH_CONVENTION_INVALID'},
  {id:'NUM-09',port:'DEPTH',change:p=>{p.contribution.depth.currentProjectionUnjittered=new Array(16);},status:'Unsupported',reason:'DEPTH_CONVENTION_INVALID'},
  {id:'NUM-10',port:'HISTORY',change:p=>{p.history.inputResolution=[17,8];},status:'Unsupported',reason:'HISTORY_BINDING_INVALID'},
  {id:'NUM-11',port:'HISTORY',change:p=>{p.history.cameraEpoch=1;},status:'Unsupported',reason:'HISTORY_BINDING_INVALID'},
  {id:'NUM-12',port:'OUTPUT_VIEW',change:p=>{p.current.cameraEpoch=4;p.current.projectionEpoch=5;p.history.cameraEpoch=4;p.history.projectionEpoch=5;
    p.history.inputResolution=[20,10];p.history.displayResolution=[40,20];
    for(const image of [p.contribution.hdrColor,p.contribution.depth.image,p.contribution.waterDepth,p.contribution.velocity.image,p.contribution.reactive.image]){
      image.width=20;image.height=10;image.frame.cameraEpoch=4;image.frame.projectionEpoch=5;
    }},status:'ValidatedSourceOnly'}
];

function freeze(v: unknown): void {
  if(v && typeof v === 'object'){Object.freeze(v);for(const child of Object.values(v))freeze(child);}
}
assert.equal(cases.length,12);
assert.equal(new Set(cases.map(c=>c.id)).size,12);
let failed=0, totalDisposalCalls=0;
const results=[];
for(const c of cases){
  let disposalCalls=0, actual: unknown;
  const expected=c.status==='ValidatedSourceOnly'
    ? {status:c.status,port:c.port,temporalReady:false,execution:'NOT_RUN',selectedOption:null}
    : {status:c.status,port:c.port,reasonCode:c.reason};
  try {
    const input=packet(c.port);c.change(input);
    const before=structuredClone(input);
    const images=[input.contribution.hdrColor,input.contribution.depth.image,input.contribution.waterDepth,
      input.contribution.velocity.image,input.contribution.reactive.image];
    for(const meta of images)Object.defineProperty(meta,'dispose',{value:()=>{disposalCalls++;throw Error('SYNTHETIC_DISPOSAL_SENTINEL_CALLED');}});
    freeze(input);
    actual=validateBorrowedPort(input);
    assert.equal(disposalCalls,0,c.id+' synthetic borrowed disposal sentinel');
    assert.deepEqual(input,before,c.id+' unchanged numeric values and array sparsity');
    const observed=actual as ReturnType<typeof validateBorrowedPort>;
    if(observed.status==='ValidatedSourceOnly'){assert.equal(observed.temporalReady,false);assert.equal(observed.selectedOption,null);}
    assert.deepEqual(actual,expected,c.id+' exact status/reason');
    results.push({id:c.id,port:c.port,status:'PASS',actual,expected,disposalCalls,inputUnchanged:true});
  }catch(error){
    failed++;results.push({id:c.id,port:c.port,status:'FAIL',actual,expected,disposalCalls,
      error:error instanceof Error?{message:error.message,stack:error.stack}:String(error)});
  }
  totalDisposalCalls+=disposalCalls;
}
console.log(JSON.stringify({schema:'atm.r04.pure-numeric-metadata-result/v1',
  population:'12_SYNTHETIC_METADATA_CASES_NO_PIXEL_OR_UPSTREAM_PROOF',passed:12-failed,failed,totalDisposalCalls,results,
  temporalAdmission:'BLOCKED_MISSING_UPSTREAM_CONTRACT',producerExportProof:false,productIntegration:'NO',gpuNativeReference:'NOT_RUN'}));
if(failed)process.exitCode=1;
