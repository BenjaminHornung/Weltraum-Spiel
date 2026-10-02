import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isHvpCutHealthFresh, readHvpCutMarkers, type HvpCutRawEntry } from "./hvpCutRtReport";
import { waitForK34Contact, type K34ContactSample } from "./hvpK34ContactReadiness";
import type { HvpPhysicsSnapshot, HvpPhysicsClock } from "../../src/hestia-prototype/physics/physicsWorker";

const baseUrl = "http://127.0.0.1:5173";
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type Snapshot = {
  atUtc: string; origin: number; now: number; generation: number; digest: string;
  sectors: { id: number; key: string; hash: string }[];
  physics: HvpPhysicsSnapshot; clock: HvpPhysicsClock | null;
  tool: { issued: number; receipts: number; queued: number; state: string; message: string;
    last?: { commandId: string; status: string } };
  save: { state: string; message: string; revision: number };
  input: { owner: string; locked: boolean; pressedKeys: string[] };
  resources: { totalCpuBytes: number; ledger: { triangles: number; drawCalls: number; retainedMeshBytes: number };
    caps: { maxCpuBytes: number; maxMeshBytes: number; maxTriangles: number; maxDrawCalls: number } };
  ownedRender: { geometries: number; materials: number; representations: number; ownedCpuBytes: number } | null;
  health: { enabled: boolean; errors: number; dropped: number; timingSinkFailures: number | null;
    publishedOrigin: number; publishedAt: number; cutObservation: { status: string; drops: number } } | null;
  playerCamera: { orientation: number[] } | null;
  cameraPreset: string | undefined; playerView: string | undefined;
  neighbor: { state: string; busy: boolean; recoveryHold: boolean } | null;
  visible: string; focused: boolean; locked: boolean; testBridge: boolean; heap: number | null;
};

const read = (page: Page): Promise<Snapshot> => page.evaluate(() => ({
  atUtc: new Date().toISOString(), origin: performance.timeOrigin, now: performance.now(),
  generation: Number(document.body.dataset.hestiaPrototypeTerrainGeneration),
  digest: document.body.dataset.hestiaPrototypeSourceDigest!,
  sectors: JSON.parse(document.body.dataset.hestiaPrototypeTerrainSectors!),
  physics: JSON.parse(document.body.dataset.hestiaPrototypePhysics!),
  clock: JSON.parse(document.body.dataset.hestiaPrototypePhysicsClock ?? "null"),
  tool: JSON.parse(document.body.dataset.hestiaPrototypeTool!),
  save: JSON.parse(document.body.dataset.hestiaPrototypeSave!),
  input: JSON.parse(document.body.dataset.hestiaPrototypeInput ?? "{}"),
  resources: JSON.parse(document.body.dataset.hestiaPrototypeResources!),
  ownedRender: JSON.parse(document.body.dataset.hestiaPrototypeOwnedRender ?? "null"),
  health: JSON.parse(document.body.dataset.hestiaPrototypeMeasurements ?? "null"),
  playerCamera: JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera ?? "null"),
  cameraPreset: document.body.dataset.hestiaPrototypeCamera,
  playerView: document.body.dataset.hestiaPrototypePlayerView,
  neighbor: JSON.parse(document.body.dataset.hestiaPrototypeNeighbor ?? "null"),
  visible: document.visibilityState, focused: document.hasFocus(),
  locked: document.pointerLockElement?.id === "debug-scene", testBridge: "TestBridge" in window,
  heap: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
}));

const readSave = (page: Page) => page.evaluate(async () => {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("weltraum-hestia-prototype-v1");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => { request.transaction?.abort(); reject(new Error("Expected existing HVP database")); };
  });
  try {
    const record = await new Promise<{ metadata: { slotId: string; recordRevision: number; contentHash: string }; payloadBytes: Uint8Array }>((resolve, reject) => {
      const request = db.transaction("saveSlots", "readonly").objectStore("saveSlots").get("hvp-primary");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const bytes = new Uint8Array(record.payloadBytes);
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map(value => value.toString(16).padStart(2, "0")).join("");
    // The canonical payload bytes are the envelope itself, not a wrapper around it.
    const game = JSON.parse(new TextDecoder().decode(bytes)).player.data.hestia;
    return { metadata: record.metadata, sha256: hash, generation: game.terrain.revision,
      digest: game.terrain.sourceDigest, tick: game.world.tick.ticks,
      receipts: game.receipts.terrain.entries.map((entry: { id: string; outcome: { commandId: string; status: string; revision: number } }) =>
        ({ id: entry.id, commandId: entry.outcome.commandId, status: entry.outcome.status, revision: entry.outcome.revision })) };
  } finally { db.close(); }
});

const installObservers = (page: Page) => page.addInitScript(() => {
  const fault = { loseAck: false, lost: 0 };
  (window as unknown as { hvpSaveFault: typeof fault }).hvpSaveFault = fault;
  const descriptor = Object.getOwnPropertyDescriptor(Worker.prototype, "onmessage");
  if (!descriptor?.set) { throw new Error("Worker event boundary unavailable"); }
  Object.defineProperty(Worker.prototype, "onmessage", { ...descriptor, set(handler: ((this: Worker, event: MessageEvent) => void) | null) {
    descriptor.set!.call(this, handler === null ? null : function(this: Worker, event: MessageEvent) {
      if (fault.loseAck && event.data?.restoreState === "Prepared") {
        fault.loseAck = false; fault.lost += 1;
        handler.call(this, new MessageEvent("message", { data: { ...event.data, snapshot: undefined } }));
      } else { handler.call(this, event); }
    });
  } });
  const entries: HvpCutRawEntry[] = [];
  let dropped = 0;
  const collect = (values: PerformanceEntry[]) => {
    for (const entry of values) {
      if (!entry.name.startsWith("hvp.cut")) { continue; }
      if (entries.length >= 8192) { dropped += 1; continue; }
      entries.push({ name: entry.name, start: entry.startTime, duration: entry.duration,
        detail: (entry as PerformanceMeasure).detail });
    }
  };
  const observer = new PerformanceObserver(list => collect(list.getEntries()));
  observer.observe({ type: "measure" });
  Object.defineProperty(window, "hvpK34Drain", { value: () => {
    collect(observer.takeRecords());
    const batch = { entries: entries.splice(0), dropped }; dropped = 0; return batch;
  } });
});

const drain = (page: Page): Promise<{ entries: HvpCutRawEntry[]; dropped: number }> => page.evaluate(() => {
  const collect = (window as unknown as { hvpK34Drain: () => { entries: HvpCutRawEntry[]; dropped: number } }).hvpK34Drain;
  return collect();
});

const frames = (page: Page) => page.evaluate(() => new Promise<number>((resolve, reject) => {
  let count = 0, request = 0;
  const timeout = setTimeout(() => { cancelAnimationFrame(request); reject(new Error("60-frame observation timeout")); }, 30_000);
  const next = () => { count += 1; if (count === 60) { clearTimeout(timeout); resolve(count); } else { request = requestAnimationFrame(next); } };
  request = requestAnimationFrame(next);
}));

const assertSafe = (s: Snapshot) => {
  expect(s.testBridge).toBe(false);
  expect(s.physics.status).not.toBe("SimulationHold");
  expect(s.save.state).not.toBe("RecoveryHold");
  expect(s.physics.terrainTransaction).toBe("Idle");
  expect(s.health).toMatchObject({ enabled: true, errors: 0, dropped: 0, timingSinkFailures: 0,
    cutObservation: { status: "armed", drops: 0 } });
  expect(s.resources.caps).toMatchObject({ maxCpuBytes: 268_435_456, maxMeshBytes: 134_217_728,
    maxTriangles: 500_000, maxDrawCalls: 300 });
  expect(s.resources.totalCpuBytes).toBeLessThanOrEqual(s.resources.caps.maxCpuBytes);
  expect(s.resources.ledger.retainedMeshBytes).toBeLessThanOrEqual(s.resources.caps.maxMeshBytes);
  expect(s.resources.ledger.triangles).toBeLessThanOrEqual(s.resources.caps.maxTriangles);
  expect(s.resources.ledger.drawCalls).toBeLessThanOrEqual(s.resources.caps.maxDrawCalls);
};

const sectors = (s: Snapshot) => s.sectors.map(({ id, hash }) => ({ id, hash }));
const replacedKeys = (before: Snapshot, after: Snapshot) => {
  for (const old of before.sectors) {
    const current = after.sectors.find(entry => entry.id === old.id);
    if (current && current.hash !== old.hash) { expect(current.key).not.toBe(old.key); }
  }
};

test.describe("K34 fixed 50 same-mount restore cycles", () => {
  test.skip(process.env.WELTRAUM_K34_FIXED50_RUN !== "1", "Only the explicit K34 frozen run may execute this test");

  test("50 failed-Load rollback, normal Load and genuine recut cycles", async ({ page, browser }, testInfo) => {
    test.setTimeout(50 * 60_000);
    const root = process.env.WELTRAUM_HVP_MEASURE_DIR;
    const outside = root && path.relative(process.cwd(), root);
    if (!root || !path.isAbsolute(root) || !(outside === ".." || outside?.startsWith(`..${path.sep}`))) {
      throw new Error("K34 requires an external absolute raw directory");
    }
    const persist = async (name: string, value: unknown) => {
      const text = JSON.stringify(value, null, 2);
      const file = path.join(root, name);
      await writeFile(file, text, { flag: "wx" });
      if (await readFile(file, "utf8") !== text) { throw new Error(`Raw readback failed for ${name}`); }
    };
    const frozen = JSON.parse(await readFile(path.join(root, "preflight.json"), "utf8")) as {
      chromeVersion: string; hashes: Record<string, string>;
    };
    const mainAsset = (await readFile("dist/index.html", "utf8")).match(/src="\/(assets\/index-[^"/]+\.js)"/)?.[1];
    const entries = await readdir("dist/assets", { withFileTypes: true });
    if (entries.some(entry => !entry.isFile())) { throw new Error("Unexpected non-file in frozen production assets"); }
    const builtAssets = entries.filter(entry => /\.(js|css)$/.test(entry.name))
      .map(entry => `dist/assets/${entry.name}`).sort();
    const frozenAssets = Object.keys(frozen.hashes ?? {}).filter(file =>
      file.startsWith("dist/assets/") && /\.(js|css)$/.test(file)).sort();
    if (!mainAsset || !builtAssets.includes(`dist/${mainAsset}`)
      || !builtAssets.some(file => /^dist\/assets\/hvp-[^/]+\.js$/.test(file))
      || !builtAssets.some(file => /^dist\/assets\/physicsWorker-[^/]+\.js$/.test(file))
      || !builtAssets.some(file => /^dist\/assets\/streamingWorker-[^/]+\.js$/.test(file))
      || JSON.stringify(builtAssets) !== JSON.stringify(frozenAssets)) {
      throw new Error("Missing frozen production assets");
    }
    for (const file of ["tests/performance/hvp-k34-50.spec.ts", "tests/performance/hvpK34ContactReadiness.ts",
      "tests/unit/hvpK34ContactReadiness.test.ts", "playwright.k34-50.config.ts",
      "dist/index.html", ...builtAssets]) {
      if (!/^[a-f0-9]{64}$/.test(frozen.hashes?.[file] ?? "")) {
        throw new Error(`Missing frozen K34 hash: ${file}`);
      }
    }
    if (testInfo.timeout !== 50 * 60_000 || path.basename(testInfo.config.configFile ?? "") !== "playwright.k34-50.config.ts"
      || browser.version() !== frozen.chromeVersion) { throw new Error("Frozen runner/Chrome mismatch before Ready"); }
    for (const [file, expected] of Object.entries(frozen.hashes)) {
      if (sha(await readFile(file)) !== expected) { throw new Error(`Frozen file hash mismatch: ${file}`); }
    }
    await persist("raw-sink-probe.json", { status: "PROVEN_BEFORE_FIRST_CUT", atUtc: new Date().toISOString() });
    let deadline = 0, completed = 0, index: number | null = null, phase = "preseed";
    let seedCut2Aim: { orientation: number[]; position: { x: number; y: number; z: number } } | undefined;
    let currentMarkers: HvpCutRawEntry[] = [], currentMarkerDrops = 0;
    let currentContactSamples: K34ContactSample[] = [], contactPersistenceError: string | null = null;
    let failure: unknown;
    const errors: string[] = [];
    page.on("pageerror", error => { errors.push(error.message); });
    page.on("console", message => { if (message.type() === "error") { errors.push("console-error"); } });
    const within = (neededMs = 30_000) => {
      if (errors.length > 0) { throw new Error(`Browser error before ${phase}: ${errors[0]}`); }
      if (phase !== "final-disposal" && deadline && Date.now() + neededMs > deadline) {
        throw new Error(`Population deadline before ${phase}`);
      }
    };
    const checkObservation = (s: Snapshot) => {
      if (errors.length > 0 || s.physics.status === "SimulationHold" || s.physics.status === "RecoveryHold"
        || s.physics.status === "CoverageHold" || s.physics.moving.state === "RecoveryHold"
        || s.tool.state === "RecoveryHold" || s.neighbor?.recoveryHold === true
        || s.save.state === "RecoveryHold" || (s.health !== null && (s.health.errors !== 0
          || s.health.dropped !== 0 || s.health.timingSinkFailures !== 0 || s.health.cutObservation.drops !== 0))) {
        throw new Error(`Unsafe HVP/browser state during ${phase}: ${s.physics.status}/${s.save.state}; ${errors.length} browser errors`);
      }
      return s;
    };
    const observe = async () => checkObservation(await read(page));
    const waitFor = async (predicate: (s: Snapshot) => boolean, timeout: number, label: string) => {
      within(timeout);
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        const s = await observe();
        if (predicate(s)) { return s; }
        await page.waitForTimeout(50);
      }
      throw new Error(`Timed out waiting for ${label}`);
    };
    const compareSave = async (saved: Awaited<ReturnType<typeof readSave>>) => {
      expect(await readSave(page)).toEqual(saved);
    };
    const inspect = async () => {
      within();
      if ((await observe()).locked) { await page.keyboard.press("Escape"); }
      await waitFor(s => s.physics.status === "Paused", 10_000, "Paused");
      within();
      await page.getByRole("button", { name: "Zur Inspektionsansicht", exact: true }).click();
      within();
      await page.getByRole("button", { name: "Ansicht: Schnittstelle", exact: true }).click();
    };
    const cut = async (tag: string, expectedId: string, generation: number, before?: Snapshot) => {
      within(); phase = `${tag}/play`;
      currentMarkers = []; currentMarkerDrops = 0;
      currentContactSamples = []; contactPersistenceError = null;
      const beforePlay = await observe();
      await persist(`${tag}-before-play.json`, { phase, atUtc: new Date().toISOString(), state: beforePlay });
      if (before) { expect(beforePlay.digest).toBe(before.digest); }
      const play = page.locator("#hvp-play");
      await expect(play).toBeVisible(); await expect(play).toBeEnabled();
      await play.focus();
      expect(await page.evaluate(() => document.activeElement?.id)).toBe("hvp-play");
      within(); await page.keyboard.press("Enter"); // Genuine button activation without moving the pointer.
      await waitFor(s => s.locked && s.input.owner === "Player" && s.physics.status === "Running"
        && s.physics.player?.status === "Walking" && s.physics.player.grounded === true, 10_000, "locked Walking");
      within(30_000);
      const [a, b, pre] = await waitForK34Contact<Snapshot>({
        beforePlayTick: beforePlay.physics.ticks, generation, digest: beforePlay.digest,
        deadlineMs: Date.now() + 30_000, samples: currentContactSamples, now: Date.now,
        read: async () => {
          const s = await read(page), p = s.physics.player;
          return { state: s, sample: {
            atUtc: s.atUtc, tick: s.physics.ticks, physicsStatus: s.physics.status,
            playerStatus: p?.status ?? null, grounded: p?.grounded ?? null,
            position: p?.position ? { ...p.position } : null, velocityY: p?.velocityY ?? null,
            locked: s.locked, inputOwner: s.input.owner, pressedKeys: [...s.input.pressedKeys],
            generation: s.generation, digest: s.digest, toolMessage: s.tool.message,
            cameraPreset: s.cameraPreset, playerView: s.playerView,
            health: { errors: s.health?.errors ?? null, dropped: s.health?.dropped ?? null,
              timingSinkFailures: s.health?.timingSinkFailures ?? null,
              cutDrops: s.health?.cutObservation.drops ?? null }
          } };
        },
        checkSafe: checkObservation, delay: () => page.waitForTimeout(50),
        persist: report => persist(`${tag}-contact-readiness.json`, report),
        onPersistenceError: error => { contactPersistenceError = error instanceof Error ? error.message.slice(0, 500) : "Unknown"; }
      });
      for (const state of [a, b, pre]) {
        assertSafe(state);
        expect(state).toMatchObject({ generation, cameraPreset: "C07-QUARRY", playerView: "FirstPerson",
          visible: "visible", focused: true, locked: true,
          input: { owner: "Player", locked: true, pressedKeys: [] } });
        expect(state.physics.player).toMatchObject({ status: "Walking", grounded: true });
        expect(state.tool.message).toContain("sicherer Steinbruch");
      }
      for (const [left, right] of [[a, b], [b, pre]] as const) {
        expect(left.digest).toBe(right.digest);
        expect(Math.hypot((left.physics.player?.position.x ?? 0) - (right.physics.player?.position.x ?? 0),
          (left.physics.player?.position.y ?? 0) - (right.physics.player?.position.y ?? 0),
          (left.physics.player?.position.z ?? 0) - (right.physics.player?.position.z ?? 0))).toBeLessThanOrEqual(0.01);
        expect(left.playerCamera?.orientation).toEqual(right.playerCamera?.orientation);
      }
      if (before) { expect(pre.digest).toBe(before.digest); }
      await drain(page); // Remove markers from the preceding cut, not history or gameplay.
      phase = `${tag}/mouse`;
      await persist(`${tag}-before-mouse.json`, { phase, atUtc: new Date().toISOString(), state: pre });
      within(60_000);
      const inputGuard = await observe(); assertSafe(inputGuard);
      expect(inputGuard).toMatchObject({ generation, digest: pre.digest, cameraPreset: "C07-QUARRY", playerView: "FirstPerson",
        visible: "visible", focused: true, locked: true,
        input: { owner: "Player", locked: true, pressedKeys: [] },
        physics: { status: "Running", player: { status: "Walking", grounded: true } } });
      expect(inputGuard.tool.message).toContain("sicherer Steinbruch");
      const orientation = inputGuard.playerCamera?.orientation;
      expect(Array.isArray(orientation)).toBe(true);
      expect(orientation).toHaveLength(4);
      expect(orientation?.every(Number.isFinite)).toBe(true);
      expect(orientation).toEqual(pre.playerCamera?.orientation);
      const position = inputGuard.physics.player?.position;
      expect(position).toBeTruthy();
      if (expectedId === "cut-2" && tag !== "seed-cut2") {
        expect(seedCut2Aim).toBeDefined();
        expect(orientation).toEqual(seedCut2Aim?.orientation);
      }
      const positionDelta = seedCut2Aim && position ? Math.hypot(position.x - seedCut2Aim.position.x,
        position.y - seedCut2Aim.position.y, position.z - seedCut2Aim.position.z) : null;
      await page.mouse.down(); await page.mouse.up(); // No locator reposition and no retry on uncertain delivery.
      await persist(`${tag}-mouse-returned.json`, { phase, atUtc: new Date().toISOString(), inputGuard,
        crossCyclePositionDeltaMeters: positionDelta, state: await observe() });
      const entries = currentMarkers;
      let commandId: string | undefined;
      within(30_000);
      const end = Date.now() + 30_000;
      while (Date.now() < end) {
        const batch = await drain(page); entries.push(...batch.entries); currentMarkerDrops += batch.dropped;
        const inputs = entries.filter(entry => entry.name === "hvp.cutInputMs");
        if (inputs.length === 1 && typeof inputs[0]?.detail?.data?.commandId === "string") {
          commandId = inputs[0].detail.data.commandId;
          const markers = readHvpCutMarkers(entries, commandId, false);
          if (markers.outcome && (markers.outcome !== "Applied" || markers.firstCommittedRenderSubmitMs !== null)) { break; }
        }
        if (entries.length > 0) { await observe(); }
        await page.waitForTimeout(50);
      }
      const terminal = await observe();
      const last = await drain(page); entries.push(...last.entries); currentMarkerDrops += last.dropped;
      await persist(`${tag}-markers.json`, { phase: `${tag}/terminal`, atUtc: new Date().toISOString(),
        entries, dropped: currentMarkerDrops, terminal });
      expect(entries.filter(entry => entry.name === "hvp.cutInputMs")).toHaveLength(1);
      expect(commandId).toBe(expectedId);
      const markers = readHvpCutMarkers(entries, expectedId, false);
      expect(markers.problems).toEqual([]); expect(currentMarkerDrops).toBe(0);
      expect(markers.outcome).toBe("Applied");
      expect(markers.appliedMs).not.toBeNull(); expect(markers.firstCommittedRenderSubmitMs).not.toBeNull();
      expect(markers.renderBinding).toMatchObject({ savedRevision: terminal.generation, savedDigest: terminal.digest,
        nativeGeneration: terminal.physics.terrainGeneration, rootIdentityMatches: true,
        activeKeysMatch: true, visibleKeysMatch: true, nativeGenerationMatches: true, recoveryHold: false });
      expect(terminal.tool).toMatchObject({ issued: Number(expectedId.slice(4)), last: { commandId: expectedId, status: "Applied" } });
      expect(terminal.generation).toBe(generation + 1);
      expect(terminal.physics.terrainGeneration).toBe(terminal.generation);
      await waitFor(s => isHvpCutHealthFresh(s.health, terminal.origin, markers.firstCommittedRenderSubmitMs!),
        5_000, "fresh cut health");
      within(30_000);
      await frames(page);
      const settled = await observe();
      assertSafe(settled); replacedKeys(pre, settled);
      await persist(`${tag}-cut.json`, { phase: `${tag}/cut`, before: pre, terminal, settled,
        inputMs: markers.inputMs, appliedMs: markers.appliedMs,
        firstCommittedRenderSubmitMs: markers.firstCommittedRenderSubmitMs, binding: markers.renderBinding });
      if (tag === "seed-cut2" && orientation && position) {
        seedCut2Aim = { orientation: [...orientation], position: { ...position } };
      }
      within(0); currentMarkers = [];
      return settled;
    };

    try {
      phase = "origin-preflight";
      await page.goto(baseUrl);
      expect(await page.evaluate(async () => (await indexedDB.databases()).some(db => db.name === "weltraum-hestia-prototype-v1"))).toBe(false);
      await installObservers(page);
      phase = "ready";
      await page.goto(`${baseUrl}/?hestiaPrototype=1&hvpMeasure=1`);
      await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 30_000 });
      const firstReadyAtUtc = new Date().toISOString(); deadline = Date.now() + 45 * 60_000;
      await persist("first-ready.json", { firstReadyAtUtc, deadlineUtc: new Date(deadline).toISOString(), status: "READY" });
      await waitFor(s => s.health !== null, 10_000, "first health publication");
      const initial = await observe(); assertSafe(initial);
      expect(initial.generation).toBe(0);
      expect(await page.evaluate(() => "gc" in window)).toBe(false);
      await page.getByRole("button", { name: "Ansicht: Schnittstelle", exact: true }).click();
      const first = await cut("seed-cut1", "cut-1", 0, initial);
      phase = "seed/save";
      await inspect();
      const saved = await observe(); assertSafe(saved);
      expect(saved.generation).toBe(1); expect(saved.tool.receipts).toBe(1);
      within(30_000);
      await frames(page);
      const savedBaseline = await observe(); assertSafe(savedBaseline);
      await persist("seed-before-save.json", { state: savedBaseline });
      within(); await page.getByRole("button", { name: "Spielstand speichern", exact: true }).click();
      await persist("seed-save-click-returned.json", { atUtc: new Date().toISOString(), state: await observe() });
      await waitFor(s => s.save.state === "Saved", 30_000, "Saved rev1");
      const record = await readSave(page);
      expect(record).toMatchObject({ metadata: { slotId: "hvp-primary", recordRevision: 1,
        contentHash: `sha256:${record.sha256}` }, generation: 1, digest: saved.digest,
        receipts: [{ id: "cut-1", commandId: "cut-1", status: "Applied", revision: 1 }] });
      expect(record.tick).toBe(saved.physics.ticks);
      await persist("seed-save.json", { saved: savedBaseline, record });
      const second = await cut("seed-cut2", "cut-2", 1, saved);
      expect(first.digest).toBe(saved.digest); expect(second.tool.receipts).toBe(2);
      await compareSave(record);
      await persist("seed-complete.json", { gen1: savedBaseline, gen2: second, save: record, seedCut2Aim });

      for (let i = 0; i < 50; i += 1) {
        index = i; phase = `i${i}/pause`;
        within(); await inspect();
        const a = await observe(); assertSafe(a);
        expect(a.generation).toBe(2); expect(a.digest).toBe(second.digest); expect(a.tool.receipts).toBe(2);
        await compareSave(record);
        const tag = `i${String(i).padStart(2, "0")}`;
        await persist(`${tag}-a-before.json`, { index: i, atUtc: new Date().toISOString(), state: a });
        const lost = await page.evaluate(() => (window as unknown as { hvpSaveFault: { lost: number; loseAck: boolean } }).hvpSaveFault);
        expect(lost).toEqual({ lost: i, loseAck: false });
        within(); phase = `${tag}/fault-load`;
        await page.evaluate(() => { (window as unknown as { hvpSaveFault: { loseAck: boolean } }).hvpSaveFault.loseAck = true; });
        await persist(`${tag}-fault-armed.json`, { index: i, beforeLoad: a.atUtc, atUtc: new Date().toISOString() });
        await page.getByRole("button", { name: "Spielstand laden", exact: true }).click();
        await persist(`${tag}-fault-click-returned.json`, { index: i, atUtc: new Date().toISOString(), state: await observe() });
        await waitFor(s => s.save.state === "Rejected", 30_000, "fault-specific Rejected");
        const rejected = await observe(); assertSafe(rejected);
        expect(rejected.save.message).toBe("Error: Missing prepared restore snapshot");
        expect(await page.evaluate(() => (window as unknown as { hvpSaveFault: { lost: number; loseAck: boolean } }).hvpSaveFault))
          .toEqual({ lost: i + 1, loseAck: false });
        expect(rejected).toMatchObject({ generation: 2, digest: a.digest, sectors: a.sectors,
          physics: { status: "Paused", terrainTransaction: "Idle", ticks: a.physics.ticks,
            bodyCount: a.physics.bodyCount, colliderCount: a.physics.colliderCount, bodies: a.physics.bodies },
          tool: { receipts: 2 } });
        await compareSave(record);
        await persist(`${tag}-a-rollback.json`, { index: i, state: rejected });
        within(); phase = `${tag}/normal-load`;
        await persist(`${tag}-before-normal-load.json`, { index: i, state: rejected });
        await page.getByRole("button", { name: "Spielstand laden", exact: true }).click();
        await persist(`${tag}-normal-click-returned.json`, { index: i, atUtc: new Date().toISOString(), state: await observe() });
        await waitFor(s => s.save.state === "Loaded", 30_000, "Loaded rev1");
        const b = await observe(); assertSafe(b);
        expect(b).toMatchObject({ generation: 1, digest: saved.digest,
          physics: { status: "Paused", ticks: saved.physics.ticks, terrainGeneration: 1, bodies: saved.physics.bodies,
            bodyCount: saved.physics.bodyCount, colliderCount: saved.physics.colliderCount,
            player: { position: saved.physics.player?.position } },
          tool: { receipts: 1, issued: 1 } });
        expect(sectors(b)).toEqual(sectors(saved)); replacedKeys(a, b);
        await compareSave(record);
        within(30_000);
        await frames(page);
        const bSettled = await observe(); assertSafe(bSettled);
        expect(bSettled).toMatchObject({ generation: 1, digest: saved.digest,
          physics: { status: "Paused", ticks: saved.physics.ticks, bodies: saved.physics.bodies } });
        expect(sectors(bSettled)).toEqual(sectors(saved));
        expect(savedBaseline.ownedRender).not.toBeNull(); expect(bSettled.ownedRender).not.toBeNull();
        for (const field of ["geometries", "materials", "representations", "ownedCpuBytes"] as const) {
          const expected = savedBaseline.ownedRender?.[field], actual = bSettled.ownedRender?.[field];
          expect(Number.isFinite(expected), field).toBe(true);
          expect(Number.isFinite(actual), field).toBe(true);
          expect(actual, field).toBe(expected);
        }
        expect(bSettled.resources.totalCpuBytes).toBeLessThanOrEqual(savedBaseline.resources.totalCpuBytes);
        await persist(`${tag}-b-loaded.json`, { index: i, state: bSettled });
        phase = `${tag}/cut2`;
        const again = await cut(`${tag}-cut2`, "cut-2", 1, saved);
        expect(again.digest).toBe(second.digest);
        expect(again.tool.receipts).toBe(2);
        await compareSave(record);
        within(0);
        await persist(`${tag}.json`, { index: i, outcome: "PASS_COMPLETE", aBefore: a, aAfterRejection: rejected,
          bLoaded: bSettled, aAfterCut2: again, saveSha256: record.sha256 });
        completed += 1;
      }
      within(0); // The 45-minute population includes seed and all 50 persisted indices, not cleanup.
      phase = "final-disposal";
      await inspect();
      const idle = await observe(); assertSafe(idle);
      expect(idle.physics.status).toBe("Paused");
      expect(idle.physics.moving.state).toBe("Idle");
      expect(idle.physics.neighborTransaction).toBe("Idle");
      expect(idle.physics.bodyResidencyTransaction).toBe("Idle");
      expect(idle.tool.queued).toBe(0);
      expect(idle.neighbor?.busy).toBe(false);
      expect(idle.neighbor?.recoveryHold).toBe(false);
      expect(await page.getByRole("button", { name: "Sitzung beenden", exact: true }).isEnabled()).toBe(true);
      await persist("before-disposal.json", { completed, state: idle });
      page.once("dialog", dialog => dialog.accept());
      await page.getByRole("button", { name: "Sitzung beenden", exact: true }).click();
      await expect(page.locator("#hvp-ended")).toContainText("Hestia-Sitzung beendet", { timeout: 30_000 });
      const disposal = await page.evaluate(() => JSON.parse(document.body.dataset.hestiaPrototypeDisposal!));
      expect(disposal).toMatchObject({ state: "Disposed", errors: [] });
      for (const field of ["geometries", "materials", "textures", "workers", "listeners", "timers", "pendingJobs", "bodies", "colliders", "ownedBytes"]) {
        expect(disposal.disposed[field], field).toBe(0);
      }
      await persist("disposal.json", disposal);
      expect(errors).toEqual([]);
    } catch (error) {
      failure = error;
      let lastObserved: Snapshot | null = null;
      try { lastObserved = await read(page); } catch { /* The first failure and durable prefixes remain authoritative. */ }
      try { await persist("first-failure.json", { index, phase, atUtc: new Date().toISOString(),
        errorType: error instanceof Error ? error.name : "Unknown",
        errorMessage: error instanceof Error ? error.message.split(/\r?\n/, 1)[0]?.slice(0, 500) : "Unknown",
        completed, markers: currentMarkers, markerDrops: currentMarkerDrops,
        contactSamples: currentContactSamples, contactPersistenceError,
        lastObserved }); } catch { /* Keep the first error and already durable phase files. */ }
    } finally {
      try { await persist("run-result.json", { status: failure ? "FAIL" : "PASS_50_WITH_DISPOSAL",
        expectedCycles: 50, completedCycles: completed, firstFailedIndex: failure ? index : null, phase,
        atUtc: new Date().toISOString(), productDisposalProven: !failure,
        gcEvents: "NOT_PROVEN", actualGpuBytes: "NOT_PROVEN", privatePoolHistory: "NOT_PROVEN" }); }
      catch (error) { failure ??= error; }
    }
    if (failure) { throw failure; }
  });
});
