import { expect, it } from "./assertions.js";
import { prepareCase } from "../candidates/observer.js";
import { readBoundRow } from "./row-reader.js";
it("R10-OWN-01 release receives the exact acquired handle", () => {
    const batch = { poisoned: false }, handle = { token: "owned" }, owned = prepareCase(batch, "handle");
    let acquired = 0, body = 0, released = 0;
    const returned = owned.run(() => { acquired++; return handle; }, resource => { body++; expect(resource).toBe(handle); return handle; }, resource => { released++; expect(resource).toBe(handle); });
    expect(returned).toBe(handle);
    expect(acquired).toBe(1);
    expect(body).toBe(1);
    expect(released).toBe(1);
    expect(owned.observation.acquired).toBe(true);
});
it("R10-OWN-02 cleanup thrown undefined is a failure, poisons and retains primary", () => {
    const batch = { poisoned: false }, owned = prepareCase(batch, "undefined-cleanup"), primary = { token: "primary" };
    let caught = false, error, release = 0;
    try {
        owned.run(() => ({}), () => { throw primary; }, () => { release++; throw undefined; });
    }
    catch (e) {
        caught = true;
        error = e;
    }
    expect(caught).toBe(true);
    expect(error).toBe(primary);
    expect(owned.observation.cleanup).toEqual({ status: "FAIL", error: undefined });
    expect(owned.observation.primaryPresent).toBe(true);
    expect(batch.poisoned).toBe(true);
    expect(release).toBe(1);
});
it("R10-OWN-03 cleanup thrown undefined after success remains thrown", () => {
    const batch = { poisoned: false }, owned = prepareCase(batch, "undefined-cleanup-success");
    let caught = false, error;
    try {
        owned.run(() => ({}), () => 42, () => { throw undefined; });
    }
    catch (e) {
        caught = true;
        error = e;
    }
    expect(caught).toBe(true);
    expect(error).toBeUndefined();
    expect(owned.observation.primary).toEqual({ status: "PASS", result: 42 });
    expect(owned.observation.primaryPresent).toBe(false);
    expect(owned.observation.cleanup.status).toBe("FAIL");
    expect(batch.poisoned).toBe(true);
});
it("R10-OWN-04 poisoned batch prevents already-prepared later profile acquisition", () => {
    const batch = { poisoned: false }, legacy = prepareCase(batch, "legacy-impulse-v1"), gyro = prepareCase(batch, "gyroscopic-v1");
    let later = 0, free = 0;
    expect(() => legacy.run(() => ({}), () => 42, () => { free++; throw new Error("local disposer sentinel"); })).toThrow();
    expect(() => gyro.run(() => { later++; }, () => { later++; }, () => { later++; })).toThrow();
    expect(later).toBe(0);
    expect(free).toBe(1);
    expect(gyro.observation.acquisition.status).toBe("NOT_RUN");
});
it("R10-OWN-05 ordinary failed acquisition records no returned handle and never frees", () => {
    const batch = { poisoned: false }, owned = prepareCase(batch, "no-return"), primary = { token: "acquire" };
    let caught, calls = 0;
    try {
        owned.run(() => { throw primary; }, () => { calls++; }, () => { calls++; });
    }
    catch (e) {
        caught = e;
    }
    expect(caught).toBe(primary);
    expect(owned.observation.acquired).toBe(false);
    expect(calls).toBe(0);
    expect(owned.observation.releaseAttempts).toBe(0);
    expect(owned.observation.cleanup.status).toBe("NOT_RUN");
});
it("R10-OWN-06 withCleanup callback shape preserves undefined primary", () => {
    const owned = prepareCase({ poisoned: false }, "side-resource"), cleanup = { token: "cleanup" };
    let caught = false, error, release = 0;
    const run = () => { throw undefined; }, dispose = () => { release++; throw cleanup; };
    try {
        owned.run(() => undefined, run, dispose);
    }
    catch (e) {
        caught = true;
        error = e;
    }
    expect(caught).toBe(true);
    expect(error).toBeUndefined();
    expect(release).toBe(1);
    expect(owned.observation.primaryPresent).toBe(true);
    expect(owned.observation.cleanup).toEqual({ status: "FAIL", error: cleanup });
});
it("R10-ROW-01 authentic compiler tuple has a physical path string", () => {
    const row = readBoundRow(["lib.es5.d.ts", 10, "a".repeat(64), "CURRENT_BOUND_NATIVE_COMPILER_PACKAGE"]);
    expect(row).toEqual({ path: "lib.es5.d.ts", bytes: 10, sha256: "a".repeat(64) });
});
it("R10-ROW-02 authentic object row selects its path property", () => {
    const row = readBoundRow({ path: "C:/IFI_SourceCode/lib.es5.d.ts", bytes: 10, sha256: "b".repeat(64), role: "BOUND_TSC_STDLIB" });
    expect(row.path).toBe("C:/IFI_SourceCode/lib.es5.d.ts");
});
it("R10-ROW-03 object as path is rejected without string coercion", () => {
    expect(() => readBoundRow({ path: { path: "pretend" }, bytes: 10, sha256: "b".repeat(64) })).toThrow();
});
it("R10-ROW-04 malformed tuple is rejected", () => {
    expect(() => readBoundRow(["file", 10, "a".repeat(64)])).toThrow();
});
it("R10-ROW-05 invalid bytes or SHA are rejected", () => {
    expect(() => readBoundRow({ path: "file", bytes: "10", sha256: "a".repeat(64) })).toThrow();
    expect(() => readBoundRow({ path: "file", bytes: 10, sha256: "INVALID" })).toThrow();
});
