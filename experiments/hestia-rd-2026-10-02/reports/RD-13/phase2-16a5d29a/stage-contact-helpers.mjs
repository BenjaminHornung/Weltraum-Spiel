import assert from 'node:assert/strict';
import { readdirSync,lstatSync,readFileSync,mkdirSync,writeFileSync } from 'node:fs';
import { join,dirname } from 'node:path';
import { LAB,RUN,PHASE,sha,fresh,bound,safe } from './support.mjs';
// Reuse the existing installed helper, staged as exact bytes under C. No install,
// dependency/package/configuration change or execution from the user-site path.
const source='C:/Users/hornung/AppData/Roaming/Python/Python312/site-packages/PIL';
const target=RUN+'/python-helpers/PIL';const pins=[];
fresh(RUN+'/helper-history/contact-sheet-v1.py',readFileSync(LAB+'/'+PHASE+'/contact-sheet.py'));
function copy(root,relative='') {for(const e of readdirSync(join(root,relative),{withFileTypes:true})){const r=relative?relative+'/'+e.name:e.name;const from=join(root,r);const stat=lstatSync(from);
 assert(!stat.isSymbolicLink(),from);if(e.isDirectory()){if(e.name!=='__pycache__'){copy(root,r);}continue;}
 assert(stat.isFile(),from);const data=readFileSync(from);const to=join(target,r);safe(to,RUN);mkdirSync(dirname(to),{recursive:true});writeFileSync(to,data,{flag:'wx'});assert.equal(bound(to).sha256,sha(data));pins.push({path:r,bytes:data.length,sha256:sha(data)});}}
copy(source);fresh(RUN+'/contact-helper-staging.json',{schema:'rd13-existing-contact-helper-staging-v1',source,target,pins,method:'Exact existing installed Pillow bytes; exclude bytecode cache',
 packageInstallation:false,globalConfigurationChange:false,productIntegrated:false,nativeExecuted:false});console.log('RD13_EXISTING_CONTACT_HELPERS_STAGED_C_ONLY files='+pins.length);
