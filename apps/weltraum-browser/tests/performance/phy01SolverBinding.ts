import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {HVP_SOLVER_PROFILE} from "../../src/hestia-prototype/physics/profile";
import {inventoryHvpCutRtFiles} from "./hvpCutRtReport";

/** Binding only: never initialize or execute the Native solver. */
export const readPhy01SolverBinding = async (app = process.cwd()) => {
  const vendorRoot = path.join(app, "vendor/rapier-phy01-migration2");
  const vendorFiles = await inventoryHvpCutRtFiles(vendorRoot, app);
  const sha = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
  const vendorSha256 = sha(JSON.stringify(vendorFiles));
  if (vendorFiles.length !== 99 || vendorSha256 !== "fcd9849ebdc213ae1f4f8081bced5d115aeecae0815b3a154ffce9c64e19b2bb") { throw new Error("Unbound .21 Sourcefork vendor closure"); }
  const profile = JSON.parse(await readFile(path.join(vendorRoot, "profile.json"), "utf8"));
  const wasmSha256 = sha(await readFile(path.join(vendorRoot, "rapier_wasm3d_bg.wasm")));
  const packageJson = JSON.parse(await readFile(path.join(app, "package.json"), "utf8"));
  if (profile.id !== HVP_SOLVER_PROFILE.sourceProfile || profile.vanillaNpmBytes !== false
    || wasmSha256 !== "ed3c8933d523eafb7d4d7a9a8efa04dd0da9d2279d4ae8cefb794c276ee98ea9"
    || profile.wasmSha256 !== wasmSha256
    || packageJson.dependencies?.["@hestia/rapier3d-phy01-candidate"] !== "file:vendor/rapier-phy01-migration2"
    || packageJson.dependencies?.["@dimforge/rapier3d-compat"] !== undefined) { throw new Error("Unbound .21 runtime package/profile/WASM"); }
  return {solver: HVP_SOLVER_PROFILE, sourceProfile: profile, wasmSha256, vendorSha256, vendorFiles};
};
