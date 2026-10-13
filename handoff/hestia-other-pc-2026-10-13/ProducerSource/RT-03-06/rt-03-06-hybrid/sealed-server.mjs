import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.wgsl':'text/plain'};
/** Every response is compared with the immutable startup binding; a changed server cannot silently serve current bytes. */
export function createSealedServer(spike,manifest,controls){
 const dist=path.join(spike,'dist'),payload=new Map(manifest.files.filter(r=>r.path.startsWith('spikes/rt-03-06-hybrid/dist/')).map(r=>[r.path.slice('spikes/rt-03-06-hybrid/dist/'.length),r]));
 const controlMap=new Map(controls.map(r=>[r.path,r]));
 return http.createServer(async(req,res)=>{
  try{const url=new URL(req.url,'http://127.0.0.1'),name=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';
   const control=name==='seal-envelope.json'?'seal.json':name==='binding-manifest.json'?'binding-manifest.json':null;
   const file=path.resolve(control?spike:dist,control??name),bound=control?controlMap.get(control):payload.get(name);
   if(req.method!=='GET'||!bound||!file.startsWith((control?spike:dist)+path.sep)){res.writeHead(404);res.end('Unbound path');return;}
   const bytes=await readFile(file);if(bytes.length!==(bound.byteLength??bound.bytes)||sha(bytes)!==bound.sha256){res.writeHead(412);res.end('FROZEN_BYTES_DRIFT');return;}
   res.writeHead(200,{'Content-Type':types[path.extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end('Unavailable bound input');}
 });
}
