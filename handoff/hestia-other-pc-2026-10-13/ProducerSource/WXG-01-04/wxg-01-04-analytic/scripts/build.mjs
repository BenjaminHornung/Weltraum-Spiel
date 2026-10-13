import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,hash,verifyConsumer,verifyIsolation,walk,bytes,save} from './bindings.mjs';
verifyIsolation();const m=verifyConsumer();if(process.versions.node!=='22.23.2')throw Error('NODE_PIN');
const inputs=walk(root,'src').filter(p=>p!=='src/model-pin.ts').map(p=>bytes(root,p));
const modelDigest='sha256:'+hash(JSON.stringify({inputs,consumerDigest:bytes(root,'ConsumerBindings.json').sha256,config:bytes(root,'fixtures/authoring-config.json')}));
writeFileSync(resolve(root,'src/model-pin.ts'),`// Generated from closed source/config/consumer bindings.\nexport const IMPLEMENTATION_DIGEST = '${modelDigest}' as const;\n`);
const r=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.json','--singleThreaded'],{cwd:root,windowsHide:true,encoding:'utf8'});
process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.status!==0)process.exit(r.status??1);
// Preserve the producer's actual emitted closure; no rebuild or live import.
cpSync(resolve(root,'vendor'),resolve(root,'dist/vendor'),{recursive:true});
for(const p of walk(root,'dist/src').filter(p=>p.endsWith('.js'))){const text=readFileSync(resolve(root,p),'utf8').replace(/(from\s*|import\s*)['"](\.[^'"]+)['"]/g,(all,prefix,path)=>`${prefix}'${/\.(m?js)$/.test(path)?path:path+'.js'}'`);writeFileSync(resolve(root,p),text);}
save(resolve(root,'.runtime/model-binding.json'),{modelDigest,inputs,consumerDigest:bytes(root,'ConsumerBindings.json').sha256,config:bytes(root,'fixtures/authoring-config.json')});
save(resolve(root,'.runtime/build-bindings.json'),{status:'PASS',typescript:'7.0.2',node:process.versions.node,files:walk(root,'dist').map(p=>bytes(root,p))});
console.log(JSON.stringify({status:'PASS',modelDigest,compiledFiles:walk(root,'dist').length,ownRuntimeModules:walk(root,'dist/src').filter(p=>p.endsWith('.js')).length,upstreamModules:m.compiledBindings.files.length}));
