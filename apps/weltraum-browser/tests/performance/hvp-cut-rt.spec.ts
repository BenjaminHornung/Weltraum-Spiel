import {test, expect, type Browser, type Page} from "@playwright/test";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {mkdir, readFile, readdir, stat, writeFile} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {Quaternion, Vector3} from "three";
import type {HvpPhysicsClock, HvpPhysicsSnapshot} from "../../src/hestia-prototype/physics/physicsWorker";
import type {createHvpPlasmaTool} from "../../src/hestia-prototype/terrain/plasmaTool";
import {readHvpCutMarkers, summarizeHvpCuts, type HvpCutRawEntry, type HvpCutSample} from "./hvpCutRtReport";

const variants = [
  {id: "quarry-box", scenario: "quarry", mode: 2, motion: "static"},
  {id: "quarry-sphere", scenario: "quarry", mode: 3, motion: "static"},
  {id: "rock-arm", scenario: "rock-arm", mode: 2, motion: "static"},
  {id: "body-box-moving", scenario: "body-box", mode: 2, motion: "moving"},
  {id: "body-box-sleeping", scenario: "body-box", mode: 2, motion: "sleeping"},
  {id: "body-sphere-moving", scenario: "body-sphere", mode: 3, motion: "moving"},
  {id: "body-sphere-sleeping", scenario: "body-sphere", mode: 3, motion: "sleeping"}
] as const;
type Variant = (typeof variants)[number];
type ToolState = ReturnType<ReturnType<typeof createHvpPlasmaTool>["read"]>;
type Snapshot = {
  origin: number; now: number; root: number; digest: string; physics: HvpPhysicsSnapshot; clock: HvpPhysicsClock | null;
  tool: ToolState; camera: {orientation: number[]} | null; save: {state: string; revision: number};
  health: {enabled: boolean; errors: number; dropped: number; cutObservation: {status: string; drops: number}};
  resources: {totalCpuBytes: number; ledger: {triangles: number; drawCalls: number; retainedMeshBytes: number};
    caps: {maxCpuBytes: number; maxMeshBytes: number; maxTriangles: number; maxDrawCalls: number}};
  visible: string; focused: boolean; locked: boolean; testBridge: boolean; inputError: string | null; pauseDialogOpen: boolean;
};
type Raw = {entries: HvpCutRawEntry[]; dropped: number};
type CutResult = {sample: HvpCutSample | null; before: Snapshot | null; after: Snapshot | null;
  raw: Raw; problems: string[]; phase: string; commandId: string | null};
const baseUrl = "http://127.0.0.1:5173";
const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const shell = (command: string) => execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command],
  {encoding: "utf8", timeout: 20_000, windowsHide: true}).trim();
const power = () => shell("powercfg /getactivescheme");
const powerSource = () => shell("Get-CimInstance -Namespace root/wmi -ClassName BatteryStatus | Select-Object PowerOnline,Charging,Discharging | ConvertTo-Json -Compress");
const inventory = async (root: string): Promise<{path: string; sha256: string}[]> => {
  const files: {path: string; sha256: string}[] = [];
  for (const entry of await readdir(root, {withFileTypes: true})) {
    const file = path.join(root, entry.name);
    if (entry.isSymbolicLink()) { throw new Error("Measurement source/build symlink is not supported"); }
    if (entry.isDirectory()) { files.push(...await inventory(file)); }
    else if (entry.isFile()) { files.push({path: file.replaceAll("\\", "/"), sha256: sha(await readFile(file))}); }
  }
  return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
};
const read = (page: Page): Promise<Snapshot> => page.evaluate(() => ({
  origin: performance.timeOrigin, now: performance.now(), root: Number(document.body.dataset.hestiaPrototypeTerrainGeneration),
  digest: document.body.dataset.hestiaPrototypeSourceDigest!, physics: JSON.parse(document.body.dataset.hestiaPrototypePhysics!),
  clock: JSON.parse(document.body.dataset.hestiaPrototypePhysicsClock ?? "null"), tool: JSON.parse(document.body.dataset.hestiaPrototypeTool!),
  camera: JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera ?? "null"), save: JSON.parse(document.body.dataset.hestiaPrototypeSave ?? "null"),
  health: JSON.parse(document.body.dataset.hestiaPrototypeMeasurements ?? "null"), resources: JSON.parse(document.body.dataset.hestiaPrototypeResources!),
  visible: document.visibilityState, focused: document.hasFocus(), locked: document.pointerLockElement?.id === "debug-scene", testBridge: "TestBridge" in window,
  inputError: document.body.dataset.hestiaPrototypeInputError ?? null,
  pauseDialogOpen: document.querySelector("#hvp-player-pause")?.hasAttribute("open") ?? false
}));
const drain = (page: Page): Promise<Raw> => page.evaluate(() => {
  const collect = (window as unknown as {hvpCutRtDrain?: () => Raw}).hvpCutRtDrain;
  if (!collect) { throw new Error("Cut observation collector missing"); }
  return collect();
});
const installCollector = (page: Page) => page.addInitScript(() => {
  const entries: HvpCutRawEntry[] = [];
  let dropped = 0;
  const collect = (values: PerformanceEntry[]) => {
    for (const entry of values) {
      if (!entry.name.startsWith("hvp.cut") && entry.name !== "hvp.frameIntervalMs" && entry.name !== "hvp.resources") { continue; }
      if (entries.length >= 8192) { dropped += 1; continue; }
      entries.push({name: entry.name, start: entry.startTime, duration: entry.duration, detail: (entry as PerformanceMeasure).detail});
    }
  };
  const observer = new PerformanceObserver(list => collect(list.getEntries()));
  observer.observe({type: "measure"});
  Object.defineProperty(window, "hvpCutRtDrain", {value: () => {
    collect(observer.takeRecords());
    const result = {entries: entries.splice(0), dropped}; dropped = 0; return result;
  }});
});
const ready = async (page: Page, url: string) => {
  await page.goto(baseUrl + url); await page.bringToFront();
  await expect(page.locator("#hvp-state")).toContainText("State: Ready", {timeout: 30_000});
};
const inspect = async (page: Page) => {
  if ((await read(page)).locked) { await page.keyboard.press("Escape"); }
  const control = page.getByRole("button", {name: "Zur Inspektionsansicht", exact: true});
  if (await control.isVisible()) { await control.click(); }
  await expect.poll(async () => (await read(page)).physics.status, {timeout: 10_000}).toBe("Paused");
};
const play = async (page: Page) => {
  await page.getByRole("button", {name: "Spielen · WASD / Maus / Space", exact: true}).click();
  try { await expect.poll(async () => (await read(page)).locked, {timeout: 10_000}).toBe(true); }
  catch (error) {
    const state = await read(page);
    throw new Error(`Normal play did not lock: ${JSON.stringify({inputError: state.inputError, pauseDialogOpen: state.pauseDialogOpen,
      save: state.save, player: state.physics.player?.status, physics: state.physics.status})}`, {cause: error});
  }
  await expect.poll(async () => (await read(page)).physics.player?.status, {timeout: 10_000}).toBe("Walking");
};
const aimBody = async (page: Page, ownerId: string) => {
  await expect.poll(async () => (await read(page)).camera, {timeout: 10_000}).toBeTruthy();
  const cursor = {x: 640, y: 360};
  for (let i = 0; i < 12; i += 1) {
    const state = await read(page), body = state.physics.bodies.find(value => value.ownerId === ownerId);
    if (!body || !state.physics.player || !state.camera) { throw new Error("Body aim source/pose unavailable"); }
    const eye = new Vector3(state.physics.player.position.x, state.physics.player.position.y + .75, state.physics.player.position.z);
    const desired = new Vector3(body.position.x, body.position.y, body.position.z).sub(eye).normalize();
    const forward = new Vector3(0, 0, -1).applyQuaternion(new Quaternion().fromArray(state.camera.orientation));
    if (desired.dot(forward) > .999 && state.physics.moving.preview?.ownerId === ownerId) { break; }
    const yaw = Math.atan2(-desired.x, -desired.z) - Math.atan2(-forward.x, -forward.z);
    cursor.x -= Math.atan2(Math.sin(yaw), Math.cos(yaw)) / .002;
    cursor.y -= (Math.asin(desired.y) - Math.asin(forward.y)) / .002;
    await page.mouse.move(cursor.x, cursor.y);
    await expect.poll(async () => (await read(page)).physics.ticks).toBeGreaterThan(state.physics.ticks);
  }
  await expect.poll(async () => (await read(page)).physics.moving.preview?.ownerId, {timeout: 10_000}).toBe(ownerId);
};
const sourceFacts = (state: Snapshot) => ({root: state.root, digest: state.digest,
  fragments: state.physics.terrainFragments.map(value => ({ownerId: value.ownerId, sourceDigest: value.sourceDigest,
    cellCount: value.cellCount, massKg: value.massKg}))});
const makeCheckpoint = async (page: Page, variant: Variant) => {
  await ready(page, `/?hestiaPrototype=1${variant.scenario === "quarry" ? "" : "&hvpScenario=rock-arm"}`);
  await page.getByRole("button", {name: variant.scenario === "quarry" ? "Ansicht: Schnittstelle" : "Stütze anvisieren (2 + Klick)", exact: true}).click();
  await play(page);
  await expect.poll(async () => (await read(page)).physics.player?.grounded).toBe(true);
  await page.keyboard.press(`Digit${variant.mode}`);
  if (variant.scenario.startsWith("body-")) {
    await page.keyboard.press("Digit2");
    await expect.poll(async () => (await read(page)).tool.message).toContain("Stützzellen");
    await page.mouse.down(); await page.mouse.up();
    await expect.poll(async () => (await read(page)).tool.last?.status, {timeout: 30_000}).toBe("Applied");
    await expect.poll(async () => {
      const state = await read(page), owner = state.physics.terrainFragments[0]?.ownerId;
      return state.physics.bodies.find(body => body.ownerId === owner)?.sleeping;
    }, {timeout: 20_000}).toBe(true);
  }
  await inspect(page);
  const saved = await read(page);
  await page.getByRole("button", {name: "Spielstand speichern", exact: true}).click();
  await expect.poll(async () => (await read(page)).save?.state, {timeout: 30_000}).toBe("Saved");
  return sourceFacts(saved);
};
const prepareCut = async (page: Page, variant: Variant) => {
  const bodyCut = variant.scenario.startsWith("body-");
  await page.getByRole("button", {name: variant.scenario === "quarry" ? "Ansicht: Schnittstelle" : "Stütze anvisieren (2 + Klick)", exact: true}).click();
  await play(page); await page.keyboard.press(`Digit${variant.mode}`);
  await expect.poll(async () => (await read(page)).physics.player?.grounded).toBe(true);
  if (bodyCut) {
    const owner = (await read(page)).physics.terrainFragments[0]?.ownerId;
    if (!owner) { throw new Error("Saved body fixture is missing"); }
    await aimBody(page, owner);
    if (variant.motion === "moving") {
      await page.keyboard.press("KeyF");
      await expect.poll(async () => (await read(page)).physics.bodies.find(body => body.ownerId === owner)?.sleeping).toBe(false);
    } else {
      await expect.poll(async () => (await read(page)).physics.bodies.find(body => body.ownerId === owner)?.sleeping).toBe(true);
    }
  } else {
    await expect.poll(async () => (await read(page)).tool.message).toContain(variant.scenario === "quarry" ? "sicherer Steinbruch" : "Stützzellen");
  }
};
const verifyCut = (variant: Variant, before: Snapshot, after: Snapshot, binding: Readonly<Record<string, unknown>> | null) => {
  expect(after.testBridge).toBe(false);
  expect(after.physics.status).toBe("Running");
  expect(after.resources.totalCpuBytes).toBeLessThanOrEqual(after.resources.caps.maxCpuBytes);
  expect(after.resources.ledger.triangles).toBeLessThanOrEqual(after.resources.caps.maxTriangles);
  expect(after.resources.ledger.drawCalls).toBeLessThanOrEqual(after.resources.caps.maxDrawCalls);
  expect(after.resources.ledger.retainedMeshBytes).toBeLessThanOrEqual(after.resources.caps.maxMeshBytes);
  expect(binding).toMatchObject({savedRevision: after.root, savedDigest: after.digest, nativeGeneration: after.root,
    rootIdentityMatches: true, activeKeysMatch: true, visibleKeysMatch: true, nativeGenerationMatches: true, recoveryHold: false});
  if (variant.scenario.startsWith("body-")) {
    const receipt = after.physics.moving.last;
    if (!receipt) { throw new Error("Native moving receipt missing"); }
    expect(after.root).toBe(before.root); expect(after.digest).toBe(before.digest);
    expect(after.physics.moving.state).toBe("Idle"); expect(receipt.status).toBe("Applied");
    expect(after.physics.moving.sequence).toBe(before.physics.moving.sequence + 1);
    expect(after.physics.bodies.some(body => body.ownerId === receipt.parentId)).toBe(false);
    const parent = before.physics.terrainFragments.find(body => body.ownerId === receipt.parentId);
    if (!parent) { throw new Error("Actual measured parent source missing"); }
    const children = receipt.children.map(id => {
      const child = after.physics.terrainFragments.find(body => body.ownerId === id);
      if (!child) { throw new Error("Actual native child missing"); }
      return child;
    });
    expect(children.reduce((sum, child) => sum + child.cellCount, receipt.removedCells)).toBe(parent.cellCount);
    expect(Math.abs(children.reduce((sum, child) => sum + child.massKg, receipt.removedMassKg) - parent.massKg)).toBeLessThanOrEqual(1e-8);
    expect(binding).toMatchObject({bodySequence: after.physics.moving.sequence, parentId: receipt.parentId, outcomeIdentityMatches: true});
    expect(binding?.children).toEqual(children.map(child => expect.objectContaining({ownerId: child.ownerId,
      sourceDigest: child.sourceDigest, renderKey: expect.any(String)})));
    const renderKeys = (binding?.children as {ownerId: string; renderKey: string}[]).map(child => {
      expect(child.renderKey).toMatch(/^hvp:/);
      expect(child.renderKey).not.toBe(child.ownerId);
      return child.renderKey;
    });
    expect(new Set(renderKeys).size).toBe(renderKeys.length);
    expect(binding?.activeBodyKeys).toEqual(expect.arrayContaining(renderKeys));
  } else {
    expect(after.root).toBe(before.root + 1); expect(after.physics.terrainGeneration).toBe(after.root);
    expect(after.physics.terrainTransaction).toBe("Idle");
    expect(after.tool.last?.removedCells).toBeGreaterThan(0); expect(after.tool.last?.removedCells).toBeLessThanOrEqual(512);
    if (variant.scenario === "rock-arm") { expect(after.tool.last?.transferredCells).toBeGreaterThan(0); }
  }
};
const cut = async (page: Page, variant: Variant, temperature: HvpCutSample["temperature"]): Promise<CutResult> => {
  const result: CutResult = {sample: null, before: null, after: null, raw: {entries: [], dropped: 0}, problems: [], phase: "precondition", commandId: null};
  const body = variant.scenario.startsWith("body-"), prefix = body ? "hvp.cutBody" : "hvp.cut";
  try {
    await prepareCut(page, variant); await drain(page); result.before = await read(page);
    expect(result.before).toMatchObject({visible: "visible", focused: true, locked: true, testBridge: false});
    expect(result.before.health).toMatchObject({enabled: true, errors: 0, dropped: 0, cutObservation: {status: "armed", drops: 0}});
    if (body) {
      const parent = result.before.physics.bodies.find(value => value.ownerId === result.before!.physics.moving.preview?.ownerId);
      if (!parent) { throw new Error("No actual parent at the measured input"); }
      expect(parent.sleeping).toBe(variant.motion === "sleeping");
    }
    result.phase = "input"; await page.mouse.down(); await page.mouse.up();
    result.phase = "await-terminal";
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const batch = await drain(page); result.raw.entries.push(...batch.entries); result.raw.dropped += batch.dropped;
      const input = result.raw.entries.find(entry => entry.name === `${prefix}InputMs`);
      if (typeof input?.detail?.data?.commandId === "string") { result.commandId = input.detail.data.commandId; }
      if (result.commandId) {
        const markers = readHvpCutMarkers(result.raw.entries, result.commandId, body);
        if (markers.outcome && (markers.outcome !== "Applied" || markers.firstCommittedRenderSubmitMs !== null)) { break; }
      }
      await page.waitForTimeout(50);
    }
    result.after = await read(page);
    const last = await drain(page); result.raw.entries.push(...last.entries); result.raw.dropped += last.dropped;
    result.phase = "verify";
    if (!result.commandId) { throw new Error("No real command-bound input observed; no synthetic sample created"); }
    const markers = readHvpCutMarkers(result.raw.entries, result.commandId, body);
    result.problems.push(...markers.problems);
    const inputs = result.raw.entries.filter(entry => entry.name === "hvp.cutInputMs" || entry.name === "hvp.cutBodyInputMs");
    if (inputs.length !== 1 || inputs[0]?.detail?.data?.commandId !== result.commandId) {
      result.problems.push("Expected exactly one actual command input in this measured attempt");
    }
    const observed = body ? result.after.tool.moving?.last : result.after.tool.last;
    const observedId = observed && ("id" in observed ? observed.id : observed.commandId);
    let outcome: HvpCutSample["outcome"] = markers.outcome ?? "Timeout";
    if (!markers.outcome && observedId === result.commandId) {
      const status = observed!.status;
      if (status !== "Applied" && status !== "NoOp" && status !== "Rejected" && status !== "RecoveryHold") {
        throw new Error("Unknown actual consumer outcome");
      }
      outcome = status;
    }
    if (markers.inputMs !== null) {
      result.sample = {commandId: result.commandId, scenario: variant.scenario, temperature, outcome,
        inputMs: markers.inputMs, appliedMs: markers.appliedMs, firstCommittedRenderSubmitMs: markers.firstCommittedRenderSubmitMs,
        holdMs: !body && result.after.clock?.lastTerrainCommandId === result.commandId ? result.after.clock.lastTerrainHoldMs ?? null : null,
        sourceGenerationBefore: result.before.root, sourceGenerationAfter: outcome === "Timeout" ? null : result.after.root,
        reason: observedId === result.commandId ? observed!.reason : "No confirmed terminal before the deadline"};
    }
    expect(result.after.origin).toBe(result.before.origin);
    expect(result.after).toMatchObject({visible: "visible", focused: true, testBridge: false});
    expect(result.after.health).toMatchObject({enabled: true, errors: 0, dropped: 0, cutObservation: {status: "armed", drops: 0}});
    expect(result.raw.dropped).toBe(0); expect(markers.problems).toEqual([]);
    expect(outcome).toBe("Applied"); expect(markers.appliedMs).not.toBeNull(); expect(markers.firstCommittedRenderSubmitMs).not.toBeNull();
    if (markers.inputMs !== null && markers.appliedMs !== null && markers.appliedMs - markers.inputMs > 30_000) {
      result.problems.push("Applied arrived beyond the declared terminal deadline; retained as late evidence, not a timely success");
    }
    expect(observedId).toBe(result.commandId); expect(observed?.status).toBe(outcome);
    verifyCut(variant, result.before, result.after, markers.renderBinding);
    result.phase = "complete";
  } catch (error) {
    result.problems.push(String(error));
    try {
      result.after = await read(page); const batch = await drain(page);
      result.raw.entries.push(...batch.entries); result.raw.dropped += batch.dropped;
    } catch { /* Retain original failure and every record already collected. */ }
  }
  return result;
};

const profile = async (page: Page) => page.evaluate(() => {
  const gl = document.querySelector<HTMLCanvasElement>("#debug-scene")?.getContext("webgl2");
  const extension = gl?.getExtension("WEBGL_debug_renderer_info");
  if (!gl || !extension) { throw new Error("Actual product GPU identity unavailable"); }
  return {gpu: String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)), width: innerWidth, height: innerHeight,
    dpr: devicePixelRatio, bufferWidth: gl.drawingBufferWidth, bufferHeight: gl.drawingBufferHeight,
    visible: document.visibilityState, focused: document.hasFocus()};
});
const processInfo = async (browser: Browser) => {
  const cdp = await browser.newBrowserCDPSession();
  try {
    const info = await cdp.send("SystemInfo.getProcessInfo"), gpu = await cdp.send("SystemInfo.getInfo");
    const pid = info.processInfo.find(value => value.type === "browser")?.id;
    if (!Number.isSafeInteger(pid) || !pid || pid < 1) { throw new Error("Actual browser PID unavailable"); }
    const startedMs = Number(shell(`([DateTimeOffset](Get-Process -Id ${pid}).StartTime).ToUnixTimeMilliseconds()`));
    if (!Number.isFinite(startedMs) || startedMs <= 0) { throw new Error("Actual browser process start unavailable"); }
    return {pid, startedMs, gpu};
  } finally { await cdp.detach(); }
};

const classification = process.env.WELTRAUM_HVP_CUT_RT_CLASS ?? "diagnostic";
if (classification !== "diagnostic" && classification !== "measurement") { throw new Error("Unknown cut series classification"); }
const schedule = classification === "measurement" ? [34, 33, 33] : [1];
for (const variant of variants) {
  for (const temperature of ["cold", "warm"] as const) {
    for (const [session, attempts] of schedule.entries()) {
      test(`P07 ${variant.id} ${temperature} session ${session + 1}`, async ({playwright}, testInfo) => {
        test.setTimeout(30 * 60_000);
        const root = process.env.WELTRAUM_HVP_MEASURE_DIR, executable = process.env.WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH;
        if (!root || !path.isAbsolute(root) || !executable || !(await stat(executable)).isFile()) { throw new Error("Explicit evidence directory and installed browser required"); }
        const configFile = testInfo.config.configFile;
        if (!configFile) { throw new Error("Actual measurement configuration path is required"); }
        const directory = path.join(root, `${variant.id}-${temperature}-${session + 1}`);
        await mkdir(directory, {recursive: true}); if ((await readdir(directory)).length !== 0) { throw new Error("Refusing to mix or overwrite a previous series"); }
        const source = await inventory("src"), build = await inventory("dist");
        const fixture = await Promise.all(["tests/performance/hvp-cut-rt.spec.ts", "tests/performance/hvpCutRtReport.ts", "tests/e2e/hvp-performance-evidence.ts", "playwright.performance.config.ts", configFile]
          .map(async file => ({path: file, sha256: sha(await readFile(file))})));
        const scheme = power(), supply = powerSource();
        if (!scheme.includes("381b4222-f694-41f0-9685-ff5bb260df2e")) { throw new Error("Reference device is not in its designated Balanced scheme"); }
        const plan = {classification, variant, temperature, session: session + 1, schedule, attempts,
          fixturePolicy: "Authentic normal-UI checkpoint; new document/workers each attempt. Warm: one unmeasured cut then normal hot restore. Moving: actual contact impulse, not a falling-body substitute.",
          timeoutMs: 30_000, width: 1280, height: 720, dpr: 1, trace: false, screenshots: false, video: false,
          head: execFileSync("git", ["rev-parse", "HEAD"], {encoding: "utf8"}).trim(), dirty: execFileSync("git", ["status", "--porcelain"], {encoding: "utf8"}).trim(),
          source, build, fixture, sourceSha256: sha(JSON.stringify(source)), buildSha256: sha(JSON.stringify(build)),
          lockSha256: sha(await readFile("package-lock.json")), wasmSha256: sha(await readFile("node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm")),
          browserSha256: sha(await readFile(executable)), os: `${os.type()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0]?.model,
          ramBytes: os.totalmem(), power: scheme, supply, adapters: JSON.parse(shell("Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion,CurrentRefreshRate,CurrentHorizontalResolution | ConvertTo-Json -Compress"))};
        await writeFile(path.join(directory, "plan.json"), JSON.stringify(plan, null, 2));
        const records = Array.from({length: attempts}, (_, index) => ({attempt: index + 1, status: "not-run", result: null as CutResult | null,
          warmup: null as CutResult | null, problems: [] as string[]}));
        let browser: Browser | undefined, failure: string | undefined;
        try {
          browser = await playwright.chromium.launch({executablePath: executable, headless: false, args: ["--force-device-scale-factor=1"]});
          const identity = await processInfo(browser), context = await browser.newContext({viewport: {width: 1280, height: 720}, deviceScaleFactor: 1});
          await writeFile(path.join(directory, "process.json"), JSON.stringify({version: browser.version(), ...identity}, null, 2));
          const setup = await context.newPage(); const saved = await makeCheckpoint(setup, variant);
          const frozenProfile = await profile(setup);
          expect(frozenProfile).toMatchObject({width: 1280, height: 720, dpr: 1, bufferWidth: 1280, bufferHeight: 720, visible: "visible", focused: true});
          const devices = identity.gpu.gpu.devices.filter(device => device.deviceString.length > 0 && frozenProfile.gpu.includes(device.deviceString));
          if (devices.length !== 1 || !devices[0]!.driverVersion) { throw new Error(`Actual WebGL GPU/driver binding is ambiguous: ${frozenProfile.gpu}`); }
          await writeFile(path.join(directory, "fixture.json"), JSON.stringify({saved, selected: frozenProfile, device: devices[0]}, null, 2)); await setup.close();
          for (const record of records) {
            const page = await context.newPage(); const errors: string[] = [];
            page.on("pageerror", error => errors.push(error.message));
            page.on("console", message => { if (message.type() === "error") { errors.push(message.text()); } });
            record.status = "preparing";
            try {
              await installCollector(page); await ready(page, "/?hestiaPrototype=1&hvpLoad=primary&hvpMeasure=1");
              expect(sourceFacts(await read(page))).toEqual(saved); expect(await profile(page)).toEqual(frozenProfile);
              expect(power()).toBe(scheme); expect(powerSource()).toBe(supply);
              if (temperature === "warm") {
                record.warmup = await cut(page, variant, temperature);
                expect(record.warmup.problems).toEqual([]);
                await inspect(page); await page.getByRole("button", {name: "Spielstand laden", exact: true}).click();
                await expect.poll(async () => (await read(page)).save.state, {timeout: 30_000}).toBe("Loaded");
                expect(sourceFacts(await read(page))).toEqual(saved);
              }
              record.result = await cut(page, variant, temperature);
              record.problems.push(...record.result.problems, ...errors);
              expect(await profile(page)).toEqual(frozenProfile); expect(power()).toBe(scheme); expect(powerSource()).toBe(supply);
              record.status = record.problems.length ? "failed" : "completed";
            } catch (error) { record.status = "failed"; record.problems.push(String(error), ...errors); }
            finally {
              try { await page.close(); } catch (error) { record.status = "failed"; record.problems.push(`Owned page cleanup: ${String(error)}`); }
            }
            await writeFile(path.join(directory, `attempt-${record.attempt}.json`), JSON.stringify(record, null, 2));
            console.log(`P07 ${variant.id}/${temperature}/${session + 1}/${record.attempt}: ${record.status}`);
          }
        } catch (error) { failure = String(error); }
        finally {
          try { await browser?.close(); } catch (error) { failure = `${failure ?? ""}; owned browser cleanup: ${String(error)}`; }
        }
        const samples = records.flatMap(record => record.result?.sample ? [record.result.sample] : []);
        const report = {planSha256: sha(JSON.stringify(plan)), failure, plannedAttempts: attempts, records,
          summary: summarizeHvpCuts(samples), sourceUnchanged: sha(JSON.stringify(await inventory("src"))) === plan.sourceSha256,
          buildUnchanged: sha(JSON.stringify(await inventory("dist"))) === plan.buildSha256,
          performanceAcceptance: "NOT_ASSESSED: aggregate the complete predeclared multi-session population, including every failed/precondition attempt"};
        await writeFile(path.join(directory, "report.json"), JSON.stringify(report, null, 2));
        expect(failure, JSON.stringify(report.summary)).toBeUndefined();
        expect(records.every(record => record.status === "completed"), JSON.stringify(records.map(record => ({attempt: record.attempt, status: record.status, problems: record.problems})))).toBe(true);
        expect(report.sourceUnchanged && report.buildUnchanged).toBe(true);
      });
    }
  }
}
