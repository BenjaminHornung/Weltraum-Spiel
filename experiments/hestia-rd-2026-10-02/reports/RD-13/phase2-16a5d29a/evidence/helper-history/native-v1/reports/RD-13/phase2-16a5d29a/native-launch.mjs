import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { appendFileSync,existsSync } from 'node:fs';
import { chromium } from '../../../node_modules/playwright-core/index.mjs';
import { LAB,RUN,NODE,CHROME,START,TREE,PHASE,environment,immutable,bytes,bound,json,sha,fresh,files } from './support.mjs';
Object.assign(process.env,environment());const initial=immutable();const admissionBytes=bytes(RUN+'/admission.json');const admission=json(RUN+'/admission.json');
const served=json(RUN+'/served-before-native.json');assert.equal(served.responses.length,517);assert.equal(served.start,START);
const started=Date.now();let browser,child,busy=false,expired=false,stopRequested=false;let browserExit=null;let stopping;
fresh(RUN+'/native-launch-started.json',{pid:process.pid,started:new Date(started).toISOString(),source:START,tree:TREE,admission:bound(RUN+'/admission.json'),
 executable:initial.executables[2],sourceSeal:bound(RUN+'/preflight.json'),nativeExecution:'ATTEMPTED_FUNCTIONAL_DIAGNOSTIC',productIntegrated:false});
async function closeOwned(reason){if(stopping){return stopping;}stopping=(async()=>{stopRequested=true;if(browser){await browser.close();}
  if(child&&child.exitCode===null&&child.signalCode===null){child.kill('SIGINT');}return reason;})();return stopping;}
const control=setInterval(()=>{if(existsSync(RUN+'/native.stop.json')){stopRequested=true;void closeOwned('owned-stop-file');}},200);
const deadline=setTimeout(()=>{expired=true;void closeOwned('bounded-native-deadline');},900000);
process.once('SIGINT',()=>{void closeOwned('owned-signal-SIGINT');});process.once('SIGTERM',()=>{void closeOwned('owned-signal-SIGTERM');});
try {
 browser=await chromium.launchServer({executablePath:CHROME,headless:true,host:'127.0.0.1',port:0,timeout:60000,env:environment(),
    args:['--disable-background-networking','--disable-component-update','--no-first-run','--no-default-browser-check','--disable-breakpad','--disable-crash-reporter']});
 const processHandle=browser.process();processHandle.once('exit',(exitCode,signal)=>{browserExit={exitCode,signal};});
 fresh(RUN+'/browser-owner.json',{ownerPid:process.pid,browserPid:processHandle.pid,executable:initial.executables[2],transport:'OWNED_PRIVATE_PLAYWRIGHT_SERVER_NOT_PUBLISHED',
   source:START,tree:TREE,headless:true,functionalHardwareCandidateOnly:true,qualifiedGpuPerformance:'NOT_GRANTED',productIntegrated:false});
 console.log('RD13_NATIVE_READY owned pinned browser; original frozen six bodies + new supplements, sequential');
 const args=[LAB+'/node_modules/@playwright/test/cli.js','test','--config',PHASE+'/playwright.config.ts'];
 const env={...environment(),RD13_ADMISSION_SHA256:sha(admissionBytes),RD13_BROWSER_WS:browser.wsEndpoint()};
 fresh(RUN+'/native-job-source-seal.json',{source:START,tree:TREE,admission:bound(RUN+'/admission.json'),
   originalSpec:bound(LAB+'/tests/RD-13/native.spec.ts'),originalCases:bound(LAB+'/tests/RD-13/native-cases.ts'),
    kernelSha256:admission.kernelSha256,config:bound(LAB+'/'+PHASE+'/playwright.config.ts'),newHarnessFiles:[...files(LAB+'/'+PHASE).map((r)=>({...r,path:PHASE+'/'+r.path})),
      ...files(LAB+'/tests/RD-13').filter((r)=>r.path.startsWith('phase2-')).map((r)=>({...r,path:'tests/RD-13/'+r.path}))],productIntegrated:false});
 fresh(RUN+'/native.raw.log','');busy=true;const t=Date.now();child=spawn(NODE,args,{cwd:LAB,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 fresh(RUN+'/native-child.json',{pid:child.pid,binary:bound(NODE),args,cwd:LAB,source:START,tree:TREE,admissionSha256:sha(admissionBytes),TEMP:env.TEMP,PATH:env.PATH,COMSPEC:env.COMSPEC,productIntegrated:false});
 const log=(b)=>{appendFileSync(RUN+'/native.raw.log',b);process.stdout.write(b);};child.stdout.on('data',log);child.stderr.on('data',log);
 const result=await new Promise((ok)=>{child.once('error',(e)=>log(Buffer.from(String(e))));child.once('close',(exitCode,signal)=>ok({exitCode,signal}));});
 fresh(RUN+'/native-job-receipt.json',{...result,elapsedCommandMs:Date.now()-t,timedOut:expired,raw:bound(RUN+'/native.raw.log'),source:START,tree:TREE,originalSuiteStatus:'ACTUAL_JSON_REPORT_NOT_RELABELLED',nativeExecution:'FUNCTIONAL_DIAGNOSTIC_ONLY',productIntegrated:false});
 busy=false;
 // Deadline/stop is honored AFTER a busy receipt too; there is no future-admission wait loop.
 if(expired||stopRequested){process.exitCode=1;}else{process.exitCode=result.exitCode??1;}
} catch(error){fresh(RUN+'/native-launch-error.json',{error:String(error),source:START,tree:TREE,expired,busy,firstFailureRetained:true,productIntegrated:false});console.error(error);process.exitCode=1;}
finally {clearInterval(control);clearTimeout(deadline);await closeOwned(expired?'deadline':'completed-owned-job');
 fresh(RUN+'/native-cleanup.json',{pid:process.pid,browserExit,cooperative:true,busy:false,expired,source:START,tree:TREE,elapsedCommandMs:Date.now()-started,
   noForeignCleanup:true,nativeVram:'UNKNOWN',productIntegrated:false});console.log('RD13_NATIVE_STOPPED owned browser/job cleanup complete');}
