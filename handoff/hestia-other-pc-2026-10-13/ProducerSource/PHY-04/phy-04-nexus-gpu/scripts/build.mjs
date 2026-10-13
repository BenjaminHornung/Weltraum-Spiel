import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, delimiter } from 'node:path';
import { root, rustRoot, cargo, run } from './commands.mjs';
import { verifyInputs } from './verify-inputs.mjs';
verifyInputs();
const id = process.argv[2] ?? 'build-01';
const env = { ...process.env, CARGO_HOME: resolve(root,'.cargo-home'), CARGO_TARGET_DIR:resolve(root,'target'),
  RUSTUP_HOME:'C:/IFI_SourceCode/Utils/Rust/rustup-home', RUSTC:rustRoot+'/bin/rustc.exe',
  CARGO_BUILD_JOBS:'1', PATH:rustRoot+'/bin'+delimiter+'C:/IFI_SourceCode/Utils/Rust/cargo-home/bin'+delimiter+process.env.PATH };
if (env.KHAL_SKIP_SPIRV || env.KHAL_CUDA_ARCH) throw new Error('NO_SHADER_BYPASS_OR_CUDA_BACKEND');
const gpu=run(id+'-cargo-gpu',cargo,['gpu','--version'],{env});
const target=existsSync(rustRoot+'/lib/rustlib/wasm32-unknown-unknown/lib');
const summary={environment:'LOCAL_WINDOWS_ISOLATED',implementation:'BLOCKED',
  gpuCompiler:{exitCode:gpu.exitCode,status:gpu.exitCode===0?'AVAILABLE':'MISSING'},
  wasm32Target:target?'AVAILABLE':'MISSING', browserBuild:'NOT_RUN_PREREQUISITES_BLOCKED',
  shader:'NOT_BUILT', nexusWasm:'NOT_BUILT', typecheck:'NOT_RUN_PREREQUISITES_BLOCKED',
  productIntegration:'NO', noNewToolchainInstallation:true};
if(gpu.exitCode===0 && target) {
  const check=run(id+'-typecheck',cargo,['check','--locked','--target','wasm32-unknown-unknown','--manifest-path','harness/Cargo.toml','--jobs','1'],{env,timeout:300000});
  summary.typecheck=check.exitCode===0?'PASS':'FAIL';
  if(check.exitCode===0) {
    const build=run(id+'-wasm',cargo,['build','--locked','--release','--target','wasm32-unknown-unknown','--manifest-path','harness/Cargo.toml','--jobs','1'],{env,timeout:600000});
    summary.browserBuild=build.exitCode===0?'WASM_ONLY_BINDGEN_AND_BROWSER_STILL_REQUIRED':'FAIL';
  }
}
writeFileSync(resolve(root,'tests/'+id+'.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
process.exitCode=summary.browserBuild==='PASS'?0:2;
