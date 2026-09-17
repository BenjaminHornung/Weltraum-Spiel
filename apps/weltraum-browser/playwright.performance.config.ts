import {defineConfig} from "@playwright/test";
import path from "node:path";

const group=path.basename(process.env.WELTRAUM_HVP_MEASURE_DIR??"performance-unconfigured");
if(!/^[a-z0-9-]+$/.test(group)){throw new Error("Invalid performance artifact group");}

// Explicit performance execution is separate from ordinary functional CI groups.
export default defineConfig({
  testDir:"./tests/performance",workers:1,retries:0,timeout:30*60_000,
  outputDir:`./evidence/playwright-output/${group}`,reporter:"list",
  use:{trace:"off",screenshot:"off",video:"off"},
  webServer:{command:"node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5173 --strictPort",
    url:"http://127.0.0.1:5173",reuseExistingServer:false,timeout:20_000}
});
