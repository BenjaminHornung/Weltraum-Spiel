'use strict';
// Retrieve embedded source strings only; never require/import/evaluate the selected modules.
const deadline = setTimeout(() => process.exit(124), 28000);
deadline.unref();
const natives = process.binding('natives');
const keys = [
  'internal/deps/undici/undici',
  'internal/bootstrap/web/exposed-wildcard',
  'internal/bootstrap/web/exposed-window-or-worker',
  'internal/util',
  'internal/bootstrap/realm'
];
const sources = {};
for (const key of keys) {
  if (typeof natives[key] !== 'string') throw new Error('Selected embedded source unavailable: ' + key);
  sources[key] = natives[key];
}
process.stdout.write(JSON.stringify({schema: 'hestia.rt02b.selected-node-embedded-source.v4', sources}) + '\n');
clearTimeout(deadline);
