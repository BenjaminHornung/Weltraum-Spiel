import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,repo,verifyConsumer,verifyBuild,verifyFiles,save,json,bytes,hash} from './bindings.mjs';
verifyConsumer();verifyBuild();
const {bundles,hestiaAuthoring,macroFixture}=await import('../dist/src/fixtures.js');
const {typedClimateBuilder,sampleClimate,ebmCoefficients,heldHouWidth}=await import('../dist/src/climate.js');
const {projectMacro}=await import('../dist/src/macro.js');
const {createAnalyticReadView,trajectoryQuery}=await import('../dist/src/weather.js');
const {synopticObjects,EPOCH_TICKS}=await import('../dist/src/synoptic.js');
const {cellCenter,cellArea,FACES,direction,coordinates,scale}=await import('../dist/src/geometry.js');
const {canonicalCelestialJson}=await import('../dist/src/common.js');
const config=json(resolve(root,'fixtures/authoring-config.json'));
const generator={id:'frozen.hestia-generator-source',version:1,digest:'sha256:'+json(resolve(root,'ConsumerBindings.json')).productReads.find(f=>f.path.endsWith('/seed.ts')).sha256};
const inputs=[];const rows=[];
for(const bundle of [...await bundles(),await hestiaAuthoring()]){
  const macro=await macroFixture(bundle,generator),input={bundle,macro,config},view=await createAnalyticReadView(input);inputs.push(input);
  const samples=[];for(const n of [{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:1,z:0}])samples.push(await view.read(trajectoryQuery(bundle,n,EPOCH_TICKS)));
  rows.push({name:bundle.name,climate:view.climate,profile:view.profile,samples,objects:view.climate.status==='Known'?synopticObjects(view.profile.digest,3*EPOCH_TICKS,true):[]});
}
const geometry=[];for(const face of FACES){const n=cellCenter(face,3,3,3);geometry.push({face,level:3,x:3,y:3,n,areaM2:cellArea(face,3,3,3,1)});}
const corridor=[];const author=inputs.at(-1),authorView=await createAnalyticReadView(author);
for(let i=0;i<=8;i++){const angle=800000/author.bundle.physics.radiusMeters*i/8;corridor.push(await authorView.read(trajectoryQuery(author.bundle,{x:Math.cos(angle),y:0,z:Math.sin(angle)},EPOCH_TICKS)));}
const values={'climate-weather-goldens.json':{schema:'wxg.synthetic-functional-goldens/v1',config,rows},'geometry-goldens.json':{schema:'wxg.geometry-goldens/v1',geometry},'macro-projection.json':await projectMacro(author.bundle,author.macro,3),'authoring-inputs.json':inputs,'corridor-800km.json':{label:'Query trajectory fixture; no implemented flight or hardware proof',rows:corridor}};
for(const [name,value] of Object.entries(values)){const path=resolve(root,'fixtures',name);if(process.argv.includes('--check')){if(canonicalCelestialJson(json(path))!==canonicalCelestialJson(value))throw Error('FIXTURE_DRIFT:'+name);}else{
  if(existsSync(path)){
    if(!process.argv.includes('--refresh-after-cache-review'))throw Error('FIXTURE_EXISTS:'+name);
    const prior=json(resolve(repo,'.devtoolbox/specs/changes/wxg-01-04-2026-10-09/tests/runs/local-functional-03/summary.json'));
    const binding=prior.testedInputs.find(f=>f.path==='fixtures/'+name);if(!binding)throw Error('HISTORICAL_FIXTURE_UNBOUND');verifyFiles(root,[binding]);
    const archive=resolve(repo,'.devtoolbox/specs/changes/wxg-01-04-2026-10-09/tests/fixture-history/local-functional-03',name);if(existsSync(archive))throw Error('HISTORICAL_FIXTURE_EXISTS');save(archive,json(path));
  }
  save(path,value);
}}
console.log(JSON.stringify({status:'PASS',profiles:rows.length,projectionCells:384,corridorQueries:9,mode:process.argv.includes('--check')?'CHECK':process.argv.includes('--refresh-after-cache-review')?'REFRESH_PRIOR_BYTES_PRESERVED':'FIRST_CREATE'}));
