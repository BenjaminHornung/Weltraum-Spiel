export const SOURCE_ROOT='C:\\IFI_SourceCode\\Temp\\WeltraumSpiel\\.worktrees\\Hestia-A0-BenniPC-2026-10-13\\.a0-runtime\\benni-pc-m5-harmless-activation-source-r05';
export const SCENARIOS=['nominal','unexpected-member','ipc-cancel','watchdog','premature-root-exit','supervisor-crash'];
export const ROLES=['root','child','grandchild','sibling','canary'];
export function need(ok,reason){if(!ok)throw new Error('DATA_HOLD:'+reason)}
export function parseFlat(text){
 need(typeof text==='string'&&text.length<=65536,'flat JSON bound');let i=0;const result=Object.create(null);
 const ws=()=>{while(/\s/.test(text[i]||'')&&i<text.length)i++};
 function str(){ws();need(text[i]==='"','JSON string');const start=i++;let escaped=false;for(;i<text.length;i++){const c=text[i];if(!escaped&&c==='"'){i++;return JSON.parse(text.slice(start,i))}if(!escaped&&c==='\\')escaped=true;else escaped=false}throw new Error('DATA_HOLD:unterminated JSON string')}
 ws();need(text[i++]==='{','flat object');ws();if(text[i]==='}'){i++;ws();need(i===text.length,'trailing JSON');return result}
 while(i<text.length){const key=str();need(!Object.hasOwn(result,key),'duplicate JSON key');ws();need(text[i++]===':','JSON colon');result[key]=str();ws();const end=text[i++];if(end==='}'){ws();need(i===text.length,'trailing JSON');return result}need(end===',','JSON comma');}
 throw new Error('DATA_HOLD:unterminated JSON object');
}
export function flatSchema(value,schema,fields){
 const keys=fields.split(' ');need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length,'unknown/missing record fields');
 for(const k of keys)need(typeof value[k]==='string'&&value[k].trim().length>0,'string field '+k);
 need(value.schema===schema&&value.version==='1','record schema');
}

export function validateRootDecision(p,c,g,f,spent,hashes,self,now){
 flatSchema(p,'hestia.m5.package.v1',"schema version packageId ownerNative sourceRoot packagePinsSha256 nodeSha256 powerShellSha256 dllSha256 fixtureSha256 coreLibrarySha256 profile scenarios roles");
 flatSchema(c,'hestia.m5.context.v1',"schema version contextId packageId packageRecordSha256 ownerNative ownerProcessId ownerCreation ownerImage ownerParentPid runnerId runnerProcessId runnerCreation runnerImage runnerParentPid paseoAgent workspace leaseId leaseExpiresUtc capacity outputExclusive outputCustodyId suiteToken nativeOrigin nativeClockDomain nativeClockApi utcClockApi clockMode issued workEnd overallEnd utcIssued utcEnd sourceRoot suiteOutputRoot hostParentPid hostParentCreation hostParentImage hostParentParentPid nodeOrigins bootStamp");
 flatSchema(g,'hestia.m5.grant.v1',"schema version grantId contextId contextRecordSha256 packageId scope authorizationClass humanMessageRef humanMessageSha256 retry suiteToken outputCustodyId notBeforeUtc expiresUtc");
 need(p.schema==='hestia.m5.package.v1'&&c.schema==='hestia.m5.context.v1'&&g.schema==='hestia.m5.grant.v1'&&p.version==='1'&&c.version==='1'&&g.version==='1','record version');
 need(p.sourceRoot===SOURCE_ROOT&&c.sourceRoot===SOURCE_ROOT,'fixed source');
 need(p.ownerNative==='01a13648-c55b-7250-bf07-34921d70b43b'&&c.ownerNative===p.ownerNative,'owner');
 need(g.scope==='HARMLESS_SIX_ONCE'&&g.authorizationClass==='DIRECT_HUMAN_RUNTIME_ONCE'&&g.retry==='0','runtime scope');
 need(g.humanMessageRef!=='call_f75fff55e3a34653b255fd83365457ca'&&!/r05|source/i.test(g.humanMessageRef)&&/^[0-9a-f]{64}$/.test(g.humanMessageSha256),'human runtime reference');
 need(c.packageId===p.packageId&&g.packageId===p.packageId&&g.contextId===c.contextId&&c.packageRecordSha256===hashes.package&&g.contextRecordSha256===hashes.context,'independent Root records');
 need(f.packageRecordSha256===hashes.package&&f.contextRecordSha256===hashes.context&&f.grantRecordSha256===hashes.grant&&f.consumedSha256===hashes.consumed,'private Root correspondence');
 need(spent.schema==='hestia.m5.consumed.v1'&&spent.version==='1'&&spent.grantId===g.grantId&&spent.contextRecordSha256===hashes.context&&spent.packageRecordSha256===hashes.package&&spent.grantRecordSha256===hashes.grant,'actual host consumed');
 for(const k of ['issued','workEnd','overallEnd','utcIssued','utcEnd','hostPid','hostCreation','hostImage','hostParentPid'])need(f[k]===spent[k],'same original '+k);
 need(c.capacity==='ONE_CONTROLLER_SIX_SERIAL_LANES_ACTIVE3'&&c.outputExclusive==='true'&&g.suiteToken===c.suiteToken&&g.outputCustodyId===c.outputCustodyId,'capacity/custody');
 need(p.profile==='WINDOWS_PWSH7.6.4_NET10.0.10_GETTICKCOUNT64'&&c.nativeClockApi==='GetTickCount64'&&c.utcClockApi==='DateTimeOffset.UtcNow','qualified original clock');
 need(ROLES.includes(f.role)&&SCENARIOS.includes(f.scenario),'fixed fixture role/scenario');
 need(String(self.pid)===f.subjectPid&&String(self.ppid)===f.subjectParentPid&&self.execPath.toLowerCase()===f.subjectImage.toLowerCase(),'actual fixture pid/parent/image');
 for(const k of ['issued','workEnd','overallEnd','utcIssued','utcEnd'])need(/^(0|[1-9][0-9]*)$/.test(f[k])&&Number.isSafeInteger(Number(f[k])),'clock integer');
 need(Number(f.workEnd)-Number(f.issued)===48000&&Number(f.overallEnd)-Number(f.issued)===60000&&Number(f.utcEnd)-Number(f.utcIssued)===60000,'original endpoints');
 need(Number(c.leaseExpiresUtc)>=Number(f.utcEnd)&&Number(g.notBeforeUtc)<=Number(f.utcIssued)&&Number(g.expiresUtc)>=Number(f.utcEnd),'grant lease window');
 need(now>=Number(f.utcIssued)&&now<=Number(f.utcEnd),'original UTC');
 need(c.suiteOutputRoot===SOURCE_ROOT+'\\qualification-runs\\'+c.suiteToken,'fixed output');
 // No capability is returned. Real fixed files, private creator transport and observations are required by the adapter.
}
