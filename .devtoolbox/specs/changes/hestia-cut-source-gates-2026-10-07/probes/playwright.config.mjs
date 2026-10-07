import {fileURLToPath} from 'node:url';
const app=fileURLToPath(new URL('../../../../../apps/weltraum-browser/',import.meta.url));
const out=process.env.WELTRAUM_HVP_MEASURE_DIR;
if(!out){throw new Error('Explicit probe output required');}
const built=process.env.WELTRAUM_PROBE_BUILD_DIR;
if(!built){throw new Error('Explicit built production probe required');}
export default {testDir:fileURLToPath(new URL('./',import.meta.url)),testMatch:'render-probe.spec.ts',workers:1,retries:0,timeout:180000,
  outputDir:out+'/pw-output',reporter:[['list'],['json',{outputFile:out+'/pw-report.json'}]],
  use:{viewport:{width:1280,height:720},deviceScaleFactor:1,headless:process.env.WELTRAUM_PROBE_HEADLESS==='1',trace:'off',screenshot:'off',video:'off',
    launchOptions:{executablePath:'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe',args:['--force-device-scale-factor=1']}},
  webServer:{command:'"'+process.execPath+'" node_modules/vite/bin/vite.js preview --config "'+fileURLToPath(new URL('./vite-probe.config.mjs',import.meta.url))+'" --outDir "'+built+'" --host 127.0.0.1 --port 5278 --strictPort',
    cwd:app,url:'http://127.0.0.1:5278',reuseExistingServer:false,timeout:30000}};
