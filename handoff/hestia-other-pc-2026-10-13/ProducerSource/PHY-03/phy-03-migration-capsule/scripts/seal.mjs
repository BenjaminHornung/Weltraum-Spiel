import {execFileSync} from "node:child_process";
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
const spike=resolve(import.meta.dirname,".."),root=resolve(spike,"../.."),base="17b1db4201a28e7b607c30707bdc2b75e3484a10";
const git=process.env.PHY03_GIT??"C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe";
const run=args=>execFileSync(git,args,{cwd:root,encoding:"utf8",maxBuffer:16*1024*1024});
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
assert.equal(run(["rev-parse","HEAD"]).trim(),base);
const split=out=>out.split("\0").filter(Boolean);
const paths=[...new Set([...split(run(["diff","--name-only","-z",base])),
  ...split(run(["diff","--cached","--name-only","-z"])),...split(run(["ls-files","--others","--exclude-standard","-z"]))])].sort();
assert(paths.length>0,"Empty review forbidden");
assert(paths.every(p=>p.startsWith("spikes/phy-03-migration-capsule/")||p.startsWith(".devtoolbox/specs/changes/phy-03-2026-10-09/")),
  "Dirty tree includes files outside the exclusive scope");
const receiptPath="spikes/phy-03-migration-capsule/receipt.json",receipt=JSON.parse(readFileSync(resolve(root,receiptPath),"utf8"));
assert.equal(receipt.sourceCommit,base);assert.equal(receipt.productIntegration,"NO");
const previous=receipt.bindings.dirtyTreeSha256;receipt.bindings.dirtyTreeSha256=null;receipt.bindings.dirtyFileCount=paths.length;
const records=paths.map(path=>{
  const bytes=path===receiptPath?Buffer.from(JSON.stringify(receipt,null,2)+"\n"):readFileSync(resolve(root,path));
  return {path,sha256:sha(bytes)};
});
const digest=sha(Buffer.from("phy03-full-dirty-tree-v1\0"+JSON.stringify(records)));
if(process.argv.includes("--check")){assert.equal(digest,previous,"Dirty tree changed since sealing");}
else{receipt.bindings.dirtyTreeSha256=digest;writeFileSync(resolve(root,receiptPath),JSON.stringify(receipt,null,2)+"\n");}
// Detached review output is ignored; every non-ignored dirty file above, including receipt, is bound.
const runtime=resolve(spike,".runtime");mkdirSync(runtime,{recursive:true});
const tracked=new Set(split(run(["ls-files","-z"])));
const additions=paths.filter(path=>!tracked.has(path)).map(path=>{
  const bytes=readFileSync(resolve(root,path)),text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
  const newline=text.endsWith("\n"),lines=text.split("\n");if(newline){lines.pop();}
  const header=`diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n`;
  return header+(text.length?`@@ -0,0 +1,${lines.length} @@\n${lines.map(line=>"+"+line).join("\n")}\n${newline?"":"\\ No newline at end of file\n"}`:"");
});
const patch=run(["diff","--binary",base])+additions.join("");
writeFileSync(resolve(runtime,"final-review.diff"),patch);
console.log(JSON.stringify({status:"PASS",dirtyTreeSha256:digest,dirtyFiles:paths.length,reviewDiffSha256:sha(Buffer.from(patch)),
  reviewDiff:".runtime/final-review.diff"}));
