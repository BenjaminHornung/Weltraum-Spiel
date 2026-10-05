import { createServer } from 'node:http';
import { readFileSync,existsSync } from 'node:fs';
import { join,extname } from 'node:path';
import { BUILD,RUN,START,TREE,URL_ROOT,json,bytes,fresh,environment } from './support.mjs';
Object.assign(process.env,environment());const admission=json(RUN+'/admission.json');
if(admission.start!==START||admission.tree!==TREE||admission.baseURL!==URL_ROOT){throw new Error('Wrong preview admission');}
const proof=json(admission.buildProof.path,admission.buildProof.sha256);const allowed=new Set(proof.buildAssets.map((r)=>r.path));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.css':'text/css; charset=utf-8','.wasm':'application/wasm'};
let stopping=false;const started=Date.now();
const server=createServer((req,res)=>{try{const url=new URL(req.url,URL_ROOT);let p=decodeURIComponent(url.pathname).slice(1);if(p===''){p='index.html';}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  if(!allowed.has(p)||p.split('/').includes('..')){res.writeHead(404);res.end('Not in immutable HEAD build');return;}
  const data=bytes(join(BUILD,p),BUILD);res.writeHead(200,{'content-type':types[extname(p)]??'application/octet-stream','content-length':data.length,'cache-control':'no-store'});res.end(req.method==='HEAD'?undefined:data);
 }catch(error){res.writeHead(500);res.end(String(error));}});
async function stop(reason){if(stopping){return;}stopping=true;clearInterval(control);clearTimeout(deadline);server.closeIdleConnections();
 await new Promise((ok,no)=>server.close((e)=>e?no(e):ok()));fresh(RUN+'/preview-cleanup.json',{pid:process.pid,reason,cooperative:true,closed:true,elapsedCommandMs:Date.now()-started,source:START,tree:TREE,productIntegrated:false});console.log('RD13_PREVIEW_STOPPED');}
const control=setInterval(()=>{if(existsSync(RUN+'/preview.stop.json')){void stop('owned-stop-file');}},200);
const deadline=setTimeout(()=>{void stop('bounded-preview-deadline');},1800000);
process.once('SIGINT',()=>{void stop('owned-signal-SIGINT');});process.once('SIGTERM',()=>{void stop('owned-signal-SIGTERM');});
server.once('error',(e)=>{fresh(RUN+'/preview-blocked.json',{status:'BLOCKED_NO_FOREIGN_CLEANUP',error:String(e),pid:process.pid,source:START,productIntegrated:false});clearInterval(control);clearTimeout(deadline);process.exitCode=1;});
server.listen({host:'127.0.0.1',port:5280,exclusive:true},()=>{fresh(RUN+'/preview-started.json',{pid:process.pid,source:START,tree:TREE,buildRoot:BUILD,buildFiles:517,baseURL:URL_ROOT,exclusive:true,readiness:'ACTUAL_LISTENING',productIntegrated:false});console.log('RD13_PREVIEW_READY 127.0.0.1:5280 exact HEAD build517');});
