import {preview} from "vite";
import {resolve} from "node:path";
import {writeFileSync,mkdirSync} from "node:fs";
const root=resolve(import.meta.dirname,".."),port=5313,runtime=resolve(root,".runtime");mkdirSync(runtime,{recursive:true});
const server=await preview({root,preview:{host:"127.0.0.1",port,strictPort:true}});
server.httpServer.ref();
const owner={pid:process.pid,port,root,origin:`http://127.0.0.1:${port}`,startedAt:new Date().toISOString()};
writeFileSync(resolve(runtime,"preview-owner.json"),JSON.stringify(owner,null,2)+"\n");console.log(JSON.stringify({server:"READY",...owner}));
let closing=false;
const close=()=>{if(closing){return;}closing=true;server.httpServer.close(error=>{
  console.log(JSON.stringify({server:"STOPPED",pid:process.pid,port,error:error?.message??null}));process.exit(error?1:0);
});};
process.once("SIGINT",close);process.once("SIGTERM",close);
process.stdin.on("data",data=>{if(data.toString().trim()==="stop"){close();}});process.stdin.resume();
