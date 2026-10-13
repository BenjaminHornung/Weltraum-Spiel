import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { root } from './commands.mjs';
import { verifyInputs } from './verify-inputs.mjs';
verifyInputs();
const receipt=JSON.parse(readFileSync(resolve(root,'snapshot/plt/receipt.json')));
for (const file of receipt.browserEvidence.servedBindings) {
  const dest=resolve(root,'snapshot/plt/dist',file.path);
  mkdirSync(dirname(dest),{recursive:true});
  writeFileSync(dest,readFileSync(resolve(root,'snapshot/plt',file.path)));
}
await import('../snapshot/plt/tests/numerics.test.mjs');
await import('../snapshot/plt/tests/integration.test.mjs');
