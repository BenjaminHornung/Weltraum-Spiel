import{defineConfig}from'vitest/config';
export default defineConfig({test:{include:['tests/RD-52/package.test.ts'],fileParallelism:false,maxWorkers:1,testTimeout:60_000,cache:false}});
