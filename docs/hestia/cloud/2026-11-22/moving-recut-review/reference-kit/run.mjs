// Run the unchanged game and measurement probes from the packaged native build.
import {createHash} from "node:crypto";
import {execFileSync,spawn} from "node:child_process";
import {existsSync} from "node:fs";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {createServer} from "node:http";
import {cpus,platform,release,totalmem} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const base=path.dirname(fileURLToPath(import.meta.url));
const [mode="serie",countArgument="30",...extra]=process.argv.slice(2);
const count=Number(countArgument);
if (extra.length||!["pruefen","serie","folgeschnitt"].includes(mode)||!Number.isSafeInteger(count)||count<1||count>1000)
  throw Error("Aufruf: node run.mjs [pruefen|serie|folgeschnitt] [Anzahl Paare]");
const manifest=JSON.parse(await readFile(path.join(base,"manifest.json"),"utf8"));
for (const [name,sha] of Object.entries(manifest.files)) {
  if (createHash("sha256").update(await readFile(path.join(base,name))).digest("hex")!==sha) throw Error("Prüfsumme abweichend: "+name);
}
console.log(manifest.commit,Object.keys(manifest.files).length,"Dateien geprüft");
if (mode==="pruefen") process.exit(0);
const chrome=process.env.CHROMIUM_BIN||[process.env.ProgramFiles,process.env["ProgramFiles(x86)"],process.env.LOCALAPPDATA]
  .filter(Boolean).map(root=>path.join(root,"Google","Chrome","Application","chrome.exe")).find(existsSync);
if (!chrome||!existsSync(chrome)) throw Error("Bitte CHROMIUM_BIN auf die vorhandene Chrome-Datei setzen.");
if (process.env.HVP_SOFTWARE_RENDERER==="1") throw Error("Referenzlauf benötigt die Hardware-GPU.");
const output=path.join(base,"Ergebnisse-"+mode+"-"+new Date().toISOString().replace(/[:.]/g,"-"));
await mkdir(output);
const host={startedUtc:new Date().toISOString(),mode,count,commit:manifest.commit,tree:manifest.tree,
  platform:platform(),release:release(),node:process.version,cpu:cpus()[0]?.model,logicalCpus:cpus().length,ramBytes:totalmem(),
  chrome,expectedGpu:process.env.HVP_REFERENCE_GPU??"7900 XTX",physicalPresentationMeasured:false};
if (platform()==="win32") {
  try {
    host.videoControllers=JSON.parse(execFileSync("powershell.exe",["-NoProfile","-Command",
      "Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion,CurrentRefreshRate | ConvertTo-Json -Compress"],{encoding:"utf8",timeout:15000}).replace(/^\uFEFF/,""));
  } catch (error) {host.videoQueryError=String(error.message);}
}
async function record(){await writeFile(path.join(output,"geraet.json"),JSON.stringify(host,null,2)+"\n");}
await record();
const mime={".html":"text/html;charset=utf-8",".js":"text/javascript",".css":"text/css",".json":"application/json",".wasm":"application/wasm",".svg":"image/svg+xml",".png":"image/png",".woff2":"font/woff2",".webp":"image/webp",".jpg":"image/jpeg"};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,"http://127.0.0.1"),key="dist"+(url.pathname==="/"?"/index.html":decodeURIComponent(url.pathname));
    if(req.method!=="GET"||!Object.hasOwn(manifest.files,key)){res.writeHead(404).end();return;}
    const bytes=await readFile(path.join(base,key));
    res.writeHead(200,{"content-type":mime[path.extname(key)]||"application/octet-stream","content-length":bytes.length,"cache-control":"no-store"}).end(bytes);
  }catch{if(!res.headersSent)res.writeHead(400);res.end();}
});
await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
let result;
try{
  const url="http://127.0.0.1:"+server.address().port;
  const probe=mode==="serie"?"physics-placement-player.mjs":"cut-moving-player.mjs";
  const args=mode==="serie"?[url,path.join(output,"serie"),String(count)]:[url];
  const env={...process.env,CHROMIUM_BIN:chrome,HVP_HEADFUL:"1",HVP_REFERENCE_GPU:host.expectedGpu};
  for(const key of ["HVP_CUT_PLANNER","HVP_CUT_PRIORITY","HVP_CUT_VISUAL","HVP_PHYSICS_PLACEMENT","HVP_CUT_TRACE_END","HVP_CUT_CHROME_TRACE","HVP_MOVING_THREAD_TRACE"])delete env[key];
  if(mode==="folgeschnitt")env.HVP_PLAYER_MEASURE="0";
  let outputHandle;
  try{
    if(mode==="folgeschnitt"){
      const {open}=await import("node:fs/promises");outputHandle=await open(path.join(output,"folgeschnitt.json"),"wx");
    }
    const child=spawn(process.execPath,[path.join(base,"probe",probe),...args],{cwd:base,env,stdio:["ignore",outputHandle?.fd??"inherit","inherit"]});
    result=await new Promise((resolve,reject)=>{child.once("error",reject);child.once("exit",(code,signal)=>resolve({code,signal}));});
  }finally{await outputHandle?.close();}
}finally{
  await new Promise(resolve=>server.close(resolve));
  host.finishedUtc=new Date().toISOString();host.process=result??{code:null,error:"Probe did not exit normally"};await record();
}
console.log("Ergebnisse:",output);
process.exitCode=result.code??1;
