import vm from 'node:vm';
// Static projection only: no C# method, assembly, fixture, host or interop is invoked.
function method(source,name){const p=source.indexOf(name+'(');if(p<0)return '';const start=source.indexOf('{',p);let depth=1,quote=false,escape=false,i=start+1;for(;i<source.length&&depth;i++){const c=source[i];if(quote){if(!escape&&c==='"')quote=false;escape=!escape&&c==='\\';continue}if(c==='"'){quote=true;continue}if(c==='{')depth++;if(c==='}')depth--}return source.slice(start+1,i-1)}
export function requirePredicate(source,name,marker){
 const b=method(source,name);const lines=b.split('\n');let depth=0;
 for(const line of lines){const t=line.trim();if(depth===0&&t.startsWith('Require(')&&t.includes('"'+marker+'"')){const end=t.lastIndexOf(',"'+marker+'"');if(end<0)return null;return t.slice(8,end)}
 // Current fixed predicates contain no braces in strings; method body nesting makes if(false){...} ineligible.
 for(const c of line.replace(/"(?:\\.|[^"\\])*"/g,'""')){if(c==='{')depth++;if(c==='}')depth--}
 }return null;
}
export function checkNativeRecordPolicies(source){
 const scope=requirePredicate(source,'ReadRootRecords','DATA_HOLD_SCOPE'),owner=requirePredicate(source,'ReadRootRecords','DATA_HOLD_OWNER');
 if(!scope||!owner)return false;
 const run=(p,v)=>vm.runInNewContext('('+p+')',{...v,Field:(o,k)=>o[k]},{timeout:50});
 const id='01a13648-c55b-7250-bf07-34921d70b43b';
 const v={p:{ownerNative:id},c:{ownerNative:id},g:{scope:'HARMLESS_SIX_ONCE',authorizationClass:'DIRECT_HUMAN_RUNTIME_ONCE',retry:'0'}};
 try{if(run(scope,v)!==true||run(owner,v)!==true)return false;
 for(const [k,value]of [['scope','NATIVE24'],['scope','R05'],['authorizationClass','SOURCE_ONLY'],['retry','1']])if(run(scope,{...v,g:{...v.g,[k]:value}})!==false)return false;
 for(const key of ['p','c'])if(run(owner,{...v,[key]:{ownerNative:'foreign'}})!==false)return false;
 return true;}catch{return false}
}
export function fixtureRequestGates(source){
 const clean=source.replace(/\/\/[^\n]*/g,'');
 const read=clean.indexOf("const request=JSON.parse(fs.readFileSync(process.argv[2],'utf8'))");
 const verify=clean.indexOf('externalRootFixtureVerifier.verifyFixedRequest(fixtureAdmission,request);');
 const phase=clean.indexOf("externalRootFixtureVerifier.verifyCurrentPhase(fixtureAdmission,'fixture-after-request');");
 const effects=clean.indexOf('const output=path.resolve(request.outputRoot)');
 return read>=0&&verify>read&&phase>verify&&effects>phase&&!clean.slice(read,effects).includes('if(false)');
}
export function hostConsumeOrder(source){
 const read=source.indexOf('$r=Read-RootRecords'),clock=source.indexOf('$entryTick=[Environment]::TickCount64');
 const gate=source.indexOf("Check-RootPhase $r $clock 'host-before-consume'"),consume=source.indexOf('[IO.FileMode]::CreateNew'),start=source.indexOf('$controller.Start()');
 return clock>=0&&read>clock&&gate>read&&consume>gate&&start>consume&&!source.slice(gate,consume).includes('if($false)');
}
