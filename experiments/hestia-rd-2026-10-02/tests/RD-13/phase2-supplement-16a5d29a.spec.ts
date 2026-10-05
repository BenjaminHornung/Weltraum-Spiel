import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PerspectiveCamera } from 'three';
import { PRODUCTION_KERNEL, hitDepth, traceOracle } from '../../src/experiments/voxel-rays/ray';
import { nativeMismatches } from '../../src/experiments/voxel-rays/qualification';
import { nativeCases } from './native-cases';
import { observations, settle, state, capture, record, digest, source } from './phase2-observe-16a5d29a';
import { numericVisible } from './phase2-numeric-16a5d29a';
const entry='/src/experiments/voxel-rays/index.html';observations();
test('supplement v1: original geometric probes without substituting their authored ready gate',async({page})=>{
 await page.goto(entry+'?testBridge=1');const admission=await settle(page);let result:any;
 try {result=await page.evaluate(async()=>await (window as any).TestBridge.probeCases());}catch(e){result={status:'FAIL',reason:String(e)};}
 record('diagnosis/geometric-v1.json',{source,productIntegrated:false,admission,result,originalReadyGateUnchanged:true,originalBodiesStatus:'SEPARATE_ORIGINAL_REPORT'});
 expect(result.results,JSON.stringify(result)).toHaveLength(12);for(const r of result.results){expect(r.result.status,JSON.stringify(r)).toBe('PASS');}for(const r of result.faults){expect(r.status,JSON.stringify(r)).toBe('FAIL');}
});
test('supplement v1: native visible-mode P2 witness with actual float MRT and resolved attachment depth',async({page})=>{
 await page.goto(entry+'?testBridge=1');await settle(page);
 const admitted=JSON.parse(readFileSync('C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-13/phase2-16a5d29a-20261004-a/admission.json','utf8'));
 expect(digest(PRODUCTION_KERNEL)).toBe(admitted.kernelSha256);const volume=nativeCases.find((r)=>r.id==='hollow-inside-air')!.volume;
 const geometric=traceOracle(volume,[.5,.5,.5],[1,0,0]);expect(geometric.t).toBe(.5);expect(geometric.normal).toEqual([1,0,0]);
 const camera=new PerspectiveCamera(55,1,.01,2000);camera.position.set(.5,.5,.5);camera.lookAt(1.5,.5,.5);camera.updateMatrixWorld();
 const result=await page.evaluate(numericVisible,{kernel:PRODUCTION_KERNEL,packed:Array.from(volume.packed),projectionView:camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).elements});
 const rows=(result.rows??[]).map((r:any)=>{const first=r.visible===0||r.double!==0;const t=first?.5:(2-.5)/1;
  const expected=first?geometric:{...geometric,t,point:[2,.5,.5] as const,normal:[-1,0,0] as const,cell:[2,0,0] as const,originalCell:[2,0,0] as const};
  const withUnknown={...expected,unknownTraversed:r.unknown};const mismatches=nativeMismatches(withUnknown,r.observed,hitDepth(withUnknown.point!,camera));return {...r,expected:withUnknown,mismatches,status:mismatches.length?'FAIL':'PASS',uploadedPackedSha256:digest(Buffer.from(r.uploadedPacked))};});
 record('numeric/visible-v1.json',{schema:'rd13-native-visible-witness-v1',source,productIntegrated:false,kernelSha256:digest(PRODUCTION_KERNEL),shaderSha256:digest(result.fragment),vertexSha256:digest(result.vertex),
  depthShaderSha256:digest(result.depthShader),originalIndependentGeometricOracle:geometric,visibleExpectedAuthority:'Analytical x=2 entry plane of declared [1,0,1] input; no epsilon/restart/crop or changed original oracle',
  result:{...result,rows},inputPackedSha256:digest(volume.packed),fixtureAuthority:'OWNED SYNTHETIC TEST ONLY, not an original gallery fixture',nativeGpuMs:'UNKNOWN',nativeVram:'UNKNOWN'});
 expect(result.status,JSON.stringify(result)).toBe('READBACK_COMPLETE');expect(rows).toHaveLength(9);
 for(const r of rows){expect(r.status,JSON.stringify(r)).toBe(r.fault?'FAIL':'PASS');}
});
test('supplement v1: normal home/gallery visible links and bounded ordinary control/compositor matrix, diagnostic collection not native acceptance',async({page})=>{
 test.setTimeout(360000);
 await page.goto('/');expect(await page.evaluate(()=>Object.hasOwn(window,'TestBridge'))).toBe(false);await page.getByRole('link',{name:'RD13 bounded voxel rays / greedy control'}).click();await settle(page);
 const rootPath=await state(page);expect(rootPath.bridgePresent).toBe(false);await capture(page,'normal-home-tool');
 await page.goto('/');await page.getByRole('link',{name:'RD40 variant gallery'}).click();const gallery={url:page.url(),bridgePresent:await page.evaluate(()=>Object.hasOwn(window,'TestBridge')),variants:await page.locator('#experiment option').allTextContents()};
 expect(gallery.variants.some((v)=>/RD13|rays-no-ao|greedy-no-ao/.test(v))).toBe(false);await page.getByRole('link',{name:'RD13 bounded voxel rays / greedy control'}).click();await settle(page);expect((await state(page)).bridgePresent).toBe(false);
 record('flows/navigation-v1.json',{source,productIntegrated:false,rootPath,gallery,toolAfterGallery:await state(page),visibleClickPath:true});
 const rows=[['F00-CONTROL-REPLAY',0],['F03-SHELTER-REPLAY',120],['F04-DETACH-REPLAY',120],['F06-MATERIAL-REPLAY',90],['F05-CUTOUT-REPLAY',0],['F01-HVP-COAST-REPLAY',0]] as const;const results=[];
 for(const [fixture,tick] of rows){for(const variant of ['rays-no-ao','greedy-no-ao']){
  await page.selectOption('#fixture',fixture);await page.selectOption('#variant',variant);await page.click('#remount');let value=await settle(page);
  if(/Host render submitted/.test(value.status??'')){await page.fill('#tick',String(tick));await page.click('#seek');value=await settle(page);}
  const name=fixture.slice(0,3)+'-'+variant+'-tick'+tick;const shot=await capture(page,name);results.push({fixture,variant,tick,name,actualSubmission:/Host render submitted/.test(shot.before.status??''),...shot});
 }}
 await page.selectOption('#fixture','F03-SHELTER-REPLAY');await page.selectOption('#variant','greedy-no-ao');await page.click('#remount');const start=await settle(page);const controls:any[]=[];
 if(/Host render submitted/.test(start.status??'')){
  const cameras=await page.locator('#camera option').evaluateAll((options)=>options.map((o)=>(o as HTMLOptionElement).value));if(cameras.length>1){await page.selectOption('#camera',cameras[1]);controls.push({command:'original fixed camera',state:await settle(page)});}
  for(const command of ['pause','step','reset']){await page.click('#'+command);controls.push({command,state:await settle(page)});}
  await page.selectOption('#resolution','960x540');controls.push({command:'960x540',state:await settle(page)});await page.selectOption('#dpr','2');controls.push({command:'DPR2',state:await settle(page)});await capture(page,'F03-greedy-dpr2-controls');
 }
 await page.click('#dispose');controls.push({command:'dispose',state:await settle(page)});await capture(page,'explicit-dispose');await page.click('#remount');controls.push({command:'explicit remount',state:await settle(page)});
 record('flows/matrix-v1.json',{source,productIntegrated:false,results,controls,controlAdmission:start,controlsBlocked:!/Host render submitted/.test(start.status??''),
  partialF01:'64³ selected terrain, original water, omitted vegetation, no face AO; not full parity',missingReferences:{unseenReddit:7,missingConceptImages:6,lfsPointerOnlyImages:5},nativeGpuMs:'UNKNOWN',nativeVram:'UNKNOWN'});
 expect(results).toHaveLength(12);expect(results.every((r)=>!r.before.bridgePresent)).toBe(true);
});
test('supplement v1: R1 terminal facts after real F06 adoption only, no forced ready state',async({page})=>{
 await page.goto(entry+'?testBridge=1');await settle(page);await page.selectOption('#fixture','F06-MATERIAL-REPLAY');await page.selectOption('#variant','greedy-no-ao');await page.click('#remount');let current=await settle(page);let failure:string|null=null;let terminal:any=null;
 if(/Host render submitted/.test(current.status??'')){await page.fill('#tick','90');await page.click('#seek');current=await settle(page);
  if(/Host render submitted/.test(current.status??'')){try {await page.evaluate(async()=>await (window as any).TestBridge.failReplacement());}catch(e){failure=String(e);}terminal=await page.evaluate(()=>(window as any).TestBridge.read());}
 }
 record('flows/r1-terminal-v1.json',{source,productIntegrated:false,current,failure,terminal,status:terminal?'EXECUTED_REAL_ADOPTED_R1':'NOT_RUN_BLOCKED_BY_ACTUAL_NATIVE_TERMINAL',noSourceFix:true});
 if(terminal){expect(failure).toMatch(/RGBA8UI|format/i);expect(terminal.hidden).toBe(true);expect(terminal.diagnostics.terminal.disposed).toBe(true);expect(terminal.facts.fixtureDigest).toBe((current.projected as any).facts.fixtureDigest);}
 else {expect(current.status).toContain('FAIL / hidden');}
});
