import { defineConfig } from 'vitest/config';
import config from './vitest.config';
// Reproduce the sealed, deliberately wrong initial behaviours with FINAL test bytes.
// Type-only correction of the ArrayBuffer annotation did not change assertions.
const red='C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-13/phase1-d17d9704-20261004-a/red';
export default defineConfig({...config,test:{...config.test,include:['tests/RD-13/unit.test.ts']},resolve:{alias:[
  {find:'../../src/experiments/voxel-rays/volume',replacement:`${red}/src__experiments__voxel-rays__volume.ts`},
  {find:'../../src/experiments/voxel-rays/ray',replacement:`${red}/src__experiments__voxel-rays__ray.ts`},
  {find:'../../src/experiments/voxel-rays',replacement:`${red}/src__experiments__voxel-rays__index.ts`},
]}});
