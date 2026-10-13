import {readFileSync,readdirSync,lstatSync,writeFileSync,existsSync} from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
const sha=b=>createHash("sha256").update(b).digest("hex");
const lock=JSON.parse(readFileSync("package-lock.json")),packages=[];
for(const [name,p] of Object.entries(lock.packages)){
  if(!name)continue;
  if(!existsSync(path.join(name,"package.json"))){
    const wrongPlatform=(p.os&&!p.os.includes(process.platform))||(p.cpu&&!p.cpu.includes(process.arch));
    if(!p.optional||!wrongPlatform)throw new Error("Required platform package missing: "+name);
    packages.push({path:name,version:p.version,integrity:p.integrity,status:"UNSUPPORTED_OTHER_PLATFORM_NOT_INSTALLED"});continue;
  }
  const meta=JSON.parse(readFileSync(path.join(name,"package.json")));
  if(meta.version!==p.version)throw new Error("Installed package version mismatch: "+name);
  packages.push({path:name,name:meta.name,version:meta.version,license:meta.license,integrity:p.integrity,resolved:p.resolved,exports:meta.exports??null});
}
const expected={"typescript":"5.9.3","esbuild":"0.25.12","three":"0.186.1","@types/three":"0.186.0","@dimforge/rapier3d-compat":"0.21.0"};
for(const [name,version] of Object.entries(expected))if(!packages.some(p=>p.name===name&&p.version===version))throw new Error("Required exact pin missing: "+name);
const files=[];
function scan(dir){
  for(const name of readdirSync(dir).sort()){
    const p=path.join(dir,name),s=lstatSync(p);if(s.isSymbolicLink())throw new Error("Dependency symlink not admitted");
    if(s.isDirectory())scan(p);else files.push({path:p.replaceAll("\\","/"),bytes:s.size,sha256:sha(readFileSync(p))});
  }
}
scan("node_modules");
const three=await import("three"),rapier=await import("@dimforge/rapier3d-compat");
if(three.REVISION!=="186"||typeof three.BufferGeometry!=="function"||typeof rapier.World!=="function")throw new Error("Actual dependency export mismatch");
writeFileSync("dependency-binding.json",JSON.stringify({lockSha256:sha(readFileSync("package-lock.json")),packages,files,
  exportProbe:{threeRevision:three.REVISION,BufferGeometry:"function",rapierWorld:"function",rapierInit:"NOT_RUN_NOT_A_PHYSICS_SPIKE"},
  usage:"Three/Rapier migration targets installed only in this spike; frozen historical controls unchanged"},null,2)+"\n");
console.log(JSON.stringify({status:"PASS",packages:packages.length,files:files.length,pins:expected}));
