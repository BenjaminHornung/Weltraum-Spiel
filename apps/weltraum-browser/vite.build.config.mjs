import { fileURLToPath } from "node:url";
import { cifiViteFileIdentity, requirePhysicalLiteralTarget } from "./scripts/cifiViteFileIdentity.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
// Vite resolves relative worker URLs before plugin hooks: these literals must be physical.
for (const relative of ["src/workers/streamingWorker.ts", "src/hestia-prototype/physics/physicsWorker.ts"]) {
  requirePhysicalLiteralTarget(root, fileURLToPath(new URL(relative, import.meta.url)));
}

export default {
  root,
  envDir: false,
  resolve: { preserveSymlinks: true },
  plugins: [cifiViteFileIdentity(root)],
  worker: { plugins: () => [cifiViteFileIdentity(root)] },
  css: { postcss: { plugins: [] }, preprocessorMaxWorkers: 0 },
  build: { target: "es2022", outDir: "dist", sourcemap: true }
};
