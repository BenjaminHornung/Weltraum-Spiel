import {defineConfig} from "@playwright/test";
import path from "node:path";
import {fileURLToPath} from "node:url";
import base from "./playwright.performance.config";

const app=fileURLToPath(new URL(".",import.meta.url));
const output=process.env.WELTRAUM_HVP_MEASURE_DIR;
const relative=output?path.relative(app,output):"";
if(!output||!path.isAbsolute(output)||process.env.WELTRAUM_RECORD_EVIDENCE==="1"
  ||!(relative===".."||relative.startsWith(`..${path.sep}`))){
  throw new Error("V3 Cut runs require an explicit external output directory and no Golden recording");
}

// Fixed Cut population; the functional and visual suites remain separate.
export default defineConfig({...base,testDir:"./tests/performance",testMatch:"hvp-cut-rt.spec.ts",
  forbidOnly:true,updateSnapshots:"none",outputDir:path.join(output,"playwright-output"),
  reporter:[["list"],["json",{outputFile:path.join(output,"playwright-report.json")}]],
  webServer:{...base.webServer,cwd:app,
    command:`"${process.execPath}" node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5173 --strictPort`}
});
