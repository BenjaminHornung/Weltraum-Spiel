// Read-only builtins and the reviewed fixed adapter are permitted before the effect gate.
import {createFixtureVerifier,childHandoff,retireChild,finishControl} from './fixture-admission.mjs';
const externalRootFixtureVerifier=createFixtureVerifier();
async function requireFixtureAdmission(){
 if(externalRootFixtureVerifier===null)throw new Error('ROOT_RUNTIME_VERIFIER_UNISSUED');
 const proof=await externalRootFixtureVerifier.verifyCurrentFixedFixture(process);
 if(!proof||!await externalRootFixtureVerifier.verifyIndependentRootProof(proof))throw new Error('HOLD_INDEPENDENT_ROOT_PROOF_REQUIRED');
 const expected=proof.expected;
 if(expected.scope!=='HARMLESS_SIX_ONCE'||expected.mode!=='REAL_RUNTIME'||expected.ownerNative!=='01a13648-c55b-7250-bf07-34921d70b43b')throw new Error('HOLD_ROOT_SCOPE_OWNER');
 if(!expected.packagePinsSha256||!/^[0-9a-f]{64}$/.test(expected.packagePinsSha256)||!expected.fixtureSha256)throw new Error('HOLD_ROOT_EXPECTED_PACKAGE_FIXTURE');
 if(process.argv.length!==3||process.argv[2]!==expected.requestPath||process.execPath.toLowerCase()!==expected.nodePath.toLowerCase()||process.argv[1].toLowerCase()!==expected.fixturePath.toLowerCase())throw new Error('HOLD_FIXED_FIXTURE_INVOCATION');
 if(!['root','child','grandchild','sibling','canary'].includes(expected.role)||!['nominal','unexpected-member','ipc-cancel','watchdog','premature-root-exit','supervisor-crash'].includes(expected.scenario))throw new Error('HOLD_FIXED_ROLE_POPULATION');
 await externalRootFixtureVerifier.verifyCurrentPhase(proof,'fixture-before-imports');
 return proof;
}
const fixtureAdmission=await requireFixtureAdmission();

const {default:fs}=await import('node:fs');
const {default:path}=await import('node:path');
const {spawn}=await import('node:child_process');
const {randomUUID}=await import('node:crypto');
const {fileURLToPath}=await import('node:url');
const fixedNode='C:\\IFI_SourceCode\\Temp\\WeltraumSpiel\\artifacts\\hestia-other-pc-restored\\Tooling\\PortableNode\\node.exe';
const fixedScript=fileURLToPath(import.meta.url);
if(process.execPath.toLowerCase()!==fixedNode.toLowerCase()||process.argv.length!==3)throw new Error('fixed qualified fixture argv only');
const request=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
await externalRootFixtureVerifier.verifyFixedRequest(fixtureAdmission,request);
const expectedFixture=fixtureAdmission.expected;
for(const key of ['scenario','role','token','nodeOrigin','outputRoot','utcEnd'])if(request[key]!==expectedFixture[key])throw new Error('HOLD_ROOT_REQUEST_BINDING:'+key);
await externalRootFixtureVerifier.verifyCurrentPhase(fixtureAdmission,'fixture-after-request');
const scenarios=['nominal','unexpected-member','ipc-cancel','watchdog','premature-root-exit','supervisor-crash'];
if(!scenarios.includes(request.scenario)||!['root','child','grandchild','sibling','canary'].includes(request.role))throw new Error('fixed fixture role/scenario');
const output=path.resolve(request.outputRoot),bridge=path.join(output,'bridge'),observer=path.join(output,'observer');
if(!output.includes(path.sep+'qualification-runs'+path.sep)||!Number.isSafeInteger(request.utcEnd)||typeof request.token!=='string')throw new Error('bound qualification output/end/token');
function sample(){
 const lower=Math.floor(performance.now());
 const utc=Date.now();
 const upper=Math.ceil(performance.now());
 if(![lower,utc,upper].every(v=>Number.isSafeInteger(v)&&v>=0)||lower>upper)throw new Error('invalid Clock bracket');
 return {lower,utc,upper};
}
async function publish(name,text){
 await externalRootFixtureVerifier.verifyCurrentPhase(fixtureAdmission,'fixture-before-publication');
 const final=path.join(output,name),pending=final+'.pending',fd=fs.openSync(pending,'wx');
 try{fs.writeFileSync(fd,text+'\n')}finally{fs.closeSync(fd)}
 fs.linkSync(pending,final);fs.unlinkSync(pending);
}
const issue=sample(),end=issue.lower+request.utcEnd-(issue.utc+1),work=end-12000;
if(![end,work].every(Number.isSafeInteger)||work<=issue.upper)throw new Error('invalid shared qualification end');
function assertTime(){const s=sample();if(s.upper>=work||s.utc>=request.utcEnd-12000)throw new Error('shared qualification work end');return s}
await externalRootFixtureVerifier.verifyOriginalClockBracket(fixtureAdmission,issue,end,work);
const pause=()=>new Promise(resolve=>setTimeout(resolve,10));
function control(ordinal,name){const p=path.join(observer,ordinal+'.'+name);return fs.existsSync(p)&&fs.readFileSync(p,'utf8')===request.token+'\t'+request.scenario+'\t'+ordinal+'\n'}
const children=[];
let cancelled=false,activeOrdinal=request.ordinal;
process.on('message',message=>{if(message?.token===request.token&&message.scenario===request.scenario&&message.ordinal===activeOrdinal&&message.type==='cancel'){cancelled=true;for(const child of children)if(child.connected)child.send(message)}});
async function spawnFixed(role,ordinal,ipc=true){
 await externalRootFixtureVerifier.verifyCurrentPhase(fixtureAdmission,'fixture-before-spawn');
 const own=path.join(output,ordinal+'.'+role+'.case.json');
 fs.writeFileSync(own,JSON.stringify({...request,role,ordinal}),{flag:'wx'});
 const env=Object.fromEntries(['SystemRoot','WINDIR','SystemDrive','PATH','TEMP','TMP'].filter(n=>process.env[n]!==undefined).map(n=>[n,process.env[n]]));
 const child=spawn(fixedNode,[fixedScript,own],{cwd:path.dirname(fixedScript),env,windowsHide:true,stdio:ipc?['pipe','pipe','pipe','ipc']:['pipe','pipe','pipe']});
 const requestBytes=Buffer.from(fs.readFileSync(own));
 child.stdin.write((await childHandoff(fixtureAdmission,child,role,own,requestBytes))+'\n');
 children.push(child);return child;
}
function closed(child){return new Promise((resolve,reject)=>{let out=0,err=0;child.stdout.on('data',b=>{out+=b.length;if(out>65536)reject(new Error('fixture stdout bound'))});child.stderr.on('data',b=>{err+=b.length;if(err>65536)reject(new Error('fixture stderr bound'))});child.on('error',reject);child.on('close',async(exit,signal)=>{try{await retireChild(child);resolve({exit,signal,streamsComplete:true})}catch(e){reject(e)}});})}
try{
if(request.role==='canary'){while(!cancelled){const s=sample();if(s.upper>=end||s.utc>=request.utcEnd)throw new Error('shared canary overall end');await pause()}process.exitCode=0}
else if(request.role==='grandchild'||request.role==='sibling'){
 const ordinal=request.ordinal;
 while(!cancelled&&!(request.role==='grandchild'?(control(ordinal,'release')||control(ordinal,'grandchild.release')):control(ordinal,'sibling.release'))){assertTime();await pause()}
 if(process.send)await new Promise(resolve=>process.send({type:'terminal',token:request.token,scenario:request.scenario,ordinal:activeOrdinal,role:request.role},()=>resolve()));
 if(process.connected)process.disconnect();
}else if(request.role==='child'){
 const child=await spawnFixed('grandchild',request.ordinal),terminal=closed(child);
 while(!cancelled&&!control(request.ordinal,'release')){assertTime();await pause()}
 if(cancelled&&child.connected)child.send({type:'cancel',token:request.token,scenario:request.scenario,ordinal:activeOrdinal});
 const result=await terminal;
 if(process.send)await new Promise(resolve=>process.send({type:'terminal',token:request.token,scenario:request.scenario,ordinal:activeOrdinal,cancelled,exit:result.exit,streamsComplete:result.streamsComplete},()=>resolve()));
 if(process.connected)process.disconnect();
}else{
 const identity=fs.readFileSync(path.join(bridge,'root.identity.tsv'),'utf8').trimEnd().split('\t');
 if(identity.length!==7||identity[0]!==request.token||identity[1]!==String(process.pid))throw new Error('verified root identity');
 async function receipt(ordinal,token,action){
  const name=ordinal+(action==='LANE_START'?'.start.receipt.tsv':'.retire.receipt.tsv'),p=path.join(bridge,name);
  while(!fs.existsSync(p)){assertTime();await pause()}
  const a=fs.readFileSync(p,'utf8').trimEnd().split('\t'),expected=1+2*(action==='LANE_START'?ordinal:ordinal+1);
  if(a.length!==13||a[0]!=='N24'||a[1]!==action||a[2]!==request.token||a[3]!==String(ordinal)||a[4]!==token||a[5]!==String(process.pid)||a[6]!==identity[2]||a[7]!=='1'||a[8]!==identity[3]||a[12]!==String(expected))throw new Error('bound Root-only receipt');
 }
 async function send(ordinal,token,action,complete){
  const s=assertTime(),fields=['N24',action,request.token,ordinal,token,request.nodeOrigin,issue.lower,s.lower,work,end,issue.utc,s.utc,complete?1:0,complete?1:0,issue.upper,s.upper];
  await publish('bridge'+path.sep+ordinal+(action==='LANE_START'?'.start.request.tsv':'.retire.request.tsv'),fields.join('\t'));
 }
 for(let ordinal=0;ordinal<6;ordinal++){
  activeOrdinal=ordinal;
  let s=assertTime();if(work-s.upper<(6-ordinal)*6000)throw new Error('remaining-lane reserve STOP/NOT_RUN');
  const token=randomUUID();await send(ordinal,token,'LANE_START',true);await receipt(ordinal,token,'LANE_START');
  s=assertTime();if(work-s.upper<(6-ordinal)*6000)throw new Error('postreceipt remaining-lane reserve');
  const child=await spawnFixed('child',ordinal),terminal=closed(child);
  while(!control(ordinal,'release')&&!cancelled){
   assertTime();
   if(control(ordinal,'cancel')){cancelled=true;if(child.connected)child.send({type:'cancel',token:request.token,scenario:request.scenario,ordinal:activeOrdinal})}
   if(control(ordinal,'root-exit'))process.exit(0);
   if(request.scenario==='unexpected-member'&&control(ordinal,'spawn-sibling')&&!children.some(p=>p.sibling)){
    const sibling=await spawnFixed('sibling',ordinal);sibling.sibling=true;closed(sibling).catch(()=>{});
   }
   if(control(ordinal,'ARMED.tsv')&&request.scenario==='nominal')break;
   await pause();
  }
  const result=await terminal;
  if(cancelled)await publish('observer'+path.sep+ordinal+'.cancel.ack',request.token+'\t'+request.scenario+'\t'+ordinal);
  await send(ordinal,token,'LANE_RETIRE',!cancelled&&result.exit===0&&result.streamsComplete);
  await receipt(ordinal,token,'LANE_RETIRE');
  if(cancelled)throw new Error('IPC_CANCEL_ACK');
 }
 process.exitCode=0;
}

}finally{await finishControl()}
