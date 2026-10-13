// Emit exact embedded tool source as data; never import or evaluate emitted strings.
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const output=new URL('builtin-call-source/',root);
mkdirSync(output,{recursive:true});
const natives=process.binding('natives');
const required=['internal/bootstrap/node','crypto','internal/streams/lazy_transform','internal/options','internal/errors','internal/process/pre_execution'];
for(const key of required)if(typeof natives[key]!=='string')throw new Error('Missing exact embedded source: '+key);
const extra=[];
const names=[...new Set(required)].sort();
const rows=[];
for(const key of names){
 const bytes=Buffer.from(natives[key],'utf8'),name=key.split('/').join('__')+'.js.source';
 writeFileSync(new URL(name,output),bytes,{flag:'wx'});
 rows.push({key,file:'builtin-source/'+name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const result={kind:'SOURCE_PACKAGE_EMISSION_EMBEDDED_TOOL_TEXT_ONLY',sourceStringsEvaluated:0,producerImports:0,networkWasmRendererNativePhysics:0,rows};
writeFileSync(new URL('BUILTIN_CALL_SOURCE_EMISSION.json',root),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({kind:result.kind,files:rows.length,bytes:rows.reduce((n,r)=>n+r.bytes,0),sourceStringsEvaluated:0,producerImports:0})+'\n');

