import {build} from "esbuild";
import {execFileSync} from "node:child_process";
import {mkdirSync,readFileSync,writeFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
process.chdir(root);
execFileSync(process.execPath,["node_modules/typescript/bin/tsc","-p","tsconfig.json"],{stdio:"inherit"});
mkdirSync("dist",{recursive:true});
await build({entryPoints:["src/oracle.ts"],outfile:"dist/oracle.mjs",bundle:true,format:"esm",platform:"neutral",target:"es2022"});
if(existsSync("src/adapter.ts"))await build({entryPoints:["src/adapter.ts"],outfile:"dist/adapter.mjs",bundle:true,format:"esm",platform:"neutral",target:"es2022"});
if(!process.argv.includes("--control-only")){
  const tool="C:/IFI_SourceCode/Utils/Rust/rustup-home/toolchains/stable-x86_64-pc-windows-msvc";
  execFileSync(path.join(tool,"bin/rustc.exe"),["rust/src/lib.rs","--crate-name","gfx05","--crate-type","cdylib","--edition=2021",
    "--target","wasm32-unknown-unknown","--sysroot",path.resolve(".runtime/sysroot"),
    "-C",`linker=${tool}/lib/rustlib/x86_64-pc-windows-msvc/bin/rust-lld.exe`,
    "-C","opt-level=3","-C","strip=debuginfo","-C","panic=abort","-C","target-feature=-simd128","-C","link-arg=--max-memory=67108864",
    "-o","dist/scalar.wasm"],{stdio:"inherit"});
}
const sha=b=>createHash("sha256").update(b).digest("hex");
const files=["dist/oracle.mjs","dist/adapter.mjs","dist/scalar.wasm"].filter(existsSync).map(p=>({path:p,bytes:readFileSync(p).length,sha256:sha(readFileSync(p))}));
writeFileSync("build-binding.json",JSON.stringify({mode:"SCALAR_ONLY",rust:"1.97.1",node:process.version,files},null,2)+"\n");
console.log(JSON.stringify({status:"PASS",files}));
