import {build} from 'esbuild';
import {root,verifyInputs} from './bindings.mjs';
verifyInputs();
await build({entryPoints:[root+'/src/optics.ts'],outfile:root+'/.runtime/optics.mjs',bundle:true,platform:'node',format:'esm'});
await build({entryPoints:[root+'/src/occlusion.ts'],outfile:root+'/.runtime/occlusion.mjs',bundle:true,platform:'node',format:'esm'});
await build({entryPoints:[root+'/src/timer.ts'],outfile:root+'/.runtime/timer.mjs',bundle:true,platform:'node',format:'esm'});
await build({entryPoints:[root+'/src/init.ts'],outfile:root+'/.runtime/init.mjs',bundle:true,platform:'node',format:'esm'});
