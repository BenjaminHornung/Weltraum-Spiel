// Same model-digest and emitted-import mechanism; native tsc is observed separately.
import {readFileSync,writeFileSync,cpSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {root,workspace,privatePrefix,normalEntry,normalClosure,actualSourcePaths,hash,verifyConsumer,walk,bytes,save,json} from './bindings.mjs';
if(process.versions.node!=='22.23.2')throw Error('NODE_PIN');
if(process.argv[2]==='--prepare'){
 const normalPin=normalEntry+'planetaryMacroModelPin.ts';
 const normalInputs=normalClosure().filter(p=>p!==normalPin).map(p=>bytes(workspace,p));
 const normalDigest='sha256:'+hash(JSON.stringify({inputs:normalInputs}));
 writeFileSync(resolve(workspace,normalPin),"// Generated from actual normal algorithm/noise/type/validation inputs; this pin is excluded to avoid a digest cycle.\nexport const PLANETARY_MACRO_IMPLEMENTATION_DIGEST = '"+normalDigest+"' as const;\n");
 save(resolve(root,'.runtime/normal-model-binding.json'),{modelDigest:normalDigest,inputs:normalInputs,excludedPin:normalPin,pin:bytes(workspace,normalPin)});
 const consumer=json(resolve(root,'ConsumerBindings.json'));
 consumer.privateSourceInputs=walk(root,'src').filter(p=>p!=='src/model-pin.ts').map(p=>bytes(root,p));
 consumer.privateBuildInputs=['scripts/build.mjs','scripts/bindings.mjs','tsconfig.json'].map(p=>bytes(root,p));
 consumer.normalSourceInputs=actualSourcePaths().filter(p=>p.startsWith('apps/')).map(p=>bytes(workspace,p));
 save(resolve(root,'ConsumerBindings.json'),consumer);verifyConsumer();
 const inputs=actualSourcePaths().map(p=>bytes(workspace,p));
 const consumerDigest=bytes(root,'ConsumerBindings.json').sha256,config=bytes(workspace,privatePrefix+'/fixtures/authoring-config.json');
 const modelDigest='sha256:'+hash(JSON.stringify({inputs,consumerDigest,config}));
 writeFileSync(resolve(root,'src/model-pin.ts'),"// Generated from closed source/config/consumer bindings.\nexport const IMPLEMENTATION_DIGEST = '"+modelDigest+"' as const;\n");
 save(resolve(root,'.runtime/model-binding.json'),{modelDigest,inputs,consumerDigest,config});
 console.log(JSON.stringify({phase:'PREPARE',modelDigest,normalDigest,normalInputs:normalInputs.length,actualInputs:inputs.length}));
}else if(process.argv[2]==='--seal'){
 verifyConsumer();cpSync(resolve(root,'vendor'),resolve(root,'dist',privatePrefix,'vendor'),{recursive:true});
 for(const p of walk(root,'dist').filter(p=>p.endsWith('.js'))){
  const text=readFileSync(resolve(root,p),'utf8').replace(/(from\s*|import\s*)['"](\.[^'"]+)['"]/g,(all,prefix,path)=>{
   const base=dirname(resolve(root,p));
   const target=/\.(m?js)$/.test(path)?path:existsSync(resolve(base,path+'.js'))?path+'.js':path+'/index.js';
   if(!existsSync(resolve(base,target)))throw Error('EMIT_IMPORT_MISSING:'+p+':'+target);
   return prefix+"'"+target+"'";
  });
  writeFileSync(resolve(root,p),text);
 }
 for(const p of actualSourcePaths())if(!existsSync(resolve(root,'dist',p.replace(/\.ts$/,'.js'))))throw Error('SOURCE_NOT_EMITTED:'+p);
 save(resolve(root,'.runtime/build-bindings.json'),{status:'PASS',typescript:'7.0.2',node:process.versions.node,files:walk(root,'dist').map(p=>bytes(root,p))});
 console.log(JSON.stringify({phase:'SEALED',files:walk(root,'dist').length}));
}else throw Error('EXPLICIT_PREPARE_OR_SEAL_REQUIRED');

