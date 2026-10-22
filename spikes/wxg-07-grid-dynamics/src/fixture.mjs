import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {buildGrid} from '../dist/grid.js';
import {Transport,selectStepTicks} from '../dist/transport.js';
import {hestiaAuthoring,macroFixture} from '../inputs/wxg/dist/src/fixtures.js';
import {typedClimateBuilder,sampleClimate} from '../inputs/wxg/dist/src/climate.js';
import {createAnalyticReadView} from '../inputs/wxg/dist/src/weather.js';
import {threefry2x32} from '../inputs/plt/src/numerics.mjs';
import {root,load,sha,binding,save,walk,verifyInputs} from '../scripts/bindings.mjs';
export const policy={source:[1e-8,2e-11],sink:[1e-7,2e-7]};
export function coefficientBytes(grid){
  const b=Buffer.alloc(4+8*8+grid.cells.length*8+grid.edges.length*16);
  b.writeUInt32LE(grid.n,0);[grid.radius,grid.wind,grid.axis.x,grid.axis.y,grid.axis.z,grid.minimumLength,grid.maximumOutflowRate,grid.waveSpeed].forEach((x,i)=>b.writeDoubleLE(x,4+8*i));
  let offset=68;for(const c of grid.cells){b.writeDoubleLE(c.area,offset);offset+=8;}
  for(const e of grid.edges){b.writeUInt32LE(e.a,offset);b.writeUInt32LE(e.b,offset+4);b.writeDoubleLE(e.flux,offset+8);offset+=16;}return b;
}
function keep(p,b){const path=resolve(root,p);if(existsSync(path)){if(!readFileSync(path).equals(b))throw Error('FROZEN_FIXTURE_DRIFT:'+p);}else writeFileSync(path,b);}
export async function prepareFixtures(){
  verifyInputs();const inputDigest='sha256:'+binding('InputBindings.json').sha256;
  const bundle=await hestiaAuthoring(),config=load('inputs/wxg/fixtures/authoring-config.json');
  const macro=await macroFixture(bundle,{id:'wxg07.synthetic-geography-input',version:1,digest:inputDigest});
  const climate=await typedClimateBuilder(bundle,macro,config),view=await createAnalyticReadView({bundle,macro,config});
  const weather=await view.read(bundle.query);if(climate.status!=='Known'||weather.status!=='Known')throw Error('UPSTREAM_UNAVAILABLE');
  keep('fixtures/authoring.json',Buffer.from(JSON.stringify({bundle,macro,climate,controlWeather:weather})+'\n'));
  const implementation={sources:walk('src').map(binding),compiled:walk('dist').map(binding),buildScript:binding('scripts/build.mjs'),inputs:binding('InputBindings.json'),compilerLock:binding('inputs/wxg/package-lock.json')};
  const implementationDigest='sha256:'+sha(JSON.stringify(implementation));
  const profiles=[];
  for(const n of [32,48,64]){
    const grid=buildGrid(n,bundle.physics.radiusMeters,100,{x:0.3,y:1,z:0.2});
    keep(`fixtures/grid-${n}.coefficients.bin`,coefficientBytes(grid));
    const values=new Float64Array(grid.cells.length*2);
    for(let i=0;i<grid.cells.length;i++){
      const c=sampleClimate(climate,bundle,macro,grid.cells[i].center),r=threefry2x32([i,n],[0x77584707,0x20261009]);
      values[2*i]=1+(c.temperatureK-200)/200;values[2*i+1]=0.001+0.0001*r[0]/0xffffffff;
    }
    const init=Buffer.alloc(values.length*8);values.forEach((v,i)=>init.writeDoubleLE(v,i*8));keep(`fixtures/grid-${n}.initial.bin`,init);
    const dtTicks=selectStepTicks(grid,policy);
    const events=[{tick:3600*120,priority:0,sourceId:'fixture.source',commandId:'source-1h',cell:0,channel:0,massKg:1e9},{tick:24*3600*120,priority:0,sourceId:'fixture.source',commandId:'source-24h',cell:6*n*n-1,channel:1,massKg:1e6}];
    const profile={schema:'wxg07.transport-profile/v1',id:`wxg07.filtered-passive-${n}`,version:1,n,radius:grid.radius,wind:grid.wind,axis:grid.axis,dtTicks,policy,events,channels:['passive-moisture-kg-m2','passive-aerosol-kg-m2'],pressureBands:1,universeTicksPerSecond:120,waveSpectrum:'ADVECTION_ONLY_NO_GRAVITY_ACOUSTIC_OR_PRESSURE_WAVES',numerics:'FLOAT64_FIXED_ORDER_PINNED_INPUT_COEFFICIENTS_PLT_LE',minimumLength:grid.minimumLength,maximumOutflowRate:grid.maximumOutflowRate,safety:0.8,implementationDigest,inputDigest,climate:climate.binding,weatherReadProfile:view.profile,basePhysics:bundle.physics.digest,authoring:binding('fixtures/authoring.json'),coefficients:binding(`fixtures/grid-${n}.coefficients.bin`),initial:binding(`fixtures/grid-${n}.initial.bin`),provenance:{kind:'TestAssumption',note:'Two passive channels; climate-derived initial density has no calibrated humidity or aerosol interpretation. Prescribed solid rotation at maximum speed 100 m/s; no prognostic atmosphere or natural Hestia adoption.'}};
    keep(`fixtures/grid-${n}.profile-r03.json`,Buffer.from(JSON.stringify(profile,null,2)+'\n'));profiles.push(binding(`fixtures/grid-${n}.profile-r03.json`));
  }
  save('.runtime/model-bindings.json',{implementation,implementationDigest,profiles});console.log(JSON.stringify({status:'PASS',profiles}));
}
export function loadFixture(n){
  const profile=load(`fixtures/grid-${n}.profile-r03.json`);
  const actualImplementation={sources:walk('src').map(binding),compiled:walk('dist').map(binding),buildScript:binding('scripts/build.mjs'),inputs:binding('InputBindings.json'),compilerLock:binding('inputs/wxg/package-lock.json')};
  if('sha256:'+sha(JSON.stringify(actualImplementation))!==profile.implementationDigest)throw Error('MODEL_DRIFT');
  for(const f of [profile.authoring,profile.coefficients,profile.initial]){const actual=binding(f.path);if(f.bytes!==actual.bytes||f.sha256!==actual.sha256)throw Error('FIXTURE_DRIFT');}
  const grid=buildGrid(n,profile.radius,profile.wind,profile.axis);
  if(!coefficientBytes(grid).equals(readFileSync(resolve(root,profile.coefficients.path))))throw Error('GEOMETRY_COEFFICIENT_DRIFT');
  const b=readFileSync(resolve(root,profile.initial.path)),values=new Float64Array(grid.cells.length*2);for(let i=0;i<values.length;i++)values[i]=b.readDoubleLE(i*8);
  const model=new Transport(grid,profile.policy,profile.events,profile.dtTicks);
  return {profile,grid,model,initial:model.initial(values),binding:'sha256:'+binding(`fixtures/grid-${n}.profile-r03.json`).sha256};
}
