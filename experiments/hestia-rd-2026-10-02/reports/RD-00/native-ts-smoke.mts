// Proves the pinned Node invocation, not RD-02's future product exporter.
interface Smoke { readonly execution: 'native-node-strip-types'; readonly productCodeExecuted: false }
const proof: Smoke = { execution: 'native-node-strip-types', productCodeExecuted: false };
if (process.version !== 'v22.23.2') { throw new Error('Native TS invocation requires pinned Node 22.23.2'); }
console.log(JSON.stringify({ ...proof, node: process.version, executable: process.execPath }));
