import {root,repo,verifyConsumer,verifyBuild,verifyFiles,json,hash} from './bindings.mjs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {verifyRun} from './receipt.mjs';
export async function loadReadPort(){
  verifyConsumer();verifyBuild();const receipt=json(resolve(root,'receipt.json'));
  const runtime=receipt.tools.find(t=>t.name==='node');if(process.versions.node!==runtime.version||hash(readFileSync(process.execPath))!==runtime.sha256)throw Error('READ_PORT_NODE_DRIFT');
  verifyFiles(root,receipt.files);verifyFiles(root,[receipt.source.sourceBindings]);
  const summary=resolve(repo,receipt.tests.summaryRepoPath);verifyFiles(dirname(summary),[receipt.tests.summary]);
  verifyRun(json(summary),root,dirname(summary));
  for(const tool of receipt.tools){const b=readFileSync(tool.executablePath);if(b.length!==tool.bytes||hash(b)!==tool.sha256)throw Error('READ_PORT_TOOL_DRIFT:'+tool.name);}
  return import('../dist/src/weather.js');
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const port=await loadReadPort(),inputs=json(resolve(root,'fixtures/authoring-inputs.json'));
  const view=await port.createAnalyticReadView(inputs[2]);const result=await view.read(inputs[2].bundle.query);
  console.log(JSON.stringify({status:result.status,WeatherSnapshotId:result.WeatherSnapshotId,sample:result.status==='Known'?result.sample:null,executionLocation:'LOCAL_WINDOWS_ISOLATED',productIntegration:'NO'}));
}
