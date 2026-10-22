import test from 'node:test';
import assert from 'node:assert/strict';
import {input,authoringInput,config,canonical,reseal,pmdBody,candidateProfile,createCandidateFrames,candidateBrickInput} from './helpers.mjs';
import {typedClimateBuilder,sampleClimate,ebmCoefficients,heldHouWidth,validateConfig} from '../dist/.a0-runtime/benni-pc-pmd-normal-core-source-r01/src/climate.js';
import {projectMacro,sampleMacro} from '../dist/.a0-runtime/benni-pc-pmd-normal-core-source-r01/src/macro.js';
import {FACES,cellCenter,coordinates,direction} from '../dist/.a0-runtime/benni-pc-pmd-normal-core-source-r01/src/geometry.js';
import {createAnalyticReadView,trajectoryQuery} from '../dist/.a0-runtime/benni-pc-pmd-normal-core-source-r01/src/weather.js';
import {createPlanetaryMacroSource,samplePlanetaryMacro} from '../dist/apps/weltraum-browser/src/world-generation/planetaryMacro.js';
import {createPlanetaryBrick} from '../dist/apps/weltraum-browser/src/world-generation/planetaryMacroTerrain.js';
import {validateVoxelBrick} from '../dist/apps/weltraum-browser/src/voxel/brick.js';
import {voxelSampleIndex} from '../dist/apps/weltraum-browser/src/voxel/channels.js';

test('shared generated PMD changes real valid brick density and climate lapse together; negative heights and inventories remain honest',async()=>{
  const d=await authoringInput(),source=await createPlanetaryMacroSource(pmdBody,candidateProfile()),changed=await createPlanetaryMacroSource(pmdBody,candidateProfile(2499));
  const n={x:1,y:0,z:0},height=samplePlanetaryMacro(source,n).elevationMeters,other=samplePlanetaryMacro(changed,n).elevationMeters;
  assert.ok(Math.abs(height-other)>1e-6);
  const frames=createCandidateFrames(source,pmdBody),a=await createPlanetaryBrick(candidateBrickInput(source,pmdBody,frames)),b=await createPlanetaryBrick(candidateBrickInput(changed,pmdBody,frames));
  const shifted=await createPlanetaryBrick({...candidateBrickInput(source,pmdBody,frames),brickCoordinate:{x:0,y:1,z:0}});
  assert.equal(validateVoxelBrick(shifted.brick).valid,true);assert.notEqual(a.brick.contentHash,shifted.brick.contentHash);
  const center=voxelSampleIndex({x:1,y:33,z:1});assert.ok(Math.abs(shifted.brick.densityBuffer[center]-a.brick.densityBuffer[center]-16)<1e-4);
  assert.equal(shifted.bindingData.brickCoordinate.y,1);assert.equal(shifted.bindingData.causalTick,120);assert.equal(shifted.bindingData.sourceRevision,7);
  await assert.rejects(()=>createPlanetaryBrick({...candidateBrickInput(source,pmdBody,frames),causalTick:121}),/PMD_TERRAIN_FRAME_OR_TICK/);
  await assert.rejects(()=>createPlanetaryBrick({...candidateBrickInput(source,pmdBody,frames),surfaceFrame:{...frames.surface,time:{tick:120,epochSeconds:2}}}));
  assert.equal(validateVoxelBrick(a.brick).valid,true);assert.equal(validateVoxelBrick(b.brick).valid,true);
  assert.notEqual(a.brick.contentHash,b.brick.contentHash);assert.notDeepEqual(a.pmd,b.pmd);
  const idx=voxelSampleIndex({x:1,y:33,z:1});
  assert.ok(Math.abs((b.brick.densityBuffer[idx]-a.brick.densityBuffer[idx])-(height-other))<1e-4);
  assert.ok(a.brick.densityBuffer.some(v=>v<0)&&a.brick.densityBuffer.some(v=>v>0));
  assert.ok(b.brick.densityBuffer.some(v=>v<0)&&b.brick.densityBuffer.some(v=>v>0));
  assert.ok(a.brick.materialBuffer.every(v=>v===0));assert.equal(a.brick.cellDimensions.y*a.brick.voxelSizeMeters,16);
  const c=await typedClimateBuilder(d.bundle,source,d.config),c2=await typedClimateBuilder(d.bundle,changed,d.config);
  const s=sampleClimate(c,d.bundle,source,n),s2=sampleClimate(c2,d.bundle,changed,n);
  assert.ok(Math.abs((s2.temperatureK-s.temperatureK)+(other-height)*d.config.lapseKPerM)<1e-10);
  assert.equal(canonical(c.macroGeography),canonical(a.pmd));assert.equal(canonical((await projectMacro(d.bundle,source,1)).source),canonical(a.pmd));
  const negative=FACES.map(face=>cellCenter(face,0,0,0)).find(n=>samplePlanetaryMacro(source,n).elevationMeters<0);
  assert.ok(negative);const warm=sampleClimate(c,d.bundle,source,negative),geo=samplePlanetaryMacro(source,negative);
  assert.ok(warm.temperatureK>=c.surfaceTemperatureRangeK[0]&&warm.temperatureK<=c.surfaceTemperatureRangeK[1]);
  const noElevation=await typedClimateBuilder(d.bundle,source,{...d.config,lapseKPerM:0});
  assert.ok(c.surfaceTemperatureRangeK[1]-noElevation.surfaceTemperatureRangeK[1]>=2500*d.config.lapseKPerM-1e-10);
  assert.equal(warm.biomeHint,'UNKNOWN');assert.equal(warm.hydrologyHint,'UNKNOWN');
  assert.equal(canonical(geo.reservoir),canonical({status:'UNKNOWN'}));assert.equal(geo.physicalComposition,'UNKNOWN');
  assert.equal(geo.realReservoirInventory,'UNKNOWN');assert.equal(a.knowledge.biome,'UNKNOWN');
  console.log('PMD_BRICK_WXG_PROOF '+JSON.stringify({pmd:a.pmd,changedPmd:b.pmd,brickContentHash:a.brick.contentHash,changedBrickContentHash:b.brick.contentHash,
    terrainBinding:a.binding,frame:a.frame,shiftedHash:shifted.brick.contentHash,shiftedDensity:shifted.brick.densityBuffer[center],shiftedBinding:shifted.bindingData,cellDimensions:a.brick.cellDimensions,sampleDimensions:a.brick.sampleDimensions,voxelSizeMeters:a.brick.voxelSizeMeters,
    densityAtDatumSample:a.brick.densityBuffer[idx],changedDensityAtDatumSample:b.brick.densityBuffer[idx],height,changedHeight:other,
    climatePmd:c.macroGeography,temperatureK:s.temperatureK,changedTemperatureK:s2.temperatureK,lapseKPerM:d.config.lapseKPerM,
    negativeHeight:geo.elevationMeters,negativeHeightTemperatureK:warm.temperatureK,surfaceTemperatureRangeK:c.surfaceTemperatureRangeK,knowledge:a.knowledge,reservoir:geo.reservoir}));
});
test('canonical BodyFixed +Z pole and +X equator bind P2 and positive zonal wind',async()=>{
 const d=await input();d.config={...d.config,seasonalAmplitudeK:0,tidalContrastK:0,lapseKPerM:0};
 const view=await createAnalyticReadView(d);
 const pole=await view.read(trajectoryQuery(d.bundle,{x:0,y:0,z:1},0)),equator=await view.read(trajectoryQuery(d.bundle,{x:1,y:0,z:0},0));
 assert.equal(pole.status,'Known');assert.equal(equator.status,'Known');assert.equal(view.climate.status,'Known');
 assert.notEqual(view.climate.p2AmplitudeK,0);assert.ok(d.config.zonalWindMps>0);
 assert.equal(Math.hypot(pole.sample.windBodyFixedMps.x,pole.sample.windBodyFixedMps.y,pole.sample.windBodyFixedMps.z),0);
 assert.equal(equator.sample.windBodyFixedMps.x,0);assert.equal(equator.sample.windBodyFixedMps.z,0);assert.equal(equator.sample.windBodyFixedMps.y,d.config.zonalWindMps);
 assert.ok(Math.abs((pole.sample.temperatureK-equator.sample.temperatureK)-1.5*view.climate.p2AmplitudeK)<1e-12);
 const seasonalAmplitudeK=config.seasonalAmplitudeK;assert.ok(seasonalAmplitudeK>0);
 const seasonal=await createAnalyticReadView({...d,config:{...d.config,seasonalAmplitudeK}});
 const north=await seasonal.read(trajectoryQuery(d.bundle,{x:0,y:0,z:1},0));
 const south=await seasonal.read(trajectoryQuery(d.bundle,{x:0,y:0,z:-1},0));
 assert.equal(north.status,'Known');assert.equal(south.status,'Known');
 assert.ok(Math.abs((north.sample.temperatureK-south.sample.temperatureK)+2*seasonalAmplitudeK)<1e-12);
});
test('W-GEO-01: macro/climate/hydrology projections are byte stable independent of call order',async()=>{
  const d=await input();const before=canonical(d);const a=await projectMacro(d.bundle,d.macro,3),c=await typedClimateBuilder(d.bundle,d.macro,d.config);
  assert.equal(a.cells.length,384);assert.equal(c.status,'Known');const first=sampleClimate(c,d.bundle,d.macro,{x:1,y:0,z:0});
  for(const face of [...FACES].reverse())for(let y=0;y<8;y++)for(let x=0;x<8;x++){const n=cellCenter(face,3,x,y);const geo=sampleMacro(d.macro,n);assert.ok(geo.landFraction>=0&&geo.landFraction<=1);assert.equal(geo.landFraction+geo.openLiquidFraction,1);assert.ok(geo.elevationMeters>=0);assert.ok(geo.roughness>=0);assert.equal(geo.reservoir,null);}
  assert.equal(canonical(await projectMacro(d.bundle,d.macro,3)),canonical(a));assert.equal(canonical(await typedClimateBuilder(d.bundle,d.macro,d.config)),canonical(c));assert.equal(canonical(first),canonical(sampleClimate(c,d.bundle,d.macro,{x:1,y:0,z:0})));assert.equal(canonical(d),before);
});
test('two-mode EBM matches independent closed equations and no-transport control',()=>{
  const c=ebmCoefficients(config,0.3,0);assert.equal(c.meanTemperatureK,280);assert.ok(Math.abs(c.p2AmplitudeK+60/5.6)<1e-12);
  const control=ebmCoefficients({...config,diffusionWPerM2K:0},0.3,0);assert.equal(control.p2AmplitudeK,-30);assert.equal(control.meanTemperatureK,c.meanTemperatureK);
  for(const mu of [-1,-0.5,0,0.5,1]){const p2=(3*mu*mu-1)/2,T=c.meanTemperatureK+c.p2AmplitudeK*p2;const incoming=238-60*p2,outgoing=238+2*(T-280),transport=-6*0.6*c.p2AmplitudeK*p2;assert.ok(Math.abs(incoming-outgoing+transport)<1e-12);}
});
test('Held-Hou width is separate scaling diagnostic, unsupported outside small-angle bounds',()=>{
  const small={...config,circulationHeightMeters:1000,circulationDeltaK:10};const w=heldHouWidth(small,6371000,86400,9.81),slower=heldHouWidth(small,6371000,129600,9.81);assert.ok(w!==null&&slower!==null);assert.ok(Math.abs(slower/w-1.5)<1e-12);
  assert.equal(heldHouWidth(config,6371000,10000000,9.81),null);assert.throws(()=>heldHouWidth(config,0,86400,9.81));assert.throws(()=>heldHouWidth(config,6371000,0,9.81));
});
test('climate invalid ranges/species/source/biome-as-input fail closed and Hestia remains Unsupported',async()=>{
  const d=await input();for(const edit of [c=>c.feedbackWPerM2K=0,c=>c.diffusionWPerM2K=-1,c=>c.referenceTemperatureK=NaN,c=>c.seasonPeriodTicks=1.5,c=>c.biome='final']){const c=structuredClone(config);edit(c);assert.throws(()=>validateConfig(c));}
  const h=await input(0);assert.equal((await typedClimateBuilder(h.bundle,h.macro,h.config)).status,'Unsupported');assert.equal((await typedClimateBuilder((await input(1)).bundle,(await input(1)).macro,config)).status,'NoAtmosphere');
  await assert.rejects(()=>typedClimateBuilder(d.bundle,null,config),/MACRO_REQUIRED/);
  const reservoir=structuredClone(d.macro);reservoir.reservoirKgPerM2=1;const sealedReservoir=await reseal(reservoir);await assert.rejects(()=>typedClimateBuilder(d.bundle,sealedReservoir,config),/RESERVOIR_SPECIES/);
  const huge={...config,referenceTemperatureK:600};await assert.rejects(()=>typedClimateBuilder(d.bundle,d.macro,huge),/climate.maximum/);
});
test('all seam/corner geography/climate values are continuous in body coordinates',async()=>{
  const d=await input(),c=await typedClimateBuilder(d.bundle,d.macro,config);
  for(const n of [{x:1,y:1,z:0},{x:1,y:1,z:1},{x:-1,y:1,z:-1}]){const q=coordinates(n),p=direction(q.face,q.u,q.v);const a=sampleClimate(c,d.bundle,d.macro,n),b=sampleClimate(c,d.bundle,d.macro,p);assert.ok(Math.abs(a.temperatureK-b.temperatureK)<1e-12);assert.ok(Math.abs(a.geo.landFraction-b.geo.landFraction)<1e-12);}
});
