// Player-route correctness probe. Point at a built app served by a local HTTP server.
import assert from "node:assert/strict";
import {setTimeout as delay} from "node:timers/promises";
import {chromium} from "playwright";

const [url, mode] = process.argv.slice(2);
if (!url || (mode && mode !== "--allow-user-resume")) {
  throw Error("Usage: node tests/performance/cut-moving-player.mjs URL [--allow-user-resume]");
}
const allowResume = mode === "--allow-user-resume";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_BIN,
  args: process.env.HVP_SOFTWARE_RENDERER === "1" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : []
});
const viewport = {width: Number(process.env.HVP_PLAYER_WIDTH ?? 640), height: Number(process.env.HVP_PLAYER_HEIGHT ?? 400)};
const page = await browser.newPage({viewport});
const cdp = await page.context().newCDPSession(page);
const report = {browser: browser.version(), viewport, allowResume, pageErrors: [], resumes: [], referenceDeviceVerified: false};
page.on("pageerror", error => report.pageErrors.push(error.message));

await page.addInitScript(() => {
  // Observe actual browser events and the normal HUD's worker clock across resumes.
  const clicks = [], holds = new Map();
  window.addEventListener("mousedown", e => clicks.push({
    target: e.target.id, locked: document.pointerLockElement?.id, trusted: e.isTrusted,
    absoluteMs: performance.timeOrigin + e.timeStamp, x: e.clientX, y: e.clientY,
    handled: e.defaultPrevented, tick: JSON.parse(document.body.dataset.hestiaPrototypePhysics).ticks,
    native: JSON.parse(document.body.dataset.hestiaPrototypePhysics).status
  }));
  new MutationObserver(() => {
    const raw = document.body?.dataset.hestiaPrototypePhysicsClock;
    if (raw) for (const hold of JSON.parse(raw).holdTransitions ?? []) holds.set(hold.origin + hold.at, hold);
  }).observe(document, {subtree: true, attributes: true, attributeFilter: ["data-hestia-prototype-physics-clock"]});
  window.readObservedPlayerInput = () => ({clicks, holds: [...holds.values()]});
});
const read = () => page.evaluate(() => {
  const d = document.body.dataset, native = JSON.parse(d.hestiaPrototypePhysics);
  const fragment = native.terrainFragments[0];
  return {
    status: native.status, tick: native.ticks, transaction: native.terrainTransaction,
    generation: native.terrainGeneration, rootViewGeneration: Number(d.hestiaPrototypeTerrainGeneration),
    lastNativeCommand: JSON.parse(d.hestiaPrototypePhysicsClock ?? "{}").lastCommand,
    fragments: native.terrainFragments, bodyCount: native.bodyCount, owners: native.bodies.map(b => b.ownerId),
    body: native.bodies.find(b => b.ownerId === fragment?.ownerId), moving: native.moving,
    player: native.player, tool: JSON.parse(d.hestiaPrototypeTool), camera: JSON.parse(d.hestiaPrototypePlayerCamera ?? "null"),
    open: !!document.querySelector("#hvp-player-pause")?.open, locked: document.pointerLockElement?.id,
    bridge: "TestBridge" in window
  };
});
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
  const expires = Date.now() + timeout;
  while (Date.now() < expires) {
    const s = await read();
    const value = await select(s);
    if (value) return value;
    await handleHold(s);
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
  scenario.search = new URLSearchParams({hestiaPrototype: "1", hvpScenario: "rock-arm", hvpMeasure: "1"});
  await page.goto(scenario.href);
  await page.waitForFunction(() => document.querySelector("#hvp-state")?.textContent.includes("State: Ready"), null, {timeout: 150000});
  const initial = await read();
  assert.equal(initial.generation, 0);
  assert.equal(initial.fragments.length, 0);
  await pressButton("Stütze anvisieren (2 + Klick)");
  await pressButton("Spielen · WASD / Maus / Space");
  await waitState("normal support preview", s => s.locked && s.status === "Running" && s.player.grounded && s.tool.message.startsWith("64 Stützzellen"), 30000);
  await page.mouse.down();
  await page.mouse.up();
  const firstClick = await page.evaluate(() => window.readObservedPlayerInput().clicks.at(-1));
  assert.ok(firstClick?.trusted && firstClick.locked === "debug-scene" && firstClick.target === "debug-scene");
  let lastSteer = 0;
  const first = await waitState("fall and native moving-body hit", async s => {
    const [fragment] = s.fragments;
    if (!fragment || s.open || !s.tool.message || s.lastNativeCommand === "Play" || s.tool.last?.status !== "Applied" || s.transaction !== "Idle" || s.status !== "Running" || !s.locked) return;
    if (!s.body || s.body.position.y >= -8 + fragment.centerOfMass.y - .2) return;
    if (s.moving.preview?.ownerId === fragment.ownerId && s.tool.message.startsWith("Loses Fragment")) return s;
    if (s.body.sleeping && s.camera && Date.now() - lastSteer > 500) {
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
  await cdp.send("Input.dispatchMouseEvent", {type:"mousePressed", button:"left", buttons:1, clickCount:1, x:firstClick.x, y:firstClick.y});
  await cdp.send("Input.dispatchMouseEvent", {type:"mouseReleased", button:"left", buttons:0, clickCount:1, x:firstClick.x, y:firstClick.y});
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
  report.rootRevision = after.generation;
  report.testBridgePresent = after.bridge;
  assert.equal(after.bridge, false);
  assert.deepEqual(report.pageErrors, []);
  const observed = await page.evaluate(() => window.readObservedPlayerInput());
  assert.equal(observed.clicks.filter(click => click.trusted && click.target === "debug-scene" && click.locked === "debug-scene").length, 2);
  if (!allowResume) assert.deepEqual(observed.holds, []);
  report.passed = true;
} catch (error) {
  report.error = String(error.stack ?? error);
  const terminal = await read().catch(() => null);
  if (terminal) report.terminal = {status: terminal.status, moving: terminal.moving, tool: terminal.tool, tick: terminal.tick};
  process.exitCode = 1;
} finally {
  report.input = await page.evaluate(() => window.readObservedPlayerInput()).catch(() => null);
  report.worker = page.workers().find(w => w.url().includes("physicsWorker"))?.url();
  if (report.input) {
    const first = report.input.clicks.find(c => c.handled && c.trusted);
    report.holdsAfterFirstClick = report.input.holds.filter(h => first && h.origin + h.at >= first.absoluteMs);
  }
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
