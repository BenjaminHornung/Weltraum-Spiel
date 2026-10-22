// Same model-digest and emitted-import mechanism; native tsc is observed separately.
import {readFileSync,writeFileSync,cpSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,hash,verifyConsumer,walk,bytes,save} from './bindings.mjs';
verifyConsumer();if(process.versions.node!=='22.23.2')throw Error('NODE_PIN');
if(process.argv[2]==='--prepare'){
 const inputs=walk(root,'src').filter(p=>p!=='src/model-pin.ts').map(p=>bytes(root,p));
 const consumerDigest=bytes(root,'ConsumerBindings.json').sha256,config=bytes(root,'fixtures/authoring-config.json');
 const modelDigest='sha256:'+hash(JSON.stringify({inputs,consumerDigest,config}));
 writeFileSync(resolve(root,'src/model-pin.ts'),"// Generated from closed source/config/consumer bindings.\nexport const IMPLEMENTATION_DIGEST = '"+modelDigest+"' as const;\n");
 save(resolve(root,'.runtime/model-binding.json'),{modelDigest,inputs,consumerDigest,config});
 console.log(JSON.stringify({phase:'PREPARE',modelDigest}));
}else if(process.argv[2]==='--seal'){
 cpSync(resolve(root,'vendor'),resolve(root,'dist/vendor'),{recursive:true});
 for(const p of walk(root,'dist/src').filter(p=>p.endsWith('.js'))){
  const text=readFileSync(resolve(root,p),'utf8').replace(/(from\s*|import\s*)['"](\.[^'"]+)['"]/g,(all,prefix,path)=>prefix+"'"+(/\.(m?js)$/.test(path)?path:path+'.js')+"'");
  writeFileSync(resolve(root,p),text);
 }
 save(resolve(root,'.runtime/build-bindings.json'),{status:'PASS',typescript:'7.0.2',node:process.versions.node,files:walk(root,'dist').map(p=>bytes(root,p))});
 console.log(JSON.stringify({phase:'SEALED',files:walk(root,'dist').length}));
}else throw Error('EXPLICIT_PREPARE_OR_SEAL_REQUIRED');

