import {parseFlat,need} from './handoff-decision.mjs';
export const REQUEST_FIELDS='schema version mode grantId packageHash contextHash consumedHash suiteToken registrationNonce probeNonce pid creation parentPid image creatorPid creatorCreation creatorImage handleOwnerPid handleOwnerCreation handleOwnerImage sourceHandle role scenario ordinal requestPath requestSha256 controllerPid controllerCreation hostPid hostCreation nativeOrigin issued workEnd overallEnd utcIssued utcEnd'.split(' '),ACK_FIELDS='schema version mode grantId packageHash contextHash consumedHash suiteToken registrationNonce probeNonce pid creation parentPid image creatorPid creatorCreation creatorImage handleOwnerPid handleOwnerCreation handleOwnerImage sourceHandle role scenario ordinal requestPath requestSha256 controllerPid controllerCreation hostPid hostCreation nativeOrigin issued workEnd overallEnd utcIssued utcEnd recordId recordSha256 observedNative observedUtc registryCount response'.split(' ');
export const HEADERS={REGISTER:'M5_SUBJECT_REGISTER_V1',ACK:'M5_SUBJECT_ACK_V1',RETIRE:'M5_SUBJECT_RETIRE_V1',CLOSED:'M5_SUBJECT_CLOSED_V1'};
const schema={M5_SUBJECT_REGISTER_V1:'hestia.m5.subject.register.v1',M5_SUBJECT_ACK_V1:'hestia.m5.subject.ack.v1',M5_SUBJECT_RETIRE_V1:'hestia.m5.subject.retire.v1',M5_SUBJECT_CLOSED_V1:'hestia.m5.subject.closed.v1'};
export const FRAME_FIELDS='schema version grantId packageRecordSha256 contextRecordSha256 grantRecordSha256 consumedSha256 hostPid hostCreation hostImage hostParentPid controllerPid controllerCreation subjectPid subjectCreation subjectParentPid subjectImage role requestPath requestSha256 scenario nodeOrigin issued workEnd overallEnd utcIssued utcEnd suiteToken nativeOrigin registrationNonce recordId recordSha256'.split(' ');
export function closed(value,fields){need(value&&typeof value==='object'&&Object.keys(value).length===fields.length,'closed field set');for(const k of fields)need(typeof value[k]==='string'&&value[k].length>0,'closed string '+k)}
export function parsePacket(line){
 need(typeof line==='string'&&Buffer.byteLength(line)<=65536,'subject line bound');const i=line.indexOf('\t'),header=line.slice(0,i);need(i>0&&Object.hasOwn(schema,header),'subject header');
 const d=parseFlat(line.slice(i+1)),fields=header===HEADERS.ACK||header===HEADERS.CLOSED?ACK_FIELDS:REQUEST_FIELDS;closed(d,fields);need(d.schema===schema[header]&&d.version==='1','subject schema');
 need(header===HEADERS.RETIRE||header===HEADERS.CLOSED?d.mode==='RETIRE':['REGISTER','PRECHECK','PROBE'].includes(d.mode),'subject mode');
 for(const k of ['registrationNonce','probeNonce','grantId'])need(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(d[k]),'subject nonce '+k);
 for(const k of ['pid','creation','parentPid','creatorPid','creatorCreation','handleOwnerPid','handleOwnerCreation','sourceHandle','controllerPid','controllerCreation','hostPid','hostCreation','issued','workEnd','overallEnd','utcIssued','utcEnd','ordinal'])need(/^(0|[1-9][0-9]*)$/.test(d[k]),'subject integer '+k);
 if(header===HEADERS.ACK)need(d.response===({REGISTER:'REGISTERED',PRECHECK:'PRECHECKED',PROBE:'PROBED'})[d.mode],'exact ACK mode');
 if(header===HEADERS.CLOSED)need(d.response==='RETIRED','exact CLOSED mode');
 return {header,data:d};
}
export function packet(header,d){const line=header+'\t'+JSON.stringify(d);parsePacket(line);return line}
export function validateProbe(record,frame,reply,nonce,before,after){
 closed(record,REQUEST_FIELDS);closed(reply,ACK_FIELDS);
 need(reply.mode==='PROBE'&&reply.response==='PROBED'&&reply.probeNonce===nonce&&nonce!==record.probeNonce,'fresh Root probe nonce');
 for(const k of ['pid','creation','parentPid','image','registrationNonce','role','scenario','ordinal','requestPath','requestSha256','controllerPid','controllerCreation','hostPid','hostCreation','grantId','contextHash','packageHash','consumedHash','issued','workEnd','overallEnd','utcIssued','utcEnd'])need(reply[k]===record[k],'Root observed exact '+k);
 need(reply.pid===frame.subjectPid&&reply.creation===frame.subjectCreation&&reply.parentPid===frame.subjectParentPid&&reply.image===frame.subjectImage&&reply.registrationNonce===frame.registrationNonce&&reply.recordId===frame.recordId&&reply.recordSha256===frame.recordSha256,'Root-held actual subject binding');
 need(Number(reply.observedUtc)>=before&&Number(reply.observedUtc)<=after&&Number(reply.observedNative)>=Number(frame.issued)&&Number(reply.observedNative)<=Number(frame.overallEnd)&&after<=Number(frame.utcEnd),'Root original probe clocks');
}

export function splitPrivateChunk(pending,chunk){let text=pending+chunk;const lines=[];let i;while((i=text.indexOf('\n'))>=0){const line=text.slice(0,i).replace(/\r$/,'');need(Buffer.byteLength(line)<=65536,'private frame bound');lines.push(line);text=text.slice(i+1)}need(Buffer.byteLength(text)<=65536,'private pending bound');return {pending:text,lines}}
export function terminalControlState(waiting,queued,children){need(waiting===false&&queued===0&&children===0,'terminal control not drained');return true}
