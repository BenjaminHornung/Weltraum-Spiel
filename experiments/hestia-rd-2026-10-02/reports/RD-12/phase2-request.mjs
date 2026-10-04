import assert from 'node:assert/strict';
import { commands, fresh, ownBindings, sha } from './phase2-support.mjs';
const [label, config, list] = process.argv.slice(2); assert.match(label ?? '', /^[a-z0-9-]+$/);
assert(['reports/RD-12/native-diagnosis-v1.config.ts', 'reports/RD-12/native-functional-v2.config.ts'].includes(config));
const bindings = ownBindings(); fresh(`${commands}/launcher/request-${label}.json`, { label, config, list: list === 'list',
  ownBindingsSha256: sha(Buffer.from(JSON.stringify(bindings))), requested: new Date().toISOString(), productIntegrated: false });
console.log(`RD12_REQUEST_SEALED ${label} ${bindings.length} files`);
