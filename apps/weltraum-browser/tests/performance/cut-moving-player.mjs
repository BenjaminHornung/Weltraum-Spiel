// Player-route correctness probe. Point at a built app served by a local HTTP server.
import assert from "node:assert/strict";
import {setTimeout as delay} from "node:timers/promises";
import {chromium} from "playwright";
import {startMovingThreadCpu} from "./cut-moving-thread-cpu.mjs";

const [url, ...options] = process.argv.slice(2);
if (!url || options.some(o => !["--allow-user-resume", "--pause-after-moving-click"].includes(o))) {
  throw Error("Usage: node tests/performance/cut-moving-player.mjs URL [--allow-user-resume] [--pause-after-moving-click]");
}
const allowResume = options.includes("--allow-user-resume");
const pauseAfterClick = options.includes("--pause-after-moving-click");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_BIN,
  args: process.env.HVP_SOFTWARE_RENDERER === "1" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : []
});
const viewport = {width: Number(process.env.HVP_PLAYER_WIDTH ?? 640), height: Number(process.env.HVP_PLAYER_HEIGHT ?? 400)};
const page = await browser.newPage({viewport});
page.setDefaultTimeout(10000);
const cdp = await page.context().newCDPSession(page);
const report = {browser: browser.version(), viewport, allowResume, pauseAfterClick, pageErrors: [], consoleErrors: [], consoleWarnings: [], workerPlan: [], resumes: [], referenceDeviceVerified: false};
const progress = text => { if(process.env.HVP_PLAYER_PROGRESS === "1") console.error(new Date().toISOString(),text); };
page.on("pageerror", error => {report.pageErrors.push(error.message);progress("Page error "+error.message);});
page.on("worker", worker=>progress("Worker "+worker.url()));
page.on("console", message => {
  if (message.type() === "debug" && message.text().startsWith("hvp-owned-body-plan-budget ")) {
    report.workerPlan.push(JSON.parse(message.text().slice("hvp-owned-body-plan-budget ".length)));
  }
  const entries = message.type() === "error" ? report.consoleErrors : message.type() === "warning" ? report.consoleWarnings : undefined;
  if (entries && entries.length < 32) entries.push(message.text().slice(0, 500));
});

await page.addInitScript(() => {
  // Observe actual browser events and the normal HUD's worker clock across resumes.
  const clicks = [], holds = new Map(), phases = [];
  new PerformanceObserver(batch => {
    for (const entry of batch.getEntries()) {
      if (entry.detail?.data?.commandId?.startsWith("moving-cut-") && phases.length < 1024) {
        phases.push({name:entry.name, start:entry.startTime, duration:entry.duration, activeMs:entry.detail.data.activeMs, count:entry.detail.data.count, thread:entry.detail.data.thread, command:entry.detail.data.commandId});
      }
    }
  }).observe({type:"measure"});
  window.addEventListener("mousedown", e => clicks.push({
    target: e.target.id, locked: document.pointerLockElement?.id, trusted: e.isTrusted,
    absoluteMs: performance.timeOrigin + e.timeStamp, x: e.clientX, y: e.clientY,
    handled: e.defaultPrevented, tick: JSON.parse(document.body.dataset.hestiaPrototypePhysics).ticks,
    native: JSON.parse(document.body.dataset.hestiaPrototypePhysics).status
  }));
  new MutationObserver(() => {
    const raw = document.body?.dataset.hestiaPrototypePhysicsClock;
    if (raw) for (const hold of JSON.parse(raw)?.holdTransitions ?? []) holds.set(hold.origin + hold.at, hold);
  }).observe(document, {subtree: true, attributes: true, attributeFilter: ["data-hestia-prototype-physics-clock"]});
  window.readObservedPlayerInput = () => ({clicks, holds: [...holds.values()], phases});
});
const read = () => page.evaluate(() => {
  const d = document.body.dataset, native = JSON.parse(d.hestiaPrototypePhysics);
  const fragment = native.terrainFragments[0];
  return {
    status: native.status, tick: native.ticks, transaction: native.terrainTransaction,
    generation: native.terrainGeneration, rootViewGeneration: Number(d.hestiaPrototypeTerrainGeneration),
    lastNativeCommand: JSON.parse(d.hestiaPrototypePhysicsClock ?? "{}")?.lastCommand,
    manualBodyHold: JSON.parse(d.hestiaPrototypePhysicsClock ?? "{}")?.lastBodyManualPause,
    fragments: native.terrainFragments, bodyCount: native.bodyCount, owners: native.bodies.map(b => b.ownerId),
    body: native.bodies.find(b => b.ownerId === fragment?.ownerId), moving: native.moving,
    player: native.player, tool: JSON.parse(d.hestiaPrototypeTool), camera: JSON.parse(d.hestiaPrototypePlayerCamera ?? "null"),
    open: !!document.querySelector("#hvp-player-pause")?.open, locked: document.pointerLockElement?.id,
    bridge: "TestBridge" in window
  };
});
let finishThreadTrace;
const pressButton = name => page.getByRole("button", {name, exact: true}).press("Enter");
let lastResume = 0;
async function handleHold(s) {
  if (!(s.open || s.status === "SimulationHold")) return;
  if (!allowResume) throw Error("Player session paused before both cuts completed");
  if (s.transaction !== "Idle" || ["PreparedHeld", "CommittedHeld", "RecoveryHold"].includes(s.moving.state) || Date.now() - lastResume < 1500) return;
  assert.ok(report.resumes.length < 6, "Player could not keep the session running");
  if (!s.open && s.locked) await page.keyboard.press("Escape");
  const resume = page.getByRole("button", {name: "Spiel fortsetzen", exact: true});
  if (await resume.isVisible()) {
    report.resumes.push({tick: s.tick, status: s.status});
    await resume.press("Enter");
    lastResume = Date.now();
  }
}
async function waitState(label, select, timeout) {
  report.phase = label;progress(label);
  const expires = Date.now() + timeout;
  while (Date.now() < expires) {
    const s = await read();
    const value = await select(s);
    if (value) return value;
    if (!(report.playerPauseRequested && s.open)) await handleHold(s);
    await delay(20);
  }
  throw Error("Timed out waiting for " + label);
}
async function steer(orientation, eye, body) {
  const [qx, qy, qz, qw] = orientation;
  const [x, y, z] = [body.x - eye.x, body.y - eye.y - .75, body.z - eye.z];
  const lookX = -2 * (qx * qz + qw * qy), lookY = 2 * (qw * qx - qy * qz), lookZ = 2 * (qx * qx + qy * qy) - 1;
  const yawDelta = Math.atan2(-x, -z) - Math.atan2(-lookX, -lookZ);
  const pitchDelta = Math.asin(y / Math.hypot(x, y, z)) - Math.asin(Math.max(-1, Math.min(1, lookY)));
  const step = Math.PI / 90;
  const yaw = Math.round(-Math.atan2(Math.sin(yawDelta), Math.cos(yawDelta)) / step);
  const pitch = Math.round(-pitchDelta / step);
  const keys = [];
  for (const [count, key] of [[yaw, yaw > 0 ? "ArrowRight" : "ArrowLeft"], [pitch, pitch > 0 ? "ArrowDown" : "ArrowUp"]]) {
    if (!count) continue;
    for (let i = 0; i < Math.abs(count); i++) {
      keys.push(cdp.send("Input.dispatchKeyEvent", {type: "rawKeyDown", key, code: key, autoRepeat: i > 0}));
    }
    keys.push(cdp.send("Input.dispatchKeyEvent", {type: "keyUp", key, code: key}));
  }
  await Promise.all(keys);
}
try {
  const scenario = new URL(url);
  report.measurementsEnabled = process.env.HVP_PLAYER_MEASURE !== "0";
  scenario.search = new URLSearchParams({hestiaPrototype:"1",hvpScenario:"rock-arm",...(report.measurementsEnabled?{hvpMeasure:"1"}:{})});
  report.phase = "startup";
  await page.goto(scenario.href, {waitUntil: "domcontentloaded", timeout: 30000});
  let ready=false;
  for(let attempt=0;attempt<150;attempt++){
    const state=await page.evaluate(()=>document.querySelector("#hvp-state")?.textContent??document.body.innerText.slice(0,450));
    if(state?.includes("State: Ready")){ready=true;break;}
    if(attempt%10===0)progress("Startup "+state);
    if(state?.includes("State: Failed")||state?.includes("Fehler"))throw Error(state);
    await delay(1000);
  }
  assert.ok(ready,"Product did not publish Ready");
  progress("Ready");
  const initial = await read();
  assert.equal(initial.generation, 0);
  assert.equal(initial.fragments.length, 0);
  report.phase = "select support and enter player mode";
  if (process.env.HVP_PLAYER_SIMPLE_EFFECTS === "1") {
    for (const id of ["hvp-ao-toggle", "hvp-water-toggle"]) {
      const control = page.locator("#"+id);
      if (await control.getAttribute("aria-pressed") === "true") await control.press("Enter");
    }
    report.reducedPresentation = true;
  }
  await pressButton("Stütze anvisieren (2 + Klick)");
  await pressButton("Spielen · WASD / Maus / Space");
  const firstClick = await waitState("normal support preview", async s => {
    if (s.open || !s.locked || s.status !== "Running" || !s.player.grounded || !s.tool.message.startsWith("64 Stützzellen")) return;
    await page.mouse.down();
    await page.mouse.up();
    const delivered = await page.evaluate(() => window.readObservedPlayerInput().clicks.at(-1));
    if (delivered?.trusted && delivered.locked === "debug-scene" && delivered.target === "debug-scene" && delivered.handled) return delivered;
    if (allowResume && delivered?.target === "hvp-player-pause" && !delivered.handled) return;
    throw Error("Support click did not reach an active player");
  }, 30000);
  if (process.env.HVP_MOVING_THREAD_CPU === "1") finishThreadTrace = await startMovingThreadCpu(page);
  let lastSteer = 0;
  const first = await waitState("fall and native moving-body hit", async s => {
    const [fragment] = s.fragments;
    if (!fragment || s.open || !s.tool.message || s.lastNativeCommand === "Play" || s.tool.last?.status !== "Applied" || s.transaction !== "Idle" || s.status !== "Running" || !s.locked) return;
    if (!s.body || s.body.position.y >= -8 + fragment.centerOfMass.y - .2) return;
    if (s.moving.preview?.ownerId === fragment.ownerId && s.tool.message.startsWith("Loses Fragment")) {
      await cdp.send("Input.dispatchMouseEvent", {type:"mousePressed", button:"left", buttons:1, clickCount:1, x:firstClick.x, y:firstClick.y});
      await cdp.send("Input.dispatchMouseEvent", {type:"mouseReleased", button:"left", buttons:0, clickCount:1, x:firstClick.x, y:firstClick.y});
      const delivered = await page.evaluate(() => window.readObservedPlayerInput().clicks.at(-1));
      if (delivered?.target === "debug-scene" && delivered.locked === "debug-scene" && delivered.trusted && delivered.handled) {
        if (pauseAfterClick) {
          const admitted = await waitState("native moving admission before player pause", current =>
            current.moving.pendingId === "moving-cut-1" && current.status === "Running" || current.tool.moving.last, 30000);
          if (admitted === true) {
            await page.keyboard.press("Escape");
            report.playerPauseRequested = true;
            if (process.env.HVP_MOVING_THREAD_CPU === "after-admission") finishThreadTrace = await startMovingThreadCpu(page);
          }
        }
        return s;
      }
      if (allowResume && delivered?.target === "hvp-player-pause" && !delivered.handled) return;
      throw Error("Moving click did not reach an active player");
    }
    if (s.camera && Date.now() - lastSteer > 350) {
      await steer(s.camera.orientation, s.player.position, s.body.position);
      lastSteer = Date.now();
    }
  }, 90000);
  const [fragment] = first.fragments;
  report.first = {receipt: first.tool.last, fragment, fallenPose: first.body.position, hit: first.moving.preview};
  assert.equal(first.bodyCount, initial.bodyCount + 1);
  assert.equal(first.generation, 1);
  assert.equal(first.tool.last.removedCells, 64);
  assert.equal(first.tool.last.materialRemovedKg, 300);
  assert.equal(first.tool.last.transferredCells, fragment.cellCount);
  assert.equal(first.tool.last.transferredMassKg, fragment.massKg);
  assert.equal(fragment.cellCount, 384);
  assert.equal(fragment.massKg, 1722.65625);
  report.clicksAtIssue = await page.evaluate(() => window.readObservedPlayerInput().clicks);
  const after = await waitState("second player receipt", s => s.tool.moving.last ? s : null, 60000);
  const recut = after.moving.last;
  report.recut = recut;
  report.toolReceipt = after.tool.moving.last;
  assert.equal(report.toolReceipt?.status, "Applied", report.toolReceipt?.reason);
  assert.equal(recut?.status, "Applied");
  assert.equal(recut.parentId, fragment.ownerId);
  assert.ok(recut.commitTick >= recut.issuedTick);
  assert.ok(recut.removedCells > 0);
  assert.equal(after.moving.state, "Idle");
  assert.ok(!after.owners.includes(fragment.ownerId));
  const children = after.fragments.filter(f => recut.children.includes(f.ownerId));
  report.children = children;
  assert.equal(children.length, recut.children.length);
  assert.equal(children.reduce((total, f) => total + f.cellCount, recut.removedCells), fragment.cellCount);
  assert.ok(Math.abs(children.reduce((total, f) => total + f.massKg, recut.removedMassKg) - fragment.massKg) < .00001);
  assert.equal(after.generation, first.generation);
  assert.equal(after.rootViewGeneration, first.rootViewGeneration);
  report.manuallyPausedDuringStage = after.manualBodyHold;
  if (pauseAfterClick && report.measurementsEnabled) assert.equal(after.manualBodyHold, true);
  report.rootRevision = after.generation;
  report.testBridgePresent = after.bridge;
  assert.equal(after.bridge, false);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  const observed = await page.evaluate(() => window.readObservedPlayerInput());
  assert.equal(observed.clicks.filter(click => click.trusted && click.target === "debug-scene" && click.locked === "debug-scene").length, 2);
  if (!allowResume) {assert.equal(report.measurementsEnabled, true, "Strict hold history requires worker measurements");assert.deepEqual(observed.holds, []);}
  report.passed = true;
} catch (error) {
  report.error = String(error.stack ?? error);
  progress(report.error);
  const terminal = await Promise.race([read().catch(() => null), delay(3000).then(()=>null)]);
  if (terminal) report.terminal = {status: terminal.status, moving: terminal.moving, tool: terminal.tool, tick: terminal.tick};
  process.exitCode = 1;
} finally {
  report.input = await Promise.race([page.evaluate(() => window.readObservedPlayerInput()).catch(() => null),delay(3000).then(()=>null)]);
  if (finishThreadTrace) report.threadCpu = await finishThreadTrace(report.input?.phases ?? []).catch(e => ({sampled:false, message:String(e)}));
  report.worker = page.workers().find(w => w.url().includes("physicsWorker"))?.url();
  if (report.input) {
    const first = report.input.clicks.find(c => c.handled && c.trusted);
    report.holdsAfterFirstClick = report.input.holds.filter(h => first && h.origin + h.at >= first.absoluteMs);
  }
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
