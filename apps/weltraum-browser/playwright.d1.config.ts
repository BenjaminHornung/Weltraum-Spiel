import {defineConfig} from "@playwright/test";
import path from "node:path";

const output=process.env.WELTRAUM_HVP_MEASURE_DIR,build=process.env.WELTRAUM_HVP_BUILD_DIR;
if(!output||!build||[output,build].some(value=>!path.isAbsolute(value)||path.relative("C:/IFI_SourceCode",value).startsWith(".."))){
  throw new Error("D1 needs explicit frozen build and output under C:/IFI_SourceCode");
}
export default defineConfig({
  testDir:"./tests/performance",testMatch:"hvp-cut-rt.spec.ts",workers:1,retries:0,timeout:10*60_000,
  outputDir:path.join(output,"pw-output"),reporter:[["list"],["json",{outputFile:path.join(output,"pw-report.json")}]],
  webServer:{command:`"${process.execPath}" node_modules/vite/bin/vite.js preview --outDir "${build}" --host 127.0.0.1 --port 5289 --strictPort`,
    url:"http://127.0.0.1:5289",reuseExistingServer:false,timeout:30_000},
});
