import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {root,json,check} from './inputs.mjs';
for(const f of json('InputBindings.json').members)check(f);
for(const f of json('.runtime/build-bindings.json').files)check(f);
const port=Number(process.argv[2]??4188);
const server=createServer((req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),path=url.pathname==='/'?'/web/index.html':decodeURIComponent(url.pathname);
  if(!['/web/','/dist/'].some(prefix=>path.startsWith(prefix)))throw Error('PATH');
  const file=resolve(root,'.'+path);if(!['web','dist'].some(dir=>file.startsWith(resolve(root,dir)+sep)))throw Error('PATH');
  const body=readFileSync(file);res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json'})[extname(file)]??'application/octet-stream');
  res.setHeader('Cache-Control','no-store');res.end(body);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log('WXG08 http://127.0.0.1:'+port));
