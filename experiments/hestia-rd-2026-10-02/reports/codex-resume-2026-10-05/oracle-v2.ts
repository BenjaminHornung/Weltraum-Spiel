import { compareRoi } from '../RD-11/oracle';

/** Source/camera semantic selection, fixed before any new candidate valuation. Original v1 stays unchanged. */
export const REN12_V2_ROIS = Object.freeze({
  'foliage-color': Object.freeze({ rect:[0.24,0.07,0.24,0.22] as const, subject:'F01 umbrella crown and source vertex colors; not an AO-isolated assertion' }),
  'water-material': Object.freeze({ rect:[0.15,0.62,0.16,0.22] as const, subject:'F01 visible water and bed; opacity response, not native depth readback' }),
  'solid-geometry': Object.freeze({ rect:[0.52,0.22,0.25,0.35] as const, subject:'F01 solid bank geometry; RGB geometry response, not native depth readback' }),
});
export type SemanticRegion=keyof typeof REN12_V2_ROIS;
export interface SemanticCaptureBinding {
  readonly fixtureId:string;readonly fixtureDigest:string;readonly sourceRevision:number;readonly cameraId:string;readonly tick:number;
  readonly width:number;readonly height:number;readonly outputColorSpace:string;readonly toneMapping:number;readonly exposure:number;
  readonly backend:'C0-WebGL2'|'C1-WebGL2'|'C2-WebGPU';readonly submitted:boolean;
}
export const REN12_V2_LIMITATIONS=Object.freeze(['native-depth-buffer-readback-unsupported','native-final-alpha-format-equivalence-unproven','AO-isolated-native-fault-unavailable','human-art-acceptance-pending']);
/** Fixed after the declared native control population, before unseen C2 hero omission. Stronger, never relaxed. */
export const REN12_V2_SOLID_RESPONSE_CAP=0.005;
export function compareSemanticRoi(reference:readonly number[],candidate:readonly number[],a:SemanticCaptureBinding,b:SemanticCaptureBinding,region:SemanticRegion,axis:'C0-C1'|'C1-C2'|'CONTROL') {
  if(!['C0-C1','C1-C2','CONTROL'].includes(axis))throw Error('Unknown comparison axis');
  if(!Object.hasOwn(REN12_V2_ROIS,region))throw Error('Unknown semantic ROI');
  for(const capture of [a,b]) {
    if(capture.fixtureId!=='F01-HVP-COAST'||capture.fixtureDigest!=='688fda7d61d4d4a68a9917841ba8b7cb2722e04ddd6c4d9ce53039314d0b5b08'
      ||capture.sourceRevision!==0||capture.cameraId!=='C01-EYE'||!capture.submitted||capture.outputColorSpace!=='srgb')throw Error('Unqualified source/camera/native submission binding');
    if(!['C0-WebGL2','C1-WebGL2','C2-WebGPU'].includes(capture.backend))throw Error('Unverified backend identity');
    if(!Number.isSafeInteger(capture.tick)||capture.tick<0||!Number.isSafeInteger(capture.width)||capture.width<1
      ||!Number.isSafeInteger(capture.height)||capture.height<1||!Number.isFinite(capture.toneMapping)||!Number.isFinite(capture.exposure)||capture.exposure<=0)throw Error('Invalid capture quality binding');
  }
  const expected=axis==='C0-C1'?['C0-WebGL2','C1-WebGL2']:axis==='C1-C2'?['C1-WebGL2','C2-WebGPU']:[a.backend,a.backend];
  if(a.backend!==expected[0]||b.backend!==expected[1])throw Error('Backend pair does not match declared comparison axis');
  for(const key of ['tick','width','height','toneMapping','exposure'] as const)if(a[key]!==b[key])throw Error(`Capture binding mismatch: ${key}`);
  const rect=REN12_V2_ROIS[region].rect;
  const roiWidth=Math.round((rect[0]+rect[2])*a.width)-Math.round(rect[0]*a.width);
  const roiHeight=Math.round((rect[1]+rect[3])*a.height)-Math.round(rect[1]*a.height);
  if(reference.length!==candidate.length||reference.length!==roiWidth*roiHeight*4)throw Error('Invalid full-resolution semantic RGBA crop; downsampling forbidden');
  if(!reference.every((v)=>Number.isInteger(v)&&v>=0&&v<=255)||!candidate.every((v)=>Number.isInteger(v)&&v>=0&&v<=255))throw Error('Invalid native 8-bit image sample');
  for(let i=3;i<reference.length;i+=4)if(reference[i]!==candidate[i]||reference[i]!==255)throw Error('Unsupported/changed final alpha response');
  // Same frozen v1 mean RGB, signal and contrast limits, now applied at the actual semantic crop resolution.
  const result=compareRoi(reference,candidate,axis==='CONTROL'?'C1-C2':axis);
  if(region==='solid-geometry'&&axis!=='C0-C1'&&result.meanRgbError>REN12_V2_SOLID_RESPONSE_CAP)throw Error('RGB geometry/depth response rejected by calibrated stronger solid cap');
  return {...result,generation:'REN12-v2',region,axis,solidResponseCap:region==='solid-geometry'&&axis!=='C0-C1'?REN12_V2_SOLID_RESPONSE_CAP:null,
    thresholdBasis:axis==='CONTROL'?'unchanged-v1-C1-C2-cap-for-labelled-repeat/fault-controls':axis,referenceBackend:a.backend,candidateBackend:b.backend};
}
