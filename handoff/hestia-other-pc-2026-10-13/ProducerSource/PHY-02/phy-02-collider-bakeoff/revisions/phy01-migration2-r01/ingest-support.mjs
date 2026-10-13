import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {root,json,sha,write,verifyCopies} from "./bindings.mjs";
verifyCopies();
const producer="C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-Spike-PHY-01-2026-10-09/spikes/phy-01-rapier-followup";
const prefix="spikes/phy-01-rapier-followup/";
const files=json("producer/delivery/manifest.json").files.filter(f=>f.path.startsWith(prefix+"snapshot/c/tests/support/")
  ||f.path===prefix+"upstream/native-toolchain-0.2.129.json");
assert(files.some(f=>f.path.endsWith("pgTragwerkFixtureAdapter.ts")));
const bound=[];
for(const f of files){
  const relative=f.path.slice(prefix.length),source=path.resolve(producer,relative),dest=path.resolve(root,"producer",relative);
  assert(source.replaceAll("\\","/").startsWith(producer+"/"));assert(dest.startsWith(root+path.sep));
  const bytes=fs.readFileSync(source);assert.equal(bytes.length,f.bytes);assert.equal(sha(bytes),f.sha256);
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes,{flag:"wx"});
  bound.push({producerPath:f.path,consumerPath:"producer/"+relative,bytes:f.bytes,sha256:f.sha256});
}
write("consumer-input-support.json",{reason:"Missing transitive frozen test seam plus bound producer native toolchain metadata",files:bound});
console.log("PASS supplemental frozen copies: "+bound.length);
