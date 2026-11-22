// Run against a built Vite preview. CHROMIUM_BIN can select an installed target browser.
import assert from "node:assert/strict";
import {chromium} from "playwright";

const target = new URL("/?hestiaPrototype=1&hvpMeasure=1&hvpScenario=rock-arm",
  process.argv[2] ?? "http://127.0.0.1:4173");
const planner = process.env.HVP_CUT_PLANNER ?? "indexed";
if (planner !== "indexed" && planner !== "oracle") throw new Error("Invalid HVP_CUT_PLANNER");
if (planner === "oracle") target.searchParams.set("hvpCutPlanner", planner);
const visual=process.env.HVP_CUT_VISUAL;
if (visual && visual!=="worker" && visual!=="local") throw new Error("Invalid HVP_CUT_VISUAL");
if (visual) target.searchParams.set("hvpCutVisual",visual);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_BIN,
  args: process.env.HVP_SOFTWARE_RENDERER === "1" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  const loadedAssets=[];
  page.on("requestfinished", r => {const n=new URL(r.url()).pathname;if(n.startsWith("/assets/"))loadedAssets.push(n);});
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    const metrics = new Map();
    const phases=[];
    const keep = new Set(["hvp.cutDomInputToPhysicsPublishedMs", "hvp.cutInputToAppliedMs", "hvp.cutFirstCommittedRenderSubmitMs"]);
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.name.startsWith("hvp.cut") || entry.detail?.data?.commandId) phases.push({name:entry.name,startTime:entry.startTime,duration:entry.duration,detail:entry.detail});
        if (keep.has(entry.name)) metrics.set(entry.name, {startTime:entry.startTime, duration:entry.duration, detail:entry.detail});
      }
    });
    observer.observe({type:"measure"});
    let eventTimeStamp;
    document.addEventListener("mousedown", event => {
      if (event.isTrusted && event.button === 0 && document.pointerLockElement === event.target) eventTimeStamp = event.timeStamp;
    }, true);
    window.readCutPublication = () => ({eventTimeStamp, metrics:Object.fromEntries(metrics), phases});
  });
  await page.goto(target.href);
  await page.waitForFunction(() => document.querySelector("#hvp-state")?.textContent.includes("State: Ready"), null, {timeout:65000});
  await page.getByRole("button", {name:"Stütze anvisieren (2 + Klick)", exact:true}).press("Enter");
  await page.getByRole("button", {name:"Spielen · WASD / Maus / Space", exact:true}).press("Enter");
  await page.waitForFunction(() => document.pointerLockElement?.id === "debug-scene"
    && JSON.parse(document.body.dataset.hestiaPrototypePhysics).player.grounded
    && JSON.parse(document.body.dataset.hestiaPrototypeTool).message.startsWith("64 Stützzellen"), null, {timeout:35000});
  await page.mouse.down();
  await page.mouse.up();
  try {
    await page.waitForFunction(() => {
      const last=JSON.parse(document.body.dataset.hestiaPrototypeTool || "{}").last;
      if (!last) return false;
      return last.status!=="Applied" || Boolean(window.readCutPublication().metrics["hvp.cutFirstCommittedRenderSubmitMs"]);
    }, null, {timeout:40000});
    const outcome=await page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypeTool).last);
    assert.equal(outcome.status,"Applied",JSON.stringify(outcome));
  } catch (error) {
    try {
      const diagnostic = await page.evaluate(() => {
        const data = document.body.dataset;
        const owner = JSON.parse(data.hestiaPrototypePhysics || "{}");
        return {tool:JSON.parse(data.hestiaPrototypeTool || "{}"), status:owner.status,
          terrainTransaction:owner.terrainTransaction, generation:owner.terrainGeneration,
          metrics:window.readCutPublication().metrics, phases:window.readCutPublication().phases.map(e => [e.name,e.duration])};
      });
      console.error(JSON.stringify(diagnostic));
    } catch (diagnosticError) {
      console.error("Could not read the terminal browser state",String(diagnosticError));
    }
    throw error;
  }
  const state = await page.evaluate(() => {
    const data = document.body.dataset;
    const physics = JSON.parse(data.hestiaPrototypePhysics);
    const gl = document.querySelector("#debug-scene").getContext("webgl2");
    const extension = gl?.getExtension("WEBGL_debug_renderer_info");
    return {...window.readCutPublication(), testBridgePresent:"TestBridge" in window, fragments:physics.terrainFragments, result:JSON.parse(data.hestiaPrototypeTool).last,
      renderer:extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null,
      nativeGeneration:physics.terrainGeneration, transaction:physics.terrainTransaction,
      fragmentCells:physics.terrainFragments.map(f => f.cellCount)};
  });
  const ack = state.metrics["hvp.cutDomInputToPhysicsPublishedMs"];
  const submit = state.metrics["hvp.cutFirstCommittedRenderSubmitMs"];
  assert.ok(Number.isFinite(state.eventTimeStamp) && ack && submit);
  assert.equal(ack.startTime, state.eventTimeStamp);
  assert.equal(ack.detail.data.commandId, state.result.commandId);
  assert.equal(submit.detail.data.commandId, state.result.commandId);
  assert.ok(ack.duration >= 0 && submit.startTime + submit.duration >= ack.startTime + ack.duration - 0.01);
  assert.equal(state.transaction, "Idle");
  assert.equal(state.result.revision, 1);
  assert.equal(state.result.revision, ack.detail.data.revision);
  assert.equal(state.nativeGeneration, ack.detail.data.nativeGeneration);
  assert.equal(state.nativeGeneration, state.result.revision);
  assert.equal(state.result.removedCells, 64);
  assert.deepEqual(state.fragmentCells, [384]);
  assert.equal(state.result.transferredMassKg, 1722.65625);
  assert.deepEqual(errors, []);
  assert.equal(state.testBridgePresent, false);
  assert.equal(ack.detail.data.sourceDigest, submit.detail.data.savedDigest);
  if(process.env.QA_SHOT) await page.screenshot({path:process.env.QA_SHOT,timeout:30000});
  console.log(JSON.stringify({browser:browser.version(), target:target.pathname+target.search, loadedAssets:[...new Set(loadedAssets)].sort(), ...state,
    domToSubmitMs:submit.startTime + submit.duration - state.eventTimeStamp,
    within10ms:ack.duration <= 10, presentMeasured:false}, null, 2));
} finally {
  await browser.close();
}
