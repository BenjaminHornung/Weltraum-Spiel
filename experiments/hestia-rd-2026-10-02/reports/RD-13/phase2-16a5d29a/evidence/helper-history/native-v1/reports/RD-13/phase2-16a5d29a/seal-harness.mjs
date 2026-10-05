import assert from 'node:assert/strict';
import { LAB,RUN,PHASE,files,bytes,fresh,START,TREE } from './support.mjs';
const label=process.argv[2];assert.match(label,/^[a-z0-9-]+$/);const pins=[...files(LAB+'/'+PHASE).map((r)=>({...r,path:PHASE+'/'+r.path})),
 ...files(LAB+'/tests/RD-13').filter((r)=>r.path.startsWith('phase2-')).map((r)=>({...r,path:'tests/RD-13/'+r.path}))];
for(const pin of pins){fresh(RUN+'/helper-history/'+label+'/'+pin.path,bytes(LAB+'/'+pin.path));}
fresh(RUN+'/helper-history/'+label+'/seal.json',{source:START,tree:TREE,pins,productIntegrated:false});console.log('RD13_OWN_HARNESS_SEALED '+label+' '+pins.length);
