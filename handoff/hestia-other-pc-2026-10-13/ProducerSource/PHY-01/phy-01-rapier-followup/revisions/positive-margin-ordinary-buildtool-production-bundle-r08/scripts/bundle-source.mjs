import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Prepared Source only: A56 does not grant the native CPU-topology import effect.
const require = createRequire(import.meta.url);
require(fileURLToPath(new URL("../tool-inputs/node_modules/@rolldown/binding-win32-x64-msvc/rolldown-binding.win32-x64-msvc.node", import.meta.url)));
// Preloading the selected addon throws before the package loader can fall back.
const { build } = await import("../tool-inputs/node_modules/vite/dist/node/index.js");
await build({
    root: fileURLToPath(new URL("../candidate/", import.meta.url)),
    configFile: false,
    envDir: false,
    plugins: [],
    cacheDir: fileURLToPath(new URL("../temp/source-bundle-01/vite-cache/", import.meta.url)),
    css: { postcss: {}, preprocessorMaxWorkers: 0 },
    build: {
        target: "es2022",
        outDir: fileURLToPath(new URL("../outputs/source-bundle-01/", import.meta.url)),
        emptyOutDir: false,
        copyPublicDir: false,
        sourcemap: true,
        minify: false,
        lib: {
            entry: fileURLToPath(new URL("../candidate/dist/index.js", import.meta.url)),
            formats: ["es"],
            fileName: () => "rapier-margin.es.js"
        }
    }
});
