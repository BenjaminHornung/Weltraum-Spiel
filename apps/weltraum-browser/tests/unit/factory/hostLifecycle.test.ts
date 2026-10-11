import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, openSync, ftruncateSync, closeSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createFp02Fixture } from "../../../src/factory/catalog/fp02Catalog";
import { createResourceCatalog } from "../../../src/resources/catalog";
import { mountFactorySession } from "../../../src/factory/session/factorySession";
import type { FactoryHostPort, FactoryHostView } from "../../../src/factory/session/hostPort";

const catalog = createFp02Fixture("cargo").catalog;
const hostFixture = (initialTick = 37) => {
  let current = true;
  let view: FactoryHostView = Object.freeze({ sessionId: "native-host", epoch: 1, nativeTick: initialTick,
    physicsStatus: "Running", confirmed: true, terrain: Object.freeze({ epoch: 1, revision: 0,
      sourceDigest: "source", baseDigest: "base", cellMeters: 0.125,
      originMeters: Object.freeze({ x: -12, y: 0, z: -12 }), sizeX: 192, sizeY: 64, sizeZ: 192 }) });
  const listeners = new Set<(view: FactoryHostView) => void>();
  const callbacks: ((view: FactoryHostView) => void)[] = [];
  const publish = (tick: number, overrides: Partial<FactoryHostView> = {}) => {
    view = Object.freeze({ ...view, nativeTick: tick, ...overrides });
    for (const listener of listeners) listener(view);
    return view;
  };
  const host: FactoryHostPort = Object.freeze({ current: () => current, read: () => view,
    readTerrainSlot: () => undefined, subscribeConfirmed: (listener: (view: FactoryHostView) => void) => {
      listeners.add(listener); callbacks.push(listener); return () => { listeners.delete(listener); };
    }, pause: async () => publish(view.nativeTick + 1, { physicsStatus: "Paused" }),
    resume: async () => publish(view.nativeTick, { physicsStatus: "Running" }) });
  return { host, publish, callbacks, listeners, retire: () => { current = false; } };
};

describe("FP06 W06 confirmed host lifecycle", () => {
  it.each(["catalog","material"])("W07 failed initial %s binding permits a valid retry on the SAME Host without a leaked mount",async(kind)=>{
    const f=hostFixture(),initial=f.host.read();let nativeCommands=0,nativeDisposals=0;
    const command=async()=>{nativeCommands++;};
    const host:FactoryHostPort={...f.host,construction:{openCargo:command,
      readFacts:()=>({binding:{sessionId:initial.sessionId,epoch:initial.epoch,terrainRevision:0,sourceDigest:"source",baseDigest:"base",facilityRevision:0},actor:{actorId:"test_actor",ownerId:"fp02_wreck_owner",positionMm:[0,0,0],canBuild:true},terrain:{cellMm:125,originMm:[0,0,0],size:[16,16,16],readSlot:()=>0}}),
      prepareNative:command,commitNative:command,publishNative:()=>{nativeCommands++;},rollbackNative:command,finalizeNative:command,stageProjection:command,publishProjection:()=>{nativeCommands++;},rollbackProjection:()=>{nativeCommands++;},finalizeProjection:()=>{nativeCommands++;},projectGhost:()=>{nativeCommands++;},dispose:()=>{nativeDisposals++;}}};
    const invalid=kind==="catalog"?{...catalog,canonicalJson:catalog.canonicalJson+" "}:{...catalog,resources:createResourceCatalog({...catalog.resources,resources:[]})};
    await expect(mountFactorySession(host,invalid)).rejects.toThrow();
    expect(f.listeners.size).toBe(0);expect(nativeCommands).toBe(0);expect(nativeDisposals).toBe(0);
    const retry=mountFactorySession(host,catalog);await expect(retry).resolves.toMatchObject({read:expect.any(Function)});
    const session=await retry;try{expect(session.read()).toMatchObject({state:"Ready",nativeTick:37});expect(f.listeners.size).toBe(1);expect(nativeCommands).toBe(0);}
    finally{await session.dispose();}expect(f.listeners.size).toBe(0);expect(nativeDisposals).toBe(1);
  });
  it("T028 binds baseline and remainder to six NEW native ticks, never duplicate render observations", async () => {
    const f = hostFixture(); const session = await mountFactorySession(f.host, catalog);
    try {
      expect(session.read()).toMatchObject({ nativeTick: 37, steps: 0, remainderTicks: 0, elapsedMs: 0 });
      for (let frame = 0; frame < 100; frame++) f.publish(37);
      expect(session.read().steps).toBe(0);
      f.publish(42); expect(session.read()).toMatchObject({ steps: 0, remainderTicks: 5 });
      f.publish(43); expect(session.read()).toMatchObject({ steps: 1, remainderTicks: 0, elapsedMs: 100 });
      f.publish(56); expect(session.read()).toMatchObject({ steps: 3, remainderTicks: 1, elapsedMs: 300 });
      expect(Object.isFrozen(session.read())).toBe(true);
    } finally { await session.dispose(); }
  });
  it("T026 refuses a second factory mount on the same live native host", async () => {
    const f = hostFixture(); const session = await mountFactorySession(f.host, catalog);
    try { await expect(mountFactorySession(f.host, catalog)).rejects.toThrow(/already mounted/i); }
    finally { await session.dispose(); }
    const next = await mountFactorySession(f.host, catalog); await next.dispose();
  });
  it("T027 rejects queued old-epoch callbacks after dispose and never touches a replacement", async () => {
    const f = hostFixture(); const old = await mountFactorySession(f.host, catalog);
    const late = f.callbacks[0]; expect(late).toBeTypeOf("function");
    await old.dispose(); const before = old.read();
    const next = await mountFactorySession(f.host, catalog);
    late!(Object.freeze({ ...f.host.read(), nativeTick: 1000 }));
    expect(old.read()).toEqual(before); expect(next.read().steps).toBe(0);
    expect(f.listeners.size).toBe(1); await next.dispose(); expect(f.listeners.size).toBe(0);
  });
  it("closes on stale epoch or backwards tick without granting progress", async () => {
    const f = hostFixture(); const session = await mountFactorySession(f.host, catalog);
    try {
      f.publish(36); expect(session.read()).toMatchObject({ state: "RecoveryHold", steps: 0 });
      f.publish(1000); expect(session.read().steps).toBe(0);
    } finally { await session.dispose(); }
    const g = hostFixture(); const other = await mountFactorySession(g.host, catalog);
    try { g.publish(1000, { epoch: 2 }); expect(other.read()).toMatchObject({ state: "RecoveryHold", steps: 0 }); }
    finally { await other.dispose(); }
  });
  it("flushes actual final confirmed ticks at pause ACK and grants no work while paused", async () => {
    const f = hostFixture(0); const session = await mountFactorySession(f.host, catalog);
    try {
      f.publish(5); await f.host.pause(); expect(session.read()).toMatchObject({ nativeTick: 6, steps: 1 });
      for (let frame = 0; frame < 100; frame++) f.publish(6, { physicsStatus: "Paused" });
      expect(session.read().steps).toBe(1);
    } finally { await session.dispose(); }
  });
  it("refuses a native RecoveryHold or disposed snapshot even if a caller marks it confirmed", async () => {
    const f = hostFixture(); f.publish(37, { physicsStatus: "RecoveryHold" });
    await expect(mountFactorySession(f.host, catalog)).rejects.toThrow(/confirmed|hold/i);
    f.publish(37, { physicsStatus: "Running" }); const session = await mountFactorySession(f.host, catalog);
    try { f.publish(1000, { physicsStatus: "Disposed" }); expect(session.read()).toMatchObject({ state: "RecoveryHold", steps: 0 }); }
    finally { await session.dispose(); }
  });
  it("does not bind a disposed or unconfirmed host, and ignores retirement", async () => {
    const f = hostFixture(); f.publish(37, { confirmed: false });
    await expect(mountFactorySession(f.host, catalog)).rejects.toThrow(/confirmed/i);
    f.publish(37, { confirmed: true }); const session = await mountFactorySession(f.host, catalog);
    try { f.retire(); f.publish(1000); expect(session.read().steps).toBe(0); }
    finally { await session.dispose(); }
    await expect(mountFactorySession(f.host, catalog)).rejects.toThrow(/current|disposed/i);
  });
  it("R1 keeps transient native holds quiescent without granting ticks and recovers only from confirmed reads", async () => {
    const f = hostFixture(0), session = await mountFactorySession(f.host, catalog);
    try {
      for (const physicsStatus of ["CoverageHold", "SimulationHold"] as const) {
        f.publish(6, { physicsStatus, confirmed: false });
        expect(session.read()).toMatchObject({ state: "WaitingForHost", nativeTick: 0, steps: 0 });
        expect(session.isQuiescent()).toBe(true);
      }
      f.publish(6, { physicsStatus: "Running", confirmed: false });
      expect(session.read()).toMatchObject({ state: "WaitingForHost", nativeTick: 0, steps: 0 });
      f.publish(6, { physicsStatus: "Running", confirmed: true });
      expect(session.read()).toMatchObject({ state: "Ready", nativeTick: 6, steps: 1 });
      f.publish(12, { physicsStatus: "RecoveryHold", confirmed: false });
      expect(session.read()).toMatchObject({ state: "RecoveryHold", nativeTick: 6, steps: 1 });
      expect(session.isQuiescent()).toBe(false);
      f.publish(18, { physicsStatus: "Running", confirmed: true });
      expect(session.read()).toMatchObject({ state: "RecoveryHold", nativeTick: 6, steps: 1 });
    } finally { await session.dispose(); }
  });
});

describe("W06 bounded recursive Factory evidence", () => {
  const verify = (directory: string) => spawnSync(process.execPath,
    [fileURLToPath(new URL("../../../../../tools/factory/verify-evidence.mjs", import.meta.url)), directory], { encoding: "utf8" });
  const manifest = (artifacts: unknown) => JSON.stringify({ schema: "hestia.fp06.evidence/v1", artifacts });
  const hash = (bytes: string) => createHash("sha256").update(bytes).digest("hex");
  it.each(["outside", "missing", "digest", "placeholder"])("R1 rejects %s manifest evidence references", kind => {
    const directory = mkdtempSync(path.join(tmpdir(), "fp06-evidence-refs-"));
    try {
      writeFileSync(path.join(directory, "actual.txt"), "observed");
      const invalid = { outside: manifest([{ path: "../../outside.png", sha256: "0".repeat(64) }]),
        missing: manifest([{ path: "missing.txt", sha256: hash("observed") }]),
        digest: manifest([{ path: "actual.txt", sha256: "0".repeat(64) }]), placeholder: '{"test":"real"}' };
      writeFileSync(path.join(directory, "manifest.json"), invalid[kind as keyof typeof invalid]);
      expect(verify(directory).status).toBe(1);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it("accepts real nested JSON and rejects corrupt descendants and symlinks", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "fp06-evidence-"));
    try {
      const nested = path.join(directory, "w06", "actual-run"); mkdirSync(nested, { recursive: true });
      writeFileSync(path.join(nested, "observed.json"), '{"ticks":6}');
      writeFileSync(path.join(nested, "manifest.json"), manifest([{ path: "observed.json", sha256: hash('{"ticks":6}') }]));
      expect(verify(directory).status).toBe(0);
      writeFileSync(path.join(nested, "bad.json"), '{');
      expect(verify(directory).status).toBe(1);
      rmSync(path.join(nested, "bad.json"));
      symlinkSync(path.join(nested, "manifest.json"), path.join(directory, "linked.json"));
      expect(verify(directory).status).toBe(1);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it.each(["artifacts", "evidenceFiles"])("binds actual %s bytes while preserving historical product receipts", field => {
    const directory = mkdtempSync(path.join(tmpdir(), "fp06-evidence-digests-"));
    try {
      writeFileSync(path.join(directory, "actual.txt"), "observed");
      const value = { schema: "hestia.fp06.w01-evidence/v1",
        [field]: [{ path: "actual.txt", sha256: hash("observed"), bytes: 8 }],
        productFiles: [{ path: "apps/weltraum-browser/historical.ts", sha256: hash("old source") }],
        commands: [{ artifact: "actual.txt" }], verification: [{ log: "actual.txt" }], review: { artifact: "actual.txt" } };
      writeFileSync(path.join(directory, "manifest.json"), JSON.stringify(value));
      expect(verify(directory).status).toBe(0);
      writeFileSync(path.join(directory, "actual.txt"), "mutated!"); expect(verify(directory).status).toBe(1);
      writeFileSync(path.join(directory, "actual.txt"), "observed");
      value.review.artifact = "unlisted.txt"; writeFileSync(path.join(directory, "manifest.json"), JSON.stringify(value));
      expect(verify(directory).status).toBe(1);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it("bounds directories as well as files in recursive admission", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "fp06-evidence-entries-"));
    try {
      writeFileSync(path.join(directory, "actual.txt"), "observed");
      writeFileSync(path.join(directory, "manifest.json"), manifest([{ path: "actual.txt", sha256: hash("observed") }]));
      expect(verify(directory).status).toBe(0);
      for (let i = 0; i < 4097; i++) mkdirSync(path.join(directory, `empty-${i}`));
      const result = verify(directory); expect(result.status).toBe(1); expect(result.stderr).toContain("entry budget exceeded");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it("rejects oversized evidence before reading or uploading it", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "fp06-evidence-budget-"));
    try {
      writeFileSync(path.join(directory, "actual.txt"), "observed");
      writeFileSync(path.join(directory, "manifest.json"), manifest([{ path: "actual.txt", sha256: hash("observed") }]));
      expect(verify(directory).status).toBe(0);
      const file = openSync(path.join(directory, "oversized.bin"), "w");
      ftruncateSync(file, 32 * 1024 * 1024 + 1); closeSync(file);
      const result = verify(directory); expect(result.status).toBe(1); expect(result.stderr).toContain("byte/file budget exceeded");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
