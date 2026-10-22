// In-memory state/fault models only. No OS calls, authority records or actual retirement claims.
export const AUTHORITY_FIELDS='schema version humanMessageRef humanMessageSha256 authorizationClass scope retry candidateManifestSha256 packagePinsSha256 outerSourceSha256 dispatcherSourceSha256 runnerSourceSha256 actualAppThread actualAppTurn appStatus paseoAgent workspace notBeforeUtc expiresUtc'.split(' ');
export const CLOCK_FIELDS='schema version authorityRecordSha256 humanMessageSha256 clockMode clockOrigin nativeClockApi utcClockApi managedOuterOutsideCIFI dispatcherStartupIncluded issued workEnd overallEnd utcIssued utcEnd'.split(' ');
export const CREATE_STAGES=['clock','pins','job','job-flags','pipes','attribute-job','attribute-handles','environment','native-create','raw-own','child-copies-close','wrap-stdout','wrap-stderr','tuple','membership','fresh-clock','resume','thread-close','pump-stdout','pump-stderr','terminal','exit-code','job-zero','stdout-eof','stderr-eof'];
export const CLOSE_STAGES=['reader-stdout-close','reader-stderr-close','stdin-read-close','stdin-write-close','stdout-read-close','stdout-write-close','stderr-read-close','stderr-write-close','thread-close-final','process-close','attributes-close','environment-close','job-close'];
export function atomicModel(faults=[]) {
 const bad=new Set(faults),events=[],errors=[];let job=false,created=false,resumed=false,terminated=false,zero=false;
 const act=(name)=>{events.push(name);if(bad.has(name)){errors.push(name);throw Error(name)}};
 const abort=()=>{if(job&&!terminated){events.push('immediate-TerminateJob');terminated=true;if(bad.has('terminate-job'))errors.push('terminate-job')}};
 try {
  for(const stage of CREATE_STAGES){
   if(stage==='job')job=true;
   if(stage==='native-create'){created=true;events.push('born-in-held-job');}
   if(stage==='resume')resumed=true;
   act(stage);
   if(stage==='native-create'&&bad.has('native-created-before-return')){errors.push('native-created-before-return');throw Error('partial native return')}
   if(stage==='pump-stdout'&&bad.has('hidden-downstream-managed-start')){events.push('hidden-child-inherited-job');errors.push('hidden-downstream-managed-start');throw Error('nonzero propagated')}
   if(stage==='exit-code'&&bad.has('nonzero-exit')){errors.push('nonzero-exit');throw Error('nonzero')}
   if(stage==='job-zero'&&bad.has('exit0-members-remain')){errors.push('exit0-members-remain');throw Error('members')}
   if(stage==='job-zero'&&bad.has('job-zero-proof')){errors.push('job-zero-proof');throw Error('query')}
  }
 }catch {abort();}
 finally {
  events.push('query-accounting','query-members');
  zero=job&&!bad.has('job-zero-proof')&&!bad.has('terminate-job');
  if(!zero&&job)errors.push('job-zero-proof');
  events.push('terminal-proof','stdout-EOF-proof','stderr-EOF-proof');
  for(const stage of CLOSE_STAGES){try{act(stage)}catch{abort();}}
 }
 return {events,errors,created,resumed,terminated,jobZero:zero,pass:errors.length===0&&created&&resumed&&zero};
}
export function readAbortModel(channel) {return ['pump-'+channel+'-error','abort=true','throw-primary','finally-kill','drain-other-channel','close-readers','close-process','close-handle'];}
export function localRetired(c){return !c.startAttempted||!!(c.started&&c.terminal&&c.streams&&c.handleClosed);}
export function remaining(c,n,work=false){return Math.max(0,Math.min((work?c.work:c.end)-n.native,(work?c.utc+48000:c.utcEnd)-n.utc,(work?48000:60000)-n.elapsed));}

export const AUTHORITY_V2_FIELDS=AUTHORITY_FIELDS;

export const ORIGIN_FIELDS='schema version authorityRecordSha256 humanMessageSha256 outerSourceSha256 producerSourceSha256 producerHostProfile platform nodeTimeOriginMicros clockMode nativeClockApi utcClockApi monotonicClockApi nativeIssued workEnd overallEnd utcIssued utcEnd monotonicIssuedMicros nativeBeforeWrite utcBeforeWrite monotonicBeforeWriteMicros'.split(' ');
export function originSamples(up,utc,mono,timeOrigin){
 const issued=Math.floor(up)*1000;
 if(![issued,utc,mono,timeOrigin].every(Number.isSafeInteger)||issued<0||issued>Number.MAX_SAFE_INTEGER-60000||utc>Number.MAX_SAFE_INTEGER-60000)throw Error('checked origin');
 return {issued,work:issued+48000,end:issued+60000,utc,utcEnd:utc+60000,mono,timeOrigin};
}
export function admitOrigin(text,facts){
 const o=JSON.parse(text);
 if(Object.keys(o).join(' ')!==ORIGIN_FIELDS.join(' ')||Object.values(o).some(v=>typeof v!=='string'||!v.trim())||JSON.stringify(o)!==text||o.schema!=='hestia.m5.external-origin.v1'||o.version!=='1')throw Error('closed canonical origin');
 if(!facts.genuineRootBinding||!facts.profileQualified||!facts.imageSourceProven||!facts.apiDomainQualified||o.producerHostProfile!==facts.profile||o.nodeTimeOriginMicros!==facts.timeOrigin)throw Error('independent profile/Root/API provenance');
 for(const k of ['authorityRecordSha256','humanMessageSha256','outerSourceSha256','producerSourceSha256'])if(!/^[0-9a-f]{64}$/.test(o[k])||o[k]!==facts[k])throw Error('origin hash');
 if(o.platform!=='win32'||o.clockMode!=='PRESTART_NODE_PRODUCER'||o.nativeClockApi!=='node:os.uptime/libuv:GetTickCount64/FLOOR_ORIGIN_CEIL_OBSERVATION'||o.utcClockApi!=='Date.now'||o.monotonicClockApi!=='node:perf_hooks.performance.now')throw Error('domain');
 const n=k=>{if(!/^(0|[1-9][0-9]*)$/.test(o[k])||!Number.isSafeInteger(Number(o[k])))throw Error('integer');return Number(o[k]);};
 const i=n('nativeIssued'),w=n('workEnd'),e=n('overallEnd'),u=n('utcIssued'),ue=n('utcEnd');
 if(i%1000||w-i!==48000||e-i!==60000||ue-u!==60000||facts.entryNative<i||facts.entryNative>=w||facts.entryUtc<u||facts.entryUtc>=u+48000)throw Error('original prestart interval');
 if(n('nativeBeforeWrite')<i||n('nativeBeforeWrite')>=w||n('utcBeforeWrite')<u||n('utcBeforeWrite')>=u+48000||n('monotonicBeforeWriteMicros')<n('monotonicIssuedMicros')||n('monotonicBeforeWriteMicros')-n('monotonicIssuedMicros')>=48000000)throw Error('before-write freshness');
 if(facts.nowNative>e||facts.nowUtc>ue||facts.monotonicElapsed>60000000||facts.workEndReceived!==w||facts.completionTimeOrigin!==o.nodeTimeOriginMicros||!facts.terminal||!facts.streams||!facts.handlesClosed||facts.running)throw Error('full completion budget/host');
 return o;
}
export function originAttempt(events){
 let created=0,roots=0,spent=false;
 for(const e of events){
  if(e==='preexisting'||e==='partial')throw Error('existing origin: zero starts and no repair');
  if(e==='create'){if(spent)throw Error('no second origin');spent=true;created++;}
  if(e==='root'){if(!spent||roots)throw Error('no second root');roots++;}
  if(e==='exec-fail')spent=true;
 }
 return {created,roots,spent};
}
export function conservativeNativeObservation(up){const n=Math.ceil(up*1000);if(!Number.isSafeInteger(n)||n<0)throw Error('native observation');return n;}
export function parseAuthorityV2(text) {
 if(typeof text!=='string'||Buffer.byteLength(text)>65536||text.charCodeAt(0)===0xfeff)throw Error('UTF8/BOM/bound');
 const v=JSON.parse(text);
 if(!v||Array.isArray(v)||Object.keys(v).join(' ')!==AUTHORITY_FIELDS.join(' ')||Object.values(v).some(x=>typeof x!=='string'||!x.trim()))throw Error('closed/string/order');
 if(v.schema!=='hestia.m5.authority.v2'||v.version!=='2')throw Error('schema/version');
 for(const k of ['humanMessageSha256','candidateManifestSha256','packagePinsSha256','outerSourceSha256','dispatcherSourceSha256','runnerSourceSha256'])if(!/^[0-9a-f]{64}$/.test(v[k]))throw Error('hash');
 if(JSON.stringify(v)!==text)throw Error('canonical/duplicate');
 return v;
}
export function checkedClock(origin,delta){if(origin<0n||delta<0n||origin>9223372036854775807n-delta)throw Error('checked Int64');return origin+delta;}
export function admitAuthorityV2(text,facts) {
 const a=parseAuthorityV2(text),guid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
 if(!facts.genuineRootAuthority||!facts.currentLoadedA0)throw Error('independent authority/current A0');
 if(a.authorizationClass!=='DIRECT_HUMAN_RUNTIME_ONCE'||a.scope!=='HARMLESS_SIX_ONCE'||a.retry!=='0'||a.appStatus!=='LOADED_CURRENT_A0'||!a.workspace.startsWith('wks_')||!guid.test(a.actualAppTurn)||!guid.test(a.paseoAgent))throw Error('logical scope/bindings');
 if(a.actualAppThread!=='01a13648-c55b-7250-bf07-34921d70b43b'||/r05|source/i.test(a.humanMessageRef)||a.humanMessageRef==='call_f75fff55e3a34653b255fd83365457ca')throw Error('old/wrong binding');
 for(const k of ['notBeforeUtc','expiresUtc'])if(!/^(0|[1-9][0-9]*)$/.test(a[k])||BigInt(a[k])>9223372036854775807n)throw Error('decimal/window');
 if(BigInt(a.notBeforeUtc)>facts.utcIssued||BigInt(a.expiresUtc)<facts.utcEnd)throw Error('full original coverage');
 return a;
}
export function outerAttempt(f={}) {
 let starts=0,spent=false;const events=['Stopwatch-origin','native-origin','UTC-origin'];
 if(f.profile===false||f.authority===false||f.pins===false||f.expiredPreflight)return{starts,spent,events,status:'HOLD'};
 if(f.slot&&f.slot!=='absent')return{starts,spent,events,status:'HOLD'};
 events.push('CreateNew');spent=true;
 for(const n of ['flush','close','readback']){events.push(n);if(f.fail===n)return{starts,spent,events,status:'SPENT_HOLD'};}
 if(f.workExpired)return{starts,spent,events,status:'SPENT_HOLD'};
 events.push('atomic-native-Dispatcher-create');starts++;
 return{starts,spent,events,status:f.cleanupFault||f.exitNonzero?'SPENT_HOLD':'SOURCE_MODEL_ONLY'};
}
