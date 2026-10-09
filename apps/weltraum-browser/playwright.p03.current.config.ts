import {defineConfig} from "@playwright/test";
import path from "node:path";
import base from "./playwright.config";
const build=process.env.WELTRAUM_HVP_BUILD_DIR,output=process.env.WELTRAUM_HVP_MEASURE_DIR,browser=process.env.WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH;
if(!build||!output||!browser||[build,output,browser,process.execPath].some(file=>!path.isAbsolute(file)||path.relative("C:/IFI_SourceCode",file).startsWith("..")||path.isAbsolute(path.relative("C:/IFI_SourceCode",file)))){
  throw new Error("P03 requires explicit approved local build, evidence and browser paths");
}
export default defineConfig({...base,workers:1,retries:0,outputDir:path.join(output,"pw-output"),
  testMatch:["hvp-visible-coast.spec.ts","hvp-look.spec.ts"],
  reporter:[["list"],["json",{outputFile:path.join(output,"pw-report.json")}]],
  use:{...base.use,baseURL:"http://127.0.0.1:5289",headless:false,
    launchOptions:{executablePath:browser,args:["--force-device-scale-factor=1","--force-high-performance-gpu"]}},
  webServer:{command:`"${process.execPath}" node_modules/vite/bin/vite.js preview --outDir "${build}" --host 127.0.0.1 --port 5289 --strictPort`,
    url:"http://127.0.0.1:5289",reuseExistingServer:false,timeout:30_000}
});
