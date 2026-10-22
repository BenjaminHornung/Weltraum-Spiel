const scenarios=['nominal','unexpected-member','ipc-cancel','watchdog','premature-root-exit','supervisor-crash'];
const cause=Object.freeze(Object.fromEntries(scenarios.map(s=>[s,s==='nominal'?'NONE':s])));
const safe=n=>Number.isSafeInteger(n)&&n>=0;
export function checkQualification(v){
 const reasons=[],no=s=>{if(!reasons.includes(s))reasons.push(s)};
 if(!v||!scenarios.includes(v.scenario)||!v.suite)return {disposition:'HOLD',reasons:['FIXED_INPUT_REQUIRED']};
 const s=v.suite;
 if(![s.issued,s.workEnd,s.overallEnd,s.utcIssued,s.utcEnd,v.admissionNow,v.retirementNow,v.ordinal].every(safe)
 ||s.workEnd-s.issued!==48000||s.overallEnd-s.issued!==60000||s.overallEnd-s.workEnd!==12000||s.utcEnd-s.utcIssued!==60000
 ||v.reset!==false||v.admissionNow<s.issued||v.admissionNow>=s.workEnd||v.retirementNow<v.admissionNow||v.retirementNow>s.overallEnd
 ||v.ordinal>=6||s.workEnd-v.admissionNow<(6-v.ordinal)*6000)no('SHARED_END_OR_RESERVE');
 for(const key of ['rootProof','captureProof','observerAck','identities','barrierBeforeEffects','canarySeparateJob','canarySurvived','rootTerminal','handlesTerminal','handlesClosed'])if(v[key]!==true)no('MISSING_'+key);
 if(v.observerHasJob!==false)no('OBSERVER_JOB_HANDLE_FORBIDDEN');
 if(v.actualCause!==cause[v.scenario]||v.expectedCause!==cause[v.scenario])no('FIXED_CAUSE_POLICY');
 if(v.scenario!=='supervisor-crash'&&(v.active!==0||v.emptyJob!==true))no('ACTUAL_JOB_ZERO_REQUIRED');
 if(v.scenario==='nominal'&&v.total!==13)no('NOMINAL_TOTAL13');
 if(v.scenario==='supervisor-crash'&&(v.crashAccountingClaim!==false||v.exactSupervisorTerminal!==true||v.observerTerminal!==true||v.crashLiveProof!==true))no('CRASH_RETAINED_HANDLE_PROOF');
 if(v.scenario==='watchdog'&&(v.watchdogMs!==1500||v.pollMs!==50||v.watchdogBeforeWait!==true))no('WATCHDOG_ORDER');
 if(v.scenario==='unexpected-member'&&(v.observedHandles!==4||v.total!==4||v.unexpectedSiblingObservedBeforeThrow!==true||v.grandchildOnlyExited!==true||v.rootChildStayedLive!==true))no('UNEXPECTED_CAPTURE_ORDER');
 const t=v.transfer;
 if(t){
  if(!['ABSENT_PROVEN','CONFIRMED','UNCERTAIN'].includes(t.publication)||typeof t.reclaimed!=='boolean'||!safe(t.reclaimAttempts??0)||(t.reclaimAttempts??0)>1||t.reclaimError===true)no('TRANSFER_CUSTODY');
  if(t.publication!=='ABSENT_PROVEN'&&t.reclaimed)no('POST_PREPARE_RECLAIM_FORBIDDEN');
  if(t.retired!==true&&t.observerTerminal!==true)no('TRANSFER_RETIREMENT_MISSING');
 }
 return {disposition:reasons.length?'HOLD':'SOURCE_READY',reasons};
}
export function aggregateQualification(results,overallEnd,utcEnd){
 if(!Array.isArray(results)||!safe(overallEnd)||!safe(utcEnd))throw new TypeError('fixed results/common end');
 let stopped=false;
 return scenarios.map((scenario,i)=>{
  const v=results[i];let disposition='NOT_RUN';
  if(!stopped&&v){disposition=v.scenario===scenario&&v.overallEnd===overallEnd&&v.utcEnd===utcEnd&&v.disposition==='SOURCE_READY'?'SOURCE_READY':'HOLD';}
  if(disposition!=='SOURCE_READY')stopped=true;
  return {scenario,disposition,overallEnd,utcEnd};
 });
}

export function checkSuiteCompletion(v){
 const reasons=[],no=message=>{if(!reasons.includes(message))reasons.push(message)};
 if(!v||!v.suite)return {disposition:'HOLD',reasons:['FIXED_SUITE_REQUIRED']};
 const s=v.suite;
 if(![s.issued,s.workEnd,s.overallEnd,s.utcIssued,s.utcEnd].every(safe)
 ||s.workEnd-s.issued!==48000||s.overallEnd-s.issued!==60000||s.utcEnd-s.utcIssued!==60000||v.reset!==false)no('ORIGINAL_END_REQUIRED');
 for(const phase of ['afterLastCase','afterCleanup','afterPublication']){
  const p=v[phase];
  if(!p||![p.now,p.utc].every(safe)||p.now<s.issued||p.now>s.overallEnd||p.utc<s.utcIssued||p.utc>s.utcEnd)no('EXPIRED_'+phase);
 }
 if(v.publicationComplete!==true)no('PUBLICATION_INCOMPLETE');
 try{
  const rows=aggregateQualification(v.candidates,s.overallEnd,s.utcEnd);
  if(v.candidates.length!==6||rows.some(row=>row.disposition!=='SOURCE_READY'))no('CANDIDATES_NOT_COMPLETE');
 }catch{no('CANDIDATES_NOT_COMPLETE')}
 return {disposition:reasons.length?'HOLD':'SOURCE_READY',reasons};
}
