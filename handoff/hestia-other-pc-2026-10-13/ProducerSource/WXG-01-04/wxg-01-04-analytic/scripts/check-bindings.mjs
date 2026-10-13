import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,hash,verifyConsumer,verifyIsolation,walk,bytes,json} from './bindings.mjs';
verifyIsolation();const m=verifyConsumer();
if(process.versions.node!=='22.23.2')throw Error('NODE_VERSION');
for(const t of m.dependencyBindings.tools.filter(t=>!t.name.startsWith('typescript'))){const b=readFileSync(t.executablePath);if(b.length!==t.bytes||hash(b)!==t.sha256)throw Error('TOOL_DRIFT:'+t.name);}
const pkg=json(resolve(root,'package.json')),lock=json(resolve(root,'package-lock.json'));
if(pkg.devDependencies.typescript!=='7.0.2'||lock.packages[''].devDependencies.typescript!=='7.0.2'||pkg.name!==lock.name||json(resolve(root,'node_modules/typescript/package.json')).version!=='7.0.2')throw Error('DEPENDENCY_PIN');
for(const [p,v] of Object.entries(lock.packages)){if(p&&!v.integrity?.startsWith('sha512-'))throw Error('REGISTRY_INTEGRITY:'+p);if(p&&v.license!=='Apache-2.0')throw Error('COMPILER_LICENSE:'+p);}
console.log(JSON.stringify({status:'PASS',localConsumerFiles:m.files.length,compilerFiles:m.dependencyBindings.nodeModules.fileCount,node:process.versions.node,typescript:'7.0.2',npm:'10.9.8_OBSERVED_ONLY',python:'3.12.13_PINNED_BYTES',git:'2.56.0.windows.1_PINNED_BYTES',runtimeDependencies:0,licenses:'Random123 BSD / TypeScript Apache-2.0',wasm:'NOT_APPLICABLE_OWN_KERNEL',shader:'NOT_APPLICABLE'}));
