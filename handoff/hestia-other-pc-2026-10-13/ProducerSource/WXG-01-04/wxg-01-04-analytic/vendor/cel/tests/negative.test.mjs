import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtures,mutable,rebind } from './helpers.mjs';
import { createWeatherReadView,validateBundle,contentDigest,validateExactRef } from '../dist/src/contracts.js';
const bundle=await fixtures();
const invalid=[
 ['wrong Kelvin unit',f=>f.physics.units.temperature='C'],
 ['wrong Pascal unit',f=>f.physics.units.pressure='kPa'],
 ['wrong meter unit',f=>f.physics.units.length='km'],
 ['inverted temperature bounds',f=>f.physics.temperatureRangeK=[600,50]],
 ['negative pressure range',f=>f.physics.pressureRangePa=[-1,1000000]],
 ['negative reference pressure',f=>f.physics.referencePressurePa=-1],
 ['invalid molar sum',f=>f.physics.gasMixture[0].moleFraction=0.5],
 ['negative mole fraction',f=>f.physics.gasMixture[0].moleFraction=-0.1],
 ['duplicate gas species',f=>f.physics.gasMixture.push({...f.physics.gasMixture[0]})],
 ['missing rotation provenance',f=>f.physics.rotation.provenance.kind='Catalog'],
 ['zero rotation',f=>f.physics.rotation.value.rotationPeriodSeconds=0],
 ['invalid albedo',f=>f.physics.bondAlbedo=1.1],
 ['negative internal heat',f=>f.physics.internalHeatFluxWPerM2=-1],
 ['negative extinction',f=>f.optics.miePerM=-1],
 ['unsupported optics units',f=>f.optics.coefficientUnit='1/km'],
 ['closed atmosphere shell',f=>f.physics.outerRadiusMeters=f.physics.radiusMeters],
 ['invented hazard',f=>f.physics.hazards=['Imaginary']],
 ['unknown body reference',f=>f.physics.body.id='planet.missing'],
 ['wrong star',f=>f.physics.star.id='planet.hestia'],
 ['changed body radius',f=>f.physics.radiusMeters+=1],
 ['unbound ephemeris',f=>f.physics.ephemeris.digest='sha256:'+'0'.repeat(64)],
 ['unbound numeric profile',f=>f.profile.numerics.version=2],
 ['unbound model implementation',f=>f.profile.model.digest='sha256:'+'0'.repeat(64)],
 ['zero weather interval',f=>f.profile.ticksPerWeatherStep=0],
 ['unknown saturation implementation',f=>f.physics.condensibleSpecies=[{speciesId:'H2O',saturation:{id:'fake',version:1,digest:'sha256:'+'0'.repeat(64)}}]],
 ['unbound sample aerosol',f=>f.records[0].sample.aerosols=[{speciesId:'fake',massMixingRatio:0.1}]],
 ['unbound condensate',f=>f.records[0].sample.condensates=[{speciesId:'H2O',massMixingRatio:0.1}]],
 ['unbound rain',f=>f.records[0].sample.precipitation=[{speciesId:'H2O',phase:'liquid',massFluxKgPerM2S:1}]],
 ['negative sample pressure',f=>f.records[0].sample.pressurePa=-1],
 ['temperature outside supported range',f=>f.records[0].sample.temperatureK=601],
 ['zero support radius',f=>f.records[0].supportRadiusMeters=0],
 ['duplicate exact query record',f=>f.records.push(mutable(f.records[0]))],
 ['forged natural constant provenance',f=>f.physics.assumptionProvenance.kind='Catalog'],
 ['camera canonical input',f=>f.query.cameraPosition={x:1,y:2,z:3}],
 ['microseconds second clock',f=>f.query.tickUs='1000000'],
 ['invalid tick fraction',f=>f.query.simulationTick=1.5],
 ['negative tick',f=>f.query.simulationTick=-1],
 ['unsafe tick',f=>f.query.simulationTick=Number.MAX_SAFE_INTEGER+1],
 ['wrong frame',f=>f.query.frameId='frame:render'],
 ['wrong frame kind',f=>f.query.frameKind='RenderRelative'],
 ['altitude and position disagree',f=>f.query.vertical.altitudeMeters=10],
 ['extra unrecognized profile field',f=>f.profile.quality='Ultra'],
 ['forged catalogue signature',f=>f.catalog.signature='fake']
];
for(const [name,edit] of invalid)test(name,async()=>{const f=mutable(bundle[2]);edit(f);await assert.rejects(async()=>validateBundle(await rebind(f)));});
for(const n of [NaN,Infinity,-Infinity])test('nonfinite schema/sample/query '+String(n),async()=>{
  for(const edit of [f=>f.physics.referencePressurePa=n,f=>f.records[0].sample.windBodyFixedMps.x=n,f=>f.query.bodyFixedPositionMeters.z=n]) {
    const f=mutable(bundle[2]);edit(f);await assert.rejects(()=>validateBundle(f));
  }
});
test('exact refs reject malformed digest, identity and versions',()=>{
  for(const r of [{id:'valid',version:0,digest:'sha256:'+'a'.repeat(64)},
    {id:'valid',version:1,digest:'sha256:'+'A'.repeat(64)},
    {id:'e\u0301',version:1,digest:'sha256:'+'a'.repeat(64)},
    {id:'\ud800',version:1,digest:'sha256:'+'a'.repeat(64)}])assert.throws(()=>validateExactRef(r));
});
test('airless cannot carry rain or air optics',async()=>{
  for(const edit of [f=>f.records[0].sample.precipitation=[{speciesId:'H2O',phase:'liquid',massFluxKgPerM2S:1}],f=>f.optics.miePerM=0.1]) {
    const f=mutable(bundle[1]);edit(f);await assert.rejects(async()=>validateBundle(await rebind(f)));
  }
});
test('GasGiant needs pressure without elevation; pressure-level sample must agree',async()=>{
  const view=await createWeatherReadView(bundle[4]);assert.equal((await view.read(bundle[4].query)).status,'Known');
  for(const edit of [f=>f.query.vertical={kind:'AltitudeMeters',altitudeMeters:0},f=>f.query.vertical.pressurePa=-1,
    f=>f.records[0].sample.pressurePa=99999]) {
    const f=mutable(bundle[4]);edit(f);await assert.rejects(async()=>validateBundle(await rebind(f)));
  }
});
test('stale source/event/profile hashes reject before reads',async()=>{
  for(const edit of [f=>f.binding.sourceDigest='sha256:'+'a'.repeat(64),f=>f.events.push({id:'changed'}),
    f=>f.binding.eventDigest='sha256:'+'a'.repeat(64),f=>f.profile.digest='sha256:'+'a'.repeat(64),
    f=>f.optics.physics.digest='sha256:'+'a'.repeat(64)]) {
    const f=mutable(bundle[2]);edit(f);await assert.rejects(()=>validateBundle(f));
  }
});
test('canonical bytes reject cycles, sparse arrays, undefined and non-JSON objects',async()=>{
  const c={};c.self=c;
  for(const v of [c,Array(2),{x:undefined},new Date(),{x:NaN}])await assert.rejects(()=>contentDigest(v));
});
