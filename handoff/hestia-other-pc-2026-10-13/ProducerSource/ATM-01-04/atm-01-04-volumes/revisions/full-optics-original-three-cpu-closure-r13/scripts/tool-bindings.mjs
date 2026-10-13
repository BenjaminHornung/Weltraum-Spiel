import {readFileSync} from 'node:fs';
import {root,hash,save,walk,json} from './bindings.mjs';
const npmRoot='C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm';
const gitRoot='C:/IFI_SourceCode/Utils/opencode-migration/runtime/git';
const ref=path=>{const b=readFileSync(path);return {path,bytes:b.length,sha256:hash(b)};};
if(process.argv.includes('--verify')){
 const m=json('ToolBindings.json');
 for(const f of m.files){const current=ref(f.path);if(current.bytes!==f.bytes||current.sha256!==f.sha256)throw Error('TOOL_BYTE_DRIFT:'+f.path);}
 const members=walk(npmRoot).map(p=>npmRoot+'/'+p);
 if(JSON.stringify(m.npmMembers)!==JSON.stringify(members))throw Error('NPM_TOOL_MEMBERSHIP');
 console.log(JSON.stringify({status:'PASS',toolFiles:m.files.length}));process.exit(0);
}
const npmMembers=walk(npmRoot).map(p=>npmRoot+'/'+p);
const gitMembers=['cmd','mingw64/bin','usr/bin'].flatMap(dir=>walk(gitRoot,dir).filter(p=>/\.(exe|dll)$/i.test(p)).map(p=>gitRoot+'/'+p));
save('ToolBindings.json',{schema:'atm.external-tool-code-closure.v1',npmVersion:JSON.parse(readFileSync(npmRoot+'/package.json')).version,npmMembers,
 files:[...new Set([process.execPath,...npmMembers,...gitMembers])].sort().map(ref),scope:'CODE_BYTE_METADATA_ONLY_NO_CONFIG_VALUES_OR_BINARIES_COPIED',windowsSystemDlls:'OS_RUNTIME_NOT_PACKAGED_NOT_QUALIFIED',browser:'PE_VERSION_ONLY_NOT_EXECUTED'});
console.log(JSON.stringify({status:'BOUND',npmFiles:npmMembers.length,gitBinaryFiles:gitMembers.length}));
