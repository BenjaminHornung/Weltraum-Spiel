import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, isAbsolute, delimiter, toNamespacedPath } from 'node:path';
import { root, rustRoot, cargo, run, sha256 } from './commands.mjs';
import { verifyInputs } from './verify-inputs.mjs';

// Bind the receipt to the harness selected by this Cargo invocation, including on cache hits.
function bindCargoWasm(stdout) {
  const path = 'target/wasm32-unknown-unknown/release/phy04_nexus_browser.wasm';
  const matchesPath = (actual, expected) => typeof actual === 'string' && isAbsolute(actual) &&
    relative(toNamespacedPath(resolve(root, expected)), toNamespacedPath(actual)) === '';
  const events = stdout.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
  const produced = events.some(event => event.reason === 'compiler-artifact' &&
    event.target?.name === 'phy04_nexus_browser' && event.target.kind?.includes('cdylib') &&
    matchesPath(event.manifest_path, 'harness/Cargo.toml') &&
    event.filenames?.some(name => matchesPath(name, path)));
  if (!produced) throw new Error('CARGO_HARNESS_ARTIFACT_MISSING');

  const bytes = readFileSync(resolve(root, path));
  const exports = WebAssembly.Module.exports(new WebAssembly.Module(bytes));
  if (!exports.some(value => value.name === 'run_fixture' && value.kind === 'function') ||
      !exports.some(value => value.name === 'memory' && value.kind === 'memory')) {
    throw new Error('NEXUS_WASM_EXPORTS_MISSING');
  }
  return { path, bytes: bytes.length, sha256: sha256(bytes) };
}

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
  wasmBuild:'NOT_RUN', wasmArtifact:null, gpuRuntime:'NOT_RUN', deviceLoss:'NOT_RUN',
  productIntegration:'NO', noNewToolchainInstallation:true};
if(gpu.exitCode===0 && target) {
  const check=run(id+'-typecheck',cargo,['check','--locked','--target','wasm32-unknown-unknown','--manifest-path','harness/Cargo.toml','--jobs','1'],{env,timeout:300000});
  summary.typecheck=check.exitCode===0?'PASS':'FAIL';
  if(check.exitCode===0) {
    const build=run(id+'-wasm',cargo,['build','--locked','--release','--message-format=json-render-diagnostics','--target','wasm32-unknown-unknown','--manifest-path','harness/Cargo.toml','--jobs','1'],{env,timeout:600000});
    summary.wasmBuild='FAIL';
    summary.browserBuild='FAIL';
    if (build.exitCode === 0 && !build.signal && !build.spawnError) {
      try {
        summary.wasmArtifact = bindCargoWasm(build.stdout);
        summary.wasmBuild = 'PASS';
        summary.nexusWasm = 'BUILT';
        summary.shader = 'EMBEDDED_SHADERS_NOT_INDEPENDENTLY_VERIFIED';
        summary.browserBuild = 'WASM_ONLY_BINDGEN_AND_BROWSER_STILL_REQUIRED';
      } catch (error) {
        summary.artifactError = error.message;
      }
    }
  }
}
writeFileSync(resolve(root,'tests/'+id+'.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
process.exitCode=summary.wasmBuild==='PASS'?0:2;
