import assert from 'node:assert/strict';
import {PORT_IDS, validateBorrowedPort} from './snapshot/borrowed-port.ts';

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
  {id:'PIPELINE-01',port:'GL_VOLUME',change:p=>{p.contribution.depth.image.disposalOwner='CONSUMER';},status:'Unsupported',reason:'BORROWED_OWNERSHIP_INVALID:depth'},
  {id:'FRAME-01',port:'FRAME',change:p=>{p.sourceFrame.binding.simulationTick++;},status:'Unsupported',reason:'ACTUAL_FRAME_REJECTED:WEATHER_TICK_BINDING'},
  {id:'WEATHER-01',port:'WEATHER',change:p=>{delete p.weather;},status:'Pending',reason:'WEATHER_READ_MISSING'},
  {id:'WEATHER-02',port:'WEATHER',change:p=>{p.weather={status:'UnknownCoverage',reasonCode:'SYNTHETIC_ORBIT_COVERAGE'};},status:'Unsupported',reason:'WEATHER_UnknownCoverage:SYNTHETIC_ORBIT_COVERAGE'},
  {id:'OPTICS-01',port:'OPTICS',change:p=>{p.weather.status='NoAtmosphere';p.sourceFrame.status='NoAtmosphere';
    p.sourceFrame.weatherExtinctionPerM=0;p.sourceFrame.authoredCloudCoverage=0;p.sourceFrame.rain01=0;p.segment={T:1,L:[0,0,0]};},status:'ValidatedSourceOnly'},
  {id:'DEPTH-01',port:'DEPTH',change:p=>{delete p.contribution.depth.nearMeters;},status:'Pending',reason:'DEPTH_METADATA_MISSING:nearMeters'},
  {id:'DEPTH-02',port:'DEPTH',change:p=>{p.contribution.depth.image.frame.resourceGeneration=1;},status:'Unsupported',reason:'BORROWED_LEASE_STALE:depth'},
  {id:'VELOCITY-01',port:'VELOCITY',change:p=>{p.contribution.velocity={availability:'MISSING',reasons:['SYNTHETIC_ABSENT_METADATA']};},status:'Pending',reason:'GENUINE_VELOCITY_MISSING'},
  {id:'VELOCITY-02',port:'MATERIAL',change:p=>{p.contribution.velocity.previousFrameId=p.current.frameId;},status:'Unsupported',reason:'VELOCITY_OR_PREVIOUS_FRAME_UNPROVEN'},
  {id:'MATERIAL-01',port:'TAKRAM',change:p=>{p.contribution.hdrColor.backend='WebGPU';p.contribution.depth.image.backend='WebGPU';
    p.contribution.depth.clipDepthRange='ZeroToOne';},status:'Unsupported',reason:'FROZEN_PORT_WEBGL_ONLY'},
  {id:'LIGHT-01',port:'LIGHT_REACTIVITY',change:p=>{delete p.lighting;},status:'Pending',reason:'LIGHTNING_LIGHT_PROJECTION_MISSING'},
  {id:'LIGHT-02',port:'LIGHT_REACTIVITY',change:p=>{p.contribution.reactive.lighting.revision='synthetic.light.changed';},status:'Unsupported',reason:'REACTIVE_LIGHT_BINDING_MISMATCH'},
  {id:'ORIGIN-01',port:'GL_VOLUME',change:p=>{p.current.originMeters=[1,0,0];},status:'Unsupported',reason:'FRAME_ATLAS_ORIGIN_BINDING_MISMATCH'},
  {id:'WATER-01',port:'WETNESS_WATER',change:p=>{p.producerOwners.waterDepth=p.producerOwners.depth;
    p.contribution.waterDepth.ownerId=p.contribution.depth.image.ownerId;p.contribution.waterDepth.resourceKey=p.contribution.depth.image.resourceKey;},
    status:'Unsupported',reason:'WATER_IS_NOT_OPAQUE_DEPTH'},
  {id:'WATER-02',port:'WETNESS_WATER',change:p=>{p.contribution.reactive={availability:'MISSING',reasons:['SYNTHETIC_ABSENT_METADATA']};},status:'Pending',reason:'REACTIVE_COVERAGE_MISSING'},
  {id:'RESET-01',port:'HISTORY',change:p=>{p.history={weather:'synthetic.weather',profile:'synthetic.profile',macro:'synthetic.macro',model:'synthetic.model',
    optics:'synthetic.optics',source:1,atlas:1,epoch:1,origin:[0,0,0],height:0,lightning:null,resources:2};},status:'Pending',reason:'HISTORY_METADATA_MISSING:generation'},
  {id:'RESET-02',port:'HISTORY',change:p=>{p.history.projectionEpoch=4;},status:'Unsupported',reason:'HISTORY_BINDING_INVALID'},
  {id:'RAIN-01',port:'RAIN',change:p=>{delete p.current.cameraEpoch;},status:'Pending',reason:'EPOCH_MISSING:cameraEpoch'},
  {id:'OUTPUT-01',port:'OUTPUT_VIEW',change:p=>{p.contribution.toneMapped=true;},status:'Unsupported',reason:'PRE_TONE_HDR_REQUIRED'},
  {id:'NEGATIVES-01',port:'OUTPUT_VIEW',change:()=>{},status:'ValidatedSourceOnly'}
];
function freeze(v: unknown): void {
  if(v && typeof v === 'object'){Object.freeze(v);for(const child of Object.values(v))freeze(child);}
}
assert.equal(cases.length,20);
assert.equal(new Set(cases.map(c=>c.id)).size,20);
assert.deepEqual([...new Set(cases.map(c=>c.port))].sort(),[...PORT_IDS].sort());
let failed=0;
const results=[];
for(const c of cases){
  let disposalCalls=0;
  try {
    const input=packet(c.port);c.change(input);
    const images=[input.contribution.hdrColor,input.contribution.depth.image,input.contribution.waterDepth,
      input.contribution.velocity.image,input.contribution.reactive.image].filter(Boolean);
    for(const meta of images)Object.defineProperty(meta,'dispose',{value:()=>{disposalCalls++;throw Error('SYNTHETIC_DISPOSAL_SENTINEL_CALLED');}});
    const before=JSON.stringify(input);freeze(input);
    const actual=validateBorrowedPort(input);
    const expected=c.status==='ValidatedSourceOnly'
      ? {status:c.status,port:c.port,temporalReady:false,execution:'NOT_RUN',selectedOption:null}
      : {status:c.status,port:c.port,reasonCode:c.reason};
    assert.deepEqual(actual,expected,c.id+' exact status/reason');
    if(actual.status==='ValidatedSourceOnly'){assert.equal(actual.temporalReady,false);assert.equal(actual.selectedOption,null);}
    assert.equal(disposalCalls,0,c.id+' borrowed metadata must never be disposed');
    assert.equal(JSON.stringify(input),before,c.id+' borrowed metadata must remain unchanged');
    results.push({id:c.id,port:c.port,status:'PASS',actual,disposalCalls,inputUnchanged:true});
  }catch(error){failed++;results.push({id:c.id,port:c.port,status:'FAIL',disposalCalls,error:error instanceof Error?{message:error.message,stack:error.stack}:String(error)});}
}
console.log(JSON.stringify({schema:'atm.r03.pure-synthetic-metadata-result/v1',population:'20_SYNTHETIC_METADATA_CASES_NO_PIXEL_OR_UPSTREAM_PROOF',
  passed:20-failed,failed,portCoverage:[...new Set(cases.map(c=>c.port))].sort(),results,
  temporalAdmission:'BLOCKED_MISSING_UPSTREAM_CONTRACT',producerExportProof:false,productIntegration:'NO',gpuNativeReference:'NOT_RUN'}));
if(failed)process.exitCode=1;
