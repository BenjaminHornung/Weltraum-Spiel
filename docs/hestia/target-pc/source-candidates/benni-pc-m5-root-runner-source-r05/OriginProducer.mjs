// Preload only before any genuine authority. No import-time I/O and no current runtime qualification.
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const BASE='C:\\IFI_SourceCode\\Temp\\WeltraumSpiel\\artifacts\\hestia-target-pc-2026-10-13';
const SELF=path.win32.join(BASE,'OriginProducer.mjs');
const OUTER=path.win32.join(BASE,'root-outer.ps1');
const AUTHORITY=path.win32.join(BASE,'M5_HARMLESS_RUNTIME_AUTHORITY.json');
const ORIGIN=path.win32.join(BASE,'M5_HARMLESS_EXTERNAL_ORIGIN.json');
const AUTH_FIELDS='schema version humanMessageRef humanMessageSha256 authorizationClass scope retry candidateManifestSha256 packagePinsSha256 outerSourceSha256 dispatcherSourceSha256 runnerSourceSha256 actualAppThread actualAppTurn appStatus paseoAgent workspace notBeforeUtc expiresUtc'.split(' ');
const ORIGIN_FIELDS='schema version authorityRecordSha256 humanMessageSha256 outerSourceSha256 producerSourceSha256 producerHostProfile platform nodeTimeOriginMicros clockMode nativeClockApi utcClockApi monotonicClockApi nativeIssued workEnd overallEnd utcIssued utcEnd monotonicIssuedMicros nativeBeforeWrite utcBeforeWrite monotonicBeforeWriteMicros'.split(' ');
const NATIVE_API='node:os.uptime/libuv:GetTickCount64/FLOOR_ORIGIN_CEIL_OBSERVATION';
const UTC_API='Date.now';
const MONO_API='node:perf_hooks.performance.now';
const PROFILE_STATUS=Object.freeze({status:'UNKNOWN',nodeVersion:'UNKNOWN',nodeExecutablePath:'UNKNOWN',nodeImageSha256:'UNKNOWN',providerRuntimeId:'UNKNOWN',runtimeId:'UNKNOWN',runtimeVersion:'UNKNOWN',reason:'No trusted MCP active-runtime evidence is available; static configuration and clock proximity are not identity.'});
let attemptBegan=false;
let issuedTicket=null;
const need=(yes,why)=>{if(!yes)throw Error('SOURCE_HOLD:'+why);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const micros=n=>{need(Number.isFinite(n)&&n>=0&&Number.isSafeInteger(Math.floor(n*1000)),'safe monotonic micros');return Math.floor(n*1000);};
const checkedAdd=(n,d)=>{need(Number.isSafeInteger(n)&&n>=0&&Number.isSafeInteger(d)&&d>=0&&n<=Number.MAX_SAFE_INTEGER-d,'checked original endpoint');return n+d;};
function exactPath(p){
 need(path.win32.isAbsolute(p)&&path.win32.normalize(p)===p&&(p===BASE||p.startsWith(BASE+path.win32.sep)),'fixed canonical path');
 let current=p;
 while(true){
  const s=fs.lstatSync(current);need(!s.isSymbolicLink(),'no link/reparse ancestor');
  need(fs.realpathSync.native(current).toLowerCase()===current.toLowerCase(),'exact resolved ancestor');
  const parent=path.win32.dirname(current);if(parent===current)break;current=parent;
 }
}
function readBounded(p,max=65536){
 exactPath(p);const fd=fs.openSync(p,'r');let primary=null;
 try{
  const stat=fs.fstatSync(fd);need(stat.isFile()&&stat.size>0&&stat.size<=max,'bounded regular input');
  const bytes=Buffer.alloc(stat.size);let at=0;
  while(at<bytes.length){const n=fs.readSync(fd,bytes,at,bytes.length-at,null);need(n>0,'complete input');at+=n;}
  const extra=Buffer.alloc(1);need(fs.readSync(fd,extra,0,1,null)===0,'exact input EOF');return bytes;
 }catch(e){primary=e;throw e;}finally{try{fs.closeSync(fd);}catch(e){if(primary)throw new AggregateError([primary,e],'input close');throw e;}}
}
function flat(bytes,fields,schema,version){
 need(bytes.length>0&&bytes.length<=65536&&!(bytes[0]===239&&bytes[1]===187&&bytes[2]===191),'bounded UTF8 without BOM');
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),value=JSON.parse(text);
 need(value&&!Array.isArray(value)&&Object.keys(value).join(' ')===fields.join(' ')&&Object.values(value).every(v=>typeof v==='string'&&v.trim().length>0),'closed ordered string fields');
 need(value.schema===schema&&value.version===version,'exact schema/version');
 need(JSON.stringify(value)===text,'canonical bytes and duplicate rejection');return value;
}
function qualifiedHostProfile(){
 // Not a null adapter or a claimed production verifier. Missing actual runtime evidence is a hard gate.
 throw Error('NODE_PROFILE_HOLD: active Node version/image/runtime ID and persistent timeOrigin are not Root-qualified');
}
function clocksWithin(ticket){
 const mono=micros(performance.now()),utc=Date.now(),native=Math.ceil(os.uptime()*1000);
 need(Number.isSafeInteger(native)&&native>=0,'checked conservative native observation');
 need(micros(performance.timeOrigin)===ticket.nodeTimeOriginMicros,'same persistent performance origin');
 need(native>=ticket.nativeIssued&&native<=ticket.overallEnd&&utc>=ticket.utcIssued&&utc<=ticket.utcEnd&&mono>=ticket.monotonicIssuedMicros&&mono-ticket.monotonicIssuedMicros<=60000000,'all original hard endpoints');
 return {mono,utc,native};
}
export function runtimeQualificationStatus(){return PROFILE_STATUS;}
export function issueOrigin(){
 const monotonicIssued=performance.now();
 const utcIssued=Date.now();
 const uptimeSeconds=os.uptime();
 need(!attemptBegan,'one attempt only; no second issuer/root call');attemptBegan=true;
 const nativeIssued=Math.floor(uptimeSeconds)*1000;
 const monotonicIssuedMicros=micros(monotonicIssued),nodeTimeOriginMicros=micros(performance.timeOrigin);
 const workEnd=checkedAdd(nativeIssued,48000),overallEnd=checkedAdd(nativeIssued,60000),utcEnd=checkedAdd(utcIssued,60000);
 const profile=qualifiedHostProfile(); // Today this always denies before any filesystem access/write.
 need(profile.status==='ROOT_QUALIFIED'&&profile.platform==='win32'&&profile.nodeTimeOriginMicros===nodeTimeOriginMicros,'genuine prequalified live host, never caller tags');
 need(os.platform()==='win32','actual Windows platform');
 need(fileURLToPath(import.meta.url)===SELF&&!new URL(import.meta.url).search&&!new URL(import.meta.url).hash,'fixed preloaded module only');
 const authorityBytes=readBounded(AUTHORITY),a=flat(authorityBytes,AUTH_FIELDS,'hestia.m5.authority.v2','2');
 need(a.authorizationClass==='DIRECT_HUMAN_RUNTIME_ONCE'&&a.scope==='HARMLESS_SIX_ONCE'&&a.retry==='0'&&a.actualAppThread==='01a13648-c55b-7250-bf07-34921d70b43b'&&a.appStatus==='LOADED_CURRENT_A0'&&a.workspace.startsWith('wks_'),'genuine fixed logical authority scope');
 need(a.humanMessageRef!=='call_f75fff55e3a34653b255fd83365457ca'&&!/r05|source/i.test(a.humanMessageRef),'old/source grant is not runtime authority');
 for(const k of ['humanMessageSha256','candidateManifestSha256','packagePinsSha256','outerSourceSha256','dispatcherSourceSha256','runnerSourceSha256'])need(/^[0-9a-f]{64}$/.test(a[k]),'authority hash');
 for(const k of ['actualAppTurn','paseoAgent'])need(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(a[k]),'logical GUID');
 for(const k of ['notBeforeUtc','expiresUtc'])need(/^(0|[1-9][0-9]*)$/.test(a[k]),'canonical authority time');
 need(BigInt(a.notBeforeUtc)<=BigInt(utcIssued)&&BigInt(a.expiresUtc)>=BigInt(utcEnd),'authority covers original full interval');
 const outerBytes=readBounded(OUTER,1048576);need(sha(outerBytes)===a.outerSourceSha256,'independent expected outer bytes');
 const matches=[...new TextDecoder('utf-8',{fatal:true}).decode(outerBytes).matchAll(/^\$OriginProducerSha256='([0-9a-f]{64})'$/gm)];
 const selfBytes=readBounded(SELF,1048576);need(matches.length===1&&matches[0][1]===sha(selfBytes),'self hash transitively pinned through expected outer');
 const ticket={nativeIssued,workEnd,overallEnd,utcIssued,utcEnd,monotonicIssuedMicros,nodeTimeOriginMicros};
 const before=clocksWithin(ticket);
 need(before.native<workEnd&&before.utc<checkedAdd(utcIssued,48000)&&before.mono-monotonicIssuedMicros<48000000,'original work remaining before write');
 const record={schema:'hestia.m5.external-origin.v1',version:'1',authorityRecordSha256:sha(authorityBytes),humanMessageSha256:a.humanMessageSha256,outerSourceSha256:a.outerSourceSha256,producerSourceSha256:sha(selfBytes),producerHostProfile:profile.id,platform:'win32',nodeTimeOriginMicros:String(nodeTimeOriginMicros),clockMode:'PRESTART_NODE_PRODUCER',nativeClockApi:NATIVE_API,utcClockApi:UTC_API,monotonicClockApi:MONO_API,nativeIssued:String(nativeIssued),workEnd:String(workEnd),overallEnd:String(overallEnd),utcIssued:String(utcIssued),utcEnd:String(utcEnd),monotonicIssuedMicros:String(monotonicIssuedMicros),nativeBeforeWrite:String(before.native),utcBeforeWrite:String(before.utc),monotonicBeforeWriteMicros:String(before.mono)};
 const bytes=Buffer.from(JSON.stringify(record),'utf8');flat(bytes,ORIGIN_FIELDS,'hestia.m5.external-origin.v1','1');
 exactPath(BASE);
 const fd=fs.openSync(ORIGIN,'wx');let primary=null;
 try{let at=0;while(at<bytes.length){const n=fs.writeSync(fd,bytes,at,bytes.length-at);need(n>0,'complete origin write');at+=n;}fs.fsyncSync(fd);}catch(e){primary=e;throw e;}finally{try{fs.closeSync(fd);}catch(e){if(primary)throw new AggregateError([primary,e],'origin close');throw e;}}
 const back=readBounded(ORIGIN);need(back.equals(bytes)&&sha(back)===sha(bytes),'separate exact origin readback');
 issuedTicket=Object.freeze({...ticket,originSha256:sha(back)});
 clocksWithin(issuedTicket);
 return Object.freeze({status:'CREATED_EXACT',originSha256:issuedTicket.originSha256});
}
export function finishAfterExec(reply){
 need(issuedTicket!==null,'same preloaded producer issued exact record');
 const now=clocksWithin(issuedTicket);
 need(reply&&reply.exit_code===0&&reply.session_id===undefined&&typeof reply.output==='string','actual completed tool result; running session denied');
 const lines=reply.output.trim().split(/\r?\n/),proof=JSON.parse(lines[lines.length-1]);
 need(proof.outerStatus==='PASS'&&proof.failure===null&&proof.clockCreated===true,'actual outer result');
 const p=proof.atomicLauncher;
 need(p&&p.Success===true&&p.Terminal===true&&p.StdoutEof===true&&p.StderrEof===true&&p.JobZero===true&&p.HandlesClosed===true&&p.ExitCode===0&&p.PartialFrame===false,'typed pinned inner terminal/EOF/job/handles');
 need(String(proof.nativeIssued)===String(issuedTicket.nativeIssued)&&String(proof.nativeWorkEnd)===String(issuedTicket.workEnd)&&String(proof.nativeOverallEnd)===String(issuedTicket.overallEnd)&&String(proof.utcIssued)===String(issuedTicket.utcIssued)&&String(proof.utcEnd)===String(issuedTicket.utcEnd),'no managed reset in completion');
 need(readBounded(ORIGIN).equals(Buffer.from(JSON.stringify(flat(readBounded(ORIGIN),ORIGIN_FIELDS,'hestia.m5.external-origin.v1','1')))),'same canonical origin after exec');
 need(sha(readBounded(ORIGIN))===issuedTicket.originSha256,'same immutable origin after exec');
 clocksWithin(issuedTicket);
 return Object.freeze({status:'COMPLETED_WITHIN_ORIGINAL_BUDGET',originSha256:issuedTicket.originSha256,elapsedMonotonicMicros:now.mono-issuedTicket.monotonicIssuedMicros});
}
