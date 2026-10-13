import http from "node:http";
import {readFile} from "node:fs/promises";
import {writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const types={".mjs":"text/javascript",".json":"application/json",".wasm":"application/wasm",".html":"text/html"};
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,"http://127.0.0.1").pathname,p=path.resolve(root,"."+decodeURIComponent(pathname==="/"?"/browser/index.html":pathname));
    if(!p.startsWith(root+path.sep))throw new Error("Outside spike");
    res.setHeader("Content-Type",types[path.extname(p)]??"application/octet-stream");res.end(await readFile(p));
  }catch{res.writeHead(404);res.end("Not found");}
});
server.listen(0,"127.0.0.1",()=>{
  const port=server.address().port;writeFileSync(path.join(root,".runtime/server.json"),JSON.stringify({port,pid:process.pid}));
  console.log("GFX05_FUNCTIONAL_URL=http://127.0.0.1:"+port);
});
