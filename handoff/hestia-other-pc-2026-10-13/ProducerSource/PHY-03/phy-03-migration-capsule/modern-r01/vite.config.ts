import {defineConfig} from "vite";
import {resolve} from "node:path";
export default defineConfig({cacheDir:".runtime/vite-build-cache",resolve:{alias:{"@hestia/rapier3d-phy01-candidate":resolve("inputs/a0/snapshot/spike/upstream/candidate-package/migration2/dist/rapier.js")}},build:{lib:{entry:{capsule:"src/index.ts",native:"src/nativeFreshWorld.ts"},formats:["es"],fileName:(_format,name)=>name+".js"},minify:false,emptyOutDir:false}});
