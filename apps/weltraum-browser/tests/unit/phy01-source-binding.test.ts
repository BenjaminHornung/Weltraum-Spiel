import { describe, expect, it } from "vitest";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertHvpPublicSaveCutover } from "../../src/hestia-prototype/physics/profile";
import { readPhy01SolverBinding, readPhy01SourceBinding } from "../performance/phy01SolverBinding";

const vendor = "vendor/rapier-phy01-positive-margin-r05";
const wasm = "f26e8ca898782fc1d903971bfa5c71a4b92bd7ed4c32df05e677faee9e18d0bb";

describe("R05 source and performance-runner binding", () => {
  it("binds the 71 published input files and the gyro-off solver policy", async () => {
    const result = await readPhy01SourceBinding();
    expect(result.vendorFiles).toHaveLength(71);
    expect(result.solver.id).toBe("rapier-0.21.0-phy01.migration2:legacy-impulse-v1");
    expect(result.solver.dynamicGyroscopicForces).toBe(false);
    expect(result.wasmSha256).toBe(wasm);
    expect(result.sourceProfile.labArtifactId).toBe("rapier-0.21.0-phy01.migration2:positive-margin-r05:" + wasm);
  });
  it("rejects a foreign source root", async () => {
    await expect(readPhy01SourceBinding(fileURLToPath(new URL("../", import.meta.url)))).rejects.toThrow();
  });
  it("rejects a modification to the vendor source even if both WASM copies are still identical", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "r05-source-"));
    try {
      await cp(vendor, path.join(temp, vendor), { recursive: true, filter: file => path.basename(file) !== "dist" });
      const file = path.join(temp, vendor, "src/init.ts");
      await writeFile(file, (await readFile(file, "utf8")) + "\n");
      await expect(readPhy01SourceBinding(temp)).rejects.toThrow("Unbound R05 source closure");
    } finally { await rm(temp, { recursive: true, force: true }); }
  });
  it("keeps public Save/restore gated independently of repository selection", () => {
    expect(assertHvpPublicSaveCutover).toThrow("Speichern und Laden ist für diesen Prüfstand noch nicht freigegeben.");
  });
  // Run on the exact postbuild output; regular source-only tests can run before Vite.
  it.runIf(process.env.HESTIA_CHECK_BUILT_SOLVER === "1")("follows the built HVP loader and rejects orphaned or different bytes", async () => {
    const actual = await readPhy01SolverBinding();
    expect(actual.bundle.wasmSha256).toBe(wasm);
    expect(actual.bundle.workerSha256).toMatch(/^[a-f0-9]{64}$/);
    const temp = await mkdtemp(path.join(os.tmpdir(), "r05-binding-"));
    const assets = path.join(temp, "dist/assets");
    try {
      await cp(vendor, path.join(temp, vendor), { recursive: true });
      const adapters = "src/hestia-prototype/physics";
      await mkdir(path.join(temp, adapters), { recursive: true });
      for (const file of ["rapier021Candidate.ts", "rapierPort.ts", "profile.ts"]) {
        await cp(path.join(adapters, file), path.join(temp, adapters, file));
      }
      await mkdir(assets, { recursive: true });
      await cp("dist/index.html", path.join(temp, "dist/index.html"));
      for (const name of [actual.bundle.entry, actual.bundle.bootstrap, actual.bundle.worker, actual.bundle.worker + ".map", actual.bundle.binary]) {
        await cp(path.join("dist/assets", name), path.join(assets, name));
      }
      expect((await readPhy01SolverBinding(temp)).bundle).toEqual(actual.bundle);
      const bootstrap = path.join(assets, actual.bundle.bootstrap);
      const original = await readFile(bootstrap, "utf8");
      await writeFile(bootstrap, original.replaceAll(actual.bundle.worker, "physicsWorker-old.js"));
      await expect(readPhy01SolverBinding(temp)).rejects.toThrow("different physics worker");
      await writeFile(bootstrap, original);
      const adapter = path.join(temp, adapters, "rapier021Candidate.ts");
      const control = await readFile(adapter, "utf8");
      await writeFile(adapter, control + "\n");
      await expect(readPhy01SolverBinding(temp)).rejects.toThrow("Stale or missing solver module");
      await writeFile(adapter, control);
      const binary = path.join(assets, actual.bundle.binary);
      await writeFile(binary, Buffer.from([0]));
      await expect(readPhy01SolverBinding(temp)).rejects.toThrow("standalone Vite WASM");
    } finally { await rm(temp, { recursive: true, force: true }); }
  });
});
