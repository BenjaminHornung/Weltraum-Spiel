// Emit exact embedded tool source as data; never import or evaluate emitted strings.
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const output=new URL('builtin-source/',root);
mkdirSync(output,{recursive:true});
const natives=process.binding('natives');
const required=['internal/worker/js_transferable','internal/encoding','internal/crypto/webcrypto','internal/crypto/hash','internal/bootstrap/web/exposed-wildcard','internal/bootstrap/web/exposed-window-or-worker','internal/webidl'];
for(const key of required)if(typeof natives[key]!=='string')throw new Error('Missing exact embedded source: '+key);
const extra=['internal/bootstrap/realm','internal/worker/io','internal/per_context/domexception','internal/util','internal/util/types','internal/validators','internal/buffer','internal/assert','internal/event_target','internal/abort_controller'];
const names=[...new Set([...required,...extra.filter(k=>typeof natives[k]==='string'),...Object.keys(natives).filter(k=>k.startsWith('internal/crypto/'))])].sort();
const rows=[];
for(const key of names){
 const bytes=Buffer.from(natives[key],'utf8'),name=key.split('/').join('__')+'.js.source';
 writeFileSync(new URL(name,output),bytes,{flag:'wx'});
 rows.push({key,file:'builtin-source/'+name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const result={kind:'SOURCE_PACKAGE_EMISSION_EMBEDDED_TOOL_TEXT_ONLY',sourceStringsEvaluated:0,producerImports:0,networkWasmRendererNativePhysics:0,rows};
writeFileSync(new URL('BUILTIN_SOURCE_EMISSION.json',root),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({kind:result.kind,files:rows.length,bytes:rows.reduce((n,r)=>n+r.bytes,0),sourceStringsEvaluated:0,producerImports:0})+'\n');
