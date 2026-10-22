import {readFileSync,lstatSync} from 'node:fs';import {createHash,randomUUID} from 'node:crypto';import path from 'node:path';
import {need,validateRootDecision,SOURCE_ROOT,SCENARIOS,ROLES,parseFlat} from './handoff-decision.mjs';
import {HEADERS,REQUEST_FIELDS,FRAME_FIELDS,closed,packet,parsePacket,validateProbe,splitPrivateChunk,terminalControlState} from './subject-protocol.mjs';
const ROOT_PACKAGE='C:\\IFI_SourceCode\\Temp\\WeltraumSpiel\\artifacts\\hestia-target-pc-2026-10-13\\M5_HARMLESS_REVIEWED_PACKAGE.json',ROOT_CONTEXT='C:\\IFI_SourceCode\\Temp\\WeltraumSpiel\\artifacts\\hestia-target-pc-2026-10-13\\M5_HARMLESS_RUNTIME_CONTEXT.json',ROOT_GRANT='C:\\IFI_SourceCode\\Temp\\WeltraumSpiel\\artifacts\\hestia-target-pc-2026-10-13\\M5_HARMLESS_RUNTIME_GRANT.json',CONSUMED='C:\\IFI_SourceCode\\Temp\\WeltraumSpiel\\artifacts\\hestia-target-pc-2026-10-13\\M5_HARMLESS_CONSUMED',NODE='C:\\IFI_SourceCode\\Temp\\WeltraumSpiel\\artifacts\\hestia-other-pc-restored\\Tooling\\PortableNode\\node.exe';
const hash=b=>createHash('sha256').update(b).digest('hex');
function bytes(p){const s=lstatSync(p);need(!s.isSymbolicLink()&&s.size<=(p===NODE?536870912:1048576),'fixed read bound/reparse');return readFileSync(p)}
function json(p){const b=bytes(p);return {data:parseFlat(b.toString('utf8')),sha:hash(b)}}
function roots(f){
 const p=json(ROOT_PACKAGE),c=json(ROOT_CONTEXT),g=json(ROOT_GRANT);need(/^[0-9a-f-]{36}$/.test(g.data.grantId),'fixed grant path');const spent=json(path.join(CONSUMED,g.data.grantId+'.json'));
 const hashes={package:p.sha,context:c.sha,grant:g.sha,consumed:spent.sha};validateRootDecision(p.data,c.data,g.data,f,spent.data,hashes,{pid:process.pid,ppid:process.ppid,execPath:process.execPath},Date.now());return {p:p.data,c:c.data,g:g.data,hashes};
}
class PrivateLines {
 constructor(stream,onLine=null){this.active=0;this.failure=null;this.q=[];this.waiter=null;this.closed=false;this.pending='';this.stream=stream;stream.setEncoding('utf8');this.onData=chunk=>{const parsed=splitPrivateChunk(this.pending,chunk);this.pending=parsed.pending;for(const line of parsed.lines){if(onLine){need(this.active<16,'bounded private relay');this.active++;Promise.resolve(onLine(line)).catch(error=>{this.failure=error;stream.destroy(error)}).finally(()=>{this.active--});continue}if(this.waiter){const w=this.waiter;this.waiter=null;w.resolve(line)}else{need(this.q.length<16,'bounded private queue');this.q.push(line)}}};this.onEnd=()=>{this.closed=true;need(this.pending.length===0,'private truncated final frame');if(this.waiter){this.waiter.reject(new Error('DATA_HOLD:private channel closed'));this.waiter=null}};stream.on('data',this.onData);stream.once('end',this.onEnd)}
 close(){need(!this.failure&&this.active===0&&!this.waiter&&this.q.length===0&&this.pending.length===0,'terminal private reader drain');this.closed=true;this.stream.off('data',this.onData);this.stream.off('end',this.onEnd);this.stream.pause();this.stream.destroy()}
 async next(end){if(this.q.length)return this.q.shift();need(!this.closed&&!this.waiter&&Date.now()<end,'private line state/end');return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.waiter=null;reject(new Error('DATA_HOLD:original private line deadline'))},Math.max(1,Math.min(1000,end-Date.now())));this.waiter={resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}}})}
}
const control=new PrivateLines(process.stdin);let serial=Promise.resolve();let stopped=false;let liveChildren=0;
export async function finishControl(){await serial;terminalControlState(!!control.waiter,control.q.length,liveChildren);stopped=true;control.close();}

function rpc(header,d){
 const work=async()=>{need(!stopped,'terminal control closed');const end=Number(d.utcEnd),before=Date.now();need(before<=end,'original RPC end');await new Promise((resolve,reject)=>process.stdout.write(packet(header,d)+'\n',e=>e?reject(e):resolve()));
 const response=parsePacket(await control.next(end));need(response.header===(header===HEADERS.RETIRE?HEADERS.CLOSED:HEADERS.ACK),'Root reply header');
 // REGISTER for a Node-created child is resolved by native Controller PRECHECK->query-handle->Root duplicate.
 for(const k of REQUEST_FIELDS)if(k!=='schema'&&!(d.mode==='REGISTER'&&d.sourceHandle==='0'&&['creation','handleOwnerPid','handleOwnerCreation','handleOwnerImage','sourceHandle','image'].includes(k)))need(response.data[k]===d[k],'private Root echo '+k);
 need(Number(response.data.observedUtc)>=before&&Number(response.data.observedUtc)<=Date.now()&&Date.now()<=end,'Root reply original UTC');return response.data};
 const result=serial.then(work);serial=result.catch(()=>{});return result;
}
function recordFor(proof){const f=proof.frame,id=f.subjectPid+'-'+f.subjectCreation+'-'+f.registrationNonce;need(id===f.recordId,'derived pid-creation-nonce path');const file=path.join(CONSUMED,proof.root.g.grantId+'.subjects',id+'.json');const r=json(file);need(r.sha===f.recordSha256,'Root immutable record hash');closed(r.data,REQUEST_FIELDS);need(r.data.pid===String(process.pid)&&r.data.creation===f.subjectCreation&&r.data.parentPid===String(process.ppid)&&r.data.image.toLowerCase()===process.execPath.toLowerCase(),'actual fixture/creation/private Root record');return r.data}
export async function freshProbe(proof){
 const record=recordFor(proof),nonce=randomUUID(),d={...record,schema:'hestia.m5.subject.register.v1',mode:'PROBE',probeNonce:nonce};const before=Date.now(),reply=await rpc(HEADERS.REGISTER,d);validateProbe(record,proof.frame,reply,nonce,before,Date.now());return reply;
}
export function createFixtureVerifier(){return Object.freeze({
 async verifyCurrentFixedFixture(proc){
  const line=await control.next(Date.now()+1000),frame=parseFlat(line);closed(frame,FRAME_FIELDS);need(frame.schema==='hestia.m5.handoff.v3'&&frame.version==='3','closed private handoff');const r=roots(frame);
  need(proc.argv.length===3&&proc.argv[2]===frame.requestPath&&proc.execPath.toLowerCase()===NODE.toLowerCase()&&path.resolve(proc.argv[1]).toLowerCase()===path.join(SOURCE_ROOT,'harmless-fixture.mjs').toLowerCase(),'fixed fixture argv before request read');
  need(path.dirname(frame.requestPath)===path.join(r.c.suiteOutputRoot,frame.scenario)&&hash(bytes(frame.requestPath))===frame.requestSha256,'fixed request bytes before read');
  for(const [p,k]of [[NODE,'nodeSha256'],[path.join(SOURCE_ROOT,'harmless-fixture.mjs'),'fixtureSha256'],[path.join(SOURCE_ROOT,'QUAL_SOURCE_PINS.tsv'),'packagePinsSha256']])need(hash(bytes(p))===r.p[k],'Root expected source/tool bytes');
  const proof=Object.freeze({frame:Object.freeze(frame),root:r,expected:Object.freeze({...frame,scope:r.g.scope,mode:'REAL_RUNTIME',ownerNative:r.c.ownerNative,packagePinsSha256:r.p.packagePinsSha256,fixtureSha256:r.p.fixtureSha256,nodePath:NODE,fixturePath:path.join(SOURCE_ROOT,'harmless-fixture.mjs'),token:r.c.suiteToken,outputRoot:path.join(r.c.suiteOutputRoot,frame.scenario),utcEnd:Number(frame.utcEnd)})});
  await freshProbe(proof);return proof;
 },
 async verifyIndependentRootProof(proof){const r=roots(proof.frame);for(const k of ['package','context','grant','consumed'])need(r.hashes[k]===proof.root.hashes[k],'Root changed '+k);await freshProbe(proof);return true},
 async verifyCurrentPhase(proof,phase){need(['fixture-before-imports','fixture-after-request','fixture-before-effects','fixture-before-spawn','fixture-before-publication'].includes(phase),'unknown fixture phase');await this.verifyIndependentRootProof(proof);need(Date.now()<=Number(proof.frame.utcEnd),'original end after slow reads/probe')},
 async verifyFixedRequest(proof,request){need(request&&typeof request==='object'&&!Array.isArray(request),'request object');for(const k of ['scenario','role','token','nodeOrigin','outputRoot','utcEnd'])need(request[k]===proof.expected[k],'actual request '+k);need(SCENARIOS.includes(request.scenario)&&ROLES.includes(request.role)&&Number.isInteger(request.ordinal)&&request.ordinal>=0&&request.ordinal<6,'fixed request population');await this.verifyCurrentPhase(proof,'fixture-after-request')},
 async verifyOriginalClockBracket(proof,issue,end,work){need(Number.isSafeInteger(issue.lower)&&Number.isSafeInteger(issue.upper)&&issue.lower<=issue.upper&&issue.utc>=Number(proof.frame.utcIssued)&&issue.utc<=Number(proof.frame.utcEnd),'actual Node UTC bracket');need(end===issue.lower+Number(proof.frame.utcEnd)-(issue.utc+1)&&work===end-12000,'original conservative UTC mapping, no counter equality');await this.verifyCurrentPhase(proof,'fixture-before-effects')}
})}
const childProofs=new WeakMap();
export async function childHandoff(proof,child,role,requestPath,requestBytes){
 need(ROLES.includes(role)&&child.pid>0&&(proof.frame.role==='root'||proof.frame.role==='child'),'admitted fixed creator');
 const parent=recordFor(proof),d={...parent,schema:'hestia.m5.subject.register.v1',mode:'REGISTER',registrationNonce:randomUUID(),probeNonce:randomUUID(),pid:String(child.pid),creation:'0',parentPid:String(process.pid),image:NODE,creatorPid:String(process.pid),creatorCreation:proof.frame.subjectCreation,creatorImage:NODE,handleOwnerPid:proof.frame.controllerPid,handleOwnerCreation:proof.frame.controllerCreation,handleOwnerImage:'C:\\IFI_SourceCode\\Utils\\PowerShell\\pwsh.exe',sourceHandle:'0',role,ordinal:String(JSON.parse(requestBytes.toString('utf8')).ordinal),requestPath,requestSha256:hash(requestBytes)};
 const ack=await rpc(HEADERS.REGISTER,d);need(ack.response==='REGISTERED'&&Number(ack.creation)>0,'Root actual child creation before admission');
 childProofs.set(child,{ack,lines:null});liveChildren++;
 // Forward child's fixed subject messages through only its sealed stdout/stdin and this admitted parent.
 const lines=new PrivateLines(child.stdout,async line=>{if(!line.startsWith('M5_SUBJECT_'))return;try{const request=parsePacket(line);need(request.header===HEADERS.REGISTER||request.header===HEADERS.RETIRE,'child request headers');const response=await rpc(request.header,request.data);child.stdin.write(packet(request.header===HEADERS.RETIRE?HEADERS.CLOSED:HEADERS.ACK,response)+'\n')}catch(error){process.stderr.write(String(error)+'\n');process.exitCode=1;child.stdin.destroy(error)}});
 childProofs.get(child).lines=lines;
 return JSON.stringify({...proof.frame,role,requestPath,requestSha256:ack.requestSha256,subjectPid:ack.pid,subjectCreation:ack.creation,subjectParentPid:ack.parentPid,subjectImage:ack.image,registrationNonce:ack.registrationNonce,recordId:ack.recordId,recordSha256:ack.recordSha256});
}
export async function retireChild(child){const entry=childProofs.get(child);need(entry,'exact retained child registration');const held=entry.ack;const d=Object.fromEntries(REQUEST_FIELDS.map(k=>[k,held[k]]));d.schema='hestia.m5.subject.retire.v1';d.mode='RETIRE';d.probeNonce=randomUUID();const ack=await rpc(HEADERS.RETIRE,d);need(ack.response==='RETIRED','exact Root terminal close');entry.lines.close();child.stdin.end();childProofs.delete(child);liveChildren--}
