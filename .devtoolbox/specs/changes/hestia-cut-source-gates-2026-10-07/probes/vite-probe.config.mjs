import base from '../../../../../apps/weltraum-browser/vite.config.ts';
import {fileURLToPath} from 'node:url';
export default {...base,root:fileURLToPath(new URL('./',import.meta.url)),
  publicDir:fileURLToPath(new URL('../../../../../apps/weltraum-browser/public/',import.meta.url)),
  server:{...base.server,port:5278,fs:{allow:[fileURLToPath(new URL('../../../../../',import.meta.url))]},
    watch:{ignored:['**/tests/**','**/artifacts/**','**/dist/**']}},
  resolve:{alias:{three:fileURLToPath(new URL('../../../../../apps/weltraum-browser/node_modules/three/build/three.module.js',import.meta.url))}}};
