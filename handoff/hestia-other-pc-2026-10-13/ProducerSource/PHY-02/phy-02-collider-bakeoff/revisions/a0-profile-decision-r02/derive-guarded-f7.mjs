import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {prior,root,sha,json,write,checkPrior} from "./bind.mjs";
checkPrior();
const sourcePath="producer/snapshot/c/tests/unit/structuralPgTragwerkF7.test.ts",bytes=fs.readFileSync(path.join(prior,sourcePath));
const bound=json(path.join(prior,"consumer-input-full.json")).files.find(f=>f.consumerPath===sourcePath);assert(bound);assert.equal(sha(bytes),bound.sha256);
const source=bytes.toString("utf8").replaceAll("\r\n","\n"),start=source.indexOf('  it("T1: Dichtepfad'),end=source.indexOf('\n  }, 180_000);',start)+ '\n  }, 180_000);'.length;
assert(start>=0&&end>start);const original=source.slice(start,end),bodyStart=original.indexOf("    const body = world.createRigidBody("),free=original.lastIndexOf("    world.free();");
assert(bodyStart>0&&free>bodyStart);
const guarded=original.slice(0,bodyStart)+"    let primary: unknown;\n    try {\n"+original.slice(bodyStart,free)+
  "    } catch (error) { primary = error; throw error; }\n    finally {\n      let cleanup: unknown = {status: \"PASS\"};\n      try { world.free(); }\n      catch (error) { cleanup = {status: \"FAIL\", name: (error as Error).name, message: (error as Error).message}; if (primary === undefined) throw error; }\n      finally {\n        fs.writeFileSync(process.env.PHY02_F7_CLEANUP!, JSON.stringify({\n          profile: \"rapier-0.21.0-phy01.migration2:legacy-impulse-v1\",\n          primary: primary instanceof Error ? {name: primary.name, message: primary.message, stack: primary.stack} : null, cleanup,\n          assertion: \"Original historical T1 unchanged; guarded disposal only; no public Cold or native heap recovery claim\"\n        }, null, 2) + \"\\n\", {flag: \"wx\"});\n      }\n    }"+original.slice(free+"    world.free();".length);
const imports=[
  ['"../../../../src/rapier021Candidate"','"../../phy01-migration2-r01/producer/src/rapier021Candidate"'],
  ['"../../src/voxel/structural"','"../../phy01-migration2-r01/producer/snapshot/c/src/voxel/structural"'],
  ['"./pgTragwerkFixture"','"../../phy01-migration2-r01/producer/snapshot/c/tests/unit/pgTragwerkFixture"'],
  ['"../../src/hestia-prototype/physics/rapierPort"','"../../phy01-migration2-r01/producer/snapshot/c/src/hestia-prototype/physics/rapierPort"']
];
const fsImport='import fs from "node:fs";\n';let derived=fsImport+source.replace(original,guarded);
for(const [old,replacement] of imports){assert(derived.includes(old));derived=derived.replace(old,replacement);}
let reversed=derived.replace(fsImport,"").replace(guarded,original);for(const [old,replacement] of imports)reversed=reversed.replace(replacement,old);
assert.equal(reversed,source,"Non-cleanup source/assertion/deadline change");
fs.mkdirSync("tests",{recursive:true});fs.writeFileSync("tests/guarded-structuralPgTragwerkF7.test.ts",derived,{flag:"wx"});
write("guarded-source-binding.json",{sourcePath:path.join(prior,sourcePath),originalBytes:bytes.length,originalSha256:sha(bytes),normalizedSourceSha256:sha(source),
  derivedPath:"tests/guarded-structuralPgTragwerkF7.test.ts",derivedSha256:sha(derived),originalT1Sha256:sha(original),guardedT1Sha256:sha(guarded),
  numericAssertionsDeadlinesPreserved:true,proof:"Reverse import rebasing, fs import and exactly one cleanup wrapper restores the complete original normalized source byte-for-byte",
  changedOnly:["Import paths target unchanged R01 copies","T1 native World disposal guarded with primary/secondary receipt","Line endings normalized LF"]});
console.log("PASS guarded T1 source derivation; all original assertions and deadlines preserved");
