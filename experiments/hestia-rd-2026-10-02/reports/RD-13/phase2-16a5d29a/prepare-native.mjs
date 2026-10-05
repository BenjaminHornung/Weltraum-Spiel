import { copyFileSync,readFileSync,mkdirSync } from 'node:fs';
import { LAB,RUN,fresh,bound,safe,sha } from './support.mjs';
// Explicitly reconstructed own reader: its only subsequent change was this API path.
// Raw failed command/error bytes remain unchanged; this is not original-source evidence.
const current=readFileSync(LAB+'/reports/RD-13/phase2-16a5d29a/support.mjs').toString();
fresh(RUN+'/helper-history/support-preflight-v2-reconstructed.mjs',current.replace("'playwright-core/lib/coreBundle.js'","'playwright-core/lib/server/utils/processLauncher.js'"));
// Existing Windows cleanup programs are staged as regular byte-identical C-only helpers,
// never installed globally. Playwright's fallback targets only its exact owned browser PID.
mkdirSync(RUN+'/bin',{recursive:true});const staged=[];
for(const name of ['cmd.exe','taskkill.exe']){const source='C:/Windows/System32/'+name;const target=RUN+'/bin/'+name;safe(target,RUN);copyFileSync(source,target,1);const raw=readFileSync(source);staged.push({name,source:{path:source,bytes:raw.length,sha256:sha(raw)},target:bound(target,RUN)});}
fresh(RUN+'/native-os-helper-staging.json',{staged,purpose:'C-only framework emergency cleanup; ordinary shutdown must remain cooperative',globalInstallation:false,productIntegrated:false,nativeExecuted:false});
console.log('RD13_NATIVE_HELPERS_STAGED_C_ONLY; bundled Playwright API diagnosis retained');
