import { closeSync, lstatSync, openSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { verifyLocal } from './bind-inputs.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const nodeExe=resolve('C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe');
const npmCli=resolve('C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js');
const pythonExe=resolve('C:/IFI_SourceCode/Utils/Python/cpython-3.12.13-windows-x86_64-none/python.exe');
const gitExe=resolve('C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe');
const tsRoot=resolve(root,'node_modules/typescript');
const tsNativeRoot=resolve(root,'node_modules/@typescript/typescript-win32-x64');
const tsCli=resolve(tsRoot,'bin/tsc');
const tsExe=resolve(tsNativeRoot,'lib/tsc.exe');
const tsIntegrity='sha512-8FYau96o3NKOhbjKi/qNvG/W5jhzxkbdm5sj9AbZ/5T5sWqn3hJgLfGx27sRKZWTvyzCP8dLRBTf5tBTSRVUNA==';
const tsVersion='7.0.2';
const outputs=['dependencies.lock.json','DependencyBindings.json'];
const sha256=b=>createHash('sha256').update(b).digest('hex');
const json=o=>Buffer.from(JSON.stringify(o,null,2)+'\n');

function fileBinding(path) {
  const stat=lstatSync(path);
  if(stat.isSymbolicLink() || !stat.isFile()) throw new Error(`TOOL_FILE_INVALID:${path}`);
  const data=readFileSync(path);
  return {bytes:data.length,sha256:sha256(data)};
}
function run(exe,args) {
  const result=spawnSync(exe,args,{cwd:root,encoding:'utf8',windowsHide:true,timeout:30000});
  if(result.status!==0) throw new Error(`TOOL_VERSION_CHECK_FAILED:${result.status}:${result.error?.code??''}`);
  return result.stdout.trim();
}
function tool(name,version,path,runtimePath) {
  const binding=fileBinding(path);
  return {name,version,executablePath:path,...(runtimePath?{runtimePath}:{}),...binding};
}
function packageEntries(lock) {
  return Object.entries(lock.packages).filter(([path])=>path.startsWith('node_modules/'))
    .sort(([a],[b])=>a<b?-1:a>b?1:0)
    .map(([path,p])=>({path,version:p.version,integrity:p.integrity??null,license:p.license??null,optional:p.optional===true}));
}
function nodeModulesFiles(dir=root,base=resolve(root,'node_modules'),out=[]) {
  const stat=lstatSync(dir);
  if(stat.isSymbolicLink()) throw new Error(`NODE_MODULES_SYMLINK:${relative(root,dir)}`);
  if(stat.isDirectory()) {
    for(const entry of readdirSync(dir).sort()) nodeModulesFiles(resolve(dir,entry),base,out);
  } else if(stat.isFile()) {
    const data=readFileSync(dir);
    out.push({path:relative(base,dir).replaceAll('\\','/'),bytes:data.length,sha256:sha256(data)});
  } else throw new Error(`NODE_MODULES_SPECIAL_FILE:${relative(root,dir)}`);
  return out;
}
function collect() {
  const resolvedNode=resolve(process.execPath);
  if(process.version!=='v22.23.2' || resolvedNode.toLowerCase()!==nodeExe.toLowerCase())
    throw new Error('NODE_RUNTIME_MISMATCH');
  const npmVersion=run(nodeExe,[npmCli,'--version']);
  const pythonVersion=run(pythonExe,['--version']).match(/^Python (.+)$/)?.[1];
  const gitVersion=run(gitExe,['--version']).replace(/^git version /,'');
  const jsTsVersion=run(nodeExe,[tsCli,'--version']).replace(/^Version /,'');
  const nativeTsVersion=run(tsExe,['--version']).replace(/^Version /,'');
  if(pythonVersion!=='3.12.13' || jsTsVersion!==tsVersion || nativeTsVersion!==tsVersion)
    throw new Error('PINNED_TOOL_VERSION_MISMATCH');

  const packageBytes=readFileSync(resolve(root,'package.json'));
  const packageLockBytes=readFileSync(resolve(root,'package-lock.json'));
  const packageJson=JSON.parse(packageBytes), lock=JSON.parse(packageLockBytes);
  const tsPackage=JSON.parse(readFileSync(resolve(tsRoot,'package.json')));
  const nativePackage=JSON.parse(readFileSync(resolve(tsNativeRoot,'package.json')));
  const tsLock=lock.packages?.['node_modules/typescript'];
  const nativeLock=lock.packages?.['node_modules/@typescript/typescript-win32-x64'];
  if(packageJson.devDependencies?.typescript!==tsVersion || lock.packages?.['']?.devDependencies?.typescript!==tsVersion ||
    tsPackage.version!==tsVersion || tsPackage.license!=='Apache-2.0' || tsLock?.version!==tsVersion ||
    tsLock.integrity!==tsIntegrity || tsLock.license!=='Apache-2.0' || nativePackage.version!==tsVersion ||
    nativePackage.license!=='Apache-2.0' || nativeLock?.version!==tsVersion || nativeLock.license!=='Apache-2.0')
    throw new Error('TYPESCRIPT_LOCK_OR_LICENSE_MISMATCH');

  const tools=[
    tool('node','22.23.2',nodeExe),tool('npm',npmVersion,npmCli,nodeExe),
    tool('python',pythonVersion,pythonExe),tool('git',gitVersion,gitExe),
    tool('typescript-js',jsTsVersion,tsCli,nodeExe),tool('typescript-native',nativeTsVersion,tsExe)
  ];
  const packageLock={path:'package-lock.json',bytes:packageLockBytes.length,sha256:sha256(packageLockBytes)};
  const packageBinding={path:'package.json',bytes:packageBytes.length,sha256:sha256(packageBytes)};
  const lockedPackages=packageEntries(lock);
  const dependencies=json({schemaVersion:1,packageLock,packages:lockedPackages});
  const sourceBindingsBytes=readFileSync(resolve(root,'SourceBindings.json'));
  const nodeFiles=nodeModulesFiles(resolve(root,'node_modules'));
  const bindings=json({schemaVersion:1,environment:'LOCAL_WINDOWS_ISOLATED',sourceBindings:{path:'SourceBindings.json',bytes:sourceBindingsBytes.length,sha256:sha256(sourceBindingsBytes)},package:packageBinding,packageLock,dependenciesLock:{path:'dependencies.lock.json',bytes:dependencies.length,sha256:sha256(dependencies)},tools,nodeModules:{root:'node_modules',fileCount:nodeFiles.length,files:nodeFiles}});
  return {dependencies,bindings,tools,nodeModulesFiles:nodeFiles.length,lockPackages:lockedPackages.length};
}
function exists(path) {
  try { lstatSync(path); return true; }
  catch(error) { if(error.code==='ENOENT') return false; throw error; }
}
function writeFirstCreate(path,data) {
  const fd=openSync(path,'wx');
  try { writeFileSync(fd,data); } finally { closeSync(fd); }
}
function check(path,expected) {
  const target=resolve(root,path),stat=lstatSync(target);
  if(stat.isSymbolicLink() || !stat.isFile()) throw new Error(`DEPENDENCY_BINDING_PATH_INVALID:${path}`);
  const actual=readFileSync(target);
  if(!actual.equals(expected)) throw new Error(`DEPENDENCY_BINDING_DRIFT:${path}`);
}
function main() {
  const mode=process.argv[2];
  if(mode!=='--create' && mode!=='--check') throw new Error('USAGE: tool-bindings.mjs --create|--check');
  verifyLocal();
  const result=collect();
  if(mode==='--check') {
    check(outputs[0],result.dependencies);check(outputs[1],result.bindings);
  } else {
    if(outputs.some(path=>exists(resolve(root,path)))) throw new Error('DEPENDENCY_BINDINGS_ALREADY_EXIST');
    writeFirstCreate(resolve(root,outputs[0]),result.dependencies);
    writeFirstCreate(resolve(root,outputs[1]),result.bindings);
  }
  console.log(JSON.stringify({status:'PASS',mode,tools:result.tools.map(({name,version})=>({name,version})),nodeModulesFiles:result.nodeModulesFiles,lockPackages:result.lockPackages}));
}
if(process.argv[1]===fileURLToPath(import.meta.url)) main();
