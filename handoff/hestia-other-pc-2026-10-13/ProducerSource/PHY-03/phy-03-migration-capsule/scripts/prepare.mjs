import {readFileSync,writeFileSync,mkdirSync,existsSync} from "node:fs";
import {resolve,dirname,relative} from "node:path";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";

const spike=resolve(import.meta.dirname,".."),root=resolve(spike,"../.."),product=resolve(root,"apps/weltraum-browser");
const base="17b1db4201a28e7b607c30707bdc2b75e3484a10";
const git=process.env.PHY03_GIT??"C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe";
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
assert.equal(execFileSync(git,["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim(),base);
const seeds=["src/hestia-prototype/persistence/worldCheckpoint.ts","src/hestia-prototype/persistence/gameCheckpoint.ts",
  "tests/unit/hvp-body-save.test.ts","tests/unit/hvp-world-save.test.ts","tests/unit/hvp-body-residency.test.ts",
  "tests/unit/hvp-residency-session.test.ts"];
const pending=seeds.map(p=>resolve(product,p)),seen=new Set(),files=[];
while(pending.length){
  const file=pending.pop();if(seen.has(file)){continue;}seen.add(file);
  const path=relative(product,file).replaceAll("\\","/");assert(!path.startsWith("../"));
  const bytes=readFileSync(file),blob=execFileSync(git,["show",`${base}:apps/weltraum-browser/${path}`],{cwd:root,maxBuffer:16*1024*1024});
  assert.equal(sha(bytes),sha(blob),`Product file differs from fixed commit: ${path}`);
  const target=resolve(spike,"snapshot",path);mkdirSync(dirname(target),{recursive:true});
  if(existsSync(target)){assert.equal(sha(readFileSync(target)),sha(bytes),`Refusing modified snapshot: ${path}`);}
  else{writeFileSync(target,bytes);}
  files.push({path:`snapshot/${path}`,original:`apps/weltraum-browser/${path}`,sha256:sha(bytes),bytes:bytes.length,modified:false});
  if(file.endsWith(".ts")){
    const imports=/\b(?:from\s*|import\s*\(|new\s+URL\s*\()\s*["'](\.{1,2}\/[^"']+)["']/g;
    for(const match of bytes.toString("utf8").matchAll(imports)){
      const stem=resolve(dirname(file),match[1].split("?")[0]);
      const next=[stem+".ts",stem+".json",stem+"/index.ts",stem].find(p=>existsSync(p));
      assert(next,`Unresolved relative snapshot import: ${path} -> ${match[1]}`);pending.push(next);
    }
  }
}
const license=readFileSync(resolve(root,"LICENSE")),licenseBlob=execFileSync(git,["show",`${base}:LICENSE`],{cwd:root});
writeFileSync(resolve(spike,"snapshot/LICENSE"),licenseBlob);
files.push({path:"snapshot/LICENSE",original:"LICENSE",sha256:sha(licenseBlob),bytes:licenseBlob.length,
  checkoutSha256:sha(license),modified:false});
files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
writeFileSync(resolve(spike,"source-manifest.json"),JSON.stringify({base,seeds,files,modifiedPorts:[]},null,2)+"\n");
const rapier=resolve(spike,"node_modules/@dimforge/rapier3d-compat");
const pkg=JSON.parse(readFileSync(resolve(rapier,"package.json"),"utf8"));assert.equal(pkg.version,"0.12.0");
const wasm=readFileSync(resolve(rapier,"rapier_wasm3d_bg.wasm"));
const lock=JSON.parse(readFileSync(resolve(spike,"package-lock.json"),"utf8"));
const solver={id:"rapier-0.12.0-compat-hvp-control-v1",package:"@dimforge/rapier3d-compat",version:pkg.version,
  buildFlavor:"compat",wasmSha256:sha(wasm),packageIntegrity:lock.packages["node_modules/@dimforge/rapier3d-compat"].integrity,
  stepPolicy:"hvp-fixed-60hz-v1",integrationPolicy:"17b1-defaults",contactPolicy:"17b1-material-combine-ccd-sleep",
  queryVisibility:"17b1-positional-queries-solid-predicate"};
writeFileSync(resolve(spike,"solver-profile.json"),JSON.stringify(solver,null,2)+"\n");
mkdirSync(resolve(spike,"evidence"),{recursive:true});
const npmPackage=resolve(dirname(process.execPath),"node_modules/npm/package.json");
writeFileSync(resolve(spike,"evidence/dependencies.json"),JSON.stringify({node:process.version,
  npmVersion:existsSync(npmPackage)?JSON.parse(readFileSync(npmPackage,"utf8")).version:null,lockfileVersion:lock.lockfileVersion,
  lockSha256:sha(readFileSync(resolve(spike,"package-lock.json"))),packages:Object.entries(lock.packages).filter(([p])=>p)
    .map(([path,v])=>({path,version:v.version,license:v.license??null,integrity:v.integrity??null})),
  rapier:{license:pkg.license,exports:{main:pkg.main,module:pkg.module,types:pkg.types},wasmSha256:sha(wasm)}},null,2)+"\n");
console.log(JSON.stringify({status:"PASS",copiedFiles:files.length,wasmSha256:sha(wasm),node:process.version}));
