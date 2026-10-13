import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
const pkg=JSON.parse(await readFile('package.json'));
const npm='C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node_modules/npm/bin/npm-cli.js';
const results=[];
for(const [name,version] of Object.entries({...pkg.dependencies,...pkg.devDependencies})){
 const raw=execFileSync(process.execPath,[npm,'view',`${name}@${version}`,'version','license','peerDependencies','exports','dist.integrity','gitHead','--json','--cache','.cache','--offline=false'],{encoding:'utf8'});
 results.push({name,requested:version,metadata:JSON.parse(raw),primarySource:`https://registry.npmjs.org/${name}/${version}`,exitCode:0});
}
await writeFile('dependency-primary.json',JSON.stringify(results,null,2)+'\n');console.log(`PASS primary npm metadata ${results.length} exact pins`);
