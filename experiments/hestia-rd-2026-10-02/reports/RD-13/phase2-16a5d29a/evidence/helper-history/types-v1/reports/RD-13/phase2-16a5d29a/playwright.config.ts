import { defineConfig } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root='C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-13/phase2-16a5d29a-20261004-a';
const data=readFileSync(root+'/admission.json');const digest=createHash('sha256').update(data).digest('hex');const admission=JSON.parse(data.toString());
// Every worker/config reload reads ONE already-sealed identity outside disposable test output.
assert.equal(process.env.RD13_ADMISSION_SHA256,digest);assert.equal(admission.start,'16a5d29a5cddea372abae139da618aa000a058be');
assert.equal(admission.leaseId,'rd13-native-16a5d29a-20261004-a');assert.equal(admission.outputRoot,root);assert.equal(admission.productIntegrated,false);
assert(process.env.RD13_BROWSER_WS?.startsWith('ws://127.0.0.1:'),'Only exact owned prelaunched browser transport');
export default defineConfig({testDir:'../../../tests/RD-13',testMatch:['phase2-original-16a5d29a.spec.ts','phase2-supplement-16a5d29a.spec.ts'],
 workers:1,fullyParallel:false,retries:0,timeout:120000,outputDir:root+'/pw-output',
 reporter:[['list'],['json',{outputFile:root+'/native-results.json'}]],
 metadata:{source:admission.start,leaseId:admission.leaseId,admissionSha256:digest,functionalDiagnosticOnly:true,qualifiedGpuPerformance:'NOT_GRANTED',productIntegrated:false},
 use:{baseURL:admission.baseURL,viewport:{width:1600,height:1100},deviceScaleFactor:1,serviceWorkers:'block',
 connectOptions:{wsEndpoint:process.env.RD13_BROWSER_WS},trace:'retain-on-failure',screenshot:'only-on-failure'}});
