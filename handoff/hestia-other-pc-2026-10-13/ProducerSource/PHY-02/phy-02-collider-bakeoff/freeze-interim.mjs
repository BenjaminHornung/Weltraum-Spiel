import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {execFileSync,spawnSync} from "node:child_process";
const dir="handoffs/c-seam-2026-10-09-v1",git="C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe";
assert(!fs.existsSync(dir+"/receipt.json"),"Frozen handoff already exists; never overwrite");
const base="17b1db4201a28e7b607c30707bdc2b75e3484a10",sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const run=args=>execFileSync(git,args,{cwd:"../..",encoding:"utf8",maxBuffer:8*1024*1024}).trim();
assert.equal(run(["rev-parse","HEAD"]),base);
const status=run(["status","--porcelain=v1","-z","-uall"]).split("\0").filter(Boolean);
const changed=status.map(line=>{assert(!line.startsWith("R")&&!line.startsWith("C"),"Unsupported rename/copy");return line.slice(3);});
for(const path of changed)assert(path.startsWith("spikes/phy-02-collider-bakeoff/")||path.startsWith(".devtoolbox/specs/changes/phy-02-2026-10-09/"),"Forbidden dirty path "+path);
const dirty=changed.sort().map(path=>({path,sha256:sha(fs.readFileSync("../../"+path))}));
const baselineTree=run(["rev-parse",base+"^{tree}"]),dirtyTreeDigest=sha(Buffer.from(JSON.stringify({baselineTree,dirty})));
const r=spawnSync(process.execPath,[dir+"/repro.mjs"],{encoding:"utf8",maxBuffer:4*1024*1024,timeout:60000});
fs.writeFileSync(dir+"/raw-results.json",r.stdout);fs.writeFileSync(dir+"/stderr.log",r.stderr);
const parsed=JSON.parse(r.stdout);assert.equal(parsed.results.length,7);
assert(parsed.results.some(x=>x.mode==="C-coupled"&&x.primary?.message==="unreachable"),"Coupled negative not reproduced");
const dependencies=["package-lock.json","node_modules/rapier012/package.json","node_modules/rapier012/rapier.cjs.js","node_modules/rapier012/rapier_wasm3d_bg.wasm",
  "node_modules/rapier021/package.json","node_modules/rapier021/dist/rapier.mjs","node_modules/rapier021/dist/rapier_wasm3d_bg.wasm"]
  .map(path=>({path,sha256:sha(fs.readFileSync(path))}));
const files=["repro.mjs","raw-results.json","stderr.log"].map(path=>({path,sha256:sha(fs.readFileSync(dir+"/"+path))}));
fs.writeFileSync(dir+"/source-dirty-binding.json",JSON.stringify({base,baselineTree,dirtyTreeDigest,dirty,
  meaning:"Complete Git dirty delta against fixed base before receipt generation, plus separately bound immutable artifact; dependency/ignored executable bytes listed separately"},null,2)+"\n");
const receipt={schemaVersion:1,task:"PHY-02",status:"PARTIAL",executionLocation:"LOCAL_WINDOWS_ISOLATED",productIntegration:"NO",
  recommendation:"NO_ADOPTION_FROM_THIS_CASE",node:process.version,base,dirtyTreeDigest,sourceBindingSha256:sha(fs.readFileSync(dir+"/source-dirty-binding.json")),
  fixture:{cellSize:.125,leftGrid:[2,4,4],rightGrid:[2,4,4],rightOrigin:[.25,0,0],shift:[2,0,0],gravity:[0,-9.81,0],
    ballRadius:.0125,ballDensity:1,bodyPosition:[.0625,.5135,.0625],linearVelocity:[.25,0,0],ccd:true,friction:0,restitution:0,dt:1/60,steps:90},
  dependencies,files,runExitCode:r.status,rawResultsSha256:sha(fs.readFileSync(dir+"/raw-results.json")),
  primaryBoundary:"combineVoxelStates then native World.step traps for this coupled sphere-contact workload; exact Rust assertion UNKNOWN",
  cleanup:"Native free fails after trap; each case exits disposable owned Node child, no surviving World passed to next case",
  limits:["One primitive workload; no global solver/library verdict","Uncoupled completion is not coupled-oracle PASS","KCC/Sleep/Save/HVP and reference hardware NOT_RUN_PHY01_PENDING"]};
fs.writeFileSync(dir+"/receipt.json",JSON.stringify(receipt,null,2)+"\n");
console.log("Frozen PARTIAL receipt: "+dir+"/receipt.json\nSHA256 "+sha(fs.readFileSync(dir+"/receipt.json")));
