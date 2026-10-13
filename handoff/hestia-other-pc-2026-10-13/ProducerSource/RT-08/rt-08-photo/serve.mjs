import {createServer} from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {storeCapture} from './capture-store.mjs';
import {execFileSync} from 'node:child_process';
import {sha} from './verify-inputs.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'dist');
const runner=process.argv.includes('--runner');
let codeBindings=null;
if(runner){
 execFileSync(process.execPath,[path.resolve(root,'../seal.mjs'),'--verify'],{cwd:path.resolve(root,'..'),stdio:'inherit'});
 const receiptBytes=await readFile(path.resolve(root,'../receipt.json')),receipt=JSON.parse(receiptBytes);
 codeBindings={bindingManifestSha256:receipt.source.bindingManifestSha256,receiptSha256:sha(receiptBytes),lockSha256:receipt.source.lockSha256,inputBindingSha256:receipt.source.inputBindingSha256,baseCommit:receipt.source.baseCommit,shaderSourceListSha256:sha(Buffer.from(JSON.stringify(receipt.source.shaderSources))),compiledShaderStatus:'NOT_CAPTURED_REQUIRES_RUNNER_INSTRUMENTATION'};
}
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.mjs':'text/javascript','.bin':'application/octet-stream','.map':'application/json'};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');
 if(req.method==='GET'&&url.pathname==='/code-bindings.json'){if(!runner){res.writeHead(403).end();return;}res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(codeBindings));return;}
 if(req.method==='POST'){
   const match=/^\/capture\/(rt08-[a-z0-9-]{1,64})\/(32|128|512|diagnostics)$/.exec(url.pathname);
   if(!runner||!match||req.headers.origin!==`http://127.0.0.1:${server.address().port}`){res.writeHead(403).end();return;}
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>32*1024*1024){res.writeHead(413).end();return;}chunks.push(chunk);}
   await storeCapture(path.resolve(root,'..'),match[1],match[2],JSON.parse(Buffer.concat(chunks).toString('utf8')));res.writeHead(201).end('Own-scope artifact saved');return;
 }
 if(req.method!=='GET'){res.writeHead(405).end();return;}
 const request=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname),file=path.resolve(root,'.'+request),resolved=await realpath(file);
 if(!resolved.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 res.writeHead(200,{'Content-Type':types[path.extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(resolved));
 }catch{res.writeHead(404).end('Not found');}});
server.listen(0,'127.0.0.1',()=>console.log(`RT08 production preview http://127.0.0.1:${server.address().port} (DOM only; ?runner=1 for exclusive Runner/A0 slot)`));
