import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from './bind-inputs.mjs';
import { createFixtureBundle } from '../dist/src/fixtures.js';
import { createWeatherReadView } from '../dist/src/contracts.js';
import { IMPLEMENTATION_DIGEST } from '../dist/src/model-pin.js';
const bundle=await createFixtureBundle(IMPLEMENTATION_DIGEST);const results=[];
for(const f of bundle)results.push(await (await createWeatherReadView(f)).read(f.query));
mkdirSync(resolve(root,'fixtures'),{recursive:true});
for(const [name,value] of [['profiles.json',bundle.map(({catalog,...f})=>f)],['read-goldens-input.json',results]]) {
  writeFileSync(resolve(root,'fixtures',name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
}
console.log(JSON.stringify({status:'PASS',profiles:bundle.length,results:results.length,write:'new files only'}));
