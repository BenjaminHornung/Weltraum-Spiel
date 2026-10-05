import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
const run=process.env.HESTIA_RESUME_RUN;
if(!run||!/^[a-z0-9-]+$/.test(run))throw Error('A fresh bounded resume run ID is required');
const output=path.resolve('.resume-runs',run);
if(process.env.PLAYWRIGHT_BROWSERS_PATH!==path.resolve('.resume-runs/runtime'))throw Error('Use the verified local CIFI browser runtime; no global executable fallback');
if(process.env.HESTIA_RESUME_ADMITTED!==run){
  if(existsSync(output))throw Error('Resume browser evidence may not overwrite an earlier run');
  process.env.HESTIA_RESUME_ADMITTED=run;
}
export default defineConfig({testDir:'./tests',testMatch:'**/browser.spec.ts',fullyParallel:false,workers:1,retries:0,timeout:30_000,
  outputDir:path.join(output,'results'),reporter:[['list'],['json',{outputFile:path.join(output,'report.json')}]],
  use:{baseURL:'http://127.0.0.1:5280',viewport:{width:1400,height:1000},deviceScaleFactor:1,headless:true,
    launchOptions:{executablePath:'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe'},
    video:{mode:'on',size:{width:1400,height:1000}},trace:'retain-on-failure',screenshot:'only-on-failure'}});
