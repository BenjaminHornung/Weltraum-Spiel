// Pure source-review model. No proof, runtime grant, signature or executable capability is emitted.
export const bindingKeys=['ownerNative','ownerProcessId','ownerCreation','ownerImage','runnerId','runnerProcessId','runnerCreation','paseoAgent','workspace','leaseId','leaseExpiresUtc','capacity','outputExclusive','outputCustodyId','suiteToken','nativeOrigin','nativeClockDomain','nativeClockApi','utcClockApi','issued','workEnd','overallEnd','utcIssued','utcEnd','sourceRoot','suiteOutputRoot','packagePinsSha256','nodeSha256','powerShellSha256','dllSha256','fixtureSha256','subjectPid','subjectCreation','subjectParentPid','subjectImage','role','requestPath'];
const hashes=['packagePinsSha256','nodeSha256','powerShellSha256','dllSha256','fixtureSha256'];
const phases=['preflight','beforeLoader','afterLoader','afterStart','afterLastCase','afterCleanup','afterPublication'];
const guid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const hash=/^[0-9a-f]{64}$/;
const fixedRoot='C:\\IFI_SourceCode\\Temp\\WeltraumSpiel\\.worktrees\\Hestia-A0-BenniPC-2026-10-13\\.a0-runtime\\benni-pc-m5-harmless-activation-source-r01';
export function evaluateActivation(v){
 const hold=reason=>({disposition:'HOLD',reason,launchCapability:false});
 if(!v||v.verifierFact!==true||v.identityFact!==true||v.leaseFact!==true||v.clockDomainFact!==true)return hold('independent facts unissued');
 const e=v.expectedRoot,o=v.observed,c=v.claim;
 if(!e||!o||!c||e.issuer!=='ROOT_INDEPENDENT_RUNTIME_HANDOFF')return hold('Root expectation unissued');
 for(const key of bindingKeys)if(typeof e[key]!=='string'||!e[key].trim()||e[key]!==o[key]||e[key]!==c[key])return hold('binding:'+key);
 if(e.ownerNative!=='01a13648-c55b-7250-bf07-34921d70b43b'||e.scope!=='HARMLESS_SIX_ONCE'||e.mode!=='REAL_RUNTIME'||v.synthetic!==false||v.reset!==false)return hold('fixed owner/scope');
 if(e.role!=='Controller'&&e.role!=='Observer'&&e.role!=='Supervisor')return hold('fixed role');
 if(e.authorityState!==(e.role==='Controller'?'UNCONSUMED':'ACTIVE_OWN_CONTROLLER'))return hold('consumed/foreign controller');
 if(e.capacity!=='ONE_CONTROLLER_SIX_SERIAL_LANES_ACTIVE3'||e.outputExclusive!=='true'||e.sourceRoot!==fixedRoot)return hold('capacity/custody/source');
 for(const k of ['ownerProcessId','runnerProcessId','subjectPid','subjectParentPid','ownerCreation','runnerCreation','subjectCreation'])if(!/^[1-9][0-9]*$/.test(e[k]))return hold('process tuple');
 for(const k of ['runnerId','paseoAgent','leaseId','outputCustodyId','suiteToken','nativeOrigin'])if(!guid.test(e[k]))return hold('identity shape');
 if(!e.workspace.startsWith('wks_')||e.nativeClockApi!=='GetTickCount64'||e.utcClockApi!=='DateTimeOffset.UtcNow')return hold('workspace/clock API');
 if(!guid.test(e.nativeClockDomain))return hold('clock domain');
 for(const k of hashes)if(!hash.test(e[k]))return hold('hash:'+k);
 if(!v.actualBytes||hashes.some(k=>v.actualBytes[k]!==e[k]))return hold('actual bytes');
 if(e.suiteOutputRoot!==fixedRoot+'\\qualification-runs\\'+e.suiteToken)return hold('fixed output');
 if(e.role==='Controller'){if(e.requestPath!=='NONE')return hold('controller request');}
 else{
  const name=e.role==='Observer'?'observer.control.tsv':'supervisor.control.tsv';
  const paths=['nominal','unexpected-member','ipc-cancel','watchdog','premature-root-exit','supervisor-crash'].map(s=>e.suiteOutputRoot+'\\'+s+'\\'+name);
  if(!paths.includes(e.requestPath)||!hash.test(e.requestSha256)||v.actualRequestSha256!==e.requestSha256)return hold('role request');
 }
 const nums=['issued','workEnd','overallEnd','utcIssued','utcEnd','leaseExpiresUtc'];
 if(nums.some(k=>!Number.isSafeInteger(Number(e[k]))||!/^(0|[1-9][0-9]*)$/.test(e[k])))return hold('clock shape');
 const n=Object.fromEntries(nums.map(k=>[k,Number(e[k])]));
 if(n.workEnd-n.issued!==48000||n.overallEnd-n.issued!==60000||n.overallEnd-n.workEnd!==12000||n.utcEnd-n.utcIssued!==60000||n.leaseExpiresUtc<n.utcEnd)return hold('original ends');
 for(const p of phases){const t=v.phases?.[p];if(!t||!Number.isSafeInteger(t.now)||!Number.isSafeInteger(t.utc)||t.now<n.issued||t.now>n.overallEnd||t.utc<n.utcIssued||t.utc>n.utcEnd)return hold('deadline:'+p);}
 return {disposition:'SOURCE_REVIEW_READY',launchCapability:false,syntheticModelOnly:true};
}
