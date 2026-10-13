import {describe,expect,it} from "vitest";
import {fileURLToPath} from "node:url";
import {assertHvpPublicSaveCutover} from "../../src/hestia-prototype/physics/profile";
import {readPhy01SolverBinding} from "../performance/phy01SolverBinding";

describe(".21 Sourcefork binding without Native initialization",()=>{
  it("binds the actual99 vendor files and the selected gyro-off profile",async()=>{
    const result=await readPhy01SolverBinding();
    expect(result.vendorFiles).toHaveLength(99);
    expect(result.solver.id).toBe("rapier-0.21.0-phy01.migration2:legacy-impulse-v1");
    expect(result.solver.dynamicGyroscopicForces).toBe(false);
    expect(result.wasmSha256).toBe("ed3c8933d523eafb7d4d7a9a8efa04dd0da9d2279d4ae8cefb794c276ee98ea9");
  });
  it("rejects a foreign input root instead of falling back to installed .12",async()=>{
    await expect(readPhy01SolverBinding(fileURLToPath(new URL("../",import.meta.url)))).rejects.toThrow();
  });
  it("keeps public Save/restore gated independently of repository selection",()=>{
    expect(assertHvpPublicSaveCutover).toThrow("Speichern und Laden ist für diesen Prüfstand noch nicht freigegeben.");
  });
});
