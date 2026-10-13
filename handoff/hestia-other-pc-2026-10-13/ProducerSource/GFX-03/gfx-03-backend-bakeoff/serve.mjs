import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.bin':'application/octet-stream'};
const server = createServer(async(req,res)=>{
  try {
    const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const file=path.resolve(root,`.${name==='/'?'/index.html':name}`);
    if(!file.startsWith(root+path.sep)||(await stat(file)).isDirectory()) {res.writeHead(403);res.end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(file));
  } catch {res.writeHead(404);res.end('Not found');}
});
server.listen(43103,'127.0.0.1',()=>console.log('GFX-03 diagnostic production preview http://127.0.0.1:43103'));
process.on('SIGINT',()=>server.close());
