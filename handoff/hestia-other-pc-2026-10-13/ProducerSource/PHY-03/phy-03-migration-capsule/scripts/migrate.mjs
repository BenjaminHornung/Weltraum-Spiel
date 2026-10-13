import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve,dirname,sep} from "node:path";
import assert from "node:assert/strict";
const spike=resolve(import.meta.dirname,".."),[kind,input,output,collision]=process.argv.slice(2);
assert(["body","world","game"].includes(kind)&&input&&output,
  "Usage: node scripts/migrate.mjs <body|world|game> <input> <new-output-in-spike> [collision-profile]");
const target=resolve(spike,output);assert(target.startsWith(spike+sep),"Output must stay in the isolated spike");
const runtime=resolve(spike,".runtime");mkdirSync(runtime,{recursive:true});process.env.TEMP=runtime;process.env.TMP=runtime;
const {createServer}=await import("vite");
const server=await createServer({root:spike,server:{middlewareMode:true},appType:"custom"});
try{
  const {migrateLegacy,encodeEnvelope,decodeEnvelope,sha256}=await server.ssrLoadModule("/src/capsule.ts");
  const original=new Uint8Array(readFileSync(resolve(spike,input))),envelope=await migrateLegacy(original,kind,collision);
  const bytes=encodeEnvelope(envelope),decoded=await decodeEnvelope(bytes);assert.deepEqual(decoded.legacy,original);
  mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes,{flag:"wx"});
  console.log(JSON.stringify({status:"PASS",inputSha256:await sha256(original),outputSha256:await sha256(bytes),bytes:bytes.length,
    worldFormatVersion:envelope.worldFormatVersion,solverProfile:envelope.solverProfile.id,productIntegration:"NO"}));
}finally{await server.close();}
