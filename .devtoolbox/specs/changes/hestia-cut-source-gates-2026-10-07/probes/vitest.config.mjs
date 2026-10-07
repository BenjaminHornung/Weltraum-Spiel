import base from '../../../../../apps/weltraum-browser/vite.config.ts';
import {fileURLToPath} from 'node:url';

export default {...base,root:fileURLToPath(new URL('./',import.meta.url)),
  test:{...base.test,include:['kernel-contract.test.ts','owned-subset.test.ts','terrain-owner.test.ts']}};
