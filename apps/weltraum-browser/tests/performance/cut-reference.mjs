// Run the trusted-click series against one locally built dist, preserving incomplete runs.
import {createHash} from "node:crypto";
import {execFileSync,spawn} from "node:child_process";
import {mkdir,readFile,readdir,writeFile} from "node:fs/promises";
import {cpus,platform,release,totalmem} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {preview} from "vite";

const usage = "node tests/performance/cut-reference.mjs NEW_DIRECTORY [PAIRS=30]";
if (process.argv[2] === "--help") {console.log(usage); process.exit(0);}
const [output, pairArg="30"] = process.argv.slice(2);
const pairs = Number(pairArg);
if (!output || !Number.isInteger(pairs) || pairs<1 || pairs>1000) throw new Error(usage);
if (!process.env.CHROMIUM_BIN) throw new Error("Set CHROMIUM_BIN to the target Chrome executable.");
if (process.env.HVP_SOFTWARE_RENDERER === "1") throw new Error("Disable HVP_SOFTWARE_RENDERER for a reference run.");

const app = fileURLToPath(new URL("../../", import.meta.url));
const dir = path.resolve(output);
const dist = path.join(app,"dist");
await readFile(path.join(dist,"index.html"));
const assets = (await readdir(path.join(dist,"assets"))).sort();
const hashes = {};
for (const asset of assets.filter(name=>/^(physicsWorker-|hvpBootstrap-|rapier_wasm3d_bg-)/.test(name))) {
  hashes[asset] = createHash("sha256").update(await readFile(path.join(dist,"assets",asset))).digest("hex");
}
if (!Object.keys(hashes).some(name=>name.endsWith(".wasm"))) throw new Error("Build does not contain the native physics asset.");
await mkdir(dir);
const cpu = cpus();
const git = (...args) => execFileSync("git",args,{cwd:app,encoding:"utf8"}).trim();
let video = null, videoError;
if (platform()==="win32") {
  try {
    const raw=execFileSync("powershell.exe",["-NoProfile","-Command",
      "Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion,CurrentRefreshRate | ConvertTo-Json -Compress"],
      {encoding:"utf8",timeout:15000});
    video=JSON.parse(raw.replace(/^\uFEFF/,""));
  } catch(error) {videoError=String(error.message);}
}
const manifest = {startedUtc:new Date().toISOString(),commit:git("rev-parse","HEAD"),worktreeChanges:git("status","--porcelain","--untracked-files=no"),
  platform:platform(),release:release(),cpu:cpu[0]?.model,logicalCpus:cpu.length,ramBytes:totalmem(),video,videoError,
  chrome:process.env.CHROMIUM_BIN,expectedGpu:process.env.HVP_REFERENCE_GPU ?? "7900 XTX",pairs,hashes};
const record=()=>writeFile(path.join(dir,"reference.json"),JSON.stringify(manifest,null,2)+"\n");
await record();
const server=await preview({root:app,configFile:false,logLevel:"warn",preview:{host:"127.0.0.1",port:0},build:{outDir:dist}});
try {
  const url="http://127.0.0.1:"+server.httpServer.address().port;
  const served=await fetch(url);
  if (!served.ok || !(await readFile(path.join(dist,"index.html"))).equals(Buffer.from(await served.arrayBuffer()))) throw new Error("Preview does not serve the selected build.");
  const runner=fileURLToPath(new URL("./physics-placement-player.mjs",import.meta.url));
  const child=spawn(process.execPath,[runner,url,path.join(dir,"series"),String(pairs)],{cwd:app,stdio:"inherit",
    env:{...process.env,HVP_HEADFUL:"1",HVP_REFERENCE_GPU:manifest.expectedGpu}});
  const result=await new Promise((resolve,reject)=>{child.on("error",reject);child.on("exit",(code,signal)=>resolve({code,signal}));});
  manifest.series=result;
  process.exitCode=result.code ?? 1;
} finally {
  await server.close();
  manifest.finishedUtc=new Date().toISOString();
  await record();
}
