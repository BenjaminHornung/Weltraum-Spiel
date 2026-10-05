import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { RUN,START,TREE,json,fresh,bound,served,freePort } from './support.mjs';
const native=json(RUN+'/native-cleanup.json');assert.equal(native.busy,false);assert.equal(native.browserExit.exitCode,0);assert.equal(native.cooperative,true);
await served('served-after-native');fresh(RUN+'/preview.stop.json',{owner:'RD13',source:START,tree:TREE,reason:'native job terminal and owned browser cooperatively exited',nativeCleanup:bound(RUN+'/native-cleanup.json'),productIntegrated:false});
const deadline=Date.now()+15000;while(!existsSync(RUN+'/preview-cleanup.json')){assert(Date.now()<deadline,'Owned preview cooperative shutdown deadline');await new Promise((ok)=>setTimeout(ok,100));}
const preview=json(RUN+'/preview-cleanup.json');assert.equal(preview.cooperative,true);assert.equal(preview.closed,true);await freePort('port-after-cleanup');
fresh(RUN+'/cleanup-complete.json',{source:START,tree:TREE,native:bound(RUN+'/native-cleanup.json'),preview:bound(RUN+'/preview-cleanup.json'),port:bound(RUN+'/port-after-cleanup.json'),servicesRetained:false,noForeignCleanup:true,nativeVram:'UNKNOWN',productIntegrated:false});
console.log('RD13_ALL_OWNED_SERVICES_STOPPED port5280 freshly free');
