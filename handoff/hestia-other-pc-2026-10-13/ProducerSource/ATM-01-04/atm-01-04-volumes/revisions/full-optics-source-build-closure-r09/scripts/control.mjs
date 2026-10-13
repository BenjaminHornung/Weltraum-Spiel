import {readFileSync,mkdirSync} from 'node:fs';
import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {root,verifyInputs,save,hash,bytes} from './bindings.mjs';
verifyInputs();
mkdirSync(root+'/.runtime',{recursive:true});
await build({entryPoints:[root+'/src/reuse.ts'],outfile:root+'/.runtime/reuse.mjs',bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'raw',setup(b){b.onLoad({filter:/\.json\?raw$/},args=>({contents:JSON.stringify(readFileSync(args.path.split('?')[0],'utf8')),loader:'text'}));}}]});
const rd=await import('../.runtime/reuse.mjs');
const weather={windMps:[8,0,-4],rain01:0.8,cloud01:0.7,snow01:0};
assert.deepEqual(rd.rainVelocityMps(weather),[1.6,-12,-0.8]);
assert.equal(rd.applyWindInputs('control.decor',480,1,weather,[0,0,0,1]).angles.x,0);
assert.equal(rd.sampleAnalyticWetness(rd.DEFAULT_WETNESS_PRESET,600,0,'shielded').wetness01,0);
const dir=root+'/inputs/rd/fixtures/F00-CONTROL',manifest=JSON.parse(readFileSync(dir+'/manifest.json'));
const fixture=await rd.importFixture(readFileSync(dir+'/manifest.json'),new Map(manifest.payloads.map(p=>[p.id,new Uint8Array(readFileSync(dir+'/'+p.path))])));
const index=rd.createVoxelSourceIndex(fixture),field=rd.buildRainColumns(index,rd.rainVelocityMps(weather),4);
assert.equal(field.columns.length,16);assert.equal(field.fixtureDigest.length,64);index.dispose();
const wx=await import('../inputs/wxg/repo/spikes/wxg-01-04-analytic/scripts/read-port.mjs');
const port=await wx.loadReadPort(),inputs=JSON.parse(readFileSync(root+'/inputs/wxg/repo/spikes/wxg-01-04-analytic/fixtures/authoring-inputs.json'));
let input,view;
for(const candidate of inputs){
 if(!candidate.bundle.physics.hazards.includes('Storms')||candidate.bundle.physics.pressureCoordinate!=='AltitudeMeters')continue;
 const read=await port.createAnalyticReadView(candidate);
 if(read.climate.status==='Known'){input=candidate;view=read;break;}
}
if(!input||!view)throw Error('NO_SUPPORTED_STORM_PROFILE');
const synoptic=await import('../inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/src/synoptic.js');
const tick=7200000,storm=synoptic.synopticObjects(view.profile.digest,tick,true).find(o=>o.kind==='Vortex'&&o.envelopeQ16>0);
assert.ok(storm);
const query=port.trajectoryQuery(input.bundle,storm.centerBodyFixed,tick,0),result=await view.read(query);
assert.equal(result.status,'Known');
assert.ok(result.sample.stormIds.includes(storm.id));
save('fixtures/chosen-weather-input.json',input);
save('fixtures/chosen-weather-query.json',query);
save('fixtures/chosen-weather-result.json',result);
save('ControlReceipt.json',{status:'PASS',rdRainColumns:16,wxgStatus:result.status,WeatherSnapshotId:result.WeatherSnapshotId,profile:view.profile,originalEntry:'loadReadPort',exitCode:0,environment:'LOCAL_WINDOWS_ISOLATED',fixtureKind:'SYNTHETIC',productIntegration:'NO',inputDigest:bytes('InputBindings.json'),compiledReuse:bytes('.runtime/reuse.mjs')});
console.log(JSON.stringify({status:'PASS',control:'ACTUAL_UNCHANGED_RD_AND_WXG_CODE',rainColumns:16,wxgStatus:result.status,stormIds:result.sample.stormIds}));
