import { RUN,json,files,fresh } from './support.mjs';
const report=json(RUN+'/native-results.json');
const cases=files(RUN+'/cases').map((r)=>{const c=json(RUN+'/cases/'+r.path);return {file:r.path,bytes:r.bytes,title:c.title,status:c.status,ownErrors:c.errors,
  networkCount:c.network.length,networkProblems:c.network.filter((n)=>n.failure||n.bodyError||n.status!==200),contexts:c.afterCleanup?.contexts?.length,
  created:c.afterCleanup?.created,deleted:c.afterCleanup?.deleted,raf:c.afterCleanup?.raf,shaderCount:c.afterCleanup?.shaders?.length,readbacks:c.afterCleanup?.readbacks?.length};});
const captures=files(RUN+'/captures').filter((r)=>r.path.endsWith('.json')).map((r)=>{const c=json(RUN+'/captures/'+r.path);return {name:c.name,stable:c.stableSourceFrame,
  status:c.before.status,bridge:c.before.bridgePresent,selections:c.before.selections,canvas:c.canvas,ui:c.ui,box:c.fractionalElementBox,
  frame:c.before.projected?.private?.host?.frame,source:c.before.projected?.private?.source,rendered:c.before.projected?.private?.host?.rendered};});
const value={stats:report.stats,reportConfigKeys:Object.keys(report.config),projectUseKeys:report.config.projects.map((p)=>Object.keys(p.use??{})),
  includesPrivateTransport:JSON.stringify(report).includes('ws://127.0.0.1:'),cases,captures,
  inventory:['captures','cases','flows','diagnosis','numeric','commands','pw-output','helper-history'].map((p)=>{const f=files(RUN+'/'+p);return {path:p,count:f.length,bytes:f.reduce((n,r)=>n+r.bytes,0)};}),
  productIntegrated:false,nativeExecuted:false};
fresh(RUN+'/recovered-evidence-summary.json',value);console.log(JSON.stringify(value,null,2));
