import { expect, it } from 'vitest';
import { REN12_V2_ROIS, compareSemanticRoi, type SemanticCaptureBinding } from '../../../reports/codex-resume-2026-10-05/oracle-v2';
import { ROI_THRESHOLDS } from '../../../reports/RD-11/oracle';
const binding:SemanticCaptureBinding={fixtureId:'F01-HVP-COAST',fixtureDigest:'688fda7d61d4d4a68a9917841ba8b7cb2722e04ddd6c4d9ce53039314d0b5b08',sourceRevision:0,cameraId:'C01-EYE',tick:0,width:100,height:100,outputColorSpace:'srgb',toneMapping:0,exposure:1,backend:'C1-WebGL2',submitted:true};
// Explicitly synthetic small image. Native tests use actual PNG/header dimensions and full crops.
const pixels=(region:keyof typeof REN12_V2_ROIS)=>{const r=REN12_V2_ROIS[region].rect;const width=Math.round((r[0]+r[2])*100)-Math.round(r[0]*100),height=Math.round((r[1]+r[3])*100)-Math.round(r[1]*100);return Array.from({length:width*height},(_,i)=>i%2?[20,180,40,255]:[160,220,80,255]).flat();};
const checker=pixels('foliage-color');
it('REN12-v2 synthetic oracle validation: unchanged positives and tolerated bounded repeats retain v1 caps',()=>{
  expect(compareSemanticRoi(checker,checker,binding,binding,'foliage-color','CONTROL').meanRgbError).toBe(0);
  const slight=checker.map((v,i)=>i%4===3?v:v+1);
  expect(compareSemanticRoi(checker,slight,binding,binding,'foliage-color','CONTROL').meanRgbError).toBeLessThan(0.035);
  expect(compareSemanticRoi(checker,slight,binding,{...binding,backend:'C2-WebGPU'},'foliage-color','C1-C2').meanRgbError).toBeLessThan(0.035);
  expect(()=>compareSemanticRoi(checker,checker,binding,binding,'foliage-color','C1-C2')).toThrow(/Backend pair/);
  expect(()=>compareSemanticRoi(checker,checker,{...binding,backend:'C2-WebGPU'},binding,'foliage-color','C1-C2')).toThrow(/Backend pair/);
  expect(ROI_THRESHOLDS.c1c2MeanRgbError).toBe(0.035);
  expect(REN12_V2_ROIS['water-material'].rect[0]).toBe(0.15);
});
it('REN12-v2 synthetic oracle validation: color loss, missing geometry and opacity response fail without threshold inflation',()=>{
  for(const region of ['foliage-color','solid-geometry','water-material'] as const){
    const source=pixels(region),wrong=source.map((_,i)=>i%4===3?255:240);
    expect(()=>compareSemanticRoi(source,wrong,binding,binding,region,'CONTROL')).toThrow(/parity rejected/);
  }
});
it('REN12-v2 synthetic oracle validation: camera/source/tick/exposure/dimensions and missing submissions reject before scoring',()=>{
  for(const change of [{cameraId:'C07-QUARRY'},{fixtureDigest:'a'.repeat(64)},{tick:1},{width:640},{exposure:2},{submitted:false}]){
    expect(()=>compareSemanticRoi(checker,checker,binding,{...binding,...change},'foliage-color','CONTROL')).toThrow();
  }
});
it('REN12-v2 synthetic oracle validation: invalid/flat/alpha-changing readbacks cannot claim native parity',()=>{
  expect(()=>compareSemanticRoi(Array(checker.length).fill(255),Array(checker.length).fill(255),binding,binding,'foliage-color','CONTROL')).toThrow(/lacks reference signal/);
  expect(()=>compareSemanticRoi(Array(4096).fill(255),Array(4096).fill(255),binding,binding,'foliage-color','CONTROL')).toThrow(/downsampling forbidden/);
  expect(()=>compareSemanticRoi(checker,checker.slice(4),binding,binding,'foliage-color','CONTROL')).toThrow();
  expect(()=>compareSemanticRoi(checker,checker.map((v,i)=>i%4===3?0:v),binding,binding,'foliage-color','CONTROL')).toThrow(/alpha/);
});
