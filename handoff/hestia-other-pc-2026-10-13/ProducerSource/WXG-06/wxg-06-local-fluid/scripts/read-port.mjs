import {resolve,dirname} from 'node:path';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {root,verifyInputs,hash,json} from './bindings.mjs';
// Original loadReadPort checks retained; compiler paths point to the closed own copy.
export async function loadReadPort(){
 verifyInputs();const base=resolve(root,'inputs/wxg'),original=await import('../inputs/wxg/scripts/bindings.mjs');
 original.verifyConsumer();original.verifyBuild();const r=json(resolve(base,'receipt.json'));
 const runtime=r.tools.find(t=>t.name==='node');if(process.versions.node!==runtime.version||hash(readFileSync(process.execPath))!==runtime.sha256)throw Error('READ_PORT_NODE_DRIFT');
 original.verifyFiles(base,r.files);original.verifyFiles(base,[r.source.sourceBindings]);
 const summary=resolve(root,r.tests.summaryRepoPath);original.verifyFiles(dirname(summary),[r.tests.summary]);
 const {verifyRun}=await import('../inputs/wxg/scripts/receipt.mjs');verifyRun(json(summary),base,dirname(summary));
 for(const t of r.tools){const p=t.executablePath.replaceAll('\\','/');const marker='/spikes/wxg-01-04-analytic/';const target=p.includes(marker)?resolve(base,p.split(marker)[1]):t.executablePath;const b=readFileSync(target);if(b.length!==t.bytes||hash(b)!==t.sha256)throw Error('READ_PORT_TOOL_DRIFT:'+t.name);}
 return import(pathToFileURL(resolve(base,'dist/src/weather.js')));
}
export async function background(index=6){const port=await loadReadPort(),all=json(resolve(root,'inputs/wxg/fixtures/authoring-inputs.json')),input=all[index],view=await port.createAnalyticReadView(input),result=await view.read(input.bundle.query);return {view,result,input};}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/scripts/read-port.mjs')){const {result}=await background();console.log(JSON.stringify({status:result.status,WeatherSnapshotId:result.WeatherSnapshotId,sample:result.sample,executionLocation:'LOCAL_WINDOWS_ISOLATED',productIntegration:'NO'}));}
