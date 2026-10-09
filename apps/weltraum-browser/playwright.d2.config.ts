import {defineConfig} from "@playwright/test";
import path from "node:path";
const output=process.env.WELTRAUM_HVP_MEASURE_DIR,build=process.env.WELTRAUM_HVP_BUILD_DIR,baseline=process.env.WELTRAUM_HVP_PAIRED_BASELINE_BUILD;
if(process.env.WELTRAUM_HVP_BASE_URL!=="http://127.0.0.1:5289"||process.env.WELTRAUM_HVP_PAIRED_BASELINE_URL!=="http://127.0.0.1:5290"){
  throw new Error("D2 candidate/baseline URLs must bind the two explicit strict preview ports");
}
if(!output||!build||!baseline||[output,build,baseline].some(p=>!path.isAbsolute(p)||path.relative("C:/IFI_SourceCode",p).startsWith(".."))){
  throw new Error("D2 requires separate bound baseline/candidate builds and output under C:/IFI_SourceCode");
}
export default defineConfig({testDir:"./tests/performance",testMatch:"hvp-cut-rt.spec.ts",workers:1,retries:0,timeout:10*60_000,
  outputDir:path.join(output,"pw-output"),reporter:[["list"],["json",{outputFile:path.join(output,"pw-report.json")}]],
  webServer:[
    {command:`"${process.execPath}" node_modules/vite/bin/vite.js preview --outDir "${build}" --host 127.0.0.1 --port 5289 --strictPort`,url:"http://127.0.0.1:5289",reuseExistingServer:false,timeout:30_000},
    {command:`"${process.execPath}" node_modules/vite/bin/vite.js preview --outDir "${baseline}" --host 127.0.0.1 --port 5290 --strictPort`,url:"http://127.0.0.1:5290",reuseExistingServer:false,timeout:30_000}
  ]});
